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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Receipt, Pencil, Search } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/useAuth";

const CATEGORIES = [
  { value: "servicios", label: "Servicios (agua, luz, internet, teléfono)" },
  { value: "limpieza", label: "Limpieza (poet, lejía, cloro, papel higiénico, etc.)" },
  { value: "combustible", label: "Combustible / Pasajes" },
  { value: "alquiler", label: "Alquiler" },
  { value: "mantenimiento", label: "Mantenimiento / Reparaciones" },
  { value: "oficina", label: "Insumos de oficina" },
  { value: "marketing", label: "Marketing / Publicidad" },
  { value: "alimentacion", label: "Alimentación / Refrigerios" },
  { value: "impuestos", label: "Impuestos / Trámites" },
  { value: "otros", label: "Otros" },
];

const CATEGORY_COLORS: Record<string, string> = {
  servicios: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  limpieza: "bg-cyan-500/15 text-cyan-500 border-cyan-500/30",
  combustible: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  alquiler: "bg-purple-500/15 text-purple-500 border-purple-500/30",
  mantenimiento: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  oficina: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  marketing: "bg-pink-500/15 text-pink-500 border-pink-500/30",
  alimentacion: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  impuestos: "bg-red-500/15 text-red-500 border-red-500/30",
  otros: "bg-muted text-muted-foreground border-border",
};

const PAYMENT_METHODS = ["Efectivo", "Yape", "Plin", "Transferencia", "Tarjeta", "Otro"];

const emptyForm = {
  id: "",
  category: "servicios",
  description: "",
  amount: "",
  expense_date: new Date().toISOString().split("T")[0],
  payment_method: "Efectivo",
  supplier_name: "",
  notes: "",
};

const ExpensesPage = () => {
  const qc = useQueryClient();
  const { isAdmin, user } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses" as any)
        .select("*")
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = useMemo(() => {
    return expenses.filter((e: any) => {
      if (filterCat !== "all" && e.category !== filterCat) return false;
      if (filterMonth && !e.expense_date?.startsWith(filterMonth)) return false;
      if (search && !`${e.description} ${e.supplier_name || ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [expenses, search, filterCat, filterMonth]);

  const totals = useMemo(() => {
    const monthTotal = filtered.reduce((a, e) => a + Number(e.amount), 0);
    const byCat: Record<string, number> = {};
    filtered.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount); });
    return { monthTotal, byCat };
  }, [filtered]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.description.trim()) throw new Error("Descripción requerida");
      const amt = parseFloat(form.amount);
      if (isNaN(amt) || amt < 0) throw new Error("Monto inválido");
      const payload: any = {
        category: form.category,
        description: form.description.trim(),
        amount: amt,
        expense_date: form.expense_date,
        payment_method: form.payment_method || null,
        supplier_name: form.supplier_name.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (form.id) {
        const { error } = await supabase.from("expenses" as any).update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        payload.created_by = user?.id || null;
        const { error } = await supabase.from("expenses" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success(form.id ? "Gasto actualizado" : "Gasto registrado");
      closeForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Gasto eliminado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const closeForm = () => { setFormOpen(false); setForm(emptyForm); };

  const editExpense = (e: any) => {
    setForm({
      id: e.id,
      category: e.category,
      description: e.description,
      amount: String(e.amount),
      expense_date: e.expense_date,
      payment_method: e.payment_method || "Efectivo",
      supplier_name: e.supplier_name || "",
      notes: e.notes || "",
    });
    setFormOpen(true);
  };

  const categoryLabel = (key: string) => CATEGORIES.find((c) => c.value === key)?.label.split(" ")[0] || key;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" /> Gastos de la Empresa
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Servicios, limpieza, combustible y otros egresos operativos</p>
        </div>
        <Button className="gap-2" onClick={() => { setForm(emptyForm); setFormOpen(true); }}>
          <Plus className="h-4 w-4" /> Nuevo Gasto
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total del periodo filtrado</p>
            <p className="text-3xl font-bold text-primary font-display">S/. {totals.monthTotal.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{filtered.length} registro(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Top categorías</p>
            <div className="space-y-1">
              {Object.entries(totals.byCat).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="capitalize">{categoryLabel(k)}</span>
                  <span className="font-bold">S/. {v.toFixed(2)}</span>
                </div>
              ))}
              {Object.keys(totals.byCat).length === 0 && <p className="text-xs text-muted-foreground">Sin datos</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Promedio por gasto</p>
            <p className="text-2xl font-bold">S/. {filtered.length ? (totals.monthTotal / filtered.length).toFixed(2) : "0.00"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-[1fr_180px_180px] gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar descripción o proveedor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} />
        </CardContent>
      </Card>

      {/* Table */}
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
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin gastos en este periodo</TableCell></TableRow>
            ) : filtered.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap text-xs">{new Date(e.expense_date + "T12:00:00").toLocaleDateString("es-PE")}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[10px] capitalize ${CATEGORY_COLORS[e.category] || ""}`}>
                    {categoryLabel(e.category)}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[280px]">
                  <p className="font-medium text-sm">{e.description}</p>
                  {e.notes && <p className="text-[10px] text-muted-foreground truncate">{e.notes}</p>}
                </TableCell>
                <TableCell className="text-xs">{e.supplier_name || "—"}</TableCell>
                <TableCell className="text-xs">{e.payment_method || "—"}</TableCell>
                <TableCell className="text-right font-bold text-destructive">- S/. {Number(e.amount).toFixed(2)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => editExpense(e)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    {isAdmin && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("¿Eliminar este gasto?")) deleteMutation.mutate(e.id); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => { if (!o) closeForm(); else setFormOpen(true); }}>
        <DialogContent className="max-w-xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" /> {form.id ? "Editar Gasto" : "Nuevo Gasto"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoría *</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fecha *</Label>
                <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Descripción *</Label>
              <Input placeholder="Ej: Recibo de luz noviembre" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Monto (S/.) *</Label>
                <Input type="number" step="0.01" min="0" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <Label>Método de pago</Label>
                <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Proveedor / Establecimiento</Label>
              <Input placeholder="Ej: Electrosur, Grifo Primax, etc." value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
              {form.id ? "Guardar Cambios" : "Registrar Gasto"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExpensesPage;
