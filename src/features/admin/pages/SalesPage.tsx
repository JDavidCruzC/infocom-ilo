import { useState, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ShoppingCart, Search, Plus, Minus, X, Receipt, User, Loader2, Printer, AlertCircle, FileText } from "lucide-react";
import { loadTemplate, buildHeaderHtml, buildSaleFooter, buildCopyright, loadCompanyInfo, type CompanyReceiptInfo, DEFAULT_COMPANY_INFO } from "@/features/admin/components/PrintReceipt";
import { CURRENCY, PAYMENT_METHOD_LABELS } from "@/lib/types";
import type { PaymentMethod } from "@/lib/types";
import { useAuth } from "@/features/auth/hooks/useAuth";
import QuickTransactionDialog from "@/features/admin/components/QuickTransactionDialog";

interface CartItem {
  product_id: string;
  name: string;
  image: string;
  price: number;
  stock: number;
  quantity: number;
}

type SaleType = "boleta" | "simple";

const SalesPage = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [dniLoading, setDniLoading] = useState(false);
  const [dniNotFound, setDniNotFound] = useState(false);
  const [quickTxOpen, setQuickTxOpen] = useState(false);


  const [saleType, setSaleType] = useState<SaleType>("simple");

  const [customerForm, setCustomerForm] = useState({
    dni: "",
    nombre: "",
    direccion: "",
    telefono: "",
    email: "",
    metodo_pago: "" as string,
    monto_recibido: "",
  });

  // Last completed sale for printing
  const [lastSale, setLastSale] = useState<{ items: CartItem[]; customer: typeof customerForm; total: number; date: string; saleType: SaleType; change: number; ticket_number?: string; created_at?: string } | null>(null);
  const [printOpen, setPrintOpen] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["pos_products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, slug, price, stock, images, short_description, is_active")
        .eq("is_active", true)
        .gt("stock", 0)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.short_description || "").toLowerCase().includes(q)
    );
  }, [products, search]);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(c => c.product_id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast.error("Stock insuficiente");
          return prev;
        }
        return prev.map(c => c.product_id === product.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, {
        product_id: product.id,
        name: product.name,
        image: product.images?.[0] || "",
        price: product.price,
        stock: product.stock,
        quantity: 1,
      }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.product_id !== productId) return c;
      const newQty = c.quantity + delta;
      if (newQty <= 0) return c;
      if (newQty > c.stock) { toast.error("Stock insuficiente"); return c; }
      return { ...c, quantity: newQty };
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(c => c.product_id !== productId));
  };

  const subtotal = cart.reduce((a, c) => a + c.price * c.quantity, 0);
  const total = subtotal;

  const lookupDNI = async () => {
    if (customerForm.dni.length !== 8) {
      toast.error("DNI debe tener 8 dígitos");
      return;
    }
    setDniLoading(true);
    setDniNotFound(false);
    try {
      const { data, error } = await supabase.functions.invoke("dni-lookup", {
        body: { dni: customerForm.dni },
      });
      if (error) throw error;
      if (data?.nombre) {
        setCustomerForm(prev => ({
          ...prev,
          nombre: data.nombre,
          direccion: data.direccion || prev.direccion,
        }));
        toast.success("Datos encontrados");
      } else {
        setDniNotFound(true);
        toast.warning("No se encontró el DNI. Ingresa el nombre manualmente.");
      }
    } catch {
      setDniNotFound(true);
      toast.warning("No se pudo consultar el DNI. Ingresa el nombre manualmente.");
    }
    setDniLoading(false);
  };

  const openCheckout = () => {
    setDniNotFound(false);
    setCheckoutOpen(true);
  };

  const handleCheckout = async () => {
    if (saleType === "boleta" && !customerForm.nombre) {
      toast.error("Nombre es requerido para boleta");
      return;
    }
    if (!customerForm.metodo_pago) { toast.error("Selecciona método de pago"); return; }
    setProcessing(true);

    try {
      const notaParts = [];
      if (saleType === "boleta") notaParts.push(`BOLETA | DNI: ${customerForm.dni || "N/A"}`);
      else notaParts.push("VENTA SIMPLE");
      if (customerForm.direccion) notaParts.push(`Dir: ${customerForm.direccion}`);
      if (customerForm.email) notaParts.push(`Email: ${customerForm.email}`);
      notaParts.push(`Pago: ${PAYMENT_METHOD_LABELS[customerForm.metodo_pago as PaymentMethod] || customerForm.metodo_pago}`);

      const { data: tx, error: txErr } = await supabase.from("transactions").insert({
        fecha: new Date().toISOString().split("T")[0],
        cliente_nombre: customerForm.nombre || null,
        cliente_telefono: customerForm.telefono || null,
        notas: notaParts.join(" | "),
        estado: "emitido" as any,
        emitido_en: new Date().toISOString(),
        emitido_por: user?.email || "POS",
        created_by: user?.id || null,
      }).select("id, ticket_number, created_at").single();
      if (txErr) throw txErr;

      const itemPayload = cart.map(c => ({
        transaction_id: tx.id,
        item_type: "producto" as const,
        descripcion: c.name,
        referencia_id: c.product_id,
        cantidad: c.quantity,
        precio_unitario: c.price,
        subtotal: c.price * c.quantity,
      }));
      const { error: itemErr } = await supabase.from("transaction_items").insert(itemPayload as any);
      if (itemErr) throw itemErr;

      await supabase.from("transaction_history").insert({
        transaction_id: tx.id,
        accion: "venta_pos",
        detalles: { items: itemPayload, cliente: customerForm, tipo: saleType } as any,
        usuario_id: user?.id || null,
      });

      for (const c of cart) {
        await supabase.from("products").update({ stock: c.stock - c.quantity } as any).eq("id", c.product_id);
      }

      const montoRecibido = parseFloat(customerForm.monto_recibido) || 0;
      const cambio = montoRecibido > total ? montoRecibido - total : 0;

      // Store last sale for printing
      setLastSale({
        items: [...cart],
        customer: { ...customerForm },
        total,
        date: new Date().toLocaleString("es-PE"),
        saleType,
        change: cambio,
        ticket_number: (tx as any).ticket_number || "",
        created_at: (tx as any).created_at || new Date().toISOString(),
      });

      toast.success("¡Venta registrada exitosamente!");
      qc.invalidateQueries({ queryKey: ["pos_products"] });
      setCart([]);
      setCheckoutOpen(false);
      setCustomerForm({ dni: "", nombre: "", direccion: "", telefono: "", email: "", metodo_pago: "", monto_recibido: "" });
      setPrintOpen(true);
    } catch (e: any) {
      toast.error(e.message || "Error al procesar venta");
    }
    setProcessing(false);
  };

  const printReceipt = async () => {
    if (!lastSale) return;
    const template = loadTemplate();
    const ci = await loadCompanyInfo();

    const PAPER_SIZES: Record<string, string> = { "50mm": "180px", "58mm": "210px", "80mm": "300px", A4: "700px" };
    const sz = PAPER_SIZES[template.paperSize] || "210px";
    const fs = parseInt(template.fontSize) || 12;
    const title = lastSale.saleType === "boleta" ? template.saleTitle : "NOTA DE VENTA";
    const ticketNum = lastSale.ticket_number || "------";
    const hora = lastSale.created_at ? new Date(lastSale.created_at).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "";

    const headerHtml = buildHeaderHtml(template, true, ci);

    const itemsHtml = lastSale.items.map(c =>
      `<div class="row"><span>${c.quantity}x ${c.name}</span><span class="bold">S/${(c.price * c.quantity).toLocaleString()}</span></div>`
    ).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ticket</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',monospace;font-size:${fs}px;font-weight:700;padding:8px;max-width:${sz};margin:0 auto;color:#000}
.center{text-align:center}.bold{font-weight:900}.line{border-top:1px dashed #000;margin:6px 0}
.row{display:flex;justify-content:space-between;margin:2px 0;gap:4px}
.title{font-size:${fs + 4}px;font-weight:900;margin-bottom:2px}
.subtitle{font-size:${Math.max(fs - 2, 8)}px;margin-bottom:6px;font-weight:700}
.company-info{font-size:${Math.max(fs - 3, 7)}px;margin:4px 0;font-weight:700;line-height:1.4}
.big{font-size:${fs + 6}px;font-weight:900}
.footer{margin-top:12px;font-size:${Math.max(fs - 3, 8)}px;text-align:center;font-weight:700}
@media print{body{padding:4px}@page{margin:2mm}}
</style></head><body>
${headerHtml}
<div class="line"></div>
<div class="center big">${title}</div>
<div class="center" style="font-size:${fs}px;font-weight:900">N° ${ticketNum}</div>
<div class="line"></div>
<div class="row"><span>Fecha:</span><span>${lastSale.date}</span></div>
${hora ? `<div class="row"><span>Hora:</span><span>${hora}</span></div>` : ""}
${lastSale.customer.nombre ? `<div class="row"><span>Cliente:</span><span class="bold">${lastSale.customer.nombre}</span></div>` : ""}
${lastSale.saleType === "boleta" && lastSale.customer.dni ? `<div class="row"><span>DNI:</span><span>${lastSale.customer.dni}</span></div>` : ""}
${lastSale.customer.telefono ? `<div class="row"><span>Telefono:</span><span>${lastSale.customer.telefono}</span></div>` : ""}
<div class="line"></div>
${itemsHtml}
<div class="line"></div>
<div class="row"><span class="bold">TOTAL:</span><span class="bold big">S/${lastSale.total.toLocaleString()}</span></div>
<div class="row"><span>Metodo:</span><span>${PAYMENT_METHOD_LABELS[lastSale.customer.metodo_pago as PaymentMethod] || lastSale.customer.metodo_pago}</span></div>
${lastSale.customer.metodo_pago === "cash" && lastSale.change > 0 ? `<div class="row"><span>Recibido:</span><span>S/${parseFloat(lastSale.customer.monto_recibido).toFixed(2)}</span></div>
<div class="row"><span class="bold">Vuelto:</span><span class="bold">S/${lastSale.change.toFixed(2)}</span></div>` : ""}
<div class="footer"><p>${buildSaleFooter(ci)}</p><p style="margin-top:4px;font-size:${Math.max(fs - 4, 6)}px">${buildCopyright(ci)}</p></div>
</body></html>`;

    const w = window.open("", "_blank", "width=500,height=700");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)]">
      {/* Left - Products */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <ShoppingCart className="h-6 w-6 text-primary" /> Punto de Venta
            </h1>
            <Button size="sm" className="gap-2" onClick={() => setQuickTxOpen(true)}>
              <Plus className="h-4 w-4" /> Nueva Transacción
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar producto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredProducts.map(p => (
              <Card
                key={p.id}
                className="border-primary/10 cursor-pointer hover:border-primary/30 hover:shadow-md transition-all"
                onClick={() => addToCart(p)}
              >
                <CardContent className="p-3">
                  <div className="aspect-square bg-secondary/30 rounded-lg mb-2 overflow-hidden">
                    {p.images?.[0] ? (
                      <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                        <ShoppingCart className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <p className="font-medium text-xs line-clamp-2 mb-1">{p.name}</p>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary text-sm">{CURRENCY}{p.price.toLocaleString()}</span>
                    <Badge variant="outline" className="text-[10px]">Stock: {p.stock}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredProducts.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No se encontraron productos
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right - Cart */}
      <Card className="w-80 xl:w-96 shrink-0 flex flex-col border-primary/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" /> Detalle de Venta
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col overflow-hidden p-4 pt-0">
          <div className="flex-1 overflow-y-auto space-y-2">
            {cart.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Selecciona productos</p>
              </div>
            )}
            {cart.map(c => (
              <div key={c.product_id} className="flex items-center gap-2 p-2 bg-secondary/30 rounded-lg">
                <div className="h-10 w-10 rounded bg-background overflow-hidden shrink-0">
                  {c.image ? <img src={c.image} alt="" className="w-full h-full object-cover" /> : <ShoppingCart className="w-full h-full p-2 text-muted-foreground/30" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{c.name}</p>
                  <p className="text-xs text-primary font-bold">{CURRENCY}{(c.price * c.quantity).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(c.product_id, -1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-xs font-bold w-6 text-center">{c.quantity}</span>
                  <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(c.product_id, 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeFromCart(c.product_id)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-3 mt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{CURRENCY}{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-primary">{CURRENCY}{total.toLocaleString()}</span>
            </div>
            <Button
              className="w-full gap-2"
              size="lg"
              disabled={cart.length === 0}
              onClick={openCheckout}
            >
              <Receipt className="h-4 w-4" /> Generar Venta
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Checkout Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" /> Datos de Venta
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Sale type toggle */}
            <div className="space-y-2">
              <Label className="font-bold">Tipo de Venta</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={saleType === "simple" ? "default" : "outline"}
                  className="gap-2"
                  onClick={() => setSaleType("simple")}
                >
                  <ShoppingCart className="h-4 w-4" /> Venta Simple
                </Button>
                <Button
                  type="button"
                  variant={saleType === "boleta" ? "default" : "outline"}
                  className="gap-2"
                  onClick={() => setSaleType("boleta")}
                >
                  <FileText className="h-4 w-4" /> Boleta con DNI
                </Button>
              </div>
            </div>

            {/* DNI field - only for boleta */}
            {saleType === "boleta" && (
              <div className="space-y-2">
                <Label>DNI</Label>
                <div className="flex gap-2">
                  <Input
                    value={customerForm.dni}
                    onChange={e => {
                      setDniNotFound(false);
                      setCustomerForm(prev => ({ ...prev, dni: e.target.value.replace(/\D/g, "").slice(0, 8) }));
                    }}
                    placeholder="12345678"
                    maxLength={8}
                  />
                  <Button
                    variant="outline"
                    onClick={lookupDNI}
                    disabled={dniLoading || customerForm.dni.length !== 8}
                    className="shrink-0"
                  >
                    {dniLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
                {dniNotFound && (
                  <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 p-2 rounded-md">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>No se encontró el DNI. Ingresa el nombre manualmente.</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>{saleType === "boleta" ? "Nombre completo *" : "Nombre (opcional)"}</Label>
              <Input
                value={customerForm.nombre}
                onChange={e => setCustomerForm(prev => ({ ...prev, nombre: e.target.value }))}
                placeholder={saleType === "boleta" ? "Nombre del cliente" : "Cliente general"}
              />
            </div>

            <div className="space-y-2">
              <Label>Teléfono {saleType === "boleta" ? "*" : "(opcional)"}</Label>
              <Input value={customerForm.telefono} onChange={e => setCustomerForm(prev => ({ ...prev, telefono: e.target.value }))} />
            </div>

            {saleType === "boleta" && (
              <>
                <div className="space-y-2">
                  <Label>Dirección</Label>
                  <Input value={customerForm.direccion} onChange={e => setCustomerForm(prev => ({ ...prev, direccion: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Correo (opcional)</Label>
                  <Input value={customerForm.email} onChange={e => setCustomerForm(prev => ({ ...prev, email: e.target.value }))} />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Método de pago *</Label>
              <Select value={customerForm.metodo_pago} onValueChange={v => setCustomerForm(prev => ({ ...prev, metodo_pago: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccione una opción" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cash change calculator - show when payment is cash */}
            {customerForm.metodo_pago === "cash" && (
              <div className="space-y-2 p-3 border border-primary/20 rounded-lg bg-primary/5">
                <Label className="font-bold">💵 Monto Recibido</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ej: 100.00"
                  value={customerForm.monto_recibido}
                  onChange={e => setCustomerForm(prev => ({ ...prev, monto_recibido: e.target.value }))}
                />
                {parseFloat(customerForm.monto_recibido) > 0 && (
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Total a cobrar:</span>
                      <span className="font-bold">{CURRENCY}{total.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Monto recibido:</span>
                      <span className="font-bold">{CURRENCY}{parseFloat(customerForm.monto_recibido).toLocaleString()}</span>
                    </div>
                    <div className={`flex justify-between text-lg font-bold border-t border-border pt-1 ${parseFloat(customerForm.monto_recibido) >= total ? "text-success" : "text-destructive"}`}>
                      <span>Vuelto:</span>
                      <span>
                        {parseFloat(customerForm.monto_recibido) >= total
                          ? `${CURRENCY}${(parseFloat(customerForm.monto_recibido) - total).toFixed(2)}`
                          : `Faltan ${CURRENCY}${(total - parseFloat(customerForm.monto_recibido)).toFixed(2)}`
                        }
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="bg-secondary/30 p-3 rounded-lg">
              <div className="flex justify-between font-bold text-lg">
                <span>TOTAL:</span>
                <span className="text-primary">{CURRENCY}{total.toLocaleString()}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{cart.length} producto(s) · {saleType === "boleta" ? "Boleta" : "Venta Simple"}</p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCheckoutOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleCheckout} disabled={processing} className="flex-1">
                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Generar Venta
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print dialog after sale */}
      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Receipt className="h-5 w-5" /> ¡Venta Registrada!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              La venta se registró exitosamente en contabilidad.
            </p>
            {lastSale && (
              <div className="bg-secondary/30 rounded-lg p-3 text-sm space-y-1">
                {lastSale.customer.nombre && <p><span className="text-muted-foreground">Cliente:</span> <span className="font-bold">{lastSale.customer.nombre}</span></p>}
                <p><span className="text-muted-foreground">Método:</span> <span className="font-bold">{PAYMENT_METHOD_LABELS[lastSale.customer.metodo_pago as PaymentMethod] || lastSale.customer.metodo_pago}</span></p>
                <p className="font-bold text-lg text-primary">{CURRENCY}{lastSale.total.toLocaleString()}</p>
                {lastSale.change > 0 && (
                  <p className="text-success font-bold text-base">Vuelto: {CURRENCY}{lastSale.change.toFixed(2)}</p>
                )}
                <p className="text-xs text-muted-foreground">{lastSale.items.length} producto(s)</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPrintOpen(false)} className="flex-1">
                Cerrar
              </Button>
              <Button onClick={() => { printReceipt(); }} className="flex-1 gap-2">
                <Printer className="h-4 w-4" /> Imprimir Ticket
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <QuickTransactionDialog open={quickTxOpen} onOpenChange={setQuickTxOpen} />
    </div>
  );
};

export default SalesPage;
