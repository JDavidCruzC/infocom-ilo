import { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { FileText, Plus, Trash2, Printer, Search, Pencil, Image as ImageIcon, Upload, Calculator } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { loadCompanyInfo, buildHeaderHtml, buildCopyright, loadTemplate, DEFAULT_COMPANY_INFO } from "@/features/admin/components/PrintReceipt";

interface QItem {
  product_id: string | null;
  descripcion: string;
  imagen_url: string | null;
  cantidad: number;
  precio_unitario: number;
}

const QuotesPage = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const blankForm = {
    fecha: new Date().toISOString().split("T")[0],
    valid_until: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
    cliente_nombre: "",
    cliente_documento: "",
    cliente_telefono: "",
    cliente_email: "",
    cliente_direccion: "",
    notas: "",
    condiciones: "Validez: 7 días. Precios en Soles (S/). Sujeto a stock disponible.",
    descuento_pct: 0,
    incluye_igv: true,
    igv_pct: 18,
  };
  const [form, setForm] = useState(blankForm);
  const [items, setItems] = useState<QItem[]>([]);
  const [productPickerIdx, setProductPickerIdx] = useState<number | null>(null);
  const [imagePickerIdx, setImagePickerIdx] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState("");

  const { data: quotes = [] } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quotes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["quotes_products"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, price, images, sku").eq("is_active", true).order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    const list = products as any[];
    if (!q) return list.slice(0, 50);
    return list.filter((p: any) => (p.name || "").toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q)).slice(0, 50);
  }, [productSearch, products]);

  const totals = useMemo(() => {
    // Precios ingresados incluyen IGV (estilo Contabilidad)
    const rawSum = items.reduce((a, i) => a + i.cantidad * i.precio_unitario, 0);
    const desc = rawSum * (form.descuento_pct / 100);
    const total = rawSum - desc;
    const divisor = 1 + (form.igv_pct / 100); // 1.18 por defecto
    const sub = form.incluye_igv ? total / divisor : total;
    const igv = form.incluye_igv ? total - sub : 0;
    return { sub, desc, base: sub, igv, total };
  }, [items, form.descuento_pct, form.incluye_igv, form.igv_pct]);

  const filteredQuotes = useMemo(() => {
    if (!search.trim()) return quotes;
    const q = search.toLowerCase();
    return (quotes as any[]).filter((qt: any) =>
      (qt.quote_number || "").toLowerCase().includes(q) ||
      (qt.cliente_nombre || "").toLowerCase().includes(q)
    );
  }, [quotes, search]);

  const openNew = () => {
    setEditingId(null);
    setForm(blankForm);
    setItems([]);
    setOpen(true);
  };

  const openEdit = async (qt: any) => {
    setEditingId(qt.id);
    setForm({
      fecha: qt.fecha,
      valid_until: qt.valid_until || blankForm.valid_until,
      cliente_nombre: qt.cliente_nombre || "",
      cliente_documento: qt.cliente_documento || "",
      cliente_telefono: qt.cliente_telefono || "",
      cliente_email: qt.cliente_email || "",
      cliente_direccion: qt.cliente_direccion || "",
      notas: qt.notas || "",
      condiciones: qt.condiciones || "",
      descuento_pct: Number(qt.descuento_pct) || 0,
      incluye_igv: !!qt.incluye_igv,
      igv_pct: Number(qt.igv_pct) || 18,
    });
    const { data } = await supabase.from("quote_items").select("*").eq("quote_id", qt.id).order("orden");
    setItems(((data || []) as any[]).map(it => ({
      product_id: it.product_id,
      descripcion: it.descripcion,
      imagen_url: it.imagen_url,
      cantidad: Number(it.cantidad),
      precio_unitario: Number(it.precio_unitario),
    })));
    setOpen(true);
  };

  const addItem = () => setItems([...items, { product_id: null, descripcion: "", imagen_url: null, cantidad: 1, precio_unitario: 0 }]);
  const updateItem = (idx: number, patch: Partial<QItem>) => setItems(items.map((it, i) => i === idx ? { ...it, ...patch } : it));
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const pickProduct = (idx: number, p: any) => {
    updateItem(idx, {
      product_id: p.id,
      descripcion: p.name,
      precio_unitario: Number(p.price) || 0,
      imagen_url: p.images?.[0] || null,
    });
    setProductPickerIdx(null);
  };

  const uploadImage = async (idx: number, file: File) => {
    const ext = file.name.split(".").pop();
    const path = `quotes/${user?.id || "anon"}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
    if (error) { toast.error("Error subiendo imagen"); return; }
    const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
    updateItem(idx, { imagen_url: pub.publicUrl });
    toast.success("Imagen subida");
  };

  const save = useMutation({
    mutationFn: async (emit: boolean) => {
      if (items.length === 0) throw new Error("Agrega al menos un producto");
      if (items.some(i => !i.descripcion.trim())) throw new Error("Completa la descripción de todos los items");
      const payload: any = {
        fecha: form.fecha,
        valid_until: form.valid_until || null,
        cliente_nombre: form.cliente_nombre || null,
        cliente_documento: form.cliente_documento || null,
        cliente_telefono: form.cliente_telefono || null,
        cliente_email: form.cliente_email || null,
        cliente_direccion: form.cliente_direccion || null,
        notas: form.notas || null,
        condiciones: form.condiciones || null,
        descuento_pct: form.descuento_pct,
        incluye_igv: form.incluye_igv,
        igv_pct: form.igv_pct,
        subtotal: totals.sub,
        descuento_monto: totals.desc,
        igv_monto: totals.igv,
        total: totals.total,
        estado: emit ? "emitida" : "borrador",
        creado_por: user?.email || "Admin",
        created_by: user?.id || null,
      };
      let quoteId = editingId;
      if (editingId) {
        const { error } = await supabase.from("quotes").update(payload).eq("id", editingId);
        if (error) throw error;
        await supabase.from("quote_items").delete().eq("quote_id", editingId);
      } else {
        const { data, error } = await supabase.from("quotes").insert(payload).select("id").single();
        if (error) throw error;
        quoteId = data.id;
      }
      const itemsPayload = items.map((it, i) => ({
        quote_id: quoteId,
        product_id: it.product_id,
        descripcion: it.descripcion,
        imagen_url: it.imagen_url,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        subtotal: it.cantidad * it.precio_unitario,
        orden: i,
      }));
      const { error: ie } = await supabase.from("quote_items").insert(itemsPayload);
      if (ie) throw ie;
      return quoteId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Cotización guardada");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Error al guardar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quotes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quotes"] }); toast.success("Cotización eliminada"); },
    onError: (e: any) => toast.error(e.message || "Error"),
  });

  const printQuote = async (qt: any) => {
    const { data: its } = await supabase.from("quote_items").select("*").eq("quote_id", qt.id).order("orden");
    const ci = await loadCompanyInfo();
    const tpl = loadTemplate();
    const header = buildHeaderHtml(tpl, true, ci);
    const itemsHtml = (its || []).map((it: any, i: number) => `
      <tr>
        <td style="text-align:center;padding:6px;border:1px solid #ddd">${i + 1}</td>
        <td style="padding:6px;border:1px solid #ddd">
          ${it.imagen_url ? `<img src="${it.imagen_url}" style="width:60px;height:60px;object-fit:cover;border-radius:4px;float:left;margin-right:8px"/>` : ""}
          <div><strong>${it.descripcion}</strong></div>
        </td>
        <td style="text-align:center;padding:6px;border:1px solid #ddd">${Number(it.cantidad)}</td>
        <td style="text-align:right;padding:6px;border:1px solid #ddd">S/ ${Number(it.precio_unitario).toFixed(2)}</td>
        <td style="text-align:right;padding:6px;border:1px solid #ddd"><strong>S/ ${Number(it.subtotal).toFixed(2)}</strong></td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${qt.quote_number}</title>
<style>
*{box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:24px;max-width:800px;margin:0 auto}
.title{font-size:22px;font-weight:900;color:#10b981;margin:12px 0}
.box{border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin:8px 0;background:#fafafa}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:8px 0}
table{width:100%;border-collapse:collapse;margin:8px 0}
th{background:#10b981;color:white;padding:8px;text-align:left;font-size:11px}
.totals{margin-left:auto;width:280px}
.totals .row{display:flex;justify-content:space-between;padding:4px 0}
.totals .total{font-weight:900;font-size:16px;border-top:2px solid #10b981;color:#10b981;padding-top:6px}
.footer{margin-top:24px;font-size:10px;color:#666;text-align:center;border-top:1px solid #ddd;padding-top:8px}
@media print{body{padding:12px}@page{margin:10mm}}
</style></head><body>
${header}
<div class="title">COTIZACIÓN ${qt.quote_number}</div>
<div class="grid">
  <div class="box">
    <strong>Cliente</strong><br/>
    ${qt.cliente_nombre || "—"}<br/>
    ${qt.cliente_documento ? "Doc: " + qt.cliente_documento + "<br/>" : ""}
    ${qt.cliente_direccion ? qt.cliente_direccion + "<br/>" : ""}
    ${qt.cliente_telefono ? "Tel: " + qt.cliente_telefono + "<br/>" : ""}
    ${qt.cliente_email ? qt.cliente_email : ""}
  </div>
  <div class="box">
    <strong>Detalles</strong><br/>
    Fecha: ${qt.fecha}<br/>
    Válida hasta: ${qt.valid_until || "—"}<br/>
    Emitido por: ${qt.creado_por || "—"}<br/>
    Estado: ${qt.estado}
  </div>
</div>
<table>
  <thead><tr><th style="width:40px">#</th><th>Descripción</th><th style="width:60px">Cant.</th><th style="width:90px">P. Unit.</th><th style="width:100px">Subtotal</th></tr></thead>
  <tbody>${itemsHtml}</tbody>
</table>
<div class="totals">
  <div class="row"><span>Subtotal:</span><span>S/ ${Number(qt.subtotal).toFixed(2)}</span></div>
  ${Number(qt.descuento_pct) > 0 ? `<div class="row"><span>Descuento (${qt.descuento_pct}%):</span><span>- S/ ${Number(qt.descuento_monto).toFixed(2)}</span></div>` : ""}
  ${qt.incluye_igv ? `<div class="row"><span>IGV (${qt.igv_pct}%):</span><span>S/ ${Number(qt.igv_monto).toFixed(2)}</span></div>` : ""}
  <div class="row total"><span>TOTAL:</span><span>S/ ${Number(qt.total).toFixed(2)}</span></div>
</div>
${qt.notas ? `<div class="box"><strong>Notas:</strong><br/>${qt.notas.replace(/\n/g, "<br/>")}</div>` : ""}
${qt.condiciones ? `<div class="box"><strong>Condiciones:</strong><br/>${qt.condiciones.replace(/\n/g, "<br/>")}</div>` : ""}
<div class="footer">${buildCopyright(ci)}</div>
</body></html>`;
    const w = window.open("", "_blank", "width=900,height=900");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" /> Cotizaciones
        </h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9 w-64" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Button className="gap-2" onClick={openNew}><Plus className="h-4 w-4" /> Nueva Cotización</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-32 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuotes.map((qt: any) => (
                <TableRow key={qt.id}>
                  <TableCell className="font-mono text-xs">{qt.quote_number}</TableCell>
                  <TableCell className="text-xs">{qt.fecha}</TableCell>
                  <TableCell className="text-sm">{qt.cliente_nombre || "—"}</TableCell>
                  <TableCell><Badge variant={qt.estado === "emitida" ? "default" : "secondary"}>{qt.estado}</Badge></TableCell>
                  <TableCell className="text-right font-mono font-bold text-primary">S/ {Number(qt.total).toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => printQuote(qt)}><Printer className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(qt)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("¿Eliminar cotización?")) remove.mutate(qt.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredQuotes.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin cotizaciones</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl w-[98vw] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> {editingId ? "Editar" : "Nueva"} Cotización
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><Label>Fecha</Label><Input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} /></div>
              <div><Label>Válida hasta</Label><Input type="date" value={form.valid_until} onChange={e => setForm({ ...form, valid_until: e.target.value })} /></div>
              <div><Label>Cliente</Label><Input value={form.cliente_nombre} onChange={e => setForm({ ...form, cliente_nombre: e.target.value })} placeholder="Nombre o razón social" /></div>
              <div><Label>RUC / DNI</Label><Input value={form.cliente_documento} onChange={e => setForm({ ...form, cliente_documento: e.target.value })} /></div>
              <div><Label>Teléfono</Label><Input value={form.cliente_telefono} onChange={e => setForm({ ...form, cliente_telefono: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={form.cliente_email} onChange={e => setForm({ ...form, cliente_email: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Dirección</Label><Input value={form.cliente_direccion} onChange={e => setForm({ ...form, cliente_direccion: e.target.value })} /></div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Productos</Label>
                <Button size="sm" variant="outline" className="gap-1" onClick={addItem}><Plus className="h-3.5 w-3.5" /> Agregar producto</Button>
              </div>

              {items.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">Agrega productos para cotizar.</Card>}

              {items.map((it, idx) => (
                <Card key={idx} className="p-3 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0">
                      {it.imagen_url ? (
                        <img src={it.imagen_url} alt="" className="w-20 h-20 object-cover rounded border" />
                      ) : (
                        <div className="w-20 h-20 rounded border border-dashed flex items-center justify-center text-muted-foreground">
                          <ImageIcon className="h-6 w-6" />
                        </div>
                      )}
                      <div className="flex gap-1 mt-1">
                        {it.product_id && (
                          <Popover open={imagePickerIdx === idx} onOpenChange={(o) => setImagePickerIdx(o ? idx : null)}>
                            <PopoverTrigger asChild>
                              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2">Galería</Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-2">
                              <ProductImageGrid productId={it.product_id} onPick={(url) => { updateItem(idx, { imagen_url: url }); setImagePickerIdx(null); }} />
                            </PopoverContent>
                          </Popover>
                        )}
                        <label className="cursor-pointer">
                          <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(idx, f); }} />
                          <span className="inline-flex items-center gap-1 h-6 px-2 text-[10px] border rounded hover:bg-accent"><Upload className="h-3 w-3" /> Subir</span>
                        </label>
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Producto</Label>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeItem(idx)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                      <Popover open={productPickerIdx === idx} onOpenChange={(o) => { setProductPickerIdx(o ? idx : null); if (o) setProductSearch(""); }}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full h-9 justify-start font-normal">
                            <Search className="h-3.5 w-3.5 mr-2" />
                            <span className="truncate">{it.descripcion || "Buscar producto del inventario..."}</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[420px] p-0" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput placeholder="Buscar por nombre o SKU..." value={productSearch} onValueChange={setProductSearch} />
                            <CommandList className="max-h-64">
                              <CommandEmpty>
                                <div className="p-2 space-y-2">
                                  <Button size="sm" variant="outline" className="w-full" onClick={() => { updateItem(idx, { descripcion: productSearch || it.descripcion, product_id: null }); setProductPickerIdx(null); }}>
                                    Usar "{productSearch || "ítem"}" libre
                                  </Button>
                                </div>
                              </CommandEmpty>
                              <CommandGroup heading="Inventario">
                                {filteredProducts.map((p: any) => (
                                  <CommandItem key={p.id} value={p.id} onSelect={() => pickProduct(idx, p)}>
                                    {p.images?.[0] && <img src={p.images[0]} className="w-8 h-8 object-cover rounded mr-2" />}
                                    <span className="flex-1 truncate">{p.name}</span>
                                    <span className="text-xs font-mono">S/{Number(p.price).toFixed(2)}</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <Input placeholder="Descripción (editable)" value={it.descripcion} onChange={e => updateItem(idx, { descripcion: e.target.value })} />
                      <div className="grid grid-cols-3 gap-2">
                        <div><Label className="text-[10px]">Cantidad</Label><Input type="number" min={1} value={it.cantidad} onChange={e => updateItem(idx, { cantidad: parseFloat(e.target.value) || 1 })} /></div>
                        <div><Label className="text-[10px]">P. Unit.</Label><Input type="number" min={0} step="0.01" value={it.precio_unitario} onChange={e => updateItem(idx, { precio_unitario: parseFloat(e.target.value) || 0 })} /></div>
                        <div><Label className="text-[10px]">Subtotal</Label><Input readOnly value={`S/ ${(it.cantidad * it.precio_unitario).toFixed(2)}`} className="font-mono" /></div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Notas</Label><Textarea rows={3} value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} /></div>
              <div><Label>Condiciones</Label><Textarea rows={3} value={form.condiciones} onChange={e => setForm({ ...form, condiciones: e.target.value })} /></div>
            </div>

            <Card className="p-4 bg-secondary/30">
              <div className="grid grid-cols-2 gap-4 items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-primary" />
                    <Label>Descuento (%)</Label>
                    <Input type="number" min={0} max={100} step="0.01" value={form.descuento_pct} onChange={e => setForm({ ...form, descuento_pct: parseFloat(e.target.value) || 0 })} className="w-24 h-8" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="igv" checked={form.incluye_igv} onCheckedChange={(c) => setForm({ ...form, incluye_igv: !!c })} />
                    <Label htmlFor="igv" className="cursor-pointer">Incluir IGV</Label>
                    <Input type="number" min={0} max={100} step="0.01" value={form.igv_pct} onChange={e => setForm({ ...form, igv_pct: parseFloat(e.target.value) || 0 })} className="w-20 h-8" disabled={!form.incluye_igv} />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span>Subtotal:</span><span className="font-mono">S/ {totals.sub.toFixed(2)}</span></div>
                  {form.descuento_pct > 0 && <div className="flex justify-between text-destructive"><span>Descuento:</span><span className="font-mono">- S/ {totals.desc.toFixed(2)}</span></div>}
                  {form.incluye_igv && <div className="flex justify-between"><span>IGV ({form.igv_pct}%):</span><span className="font-mono">S/ {totals.igv.toFixed(2)}</span></div>}
                  <div className="flex justify-between text-lg font-bold border-t border-border pt-1 mt-1"><span>Total:</span><span className="font-mono text-primary">S/ {totals.total.toFixed(2)}</span></div>
                </div>
              </div>
            </Card>
          </div>

          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="secondary" onClick={() => save.mutate(false)} disabled={save.isPending}>Guardar Borrador</Button>
            <Button onClick={() => save.mutate(true)} disabled={save.isPending} className="gap-2"><FileText className="h-4 w-4" /> Emitir Cotización</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ProductImageGrid = ({ productId, onPick }: { productId: string; onPick: (url: string) => void }) => {
  const { data: prod } = useQuery({
    queryKey: ["product_images", productId],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("images").eq("id", productId).maybeSingle();
      return data;
    },
  });
  const imgs = (prod?.images || []) as string[];
  if (imgs.length === 0) return <p className="text-xs text-muted-foreground p-2">Este producto no tiene imágenes.</p>;
  return (
    <div className="grid grid-cols-3 gap-2">
      {imgs.map((url, i) => (
        <button key={i} type="button" className="aspect-square rounded border overflow-hidden hover:ring-2 hover:ring-primary" onClick={() => onPick(url)}>
          <img src={url} alt="" className="w-full h-full object-cover" />
        </button>
      ))}
    </div>
  );
};

export default QuotesPage;
