import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Trash2, Plus, Search, Receipt, ShoppingCart, Wrench } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { notifyAllStaff } from "@/lib/notifications";

interface QItem {
  item_type: "producto" | "servicio";
  referencia_id?: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

interface ServiceType { name: string; price: number }

export default function QuickTransactionDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    fecha: new Date().toISOString().split("T")[0],
    cliente_nombre: "",
    cliente_telefono: "",
    notas: "",
    emitido_por: "Personal de Infocom",
    por_cobrar: false,
    tipo_cliente: "publico" as "publico" | "privado" | "corporativo",
  });
  const [items, setItems] = useState<QItem[]>([]);
  const [productPickerIdx, setProductPickerIdx] = useState<number | null>(null);
  const [clientOpen, setClientOpen] = useState(false);

  const reset = () => {
    setForm({
      fecha: new Date().toISOString().split("T")[0],
      cliente_nombre: "",
      cliente_telefono: "",
      notas: "",
      emitido_por: "Personal de Infocom",
      por_cobrar: false,
      tipo_cliente: "publico",
    });
    setItems([]);
  };

  useEffect(() => { if (!open) reset(); }, [open]);

  const { data: products = [] } = useQuery({
    queryKey: ["quick_tx_products"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, stock, sku")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["quick_tx_customers"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, full_name, phone, document_number").order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["quick_tx_staff"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_members").select("id, full_name, position").eq("is_active", true).order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: serviceTypesRow } = useQuery({
    queryKey: ["quick_tx_service_types"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("store_settings").select("*").eq("key", "service_types").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const SERVICE_TYPES: ServiceType[] = useMemo(() => {
    if (!serviceTypesRow?.value) return [];
    const val: any = serviceTypesRow.value;
    if (Array.isArray(val)) return val.map((v: any) => typeof v === "string" ? { name: v, price: 0 } : { name: v.name, price: Number(v.price) || 0 });
    return [];
  }, [serviceTypesRow]);

  const totals = useMemo(() => {
    const productos = items.filter(i => i.item_type === "producto").reduce((a, i) => a + i.cantidad * i.precio_unitario, 0);
    const servicios = items.filter(i => i.item_type === "servicio").reduce((a, i) => a + i.cantidad * i.precio_unitario, 0);
    return { productos, servicios, total: productos + servicios };
  }, [items]);

  const addProducto = () => {
    setItems([...items, { item_type: "producto", descripcion: "", cantidad: 1, precio_unitario: 0, referencia_id: null }]);
  };
  const addServicio = () => {
    setItems([...items, { item_type: "servicio", descripcion: "", cantidad: 1, precio_unitario: 0, referencia_id: "service" }]);
  };
  const updateItem = (idx: number, patch: Partial<QItem>) => {
    setItems(items.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const pickProduct = (idx: number, p: any) => {
    updateItem(idx, { referencia_id: p.id, descripcion: p.name, precio_unitario: Number(p.price) || 0 });
    setProductPickerIdx(null);
  };

  const save = useMutation({
    mutationFn: async (emit: boolean) => {
      if (items.length === 0) throw new Error("Agrega al menos un item");
      if (items.some(i => !i.descripcion.trim())) throw new Error("Completa la descripción de todos los items");

      const { data: tx, error } = await supabase.from("transactions").insert({
        fecha: form.fecha,
        cliente_nombre: form.cliente_nombre || null,
        cliente_telefono: form.cliente_telefono || null,
        notas: form.notas || null,
        emitido_por: form.emitido_por || null,
        por_cobrar: form.por_cobrar,
        tipo_cliente: form.tipo_cliente,
        created_by: user?.id || null,
      } as any).select("id").single();
      if (error) throw error;

      const payload = items.map(it => ({
        transaction_id: tx.id,
        item_type: it.item_type,
        referencia_id: it.referencia_id && it.referencia_id !== "service" ? it.referencia_id : null,
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        subtotal: it.cantidad * it.precio_unitario,
      }));
      const { error: ie } = await supabase.from("transaction_items").insert(payload as any);
      if (ie) throw ie;

      await supabase.from("transaction_history").insert({
        transaction_id: tx.id, accion: "creado",
        detalles: { items: items.length, origen: "pos_quick" },
        usuario_id: user?.id || null,
      });

      if (emit) {
        const { error: ee } = await supabase.from("transactions").update({
          estado: "emitido" as any,
          emitido_en: new Date().toISOString(),
          emitido_por: form.emitido_por || user?.email || "Admin",
        }).eq("id", tx.id);
        if (ee) throw ee;

        // Reduce stock for product items
        for (const it of items) {
          if (it.item_type === "producto" && it.referencia_id) {
            const { data: prod } = await supabase.from("products").select("stock").eq("id", it.referencia_id).single();
            if (prod) {
              const stockBefore = prod.stock;
              const stockAfter = Math.max(0, stockBefore - (it.cantidad || 0));
              await supabase.from("products").update({ stock: stockAfter } as any).eq("id", it.referencia_id);
              await supabase.from("inventory_movements").insert({
                product_id: it.referencia_id, product_name: it.descripcion,
                movement_type: "venta", quantity: it.cantidad,
                reference_type: "transaccion", reference_id: tx.id,
                stock_before: stockBefore, stock_after: stockAfter,
                created_by: user?.id || null,
              } as any);
            }
          }
        }

        await supabase.from("transaction_history").insert({
          transaction_id: tx.id, accion: "emitido", usuario_id: user?.id || null,
        });
      }

      return tx.id;
    },
    onSuccess: (_id, emit) => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["transactions_por_cobrar_all"] });
      qc.invalidateQueries({ queryKey: ["pos_products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      const hasService = items.some(i => i.item_type === "servicio");
      notifyAllStaff({
        title: `Nueva ${hasService ? "orden de servicio" : "venta"} registrada`,
        message: `${form.cliente_nombre || "Sin cliente"} — S/. ${totals.total.toFixed(2)}`,
        type: hasService ? "service" : "sale",
        link: "/admin/ventas/pos",
        excludeUserId: user?.id,
      });
      toast.success(emit ? "Transacción emitida" : "Borrador guardado");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || "Error al guardar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[98vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" /> Nueva Transacción
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fecha *</Label>
              <Input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
            </div>
            <div>
              <Label>Atendido por</Label>
              <Select value={form.emitido_por} onValueChange={v => setForm({ ...form, emitido_por: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Personal de Infocom">Personal de Infocom</SelectItem>
                  {staff.map((s: any) => <SelectItem key={s.id} value={s.full_name}>{s.full_name} — {s.position}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cliente</Label>
              <Popover open={clientOpen} onOpenChange={setClientOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full h-9 justify-start font-normal">
                    {form.cliente_nombre || "Buscar cliente o escribir..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar..." value={form.cliente_nombre} onValueChange={(v) => setForm({ ...form, cliente_nombre: v })} />
                    <CommandList>
                      <CommandEmpty>Usar “{form.cliente_nombre}” como cliente nuevo.</CommandEmpty>
                      <CommandGroup heading="Clientes">
                        {customers.slice(0, 50).map((c: any) => (
                          <CommandItem key={c.id} value={c.full_name} onSelect={() => {
                            setForm({ ...form, cliente_nombre: c.full_name, cliente_telefono: c.phone || "" });
                            setClientOpen(false);
                          }}>
                            <span className="flex-1">{c.full_name}</span>
                            <span className="text-xs text-muted-foreground">{c.phone || ""}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={form.cliente_telefono} onChange={e => setForm({ ...form, cliente_telefono: e.target.value })} />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox id="qtx-cobrar" checked={form.por_cobrar} onCheckedChange={(c) => setForm({ ...form, por_cobrar: !!c })} />
              <Label htmlFor="qtx-cobrar" className="cursor-pointer text-sm">Por cobrar</Label>
            </div>
            <div className="flex-1">
              <Select value={form.tipo_cliente} onValueChange={(v: any) => setForm({ ...form, tipo_cliente: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="publico">Público</SelectItem>
                  <SelectItem value="privado">Privado</SelectItem>
                  <SelectItem value="corporativo">Corporativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-semibold">Items</Label>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" className="gap-1" onClick={addProducto}>
                  <ShoppingCart className="h-3.5 w-3.5" /> Producto
                </Button>
                <Button type="button" size="sm" variant="outline" className="gap-1" onClick={addServicio}>
                  <Wrench className="h-3.5 w-3.5" /> Servicio
                </Button>
              </div>
            </div>

            {items.length === 0 && (
              <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">
                Sin items. Agrega un producto o servicio.
              </Card>
            )}

            {items.map((it, idx) => (
              <Card key={idx} className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
                    {it.item_type === "producto" ? <ShoppingCart className="h-3 w-3" /> : <Wrench className="h-3 w-3" />}
                    {it.item_type}
                  </span>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeItem(idx)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {it.item_type === "producto" ? (
                  <Popover open={productPickerIdx === idx} onOpenChange={(o) => setProductPickerIdx(o ? idx : null)}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="w-full h-9 justify-start font-normal">
                        <Search className="h-3.5 w-3.5 mr-2" />
                        {it.descripcion || "Buscar producto..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[420px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar por nombre o SKU..." />
                        <CommandList>
                          <CommandEmpty>Sin resultados</CommandEmpty>
                          <CommandGroup>
                            {products.slice(0, 100).map((p: any) => (
                              <CommandItem key={p.id} value={`${p.name} ${p.sku || ""}`} onSelect={() => pickProduct(idx, p)}>
                                <span className="flex-1 truncate">{p.name}</span>
                                <span className="text-xs font-mono mr-2">S/{Number(p.price).toFixed(2)}</span>
                                <span className="text-[10px] text-muted-foreground">Stock {p.stock}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <div>
                    {SERVICE_TYPES.length > 0 && (
                      <Select onValueChange={(v) => {
                        const st = SERVICE_TYPES.find(s => s.name === v);
                        if (st) updateItem(idx, { descripcion: st.name, precio_unitario: st.price || it.precio_unitario });
                      }}>
                        <SelectTrigger className="h-8 mb-1 text-xs"><SelectValue placeholder="Servicio rápido..." /></SelectTrigger>
                        <SelectContent>
                          {SERVICE_TYPES.map(s => <SelectItem key={s.name} value={s.name}>{s.name} {s.price ? `— S/${s.price}` : ""}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    <Input
                      placeholder="Descripción del servicio"
                      value={it.descripcion}
                      onChange={e => updateItem(idx, { descripcion: e.target.value })}
                    />
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px]">Cant.</Label>
                    <Input type="number" min={1} value={it.cantidad}
                      onChange={e => updateItem(idx, { cantidad: parseInt(e.target.value) || 1 })} />
                  </div>
                  <div>
                    <Label className="text-[10px]">P. Unit.</Label>
                    <Input type="number" min={0} step="0.01" value={it.precio_unitario}
                      onChange={e => updateItem(idx, { precio_unitario: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label className="text-[10px]">Subtotal</Label>
                    <Input readOnly value={`S/ ${(it.cantidad * it.precio_unitario).toFixed(2)}`} className="font-mono" />
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div>
            <Label>Notas</Label>
            <Input value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Opcional" />
          </div>

          <Card className="p-3 bg-secondary/30">
            <div className="flex items-center justify-between text-sm">
              <span>Productos:</span>
              <span className="font-mono">S/ {totals.productos.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Servicios:</span>
              <span className="font-mono">S/ {totals.servicios.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-lg font-bold border-t border-border mt-1 pt-1">
              <span>Total:</span>
              <span className="font-mono text-primary">S/ {totals.total.toFixed(2)}</span>
            </div>
          </Card>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>Cancelar</Button>
          <Button variant="secondary" onClick={() => save.mutate(false)} disabled={save.isPending || items.length === 0}>
            Guardar borrador
          </Button>
          <Button onClick={() => save.mutate(true)} disabled={save.isPending || items.length === 0} className="gap-2">
            <Plus className="h-4 w-4" /> Emitir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
