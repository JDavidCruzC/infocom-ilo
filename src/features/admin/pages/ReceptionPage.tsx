import { useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ClipboardList, Plus, Search, Clock, CheckCircle, Wrench, Package, AlertTriangle, Phone, User, Monitor, Pencil } from "lucide-react";
import PrintReceipt from "@/features/admin/components/PrintReceipt";
import DataImportExport from "@/features/admin/components/DataImportExport";
import CustomerSelector, { type CustomerLite } from "@/features/admin/components/CustomerSelector";
import CustomerDetailDialog from "@/features/admin/components/CustomerDetailDialog";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { notifyAllStaff } from "@/lib/notifications";
import { usePersistentDraft } from "@/hooks/use-persistent-draft";

const RECEPTION_COLUMNS = [
  { key: "customer_name", label: "Cliente" }, { key: "customer_phone", label: "Telefono" },
  { key: "device_type", label: "Tipo Equipo" }, { key: "device_brand", label: "Marca" },
  { key: "device_model", label: "Modelo" }, { key: "reported_issue", label: "Falla Reportada" },
  { key: "priority", label: "Prioridad" }, { key: "estimated_cost", label: "Costo Estimado" },
];

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pendiente", color: "bg-warning/20 text-warning border-warning/30", icon: Clock },
  in_progress: { label: "En Proceso", color: "bg-info/20 text-info border-info/30", icon: Wrench },
  waiting_parts: { label: "Esperando Repuestos", color: "bg-accent/20 text-accent-foreground border-accent/30", icon: Package },
  completed: { label: "Completado", color: "bg-success/20 text-success border-success/30", icon: CheckCircle },
  delivered: { label: "Entregado", color: "bg-muted text-muted-foreground border-border", icon: CheckCircle },
  cancelled: { label: "Cancelado", color: "bg-destructive/20 text-destructive border-destructive/30", icon: AlertTriangle },
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  low: { label: "Baja", color: "bg-muted text-muted-foreground" },
  normal: { label: "Normal", color: "bg-primary/20 text-primary" },
  high: { label: "Alta", color: "bg-warning/20 text-warning" },
  urgent: { label: "Urgente", color: "bg-destructive/20 text-destructive" },
};

const emptyForm = {
  customer_name: "", customer_phone: "", customer_email: "",
  device_type: "", device_brand: "", device_model: "",
  accessories: "", reported_issue: "", priority: "normal",
  estimated_cost: "", notes: "", diagnosis: "", final_cost: "",
  received_by_id: "", spare_parts: "",
};

const ReceptionPage = () => {
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewCustomerName, setViewCustomerName] = useState<string | null>(null);

  const restoreDraft = useCallback((draft: { editingId: string | null; form: typeof emptyForm }) => {
    if (!draft?.form) return;
    setForm({ ...emptyForm, ...draft.form });
    setEditingId(draft.editingId ?? null);
    setDialogOpen(true);
    toast.info("Se restauró tu borrador de recepción técnica");
  }, []);

  const { clearDraft } = usePersistentDraft({
    storageKey: "admin:reception:draft",
    enabled: dialogOpen,
    value: { form, editingId },
    isEmpty: (draft) => !draft.editingId && JSON.stringify(draft.form) === JSON.stringify(emptyForm),
    onRestore: restoreDraft,
  });

  const openNew = () => {
    clearDraft();
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  // Fetch staff to show received_by name
  const { data: staffMap = {} } = useQuery({
    queryKey: ["staff_by_user"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      const m: Record<string, string> = {};
      (data || []).forEach((p: any) => { if (p.user_id && p.full_name) m[p.user_id] = p.full_name; });
      return m;
    },
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["service_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (formData: typeof emptyForm) => {
      const payload: any = {
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone || null,
        customer_email: formData.customer_email || null,
        device_type: formData.device_type,
        device_brand: formData.device_brand || null,
        device_model: formData.device_model || null,
        accessories: formData.accessories || null,
        reported_issue: formData.reported_issue,
        priority: formData.priority,
        estimated_cost: formData.estimated_cost ? parseFloat(formData.estimated_cost) : null,
        final_cost: formData.final_cost ? parseFloat(formData.final_cost) : null,
        diagnosis: formData.diagnosis || null,
        notes: formData.notes || null,
        spare_parts: formData.spare_parts || null,
      };
      if (editingId) {
        if (formData.received_by_id) {
          payload.received_by_id = formData.received_by_id;
        }
        const { error } = await supabase.from("service_orders").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        payload.received_by_id = user?.id || null;
        const { error } = await supabase.from("service_orders").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service_orders"] });
      toast.success(editingId ? "Orden actualizada" : "Orden registrada");
      if (!editingId) {
        notifyAllStaff({
          title: "Nueva recepción técnica",
          message: `${form.customer_name} — ${form.device_type} ${form.device_brand} ${form.device_model}`.trim(),
          type: "service",
          link: "/admin/recepcion",
          excludeUserId: user?.id,
        });
      }
      clearDraft();
      setForm(emptyForm);
      setEditingId(null);
      setDialogOpen(false);
    },
    onError: () => toast.error("Error al guardar"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === "completed") updates.completed_at = new Date().toISOString();
      if (status === "delivered") updates.delivered_at = new Date().toISOString();
      const { error } = await supabase.from("service_orders").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service_orders"] });
      toast.success("Estado actualizado");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service_orders"] });
      toast.success("Orden eliminada");
      setSelectedOrder(null);
    },
  });

  const openEdit = (order: any) => {
    setForm({
      customer_name: order.customer_name || "",
      customer_phone: order.customer_phone || "",
      customer_email: order.customer_email || "",
      device_type: order.device_type || "",
      device_brand: order.device_brand || "",
      device_model: order.device_model || "",
      accessories: order.accessories || "",
      reported_issue: order.reported_issue || "",
      priority: order.priority || "normal",
      estimated_cost: order.estimated_cost ? String(order.estimated_cost) : "",
      final_cost: order.final_cost ? String(order.final_cost) : "",
      diagnosis: order.diagnosis || "",
      notes: order.notes || "",
      received_by_id: order.received_by_id || "",
      spare_parts: order.spare_parts || "",
    });
    setEditingId(order.id);
    setDialogOpen(true);
    setSelectedOrder(null);
  };

  const filtered = orders.filter((o: any) => {
    const matchSearch = !search ||
      o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.device_type?.toLowerCase().includes(search.toLowerCase()) ||
      o.device_brand?.toLowerCase().includes(search.toLowerCase()) ||
      String(o.order_number).includes(search);
    const matchStatus = filterStatus === "all" || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const pendingCount = orders.filter((o: any) => o.status === "pending").length;
  const inProgressCount = orders.filter((o: any) => o.status === "in_progress").length;
  const completedCount = orders.filter((o: any) => o.status === "completed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" /> Recepción Técnica
        </h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen} modal={false}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openNew}><Plus className="h-4 w-4" /> Nueva Orden</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" /> {editingId ? "Editar Orden" : "Registrar Equipo"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-6">
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-primary flex items-center gap-2"><User className="h-4 w-4" /> Datos del Cliente</h3>
                <CustomerSelector
                  value={form.customer_name ? { full_name: form.customer_name, phone: form.customer_phone, email: form.customer_email } as CustomerLite : null}
                  onChange={(c) => {
                    if (c) {
                      setForm({ ...form, customer_name: c.full_name, customer_phone: c.phone || "", customer_email: c.email || "" });
                    } else {
                      setForm({ ...form, customer_name: "", customer_phone: "", customer_email: "" });
                    }
                  }}
                  label="Buscar en directorio o crear nuevo"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label>Nombre *</Label><Input required value={form.customer_name} onChange={e => setForm({...form, customer_name: e.target.value})} placeholder="Nombre completo" /></div>
                  <div><Label>Teléfono</Label><Input value={form.customer_phone} onChange={e => setForm({...form, customer_phone: e.target.value})} placeholder="+51 999 999 999" /></div>
                  <div className="sm:col-span-2"><Label>Email</Label><Input type="email" value={form.customer_email} onChange={e => setForm({...form, customer_email: e.target.value})} placeholder="cliente@email.com" /></div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-primary flex items-center gap-2"><Monitor className="h-4 w-4" /> Datos del Equipo</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div><Label>Tipo de Equipo *</Label><Input required value={form.device_type} onChange={e => setForm({...form, device_type: e.target.value})} placeholder="Laptop, PC, Impresora..." /></div>
                  <div><Label>Marca</Label><Input value={form.device_brand} onChange={e => setForm({...form, device_brand: e.target.value})} placeholder="HP, Lenovo, Epson..." /></div>
                  <div><Label>Modelo</Label><Input value={form.device_model} onChange={e => setForm({...form, device_model: e.target.value})} placeholder="Modelo del equipo" /></div>
                </div>
                <div><Label>Accesorios</Label><Textarea value={form.accessories} onChange={e => setForm({...form, accessories: e.target.value})} placeholder="Cargador, mouse, bolsa..." rows={2} /></div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-primary flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Falla Reportada</h3>
                <Textarea required value={form.reported_issue} onChange={e => setForm({...form, reported_issue: e.target.value})} placeholder="Describir la falla..." rows={3} />
              </div>

              {editingId && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-primary flex items-center gap-2"><Wrench className="h-4 w-4" /> Diagnóstico Técnico</h3>
                  <Textarea value={form.diagnosis} onChange={e => setForm({...form, diagnosis: e.target.value})} placeholder="Diagnóstico del técnico..." rows={2} />
                  <h3 className="font-semibold text-sm text-primary flex items-center gap-2"><Package className="h-4 w-4" /> Repuestos Utilizados</h3>
                  <Textarea value={form.spare_parts} onChange={e => setForm({...form, spare_parts: e.target.value})} placeholder="Ej: Pantalla 15.6 HD, Teclado español, Pasta térmica..." rows={2} />
                </div>
              )}

              {editingId && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-primary flex items-center gap-2"><User className="h-4 w-4" /> Recepciono</h3>
                  <Select value={form.received_by_id} onValueChange={v => setForm({...form, received_by_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar personal" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(staffMap).map(([uid, name]) => (
                        <SelectItem key={uid} value={uid}>{name as string}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Cualquier personal puede ajustar quién recepcionó el equipo.</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label>Prioridad</Label>
                  <Select value={form.priority} onValueChange={v => setForm({...form, priority: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">🟢 Baja</SelectItem>
                      <SelectItem value="normal">🔵 Normal</SelectItem>
                      <SelectItem value="high">🟠 Alta</SelectItem>
                      <SelectItem value="urgent">🔴 Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Costo Estimado (S/.)</Label><Input type="number" step="0.01" value={form.estimated_cost} onChange={e => setForm({...form, estimated_cost: e.target.value})} placeholder="0.00" /></div>
                <div><Label>Costo Final (S/.)</Label><Input type="number" step="0.01" value={form.final_cost} onChange={e => setForm({...form, final_cost: e.target.value})} placeholder="0.00" /></div>
              </div>
              <div><Label>Notas adicionales</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Observaciones internas..." rows={2} /></div>
              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Guardando..." : editingId ? "Guardar Cambios" : "Registrar Orden de Servicio"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-warning/20"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-warning">{pendingCount}</p><p className="text-xs text-muted-foreground">Pendientes</p></CardContent></Card>
        <Card className="border-info/20"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-info">{inProgressCount}</p><p className="text-xs text-muted-foreground">En Proceso</p></CardContent></Card>
        <Card className="border-success/20"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-success">{completedCount}</p><p className="text-xs text-muted-foreground">Completados</p></CardContent></Card>
        <Card className="border-primary/20"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{orders.length}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por cliente, equipo, N orden..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <DataImportExport
          columns={RECEPTION_COLUMNS}
          data={orders}
          filenamePrefix="recepcion_tecnica"
          templateDescription="Cada fila es una orden de servicio. Prioridad: low, normal, high, urgent."
          onImport={async (rows) => {
            const payload = rows.map(r => ({
              customer_name: r.customer_name || "",
              customer_phone: r.customer_phone || null,
              device_type: r.device_type || "Equipo",
              device_brand: r.device_brand || null,
              device_model: r.device_model || null,
              reported_issue: r.reported_issue || "Sin especificar",
              priority: r.priority || "normal",
              estimated_cost: parseFloat(r.estimated_cost) || null,
              received_by_id: user?.id || null,
            }));
            const { error } = await supabase.from("service_orders").insert(payload);
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ["service_orders"] });
          }}
        />
      </div>

      {/* Orders list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-primary/20"><CardContent className="py-12 text-center text-muted-foreground"><ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No hay órdenes de servicio</p></CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((order: any) => {
            const st = STATUS_MAP[order.status] || STATUS_MAP.pending;
            const pr = PRIORITY_MAP[order.priority] || PRIORITY_MAP.normal;
            const StIcon = st.icon;
            const receivedBy = order.received_by_id ? (staffMap[order.received_by_id] || "Usuario") : "—";
            return (
              <Card key={order.id} className="border-primary/10 hover:border-primary/30 transition-colors cursor-pointer" onClick={() => setSelectedOrder(order)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display font-bold text-primary">#{order.order_number}</span>
                        <Badge variant="outline" className={`text-xs ${st.color}`}><StIcon className="h-3 w-3 mr-1" />{st.label}</Badge>
                        <Badge variant="outline" className={`text-xs ${pr.color}`}>{pr.label}</Badge>
                      </div>
                      <p className="font-semibold">{order.customer_name}</p>
                      <p className="text-sm text-muted-foreground">{order.device_type} {order.device_brand && `• ${order.device_brand}`} {order.device_model && `• ${order.device_model}`}</p>
                      <p className="text-sm line-clamp-1">{order.reported_issue}</p>
                      <p className="text-xs text-muted-foreground">Recepcionó: <span className="text-foreground font-medium">{receivedBy}</span></p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground space-y-1 shrink-0">
                      <p>{new Date(order.received_at).toLocaleDateString("es-PE")}</p>
                      {order.estimated_cost && <p className="font-semibold text-foreground">S/. {Number(order.estimated_cost).toFixed(2)}</p>}
                      {order.customer_phone && <a href={`tel:${order.customer_phone}`} className="flex items-center gap-1 text-primary hover:underline justify-end" onClick={e => e.stopPropagation()}><Phone className="h-3 w-3" />{order.customer_phone}</a>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedOrder && (() => {
            const receivedBy = selectedOrder.received_by_id ? (staffMap[selectedOrder.received_by_id] || "Usuario") : "—";
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <span className="text-primary">#{selectedOrder.order_number}</span> — {selectedOrder.customer_name}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-muted-foreground">Teléfono:</span><p>{selectedOrder.customer_phone || "—"}</p></div>
                    <div><span className="text-muted-foreground">Email:</span><p>{selectedOrder.customer_email || "—"}</p></div>
                    <div><span className="text-muted-foreground">Equipo:</span><p>{selectedOrder.device_type}</p></div>
                    <div><span className="text-muted-foreground">Marca / Modelo:</span><p>{selectedOrder.device_brand || "—"} / {selectedOrder.device_model || "—"}</p></div>
                  </div>
                  <div><span className="text-muted-foreground">Accesorios:</span><p>{selectedOrder.accessories || "Ninguno"}</p></div>
                  <div><span className="text-muted-foreground">Falla Reportada:</span><p className="font-medium">{selectedOrder.reported_issue}</p></div>
                  <div><span className="text-muted-foreground">Diagnóstico:</span><p>{selectedOrder.diagnosis || "Pendiente"}</p></div>
                  {selectedOrder.spare_parts && <div><span className="text-muted-foreground">Repuestos Utilizados:</span><p className="font-medium text-primary">{selectedOrder.spare_parts}</p></div>}
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-muted-foreground">Costo Estimado:</span><p>{selectedOrder.estimated_cost ? `S/. ${Number(selectedOrder.estimated_cost).toFixed(2)}` : "—"}</p></div>
                    <div><span className="text-muted-foreground">Costo Final:</span><p>{selectedOrder.final_cost ? `S/. ${Number(selectedOrder.final_cost).toFixed(2)}` : "—"}</p></div>
                  </div>
                  <div><span className="text-muted-foreground">Recepcionó:</span><p className="font-medium">{receivedBy}</p></div>
                  <div><span className="text-muted-foreground">Notas:</span><p>{selectedOrder.notes || "—"}</p></div>
                  <div><span className="text-muted-foreground">Recibido:</span><p>{new Date(selectedOrder.received_at).toLocaleString("es-PE")}</p></div>

                  <div className="pt-2 border-t border-border space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      <PrintReceipt order={selectedOrder} />
                      {selectedOrder.customer_name && (
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => setViewCustomerName(selectedOrder.customer_name)}>
                          <User className="h-4 w-4" /> Ver Cliente
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => openEdit(selectedOrder)}>
                        <Pencil className="h-4 w-4" /> Editar Orden
                      </Button>
                      {isAdmin && (
                        <Button variant="destructive" size="sm" onClick={() => { if (confirm("¿Eliminar esta orden?")) deleteMutation.mutate(selectedOrder.id); }}>
                          Eliminar
                        </Button>
                      )}
                    </div>
                    <div>
                      <Label>Cambiar Estado</Label>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(STATUS_MAP).map(([k, v]) => (
                          <Button key={k} size="sm" variant={selectedOrder.status === k ? "default" : "outline"} className="text-xs gap-1" disabled={selectedOrder.status === k}
                            onClick={() => { updateStatusMutation.mutate({ id: selectedOrder.id, status: k }); setSelectedOrder({ ...selectedOrder, status: k }); }}>
                            {v.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Customer Detail Dialog */}
      <CustomerDetailDialog
        customerId={null}
        customerName={viewCustomerName}
        onClose={() => setViewCustomerName(null)}
      />
    </div>
  );
};

export default ReceptionPage;
