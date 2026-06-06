import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/hooks/useAuth";
import SendToAccountingDialog from "@/features/admin/components/SendToAccountingDialog";
import {
  Wrench, Clock, CheckCircle, Package, AlertTriangle, Search,
  LayoutGrid, List, BarChart3, User, Phone, Monitor, ArrowRight,
  Receipt, Send
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; kanbanOrder: number }> = {
  pending: { label: "Pendiente", color: "border-warning/40 bg-warning/5", icon: Clock, kanbanOrder: 0 },
  in_progress: { label: "En Proceso", color: "border-info/40 bg-info/5", icon: Wrench, kanbanOrder: 1 },
  waiting_parts: { label: "Esp. Repuestos", color: "border-accent/40 bg-accent/5", icon: Package, kanbanOrder: 2 },
  completed: { label: "Completado", color: "border-success/40 bg-success/5", icon: CheckCircle, kanbanOrder: 3 },
  delivered: { label: "Entregado", color: "border-muted bg-muted/30", icon: CheckCircle, kanbanOrder: 4 },
  cancelled: { label: "Cancelado", color: "border-destructive/40 bg-destructive/5", icon: AlertTriangle, kanbanOrder: 5 },
};

const KANBAN_STATUSES = ["pending", "in_progress"];

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  low: { label: "Baja", color: "bg-muted text-muted-foreground" },
  normal: { label: "Normal", color: "bg-primary/20 text-primary" },
  high: { label: "Alta", color: "bg-warning/20 text-warning" },
  urgent: { label: "Urgente", color: "bg-destructive/20 text-destructive" },
};

const SupportPage = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [view, setView] = useState<"kanban" | "list" | "dashboard">("kanban");
  const [search, setSearch] = useState("");
  const [filterTech, setFilterTech] = useState("all");

  // Send to accounting dialog
  const [sendToAccOpen, setSendToAccOpen] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<any>(null);

  // Fetch all service orders
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["support_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  // Fetch profiles for technician names
  const { data: profilesMap = {} } = useQuery({
    queryKey: ["profiles_map_support"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      const m: Record<string, string> = {};
      (data || []).forEach((p: any) => { if (p.user_id && p.full_name) m[p.user_id] = p.full_name; });
      return m;
    },
  });

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === "completed") updates.completed_at = new Date().toISOString();
      if (status === "delivered") updates.delivered_at = new Date().toISOString();
      if (status === "in_progress" && !orders.find(o => o.id === id)?.assigned_technician_id) {
        updates.assigned_technician_id = user?.id || null;
      }
      const { error } = await supabase.from("service_orders").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support_orders"] });
      toast.success("Estado actualizado");
    },
  });

  // Handle status change — when completing, open the rich "send to accounting" dialog
  const handleStatusChange = (order: any, nextStatus: string) => {
    if (nextStatus === "completed") {
      setPendingOrder(order);
      setSendToAccOpen(true);
    } else {
      updateStatusMutation.mutate({ id: order.id, status: nextStatus });
    }
  };

  // Technician list for filter
  const techList = useMemo(() => {
    const ids = new Set<string>();
    orders.forEach((o: any) => { if (o.assigned_technician_id) ids.add(o.assigned_technician_id); if (o.received_by_id) ids.add(o.received_by_id); });
    return Array.from(ids).map(id => ({ id, name: profilesMap[id] || id.slice(0, 8) }));
  }, [orders, profilesMap]);

  // Filtered orders
  const filtered = useMemo(() => {
    return orders.filter((o: any) => {
      const matchSearch = !search ||
        o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        o.device_type?.toLowerCase().includes(search.toLowerCase()) ||
        o.device_brand?.toLowerCase().includes(search.toLowerCase()) ||
        String(o.order_number).includes(search);
      const matchTech = filterTech === "all" || filterTech === "mine"
        ? (filterTech === "all" || o.assigned_technician_id === user?.id || o.received_by_id === user?.id)
        : (o.assigned_technician_id === filterTech || o.received_by_id === filterTech);
      return matchSearch && matchTech;
    });
  }, [orders, search, filterTech, user]);

  // Dashboard metrics
  const metrics = useMemo(() => {
    const myOrders = orders.filter((o: any) => o.assigned_technician_id === user?.id || o.received_by_id === user?.id);
    const today = new Date().toISOString().split("T")[0];
    return {
      totalActive: orders.filter((o: any) => !["delivered", "cancelled"].includes(o.status)).length,
      myPending: myOrders.filter((o: any) => o.status === "pending").length,
      myInProgress: myOrders.filter((o: any) => o.status === "in_progress").length,
      myCompleted: myOrders.filter((o: any) => o.status === "completed").length,
      completedToday: orders.filter((o: any) => o.completed_at?.startsWith(today)).length,
      urgent: orders.filter((o: any) => o.priority === "urgent" && !["delivered", "cancelled"].includes(o.status)).length,
    };
  }, [orders, user]);

  const getNextStatus = (current: string): string | null => {
    const flow: Record<string, string> = { pending: "in_progress", in_progress: "completed", completed: "delivered" };
    return flow[current] || null;
  };

  // ─── Order Card ────────────────────────────────────────────────
  const OrderCard = ({ order, compact = false }: { order: any; compact?: boolean }) => {
    const st = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
    const pr = PRIORITY_MAP[order.priority] || PRIORITY_MAP.normal;
    const techName = order.assigned_technician_id ? profilesMap[order.assigned_technician_id] : null;
    const nextStatus = getNextStatus(order.status);

    return (
      <Card className={`${st.color} border transition-all hover:shadow-md`}>
        <CardContent className={compact ? "p-3" : "p-4"}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">#{order.order_number}</span>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${pr.color}`}>{pr.label}</Badge>
            </div>
            {nextStatus && (
              <Button
                variant={nextStatus === "completed" ? "default" : "ghost"}
                size="sm"
                className="h-6 text-xs gap-1"
                onClick={() => handleStatusChange(order, nextStatus)}
              >
                {nextStatus === "completed"
                  ? <><Send className="h-3 w-3" /> Mandar a Contabilidad</>
                  : <><ArrowRight className="h-3 w-3" /> {STATUS_CONFIG[nextStatus]?.label}</>}
              </Button>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-sm">
              <User className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="font-medium truncate">{order.customer_name}</span>
            </div>
            {order.customer_phone && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone className="h-3 w-3 shrink-0" />
                <span>{order.customer_phone}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Monitor className="h-3 w-3 shrink-0" />
              <span className="truncate">{order.device_type} {order.device_brand ? `- ${order.device_brand}` : ""} {order.device_model || ""}</span>
            </div>
          </div>

          {!compact && order.reported_issue && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2 border-t border-border/50 pt-2">
              {order.reported_issue}
            </p>
          )}

          <div className="flex items-center justify-between mt-2 pt-1">
            {techName && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Wrench className="h-3 w-3" /> {techName}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto">
              {new Date(order.received_at || order.created_at).toLocaleDateString("es-PE")}
            </span>
          </div>

          {order.estimated_cost && (
            <p className="text-xs font-bold text-primary mt-1">S/ {Number(order.estimated_cost).toFixed(2)}</p>
          )}
        </CardContent>
      </Card>
    );
  };

  // ─── Kanban View ──────────────────────────────────────────────
  const KanbanView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {KANBAN_STATUSES.map(statusKey => {
        const config = STATUS_CONFIG[statusKey];
        const columnOrders = filtered.filter((o: any) => o.status === statusKey);
        const StIcon = config.icon;
        return (
          <div key={statusKey} className="space-y-3">
            <div className={`flex items-center gap-2 p-2 rounded-lg ${config.color} border`}>
              <StIcon className="h-4 w-4" />
              <span className="font-semibold text-sm">{config.label}</span>
              <Badge variant="secondary" className="ml-auto text-xs">{columnOrders.length}</Badge>
            </div>
            <div className="space-y-2 min-h-[100px]">
              {columnOrders.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Sin órdenes</p>
              ) : (
                columnOrders.map((order: any) => (
                  <OrderCard key={order.id} order={order} compact />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ─── List View ────────────────────────────────────────────────
  const ListView = () => (
    <div className="space-y-2">
      {filtered.length === 0 ? (
        <Card className="border-dashed border-primary/20">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Wrench className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No hay órdenes que coincidan</p>
          </CardContent>
        </Card>
      ) : (
        filtered.map((order: any) => <OrderCard key={order.id} order={order} />)
      )}
    </div>
  );

  // ─── Dashboard View ───────────────────────────────────────────
  const DashboardView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Card className="border-primary/20"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{metrics.totalActive}</p><p className="text-xs text-muted-foreground">Activas Total</p></CardContent></Card>
        <Card className="border-warning/20"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-warning">{metrics.myPending}</p><p className="text-xs text-muted-foreground">Mis Pendientes</p></CardContent></Card>
        <Card className="border-info/20"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-info">{metrics.myInProgress}</p><p className="text-xs text-muted-foreground">Mis En Proceso</p></CardContent></Card>
        <Card className="border-success/20"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-success">{metrics.myCompleted}</p><p className="text-xs text-muted-foreground">Mis Completados</p></CardContent></Card>
        <Card className="border-success/20"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-success">{metrics.completedToday}</p><p className="text-xs text-muted-foreground">Completados Hoy</p></CardContent></Card>
        <Card className="border-destructive/20"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-destructive">{metrics.urgent}</p><p className="text-xs text-muted-foreground">Urgentes</p></CardContent></Card>
      </div>

      <Card className="border-primary/10">
        <CardHeader><CardTitle className="text-lg">Mis Órdenes Activas</CardTitle></CardHeader>
        <CardContent>
          {filtered.filter((o: any) => (o.assigned_technician_id === user?.id || o.received_by_id === user?.id) && !["delivered", "cancelled"].includes(o.status)).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No tienes órdenes activas</p>
          ) : (
            <div className="space-y-2">
              {filtered
                .filter((o: any) => (o.assigned_technician_id === user?.id || o.received_by_id === user?.id) && !["delivered", "cancelled"].includes(o.status))
                .map((order: any) => <OrderCard key={order.id} order={order} />)}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/10">
        <CardHeader><CardTitle className="text-lg">Órdenes de Otros Técnicos</CardTitle></CardHeader>
        <CardContent>
          {filtered.filter((o: any) => o.assigned_technician_id && o.assigned_technician_id !== user?.id && !["delivered", "cancelled"].includes(o.status)).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No hay órdenes de otros técnicos</p>
          ) : (
            <div className="space-y-2">
              {filtered
                .filter((o: any) => o.assigned_technician_id && o.assigned_technician_id !== user?.id && !["delivered", "cancelled"].includes(o.status))
                .map((order: any) => <OrderCard key={order.id} order={order} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Wrench className="h-6 w-6 text-primary" /> Soporte Técnico
        </h1>
        <div className="flex items-center gap-2">
          <Button variant={view === "kanban" ? "default" : "outline"} size="sm" className="gap-1" onClick={() => setView("kanban")}>
            <LayoutGrid className="h-4 w-4" /> Kanban
          </Button>
          <Button variant={view === "list" ? "default" : "outline"} size="sm" className="gap-1" onClick={() => setView("list")}>
            <List className="h-4 w-4" /> Lista
          </Button>
          <Button variant={view === "dashboard" ? "default" : "outline"} size="sm" className="gap-1" onClick={() => setView("dashboard")}>
            <BarChart3 className="h-4 w-4" /> Dashboard
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por cliente, equipo, N° orden..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterTech} onValueChange={setFilterTech}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los técnicos</SelectItem>
            <SelectItem value="mine">Mis órdenes</SelectItem>
            {techList.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {view === "kanban" && <KanbanView />}
          {view === "list" && <ListView />}
          {view === "dashboard" && <DashboardView />}
        </>
      )}

      {/* ─── Send to Accounting Dialog (rich, multi-item) ─── */}
      <SendToAccountingDialog
        open={sendToAccOpen}
        onOpenChange={(o) => { setSendToAccOpen(o); if (!o) setPendingOrder(null); }}
        order={pendingOrder}
        userId={user?.id}
        technicianName={pendingOrder?.assigned_technician_id ? profilesMap[pendingOrder.assigned_technician_id] : (user?.email || "")}
        onCompleted={() => qc.invalidateQueries({ queryKey: ["support_orders"] })}
      />
    </div>
  );
};

export default SupportPage;
