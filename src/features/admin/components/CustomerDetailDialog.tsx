import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  User, Phone, Mail, IdCard, MapPin, Star, Calendar, ShoppingCart,
  Wrench, TrendingUp, Award, Receipt, Crown, ChevronDown, ChevronRight,
  Package, Sparkles, TrendingDown
} from "lucide-react";

interface Props {
  customerId: string | null;
  customerName?: string | null;
  onClose: () => void;
}

const CURRENCY = "S/. ";

export const CustomerDetailDialog = ({ customerId, customerName, onClose }: Props) => {
  const open = !!(customerId || customerName);

  // Fetch customer record (by id, fallback to name)
  const { data: customer } = useQuery({
    queryKey: ["customer_detail", customerId, customerName],
    queryFn: async () => {
      if (customerId) {
        const { data } = await supabase.from("customers").select("*").eq("id", customerId).maybeSingle();
        return data;
      }
      if (customerName) {
        const { data } = await supabase.from("customers").select("*").ilike("full_name", customerName).maybeSingle();
        return data;
      }
      return null;
    },
    enabled: open,
  });

  const matchName = customer?.full_name || customerName || "";

  // Fetch transactions by customer name (case-insensitive)
  const { data: transactions = [] } = useQuery({
    queryKey: ["customer_transactions", matchName],
    queryFn: async () => {
      if (!matchName) return [];
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .ilike("cliente_nombre", matchName)
        .order("fecha", { ascending: false });
      return data || [];
    },
    enabled: !!matchName && open,
  });

  // Fetch service orders by customer name
  const { data: serviceOrders = [] } = useQuery({
    queryKey: ["customer_service_orders", matchName],
    queryFn: async () => {
      if (!matchName) return [];
      const { data } = await supabase
        .from("service_orders")
        .select("*")
        .ilike("customer_name", matchName)
        .order("received_at", { ascending: false });
      return data || [];
    },
    enabled: !!matchName && open,
  });

  // Fetch all transaction items for emitted ones (for spending breakdown)
  const emitted = transactions.filter((t: any) => t.estado === "emitido");
  const emittedIds = emitted.map((t: any) => t.id);

  const { data: allItems = [] } = useQuery({
    queryKey: ["customer_tx_items", emittedIds.join(",")],
    queryFn: async () => {
      if (emittedIds.length === 0) return [];
      const { data } = await supabase
        .from("transaction_items")
        .select("*")
        .in("transaction_id", emittedIds);
      return data || [];
    },
    enabled: emittedIds.length > 0 && open,
  });

  const itemsByTx = useMemo(() => {
    const map: Record<string, any[]> = {};
    (allItems as any[]).forEach((it) => {
      (map[it.transaction_id] ||= []).push(it);
    });
    return map;
  }, [allItems]);

  const [expandedTx, setExpandedTx] = useState<Set<string>>(new Set());
  const toggleTx = (id: string) => {
    setExpandedTx((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const metrics = useMemo(() => {
    const totalSpent = emitted.reduce((a: number, t: any) => a + Number(t.total || 0), 0);
    const totalProductos = emitted.reduce((a: number, t: any) => a + Number(t.subtotal_productos || 0), 0);
    const totalServicios = emitted.reduce((a: number, t: any) => a + Number(t.subtotal_servicios || 0), 0);
    const numCompras = emitted.length;
    const ticketPromedio = numCompras > 0 ? totalSpent / numCompras : 0;
    const ultimaCompra = emitted[0]?.fecha || null;
    const techOrders = serviceOrders.length;
    const totalUnidades = (allItems as any[]).reduce((a, it) => a + Number(it.cantidad || 0), 0);
    return { totalSpent, totalProductos, totalServicios, numCompras, ticketPromedio, ultimaCompra, techOrders, totalUnidades };
  }, [emitted, serviceOrders, allItems]);

  // Aggregate items by description
  const itemRanking = useMemo(() => {
    const map = new Map<string, { descripcion: string; item_type: string; cantidad: number; total: number; ultimo: string; veces: number }>();
    (allItems as any[]).forEach((it) => {
      const key = `${it.item_type}::${it.descripcion}`;
      const tx = transactions.find((t: any) => t.id === it.transaction_id);
      const fecha = tx?.fecha || "";
      const prev = map.get(key);
      if (prev) {
        prev.cantidad += Number(it.cantidad || 0);
        prev.total += Number(it.subtotal || 0);
        prev.veces += 1;
        if (fecha > prev.ultimo) prev.ultimo = fecha;
      } else {
        map.set(key, {
          descripcion: it.descripcion,
          item_type: it.item_type,
          cantidad: Number(it.cantidad || 0),
          total: Number(it.subtotal || 0),
          veces: 1,
          ultimo: fecha,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [allItems, transactions]);

  // Loyalty tier
  const tier = metrics.numCompras >= 20
    ? { label: "Premium", icon: Crown, className: "bg-primary/20 text-primary border-primary/40" }
    : metrics.numCompras >= 10
    ? { label: "Fiel", icon: Award, className: "bg-yellow-500/20 text-yellow-600 border-yellow-500/40" }
    : metrics.numCompras >= 5
    ? { label: "Frecuente", icon: Star, className: "bg-blue-500/20 text-blue-500 border-blue-500/40" }
    : { label: "Nuevo", icon: User, className: "bg-muted text-muted-foreground" };
  const TierIcon = tier.icon;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${customer?.is_vip ? "bg-yellow-500/20" : "bg-primary/10"}`}>
              {customer?.is_vip ? <Star className="h-5 w-5 text-yellow-500" /> : <User className="h-5 w-5 text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold truncate">{matchName || "Cliente"}</span>
                {customer?.is_vip && <Badge className="bg-yellow-500/20 text-yellow-600 text-[10px]">VIP</Badge>}
                <Badge variant="outline" className={`text-[10px] gap-1 ${tier.className}`}>
                  <TierIcon className="h-3 w-3" /> {tier.label}
                </Badge>
              </div>
              {!customer && matchName && (
                <p className="text-[10px] text-muted-foreground font-normal mt-0.5">
                  Cliente no registrado en el directorio
                </p>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Personal data */}
        {customer && (
          <Card className="border-primary/10">
            <CardContent className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {customer.phone && (
                <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-primary" /><span className="text-muted-foreground">Tel:</span> <span className="font-medium">{customer.phone}</span></div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-primary" /><span className="text-muted-foreground">Email:</span> <span className="font-medium truncate">{customer.email}</span></div>
              )}
              {customer.document_number && (
                <div className="flex items-center gap-2"><IdCard className="h-3.5 w-3.5 text-primary" /><span className="text-muted-foreground">DNI:</span> <span className="font-medium">{customer.document_number}</span></div>
              )}
              {customer.address && (
                <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-primary" /><span className="text-muted-foreground">Dir:</span> <span className="font-medium truncate">{customer.address}</span></div>
              )}
              {customer.notes && (
                <div className="col-span-full text-muted-foreground italic">📝 {customer.notes}</div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Metrics grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Card className="border-success/20">
            <CardContent className="p-3 text-center">
              <TrendingUp className="h-4 w-4 mx-auto mb-1 text-success" />
              <p className="text-lg font-bold text-success">{CURRENCY}{metrics.totalSpent.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">Total gastado</p>
            </CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardContent className="p-3 text-center">
              <Receipt className="h-4 w-4 mx-auto mb-1 text-primary" />
              <p className="text-lg font-bold">{metrics.numCompras}</p>
              <p className="text-[10px] text-muted-foreground">Transacciones</p>
            </CardContent>
          </Card>
          <Card className="border-info/20">
            <CardContent className="p-3 text-center">
              <ShoppingCart className="h-4 w-4 mx-auto mb-1 text-info" />
              <p className="text-lg font-bold">{CURRENCY}{metrics.ticketPromedio.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">Ticket promedio</p>
            </CardContent>
          </Card>
          <Card className="border-amber-500/20">
            <CardContent className="p-3 text-center">
              <Calendar className="h-4 w-4 mx-auto mb-1 text-amber-500" />
              <p className="text-xs font-bold">{metrics.ultimaCompra ? new Date(metrics.ultimaCompra + "T12:00:00").toLocaleDateString("es-PE") : "—"}</p>
              <p className="text-[10px] text-muted-foreground">Última compra</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs: detalle items + transactions + service orders */}
        <Tabs defaultValue="detalle">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="detalle" className="gap-1 text-xs">
              <Package className="h-3 w-3" /> Detalle ({itemRanking.length})
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-1 text-xs">
              <Receipt className="h-3 w-3" /> Transacciones ({transactions.length})
            </TabsTrigger>
            <TabsTrigger value="services" className="gap-1 text-xs">
              <Wrench className="h-3 w-3" /> Órdenes Técnicas ({serviceOrders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="detalle" className="mt-3 space-y-3">
            {/* Resumen productos vs servicios */}
            <div className="grid grid-cols-3 gap-2">
              <Card className="border-primary/20">
                <CardContent className="p-3 text-center">
                  <Package className="h-4 w-4 mx-auto mb-1 text-primary" />
                  <p className="text-sm font-bold text-primary">{CURRENCY}{metrics.totalProductos.toFixed(2)}</p>
                  <p className="text-[10px] text-muted-foreground">Productos</p>
                </CardContent>
              </Card>
              <Card className="border-info/20">
                <CardContent className="p-3 text-center">
                  <Sparkles className="h-4 w-4 mx-auto mb-1 text-info" />
                  <p className="text-sm font-bold text-info">{CURRENCY}{metrics.totalServicios.toFixed(2)}</p>
                  <p className="text-[10px] text-muted-foreground">Servicios</p>
                </CardContent>
              </Card>
              <Card className="border-success/20">
                <CardContent className="p-3 text-center">
                  <ShoppingCart className="h-4 w-4 mx-auto mb-1 text-success" />
                  <p className="text-sm font-bold text-success">{metrics.totalUnidades}</p>
                  <p className="text-[10px] text-muted-foreground">Unidades totales</p>
                </CardContent>
              </Card>
            </div>

            {itemRanking.length === 0 ? (
              <p className="text-center text-muted-foreground text-xs py-6">Sin items registrados</p>
            ) : (
              <div className="border border-border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Descripción</TableHead>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs text-right">Cant.</TableHead>
                      <TableHead className="text-xs text-right">Veces</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">Última</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemRanking.map((it, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs max-w-[260px] truncate font-medium">{it.descripcion}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] capitalize ${it.item_type === "servicio" ? "border-info/40 text-info" : "border-primary/40 text-primary"}`}>
                            {it.item_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold">{it.cantidad}</TableCell>
                        <TableCell className="text-right text-xs">{it.veces}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                          {it.ultimo ? new Date(it.ultimo + "T12:00:00").toLocaleDateString("es-PE") : "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold text-success">{CURRENCY}{it.total.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="transactions" className="mt-3">
            {transactions.length === 0 ? (
              <p className="text-center text-muted-foreground text-xs py-6">Sin transacciones registradas</p>
            ) : (
              <div className="border border-border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-8"></TableHead>
                      <TableHead className="text-xs">Fecha</TableHead>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs">Estado</TableHead>
                      <TableHead className="text-xs text-right">Items</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((t: any) => {
                      const items = itemsByTx[t.id] || [];
                      const isOpen = expandedTx.has(t.id);
                      return (
                        <React.Fragment key={t.id}>
                          <TableRow
                            className={`${t.estado !== "emitido" ? "opacity-60" : ""} cursor-pointer`}
                            onClick={() => toggleTx(t.id)}
                          >
                            <TableCell className="p-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              </Button>
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              {new Date(t.fecha + "T12:00:00").toLocaleDateString("es-PE")}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] capitalize">{t.tipo_general}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={t.estado === "emitido" ? "default" : t.estado === "anulado" ? "destructive" : "secondary"} className="text-[10px] capitalize">
                                {t.estado}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-xs">{items.length}</TableCell>
                            <TableCell className="text-right font-bold text-xs">{CURRENCY}{Number(t.total).toFixed(2)}</TableCell>
                          </TableRow>
                          {isOpen && (
                            <TableRow key={`${t.id}-detail`} className="bg-muted/30 hover:bg-muted/30">
                              <TableCell colSpan={6} className="p-3">
                                {items.length === 0 ? (
                                  <p className="text-[11px] text-muted-foreground italic">Sin items detallados</p>
                                ) : (
                                  <div className="space-y-1">
                                    {items.map((it) => (
                                      <div key={it.id} className="flex items-center justify-between gap-3 text-xs py-1 border-b border-border/40 last:border-0">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          {it.item_type === "servicio"
                                            ? <Sparkles className="h-3 w-3 text-info shrink-0" />
                                            : <Package className="h-3 w-3 text-primary shrink-0" />}
                                          <span className="truncate font-medium">{it.descripcion}</span>
                                          {it.tipo_equipo && <span className="text-[10px] text-muted-foreground">({it.tipo_equipo})</span>}
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0 text-[11px]">
                                          <span className="text-muted-foreground">{it.cantidad} × {CURRENCY}{Number(it.precio_unitario).toFixed(2)}</span>
                                          <span className="font-bold text-success w-20 text-right">{CURRENCY}{Number(it.subtotal).toFixed(2)}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="services" className="mt-3">
            {serviceOrders.length === 0 ? (
              <p className="text-center text-muted-foreground text-xs py-6">Sin órdenes técnicas registradas</p>
            ) : (
              <div className="border border-border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">N°</TableHead>
                      <TableHead className="text-xs">Fecha</TableHead>
                      <TableHead className="text-xs">Equipo</TableHead>
                      <TableHead className="text-xs">Estado</TableHead>
                      <TableHead className="text-xs text-right">Costo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {serviceOrders.map((o: any) => (
                      <TableRow key={o.id}>
                        <TableCell className="text-xs font-mono">#{o.order_number}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(o.received_at).toLocaleDateString("es-PE")}
                        </TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate">
                          {o.device_type} {o.device_brand} {o.device_model}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{o.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold">
                          {o.final_cost ? `${CURRENCY}${Number(o.final_cost).toFixed(2)}` : (o.estimated_cost ? `~${CURRENCY}${Number(o.estimated_cost).toFixed(2)}` : "—")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>

      </DialogContent>
    </Dialog>
  );
};

export default CustomerDetailDialog;
