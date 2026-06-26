import { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Eye, Search, History, Ban, Trash2, MessageCircle, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/hooks/useAuth";
import PrintReceipt from "./PrintReceipt";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** When true, list is restricted to transactions created by the current user (POS-friendly). */
  scopeToCurrentUser?: boolean;
}

interface TxRow {
  id: string;
  fecha: string;
  created_at: string;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  total: number | null;
  subtotal_productos: number | null;
  subtotal_servicios: number | null;
  estado: string | null;
  tipo_general: string | null;
  tipo_comprobante: string | null;
  numero_comprobante: string | null;
  emitido_por: string | null;
  notas: string | null;
  created_by: string | null;
  items?: any[];
}

export default function TransactionHistoryDialog({ open, onOpenChange, scopeToCurrentUser = false }: Props) {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();


  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [viewing, setViewing] = useState<TxRow | null>(null);
  const [editing, setEditing] = useState<TxRow | null>(null);
  const [editForm, setEditForm] = useState({ cliente_nombre: "", cliente_telefono: "", notas: "" });

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["transactions_history_dialog", scopeToCurrentUser, user?.id],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from("transactions")
        .select("*, items:transaction_items(*)")
        .order("created_at", { ascending: false })
        .limit(150);
      if (scopeToCurrentUser && !isAdmin && user?.id) {
        q = q.eq("created_by", user.id);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as TxRow[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return txs.filter((t) => {
      if (statusFilter !== "todos" && t.estado !== statusFilter) return false;
      if (!q) return true;
      return (
        (t.cliente_nombre || "").toLowerCase().includes(q) ||
        (t.numero_comprobante || "").toLowerCase().includes(q) ||
        (t.notas || "").toLowerCase().includes(q)
      );
    });
  }, [txs, search, statusFilter]);

  const anular = useMutation({
    mutationFn: async (id: string) => {
      const motivo = window.prompt("Motivo de anulación:");
      if (!motivo) throw new Error("Cancelado");
      const { error } = await supabase
        .from("transactions")
        .update({ estado: "anulado" as any, motivo_anulacion: motivo } as any)
        .eq("id", id);
      if (error) throw error;
      await supabase.from("transaction_history").insert({
        transaction_id: id,
        accion: "anulado",
        detalles: { motivo } as any,
        usuario_id: user?.id || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions_history_dialog"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Transacción anulada");
    },
    onError: (e: any) => e.message !== "Cancelado" && toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!window.confirm("¿Eliminar definitivamente esta transacción?")) throw new Error("Cancelado");
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions_history_dialog"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Transacción eliminada");
    },
    onError: (e: any) => e.message !== "Cancelado" && toast.error(e.message),
  });

  const startEdit = (tx: TxRow) => {
    setEditing(tx);
    setEditForm({
      cliente_nombre: tx.cliente_nombre || "",
      cliente_telefono: tx.cliente_telefono || "",
      notas: tx.notas || "",
    });
  };

  const saveEdit = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("Sin transacción");
      const { error } = await supabase
        .from("transactions")
        .update({
          cliente_nombre: editForm.cliente_nombre || null,
          cliente_telefono: editForm.cliente_telefono || null,
          notas: editForm.notas || null,
        } as any)
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions_history_dialog"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Transacción actualizada");
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const shareWhatsApp = (tx: TxRow) => {
    const lines: string[] = [];
    lines.push(`*Comprobante INFOCOM*`);
    if (tx.numero_comprobante) lines.push(`N° ${tx.numero_comprobante}`);
    lines.push(`Fecha: ${tx.fecha}`);
    if (tx.cliente_nombre) lines.push(`Cliente: ${tx.cliente_nombre}`);
    lines.push("");
    (tx.items || []).forEach((it: any) => {
      lines.push(`• ${it.cantidad}x ${it.descripcion} — S/. ${Number(it.subtotal).toFixed(2)}`);
    });
    lines.push("");
    lines.push(`*TOTAL: S/. ${Number(tx.total).toFixed(2)}*`);
    lines.push("");
    lines.push("Gracias por su preferencia.");
    const text = encodeURIComponent(lines.join("\n"));
    const phone = (tx.cliente_telefono || "").replace(/\D/g, "");
    const url = phone ? `https://wa.me/${phone.startsWith("51") ? phone : "51" + phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, "_blank");
  };

  const stateBadge = (estado: string | null) => {
    if (estado === "emitido") return <Badge className="bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/20">Emitido</Badge>;
    if (estado === "anulado") return <Badge variant="destructive">Anulado</Badge>;
    if (estado === "devuelto") return <Badge variant="secondary">Devuelto</Badge>;
    return <Badge variant="outline">Borrador</Badge>;
  };

  const toPrintOrder = (tx: TxRow) => ({
    id: tx.id,
    created_at: tx.created_at,
    date: tx.fecha,
    numero_comprobante: tx.numero_comprobante,
    ticket_number: tx.numero_comprobante,
    customer_name: tx.cliente_nombre || "",
    customer_phone: tx.cliente_telefono || "",
    seller: tx.emitido_por || "Admin",
    items: (tx.items || []).map((it: any) => ({
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      precio_unitario: it.precio_unitario,
      subtotal: it.subtotal,
      item_type: it.item_type,
      responsable: it.responsable,
      tipo_equipo: it.tipo_equipo,
      diagnostico: it.diagnostico,
    })),
    subtotal_productos: tx.subtotal_productos,
    subtotal_servicios: tx.subtotal_servicios,
    total: tx.total,
    description: (tx.items || []).filter((it: any) => it.item_type === "servicio").map((it: any) => it.descripcion).join(", "),
    responsible: (tx.items || []).find((it: any) => it.responsable)?.responsable || tx.emitido_por || "",
    device_type: (tx.items || []).find((it: any) => it.tipo_equipo)?.tipo_equipo || "",
    diagnosis: (tx.items || []).find((it: any) => it.diagnostico)?.diagnostico || "",
    price: tx.total,
    product_description: (tx.items || []).map((it: any) => `${it.cantidad}x ${it.descripcion}`).join(", "),
    quantity: (tx.items || []).reduce((a: number, it: any) => a + it.cantidad, 0),
    unit_price: tx.total,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[98vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" /> Ver y editar transacciones
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por cliente, N° o nota..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="borrador">Borrador</SelectItem>
              <SelectItem value="emitido">Emitido</SelectItem>
              <SelectItem value="anulado">Anulado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          {isLoading && <p className="text-center text-sm text-muted-foreground py-8">Cargando...</p>}
          {!isLoading && filtered.length === 0 && (
            <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">Sin transacciones</Card>
          )}
          {filtered.map((tx) => (
            <Card key={tx.id} className="p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-mono font-bold text-primary">{tx.numero_comprobante || "—"}</span>
                    {stateBadge(tx.estado)}
                    {tx.tipo_general && <Badge variant="outline" className="capitalize text-[10px]">{tx.tipo_general}</Badge>}
                  </div>
                  <p className="text-sm font-semibold mt-1">{tx.cliente_nombre || "Sin cliente"}</p>
                  <p className="text-xs text-muted-foreground">{tx.fecha} • {tx.emitido_por || "—"} • {(tx.items || []).length} ítem(s)</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-primary font-mono">S/. {Number(tx.total || 0).toFixed(2)}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-border items-center">
                <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => setViewing(tx)}>
                  <Eye className="h-3.5 w-3.5" /> Ver
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 h-8 text-blue-600 border-blue-500/30 hover:bg-blue-500/10" onClick={() => startEdit(tx)}>
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
                <div className="scale-90 origin-left">
                  <PrintReceipt
                    order={toPrintOrder(tx) as any}
                    type={tx.tipo_general === "servicio" ? "service" : "sale"}
                    defaultDocumentKind={(tx.tipo_comprobante as any) || undefined}
                  />
                </div>
                <Button size="sm" variant="outline" className="gap-1.5 h-8 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10" onClick={() => shareWhatsApp(tx)}>
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </Button>
                {tx.estado !== "anulado" && (
                  <Button size="sm" variant="outline" className="gap-1.5 h-8 text-amber-600 border-amber-500/30 hover:bg-amber-500/10" onClick={() => anular.mutate(tx.id)}>
                    <Ban className="h-3.5 w-3.5" /> Anular
                  </Button>
                )}
                {isAdmin && (
                  <Button size="sm" variant="outline" className="gap-1.5 h-8 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => remove.mutate(tx.id)}>
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* DETAIL VIEW */}
        <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
          <DialogContent className="max-w-2xl w-[95vw] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" /> Detalle de Transacción
              </DialogTitle>
            </DialogHeader>
            {viewing && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">N°:</span> <span className="font-mono font-bold">{viewing.numero_comprobante || "—"}</span></div>
                  <div><span className="text-muted-foreground">Estado:</span> {stateBadge(viewing.estado)}</div>
                  <div><span className="text-muted-foreground">Fecha:</span> {viewing.fecha}</div>
                  <div><span className="text-muted-foreground">Tipo:</span> <span className="capitalize">{viewing.tipo_general}</span></div>
                  <div><span className="text-muted-foreground">Cliente:</span> <span className="font-bold">{viewing.cliente_nombre || "—"}</span></div>
                  <div><span className="text-muted-foreground">Teléfono:</span> {viewing.cliente_telefono || "—"}</div>
                  <div className="col-span-2"><span className="text-muted-foreground">Notas:</span> {viewing.notas || "—"}</div>
                </div>
                <div className="border-t border-border pt-3">
                  <p className="font-semibold mb-2 text-sm">Items</p>
                  <div className="space-y-1">
                    {(viewing.items || []).map((it: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm bg-secondary/30 rounded px-3 py-1.5">
                        <span>{it.cantidad}x {it.descripcion}</span>
                        <span className="font-mono">S/. {Number(it.subtotal).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 mt-2 border-t border-border">
                    <span>Total:</span>
                    <span className="text-primary font-mono">S/. {Number(viewing.total || 0).toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-border">
                  <PrintReceipt
                    order={toPrintOrder(viewing) as any}
                    type={viewing.tipo_general === "servicio" ? "service" : "sale"}
                    defaultDocumentKind={(viewing.tipo_comprobante as any) || undefined}
                  />
                  <Button size="sm" variant="outline" className="gap-1.5 text-emerald-600 border-emerald-500/30" onClick={() => shareWhatsApp(viewing)}>
                    <MessageCircle className="h-4 w-4" /> Enviar por WhatsApp
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
