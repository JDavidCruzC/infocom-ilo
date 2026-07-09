import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Send, Wrench, Package, Sparkles, Plus, Trash2, Search, Receipt, Cog, Gift, Stethoscope
} from "lucide-react";

type ItemType = "producto" | "servicio";
type ItemKind = "servicio" | "repuesto" | "accesorio" | "producto" | "otro";

interface DraftItem {
  kind: ItemKind;
  item_type: ItemType;
  referencia_id?: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  responsable?: string;
  tipo_equipo?: string;
  diagnostico?: string;
  stockAvailable?: number;
}

const KIND_META: Record<ItemKind, { label: string; icon: any; type: ItemType; color: string }> = {
  servicio: { label: "Servicio", icon: Wrench, type: "servicio", color: "text-info" },
  repuesto: { label: "Repuesto", icon: Cog, type: "producto", color: "text-warning" },
  accesorio: { label: "Accesorio", icon: Sparkles, type: "producto", color: "text-accent" },
  producto: { label: "Producto", icon: Package, type: "producto", color: "text-primary" },
  otro: { label: "Otro", icon: Gift, type: "producto", color: "text-muted-foreground" },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any | null;
  userId?: string;
  technicianName?: string;
  onCompleted?: () => void;
}

const SendToAccountingDialog = ({ open, onOpenChange, order, userId, technicianName, onCompleted }: Props) => {
  const [items, setItems] = useState<DraftItem[]>([]);
  const [sending, setSending] = useState(false);
  const [productSearchOpen, setProductSearchOpen] = useState<number | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [porCobrar, setPorCobrar] = useState(false);
  const [diagnosisText, setDiagnosisText] = useState("");

  // Load products for inventory picker
  useEffect(() => {
    if (!open) return;
    supabase.from("products").select("id, name, price, stock, sku").eq("is_active", true).order("name").then(({ data }) => {
      setProducts(data || []);
    });
  }, [open]);

  // Initialize with main service when opening
  useEffect(() => {
    if (open && order) {
      const baseCost = order.final_cost ? Number(order.final_cost) : order.estimated_cost ? Number(order.estimated_cost) : 0;
      setDiagnosisText(order.diagnosis || "");
      setItems([{
        kind: "servicio",
        item_type: "servicio",
        descripcion: `${order.reported_issue || "Servicio técnico"} - ${order.device_type || ""} ${order.device_brand || ""}`.trim(),
        cantidad: 1,
        precio_unitario: baseCost,
        responsable: technicianName || "",
        tipo_equipo: `${order.device_type || ""} ${order.device_brand || ""}`.trim(),
        diagnostico: order.diagnosis || order.reported_issue || "",
      }]);
    } else if (!open) {
      setItems([]);
      setSearch("");
      setDiagnosisText("");
    }
  }, [open, order, technicianName]);

  const addItem = (kind: ItemKind) => {
    const meta = KIND_META[kind];
    setItems(prev => [...prev, {
      kind,
      item_type: meta.type,
      descripcion: "",
      cantidad: 1,
      precio_unitario: 0,
      responsable: kind === "servicio" ? technicianName || "" : "",
    }]);
  };

  const updateItem = (idx: number, patch: Partial<DraftItem>) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const pickProduct = (idx: number, prod: any) => {
    updateItem(idx, {
      referencia_id: prod.id,
      descripcion: prod.name + (prod.sku ? ` (${prod.sku})` : ""),
      precio_unitario: Number(prod.price || 0),
      stockAvailable: prod.stock,
    });
    setProductSearchOpen(null);
  };

  const total = useMemo(() => items.reduce((a, it) => a + (it.cantidad || 0) * (it.precio_unitario || 0), 0), [items]);
  const totalProductos = useMemo(() => items.filter(i => i.item_type === "producto").reduce((a, i) => a + i.cantidad * i.precio_unitario, 0), [items]);
  const totalServicios = useMemo(() => items.filter(i => i.item_type === "servicio").reduce((a, i) => a + i.cantidad * i.precio_unitario, 0), [items]);

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products.slice(0, 50);
    return products.filter(p => p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)).slice(0, 50);
  }, [products, search]);

  const handleSend = async () => {
    if (!order) return;
    const validItems = items.filter(it => it.descripcion.trim() && it.precio_unitario >= 0 && it.cantidad > 0);
    if (validItems.length === 0) {
      toast.error("Agrega al menos un ítem válido");
      return;
    }
    if (!diagnosisText.trim()) {
      toast.error("Ingresa el Diagnóstico Técnico");
      return;
    }
    if (total <= 0) {
      toast.error("El total debe ser mayor a 0");
      return;
    }
    // Stock validation
    for (const it of validItems) {
      if (it.referencia_id && typeof it.stockAvailable === "number" && it.cantidad > it.stockAvailable) {
        toast.error(`Stock insuficiente para "${it.descripcion}" (disponible: ${it.stockAvailable})`);
        return;
      }
    }

    setSending(true);
    try {
      // Update service order
      await supabase.from("service_orders").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        final_cost: total,
        diagnosis: diagnosisText,
      }).eq("id", order.id);

      // Create transaction
      const hasProd = validItems.some(i => i.item_type === "producto");
      const hasServ = validItems.some(i => i.item_type === "servicio");
      const tipo_general = hasProd && hasServ ? "mixto" : hasServ ? "servicio" : "venta";

      const { data: tx, error: txErr } = await supabase.from("transactions").insert({
        fecha: new Date().toISOString().split("T")[0],
        cliente_nombre: order.customer_name || null,
        cliente_telefono: order.customer_phone || null,
        notas: `Orden de servicio #${order.order_number} | ${order.device_type || ""} ${order.device_brand || ""} ${order.device_model || ""}`.trim(),
        estado: "emitido" as any,
        tipo_general: tipo_general as any,
        created_by: userId || null,
        emitido_en: new Date().toISOString(),
        emitido_por: technicianName || "Soporte Técnico",
        por_cobrar: porCobrar,
      } as any).select("id").single();
      if (txErr) throw txErr;

      // Insert items
      const payload = validItems.map(it => ({
        transaction_id: tx.id,
        item_type: it.item_type as any,
        referencia_id: it.referencia_id || null,
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        subtotal: it.cantidad * it.precio_unitario,
        responsable: it.item_type === "servicio" ? (it.responsable || null) : null,
        tipo_equipo: it.item_type === "servicio" ? (it.tipo_equipo || null) : null,
        diagnostico: it.item_type === "servicio" ? (it.diagnostico || null) : null,
      }));
      await supabase.from("transaction_items").insert(payload);

      // Reduce stock for product items with referencia_id
      for (const it of validItems) {
        if (it.referencia_id && it.item_type === "producto") {
          const { data: prod } = await supabase.from("products").select("stock").eq("id", it.referencia_id).single();
          if (prod) {
            const stockBefore = prod.stock;
            const stockAfter = stockBefore - it.cantidad;
            await supabase.from("products").update({ stock: stockAfter } as any).eq("id", it.referencia_id);
            await supabase.from("inventory_movements").insert({
              product_id: it.referencia_id,
              product_name: it.descripcion,
              movement_type: "salida",
              quantity: it.cantidad,
              reference_type: "servicio_tecnico",
              reference_id: tx.id,
              stock_before: stockBefore,
              stock_after: stockAfter,
              created_by: userId || null,
            } as any);
          }
        }
      }

      // History
      await supabase.from("transaction_history").insert({
        transaction_id: tx.id,
        accion: "creado_desde_soporte",
        detalles: { service_order_id: order.id, order_number: order.order_number, items_count: validItems.length } as any,
        usuario_id: userId || null,
      });

      toast.success(`Orden #${order.order_number} enviada a contabilidad${porCobrar ? " — PENDIENTE POR COBRAR" : ""}`);
      onOpenChange(false);
      onCompleted?.();
    } catch (e: any) {
      toast.error(e.message || "Error al enviar a contabilidad");
    } finally {
      setSending(false);
    }
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" /> Mandar a Contabilidad — Orden #{order.order_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order summary */}
          <div className="bg-secondary/30 rounded-lg p-3 text-sm grid grid-cols-1 md:grid-cols-2 gap-2">
            <p><span className="text-muted-foreground">Cliente:</span> <span className="font-bold">{order.customer_name}</span></p>
            <p><span className="text-muted-foreground">Teléfono:</span> <span className="font-bold">{order.customer_phone || "—"}</span></p>
            <p><span className="text-muted-foreground">Equipo:</span> <span className="font-bold">{order.device_type} {order.device_brand || ""} {order.device_model || ""}</span></p>
            <p><span className="text-muted-foreground">Falla:</span> <span>{order.reported_issue}</span></p>
          </div>

          {/* Diagnóstico Técnico */}
          <div className="border-2 border-info/40 bg-info/5 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-info" />
              <Label className="text-base font-bold text-info">Diagnóstico Técnico *</Label>
            </div>
            <Textarea
              value={diagnosisText}
              onChange={(e) => setDiagnosisText(e.target.value)}
              placeholder="Describe el diagnóstico realizado, hallazgos, causa de la falla y trabajo efectuado…"
              rows={3}
              className="bg-background"
            />
          </div>

          {/* Repuestos Utilizados heading */}
          <div className="flex items-center gap-2 pt-2">
            <Cog className="h-4 w-4 text-warning" />
            <Label className="text-sm font-bold text-warning">Repuestos Utilizados & Ítems</Label>
            <span className="text-xs text-muted-foreground">— busca en inventario o escribe manualmente (no registra al stock)</span>
          </div>


          {/* Add buttons */}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => addItem("servicio")} className="gap-1">
              <Wrench className="h-4 w-4" /> + Servicio
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => addItem("repuesto")} className="gap-1">
              <Cog className="h-4 w-4" /> + Repuesto
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => addItem("accesorio")} className="gap-1">
              <Sparkles className="h-4 w-4" /> + Accesorio
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => addItem("producto")} className="gap-1">
              <Package className="h-4 w-4" /> + Producto
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => addItem("otro")} className="gap-1">
              <Plus className="h-4 w-4" /> + Otro
            </Button>
          </div>

          {/* Items */}
          <div className="space-y-2">
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-lg">
                Agrega servicios, repuestos o productos para enviar a contabilidad.
              </p>
            )}
            {items.map((it, idx) => {
              const meta = KIND_META[it.kind];
              const Icon = meta.icon;
              const isProductLink = it.item_type === "producto" && (it.kind === "repuesto" || it.kind === "accesorio" || it.kind === "producto");
              return (
                <div key={idx} className="border rounded-lg p-3 space-y-2 bg-card">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className={`${meta.color} gap-1`}>
                      <Icon className="h-3 w-3" /> {meta.label}
                    </Badge>
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeItem(idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-12 md:col-span-6 space-y-1">
                      <Label className="text-xs">Descripción</Label>
                      {isProductLink ? (
                        <>
                          <Popover open={productSearchOpen === idx} onOpenChange={(o) => setProductSearchOpen(o ? idx : null)}>
                            <PopoverTrigger asChild>
                              <Button type="button" variant="outline" className="w-full justify-start gap-2 font-normal">
                                <Search className="h-4 w-4" />
                                <span className="truncate">{it.referencia_id ? it.descripcion : (it.descripcion || "Buscar en inventario o escribir libre…")}</span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[420px] p-0" align="start">
                              <Command shouldFilter={false}>
                                <CommandInput placeholder="Buscar producto o SKU…" value={search} onValueChange={setSearch} />
                                <CommandList className="max-h-64">
                                  <CommandEmpty>
                                    <div className="p-2 space-y-2">
                                      <p className="text-xs text-muted-foreground">Sin coincidencias en inventario.</p>
                                      <Button size="sm" variant="outline" className="w-full" onClick={() => { updateItem(idx, { descripcion: search || it.descripcion, referencia_id: null, stockAvailable: undefined }); setProductSearchOpen(null); }}>
                                        Usar "{search || it.descripcion}" como ítem libre
                                      </Button>
                                    </div>
                                  </CommandEmpty>
                                  <CommandGroup heading="Inventario">
                                    {filteredProducts.map(p => (
                                      <CommandItem key={p.id} value={p.id} onSelect={() => pickProduct(idx, p)}>
                                        <div className="flex flex-col w-full">
                                          <span className="font-medium">{p.name}</span>
                                          <span className="text-xs text-muted-foreground flex justify-between">
                                            <span>SKU: {p.sku || "—"}</span>
                                            <span>Stock: {p.stock} · S/ {Number(p.price).toFixed(2)}</span>
                                          </span>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                  <CommandGroup heading="Manual">
                                    <CommandItem value="__manual__" onSelect={() => { updateItem(idx, { referencia_id: null, stockAvailable: undefined }); setProductSearchOpen(null); }}>
                                      <Plus className="h-3 w-3 mr-2" /> Escribir manualmente (producto no registrado)
                                    </CommandItem>
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          {!it.referencia_id && (
                            <Input
                              value={it.descripcion}
                              onChange={e => updateItem(idx, { descripcion: e.target.value })}
                              placeholder="Escribir nombre del producto/repuesto…"
                              className="h-8 text-xs mt-1"
                            />
                          )}
                        </>
                      ) : (
                        <Input value={it.descripcion} onChange={e => updateItem(idx, { descripcion: e.target.value })} placeholder="Describe el ítem" />
                      )}
                      {typeof it.stockAvailable === "number" && (
                        <p className="text-[10px] text-muted-foreground">Stock disponible: {it.stockAvailable}</p>
                      )}
                    </div>
                    <div className="col-span-4 md:col-span-2 space-y-1">
                      <Label className="text-xs">Cant.</Label>
                      <Input type="number" min="1" value={it.cantidad} onChange={e => updateItem(idx, { cantidad: Math.max(1, parseInt(e.target.value) || 1) })} />
                    </div>
                    <div className="col-span-4 md:col-span-2 space-y-1">
                      <Label className="text-xs">Precio S/</Label>
                      <Input type="number" step="0.01" min="0" value={it.precio_unitario} onChange={e => updateItem(idx, { precio_unitario: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="col-span-4 md:col-span-2 space-y-1">
                      <Label className="text-xs">Subtotal</Label>
                      <div className="h-10 flex items-center font-bold text-primary">S/ {(it.cantidad * it.precio_unitario).toFixed(2)}</div>
                    </div>
                  </div>

                  {it.item_type === "servicio" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t">
                      <div className="space-y-1">
                        <Label className="text-xs">Responsable</Label>
                        <Input value={it.responsable || ""} onChange={e => updateItem(idx, { responsable: e.target.value })} placeholder="Técnico" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Equipo</Label>
                        <Input value={it.tipo_equipo || ""} onChange={e => updateItem(idx, { tipo_equipo: e.target.value })} placeholder="Tipo / marca" />
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <Label className="text-xs">Diagnóstico</Label>
                        <Input value={it.diagnostico || ""} onChange={e => updateItem(idx, { diagnostico: e.target.value })} placeholder="Diagnóstico técnico" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-1">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Servicios</span><span>S/ {totalServicios.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Productos / Repuestos</span><span>S/ {totalProductos.toFixed(2)}</span></div>
            <div className="flex justify-between text-lg font-bold border-t pt-1 mt-1"><span>Total</span><span className="text-primary">S/ {total.toFixed(2)}</span></div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
            <Checkbox id="por_cobrar_support" checked={porCobrar} onCheckedChange={(v) => setPorCobrar(!!v)} />
            <Label htmlFor="por_cobrar_support" className="cursor-pointer font-semibold text-amber-700 dark:text-amber-300">
              Marcar como pendiente por cobrar
            </Label>
            <span className="ml-auto text-xs text-muted-foreground">Aparecerá en la pestaña "Por Cobrar" de Contabilidad</span>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSend} disabled={sending || items.length === 0 || total <= 0} className="gap-2 min-w-[220px]">
              {sending ? <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : <Receipt className="h-4 w-4" />}
              Completar y enviar a Contabilidad
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SendToAccountingDialog;
