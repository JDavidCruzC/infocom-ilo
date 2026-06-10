import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Plus, Trash2, Receipt, Pencil, ChevronLeft, ChevronRight, Zap, Download,
  Droplets, Lightbulb, Wifi, Phone, Tv, Flame, Fuel, Bus, Car, Home, Hammer,
  PaintBucket, FileText, Printer, Coffee, Megaphone, Landmark, Package as PkgIcon,
  X, Sparkles,
} from "lucide-react";
import { useAuth } from "@/features/auth/hooks/useAuth";

const CATEGORIES = [
  { value: "servicios", label: "Servicios", icon: Zap, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/30" },
  { value: "limpieza", label: "Limpieza", icon: Droplets, color: "text-cyan-500", bg: "bg-cyan-500/10", border: "border-cyan-500/30" },
  { value: "combustible", label: "Combustible", icon: Fuel, color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/30" },
  { value: "alquiler", label: "Alquiler", icon: Home, color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/30" },
  { value: "mantenimiento", label: "Mantenimiento", icon: Hammer, color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
  { value: "oficina", label: "Oficina", icon: Printer, color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/30" },
  { value: "marketing", label: "Marketing", icon: Megaphone, color: "text-pink-500", bg: "bg-pink-500/10", border: "border-pink-500/30" },
  { value: "alimentacion", label: "Alimentación", icon: Coffee, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  { value: "impuestos", label: "Impuestos", icon: Landmark, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30" },
  { value: "otros", label: "Otros", icon: PkgIcon, color: "text-muted-foreground", bg: "bg-muted", border: "border-border" },
];

const PAYMENT_METHODS = ["Efectivo", "Yape", "Plin", "Transferencia", "Tarjeta", "Otro"];

const todayStr = () => new Date().toISOString().split("T")[0];

const ExpensesPage = () => {
  const qc = useQueryClient();
  const { isAdmin, user } = useAuth();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [activeCat, setActiveCat] = useState("servicios");

  // Quick add modal
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickItem, setQuickItem] = useState<{ name: string; category: string; suggested?: number } | null>(null);
  const [quickAmount, setQuickAmount] = useState("");
  const [quickDate, setQuickDate] = useState(todayStr());
  const [quickMethod, setQuickMethod] = useState("Efectivo");
  const [quickSupplier, setQuickSupplier] = useState("");

  // Add catalog item modal
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemAmount, setNewItemAmount] = useState("");

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);

  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, "0")}`;

  const { data: catalog = [] } = useQuery({
    queryKey: ["expense_catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_catalog" as any)
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses" as any)
        .select("*")
        .gte("expense_date", monthStart)
        .lte("expense_date", monthEnd)
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const totals = useMemo(() => {
    const total = expenses.reduce((a, e) => a + Number(e.amount), 0);
    const byCat: Record<string, number> = {};
    expenses.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount); });
    return { total, byCat };
  }, [expenses]);

  const catalogByCat = useMemo(() => {
    const map: Record<string, any[]> = {};
    catalog.forEach((c) => { if (!map[c.category]) map[c.category] = []; map[c.category].push(c); });
    return map;
  }, [catalog]);

  // ─── Mutations ───
  const addExpense = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.from("expenses" as any).insert({ ...payload, created_by: user?.id || null });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Gasto registrado");
      closeQuick();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addCatalogItem = useMutation({
    mutationFn: async () => {
      if (!newItemName.trim()) throw new Error("Nombre requerido");
      const { error } = await supabase.from("expense_catalog" as any).insert({
        category: activeCat,
        name: newItemName.trim(),
        default_amount: newItemAmount ? parseFloat(newItemAmount) : null,
        sort_order: (catalogByCat[activeCat]?.length || 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense_catalog"] });
      toast.success("Ítem agregado al catálogo");
      setNewItemOpen(false);
      setNewItemName("");
      setNewItemAmount("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteCatalogItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expense_catalog" as any).update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense_catalog"] });
      toast.success("Ítem ocultado");
    },
  });

  const updateExpense = useMutation({
    mutationFn: async () => {
      if (!editForm) return;
      const amt = parseFloat(editForm.amount);
      if (isNaN(amt) || amt < 0) throw new Error("Monto inválido");
      const { error } = await supabase.from("expenses" as any).update({
        description: editForm.description,
        amount: amt,
        expense_date: editForm.expense_date,
        payment_method: editForm.payment_method || null,
        supplier_name: editForm.supplier_name || null,
        notes: editForm.notes || null,
        category: editForm.category,
      }).eq("id", editForm.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Gasto actualizado");
      setEditOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Gasto eliminado");
    },
  });

  const openQuick = (item: any) => {
    setQuickItem({ name: item.name, category: item.category, suggested: item.default_amount });
    setQuickAmount(item.default_amount ? String(item.default_amount) : "");
    setQuickDate(todayStr());
    setQuickMethod("Efectivo");
    setQuickSupplier("");
    setQuickOpen(true);
  };

  const closeQuick = () => { setQuickOpen(false); setQuickItem(null); };

  const submitQuick = () => {
    if (!quickItem) return;
    const amt = parseFloat(quickAmount);
    if (isNaN(amt) || amt <= 0) { toast.error("Ingresa un monto válido"); return; }
    addExpense.mutate({
      category: quickItem.category,
      description: quickItem.name,
      amount: amt,
      expense_date: quickDate,
      payment_method: quickMethod,
      supplier_name: quickSupplier || null,
    });
  };

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  const catMeta = (key: string) => CATEGORIES.find(c => c.value === key) || CATEGORIES[CATEGORIES.length - 1];

  const exportCSV = () => {
    if (expenses.length === 0) { toast.error("Sin gastos para exportar"); return; }
    const headers = ["Fecha","Categoría","Descripción","Proveedor","Método","Monto","Notas"];
    const rows = expenses.map((e: any) => [
      e.expense_date,
      catMeta(e.category).label,
      e.description,
      e.supplier_name || "",
      e.payment_method || "",
      Number(e.amount).toFixed(2),
      (e.notes || "").replace(/\n/g, " "),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gastos_${MONTHS[month]}_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV descargado");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" /> Gastos de la Empresa
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Registra en un clic — los gastos se restan al total del mes en Contabilidad.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="font-semibold text-sm min-w-[160px] text-center">{MONTHS[month]} {year}</span>
          <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={exportCSV}>
            <Download className="h-3 w-3" /> CSV
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Gasto Total del Mes</p>
            <p className="text-3xl font-bold text-destructive font-display">S/. {totals.total.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{expenses.length} registro(s)</p>
          </CardContent>
        </Card>
        {CATEGORIES.slice(0, 3).map((cat) => {
          const Icon = cat.icon;
          const v = totals.byCat[cat.value] || 0;
          return (
            <Card key={cat.value} className={`${cat.border}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-4 w-4 ${cat.color}`} />
                  <p className="text-xs text-muted-foreground">{cat.label}</p>
                </div>
                <p className={`text-xl font-bold ${cat.color}`}>S/. {v.toFixed(2)}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick add: category tabs with item chips */}
      <Card className="border-primary/20">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Registro Rápido
            </Label>
            <Button size="sm" variant="outline" className="gap-1 h-8" onClick={() => setNewItemOpen(true)}>
              <Plus className="h-3 w-3" /> Nuevo ítem
            </Button>
          </div>

          <Tabs value={activeCat} onValueChange={setActiveCat}>
            <TabsList className="flex flex-wrap h-auto gap-1 bg-secondary/40 p-1">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const count = catalogByCat[cat.value]?.length || 0;
                return (
                  <TabsTrigger key={cat.value} value={cat.value} className="text-xs gap-1 data-[state=active]:bg-background">
                    <Icon className={`h-3 w-3 ${cat.color}`} /> {cat.label}
                    {count > 0 && <span className="text-[9px] opacity-60">({count})</span>}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {CATEGORIES.map((cat) => (
              <TabsContent key={cat.value} value={cat.value} className="mt-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {(catalogByCat[cat.value] || []).map((item) => (
                    <div key={item.id} className={`group relative ${cat.bg} ${cat.border} border rounded-lg p-3 hover:shadow-lg hover:scale-[1.02] transition cursor-pointer`} onClick={() => openQuick(item)}>
                      <div className="flex items-start gap-2">
                        <cat.icon className={`h-4 w-4 ${cat.color} mt-0.5 flex-shrink-0`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate">{item.name}</p>
                          {item.default_amount && <p className="text-[10px] text-muted-foreground">~ S/. {Number(item.default_amount).toFixed(2)}</p>}
                        </div>
                      </div>
                      {isAdmin && (
                        <button
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition p-0.5 rounded hover:bg-destructive/20 text-destructive"
                          onClick={(e) => { e.stopPropagation(); if (confirm(`¿Ocultar "${item.name}" del catálogo?`)) deleteCatalogItem.mutate(item.id); }}
                          title="Ocultar"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {(catalogByCat[cat.value]?.length || 0) === 0 && (
                    <p className="col-span-full text-xs text-muted-foreground text-center py-6">
                      Sin ítems. Usa "Nuevo ítem" para crear uno rápido para esta categoría.
                    </p>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Expenses list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Gastos registrados en {MONTHS[month]}</h2>
        </div>
        <div className="border border-border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">Cargando...</TableCell></TableRow>
              ) : expenses.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin gastos en este mes</TableCell></TableRow>
              ) : expenses.map((e: any) => {
                const cm = catMeta(e.category);
                const Icon = cm.icon;
                return (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-xs">{new Date(e.expense_date + "T12:00:00").toLocaleDateString("es-PE")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] gap-1 ${cm.bg} ${cm.color} ${cm.border}`}>
                        <Icon className="h-3 w-3" /> {cm.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{e.description}</TableCell>
                    <TableCell className="text-xs">{e.supplier_name || "—"}</TableCell>
                    <TableCell className="text-xs">{e.payment_method || "—"}</TableCell>
                    <TableCell className="text-right font-bold text-destructive">- S/. {Number(e.amount).toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditForm({ ...e, amount: String(e.amount) }); setEditOpen(true); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("¿Eliminar este gasto?")) deleteExpense.mutate(e.id); }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* QUICK ADD modal */}
      <Dialog open={quickOpen} onOpenChange={(o) => { if (!o) closeQuick(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" /> Registrar Gasto
            </DialogTitle>
          </DialogHeader>
          {quickItem && (
            <div className="space-y-3">
              <div className={`p-3 rounded-lg border ${catMeta(quickItem.category).bg} ${catMeta(quickItem.category).border}`}>
                <p className="text-[10px] text-muted-foreground uppercase">{catMeta(quickItem.category).label}</p>
                <p className="font-bold">{quickItem.name}</p>
              </div>
              <div>
                <Label>Monto (S/.) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  autoFocus
                  placeholder="0.00"
                  value={quickAmount}
                  onChange={(e) => setQuickAmount(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitQuick(); }}
                  className="text-2xl h-14 font-bold text-center"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Fecha</Label>
                  <Input type="date" value={quickDate} onChange={(e) => setQuickDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Método</Label>
                  <Select value={quickMethod} onValueChange={setQuickMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Proveedor (opcional)</Label>
                <Input placeholder="Ej: Electrosur, Primax..." value={quickSupplier} onChange={(e) => setQuickSupplier(e.target.value)} />
              </div>
              <Button className="w-full h-11 font-bold" onClick={submitQuick} disabled={addExpense.isPending}>
                {addExpense.isPending ? "Guardando..." : "Registrar Gasto"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* NEW CATALOG ITEM modal */}
      <Dialog open={newItemOpen} onOpenChange={setNewItemOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo ítem en "{catMeta(activeCat).label}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nombre *</Label>
              <Input autoFocus placeholder="Ej: Recibo de gas" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} />
            </div>
            <div>
              <Label>Monto sugerido (opcional)</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={newItemAmount} onChange={(e) => setNewItemAmount(e.target.value)} />
              <p className="text-[10px] text-muted-foreground mt-1">Se autocompletará cuando uses este ítem rápido.</p>
            </div>
            <Button className="w-full" onClick={() => addCatalogItem.mutate()} disabled={addCatalogItem.isPending}>
              Agregar al catálogo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* EDIT expense modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar Gasto</DialogTitle></DialogHeader>
          {editForm && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Categoría</Label>
                  <Select value={editForm.category} onValueChange={(v) => setEditForm({ ...editForm, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Fecha</Label>
                  <Input type="date" value={editForm.expense_date} onChange={(e) => setEditForm({ ...editForm, expense_date: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Descripción</Label>
                <Input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Monto (S/.)</Label>
                  <Input type="number" step="0.01" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Método</Label>
                  <Select value={editForm.payment_method || "Efectivo"} onValueChange={(v) => setEditForm({ ...editForm, payment_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Proveedor</Label>
                <Input value={editForm.supplier_name || ""} onChange={(e) => setEditForm({ ...editForm, supplier_name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Notas</Label>
                <Textarea rows={2} value={editForm.notes || ""} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
              </div>
              <Button className="w-full" onClick={() => updateExpense.mutate()} disabled={updateExpense.isPending}>
                Guardar Cambios
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExpensesPage;
