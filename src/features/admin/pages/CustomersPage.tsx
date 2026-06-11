import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Users, Plus, Search, Star, Phone, Mail, IdCard, Gift, TrendingUp, BarChart3, Crown, Award, Download, Eye } from "lucide-react";
import { CustomerDetailDialog } from "@/features/admin/components/CustomerDetailDialog";
import { CURRENCY } from "@/lib/types";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import XLSX from "xlsx-js-style";

const emptyForm = {
  full_name: "", phone: "", email: "", document_number: "", address: "", notes: "", is_vip: false,
};

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 220 70% 50%))",
  "hsl(var(--chart-3, 340 75% 55%))",
  "hsl(var(--chart-4, 160 60% 45%))",
  "hsl(var(--chart-5, 30 80% 55%))",
];

const CustomersPage = () => {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [filterVip, setFilterVip] = useState(false);
  const [activeTab, setActiveTab] = useState("lista");
  const [detailCustomerId, setDetailCustomerId] = useState<string | null>(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        full_name: form.full_name, phone: form.phone || null,
        email: form.email || null, document_number: form.document_number || null,
        address: form.address || null, notes: form.notes || null, is_vip: form.is_vip,
      };
      if (editingId) {
        const { error } = await supabase.from("customers").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success(editingId ? "Cliente actualizado" : "Cliente registrado");
      setForm(emptyForm); setEditingId(null); setDialogOpen(false);
    },
    onError: () => toast.error("Error al guardar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Cliente eliminado");
    },
  });

  const openEdit = (c: any) => {
    setForm({
      full_name: c.full_name, phone: c.phone || "", email: c.email || "",
      document_number: c.document_number || "", address: c.address || "",
      notes: c.notes || "", is_vip: c.is_vip,
    });
    setEditingId(c.id); setDialogOpen(true);
  };

  const filtered = customers.filter((c: any) => {
    if (filterVip && !c.is_vip) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return c.full_name?.toLowerCase().includes(s) || c.phone?.includes(s) || c.document_number?.includes(s);
  });

  const vipCount = customers.filter((c: any) => c.is_vip).length;
  const totalSpent = customers.reduce((sum: number, c: any) => sum + Number(c.total_spent || 0), 0);
  const loyalCount = customers.filter((c: any) => (c.total_purchases || 0) >= 5).length;

  // ─── Analytics data ──────────────────────────────────────────
  const topBuyers = useMemo(() => {
    return [...customers]
      .sort((a: any, b: any) => Number(b.total_spent || 0) - Number(a.total_spent || 0))
      .slice(0, 10)
      .map((c: any) => ({
        name: c.full_name?.length > 15 ? c.full_name.substring(0, 15) + "…" : c.full_name,
        total: Number(c.total_spent || 0),
        compras: c.total_purchases || 0,
        vip: c.is_vip,
      }));
  }, [customers]);

  const loyaltyDistribution = useMemo(() => {
    const ranges = [
      { name: "Nuevos (0-1)", min: 0, max: 1 },
      { name: "Ocasional (2-4)", min: 2, max: 4 },
      { name: "Frecuente (5-9)", min: 5, max: 9 },
      { name: "Fiel (10-19)", min: 10, max: 19 },
      { name: "Premium (20+)", min: 20, max: Infinity },
    ];
    return ranges.map(r => ({
      name: r.name,
      value: customers.filter((c: any) => {
        const p = c.total_purchases || 0;
        return p >= r.min && p <= r.max;
      }).length,
    })).filter(r => r.value > 0);
  }, [customers]);

  const spendingDistribution = useMemo(() => {
    const ranges = [
      { name: "S/0-50", min: 0, max: 50 },
      { name: "S/50-200", min: 50, max: 200 },
      { name: "S/200-500", min: 200, max: 500 },
      { name: "S/500-1000", min: 500, max: 1000 },
      { name: "S/1000+", min: 1000, max: Infinity },
    ];
    return ranges.map(r => ({
      name: r.name,
      clientes: customers.filter((c: any) => {
        const s = Number(c.total_spent || 0);
        return s >= r.min && s < r.max;
      }).length,
    })).filter(r => r.clientes > 0);
  }, [customers]);

  // ─── Export to Excel (for raffles & marketing) ───
  const exportExcel = () => {
    const data = filtered.length > 0 ? filtered : customers;
    if (data.length === 0) return;
    const headers = ["#", "Nombre Completo", "DNI", "Teléfono", "Email", "Dirección", "VIP", "Compras", "Total Gastado (S/)", "Última Compra", "Notas"];
    const rows = data.map((c: any, i: number) => [
      i + 1,
      c.full_name || "",
      c.document_number || "",
      c.phone || "",
      c.email || "",
      c.address || "",
      c.is_vip ? "SÍ" : "",
      Number(c.total_purchases || 0),
      Number(c.total_spent || 0),
      c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleDateString("es-PE") : "",
      c.notes || "",
    ]);
    const title = [`DIRECTORIO DE CLIENTES — INFOCOM SOLUCIONES`];
    const subtitle = [`Generado: ${new Date().toLocaleString("es-PE")}  •  Total: ${data.length} clientes`];
    const aoa: any[][] = [title, subtitle, [], headers, ...rows];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [
      { wch: 5 }, { wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 28 },
      { wch: 30 }, { wch: 6 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 30 },
    ];
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
    ];

    // Title styles
    const titleCell = ws[XLSX.utils.encode_cell({ r: 0, c: 0 })];
    if (titleCell) titleCell.s = { font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "0E7C3A" } }, alignment: { horizontal: "center", vertical: "center" } };
    const subCell = ws[XLSX.utils.encode_cell({ r: 1, c: 0 })];
    if (subCell) subCell.s = { font: { italic: true, sz: 10, color: { rgb: "555555" } }, alignment: { horizontal: "center" } };

    // Header row styles
    headers.forEach((_, c) => {
      const ref = XLSX.utils.encode_cell({ r: 3, c });
      if (!ws[ref]) return;
      ws[ref].s = {
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
        fill: { fgColor: { rgb: "16A34A" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: { top: { style: "thin", color: { rgb: "0E7C3A" } }, bottom: { style: "thin", color: { rgb: "0E7C3A" } }, left: { style: "thin", color: { rgb: "0E7C3A" } }, right: { style: "thin", color: { rgb: "0E7C3A" } } },
      };
    });

    // Body styling
    rows.forEach((_, ri) => {
      const r = ri + 4;
      const isVip = data[ri].is_vip;
      headers.forEach((_, c) => {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (!ws[ref]) ws[ref] = { v: "", t: "s" };
        ws[ref].s = {
          font: { sz: 10, color: { rgb: isVip ? "9A6B00" : "111111" }, bold: isVip },
          fill: { fgColor: { rgb: ri % 2 === 0 ? (isVip ? "FFF8DC" : "F7FAF7") : (isVip ? "FFF1B8" : "FFFFFF") } },
          alignment: { horizontal: c === 1 || c === 4 || c === 5 || c === 10 ? "left" : "center", vertical: "center", wrapText: true },
          border: { top: { style: "hair", color: { rgb: "CCCCCC" } }, bottom: { style: "hair", color: { rgb: "CCCCCC" } }, left: { style: "hair", color: { rgb: "CCCCCC" } }, right: { style: "hair", color: { rgb: "CCCCCC" } } },
          numFmt: c === 8 ? '"S/. "#,##0.00' : undefined,
        };
      });
    });

    ws["!rows"] = [{ hpt: 28 }, { hpt: 18 }, { hpt: 6 }, { hpt: 26 }];

    // Sheet 2: just names for raffles
    const aoa2: any[][] = [["SORTEO — LISTADO DE NOMBRES"], [`Total: ${data.length} participantes`], [], ["#", "Nombre", "DNI", "Teléfono"]];
    data.forEach((c: any, i: number) => aoa2.push([i + 1, c.full_name || "", c.document_number || "", c.phone || ""]));
    const ws2 = XLSX.utils.aoa_to_sheet(aoa2);
    ws2["!cols"] = [{ wch: 5 }, { wch: 32 }, { wch: 14 }, { wch: 14 }];
    ws2["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }];
    const t2 = ws2[XLSX.utils.encode_cell({ r: 0, c: 0 })];
    if (t2) t2.s = { font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "0E7C3A" } }, alignment: { horizontal: "center" } };
    [0, 1, 2, 3].forEach(c => {
      const ref = XLSX.utils.encode_cell({ r: 3, c });
      if (ws2[ref]) ws2[ref].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "16A34A" } }, alignment: { horizontal: "center" } };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Directorio");
    XLSX.utils.book_append_sheet(wb, ws2, "Sorteos");
    XLSX.writeFile(wb, `clientes_infocom_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Excel descargado correctamente");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Clientes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gestiona tus clientes recurrentes para sorteos, regalos y fidelización</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" className="gap-2" onClick={() => exportExcel()} disabled={customers.length === 0}>
          <Download className="h-4 w-4" /> Exportar Excel
        </Button>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingId(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Nuevo Cliente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Editar" : "Registrar"} Cliente</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
              <div><Label>Nombre Completo *</Label><Input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Teléfono</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>DNI</Label><Input value={form.document_number} onChange={e => setForm({ ...form, document_number: e.target.value })} /></div>
              </div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Dirección</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              <div><Label>Notas</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Preferencias, cumpleaños, etc." /></div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_vip} onCheckedChange={v => setForm({ ...form, is_vip: v })} />
                <Label className="flex items-center gap-1"><Star className="h-4 w-4 text-yellow-500" /> Cliente VIP</Label>
              </div>
              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>{editingId ? "Guardar" : "Registrar"}</Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-primary/20"><CardContent className="p-4 text-center"><Users className="h-5 w-5 text-primary mx-auto mb-1" /><p className="text-2xl font-bold">{customers.length}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
        <Card className="border-yellow-500/20"><CardContent className="p-4 text-center"><Star className="h-5 w-5 text-yellow-500 mx-auto mb-1" /><p className="text-2xl font-bold">{vipCount}</p><p className="text-xs text-muted-foreground">VIP</p></CardContent></Card>
        <Card className="border-success/20"><CardContent className="p-4 text-center"><TrendingUp className="h-5 w-5 text-success mx-auto mb-1" /><p className="text-2xl font-bold">{CURRENCY}{totalSpent.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total comprado</p></CardContent></Card>
        <Card className="border-pink-500/20"><CardContent className="p-4 text-center"><Gift className="h-5 w-5 text-pink-500 mx-auto mb-1" /><p className="text-2xl font-bold">{loyalCount}</p><p className="text-xs text-muted-foreground">Fieles (5+ compras)</p></CardContent></Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="lista" className="gap-1"><Users className="h-4 w-4" /> Lista</TabsTrigger>
          <TabsTrigger value="reportes" className="gap-1"><BarChart3 className="h-4 w-4" /> Reportes</TabsTrigger>
        </TabsList>

        {/* ─── Lista ──────────────────────────────────────────── */}
        <TabsContent value="lista" className="space-y-4 mt-4">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nombre, teléfono, DNI..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Button variant={filterVip ? "default" : "outline"} size="sm" onClick={() => setFilterVip(!filterVip)} className="gap-1">
              <Star className="h-3.5 w-3.5" /> Solo VIP
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <Card className="border-dashed"><CardContent className="py-12 text-center text-muted-foreground"><Users className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No hay clientes registrados</p></CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {filtered.map((c: any) => (
                <Card key={c.id} className="border-primary/10 hover:border-primary/30 transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${c.is_vip ? "bg-yellow-500/20" : "bg-primary/10"}`}>
                          {c.is_vip ? <Star className="h-5 w-5 text-yellow-500" /> : <Users className="h-5 w-5 text-primary" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold truncate">{c.full_name}</p>
                            {c.is_vip && <Badge className="bg-yellow-500/20 text-yellow-600 text-[10px]">VIP</Badge>}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                            {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                            {c.document_number && <span className="flex items-center gap-1"><IdCard className="h-3 w-3" />{c.document_number}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary">{c.total_purchases || 0} compras</Badge>
                        <Badge variant="outline">{CURRENCY}{Number(c.total_spent || 0).toLocaleString()}</Badge>
                        <Button variant="outline" size="sm" onClick={() => openEdit(c)}>Editar</Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { if (confirm("¿Eliminar este cliente?")) deleteMutation.mutate(c.id); }}>✕</Button>
                      </div>
                    </div>
                    {c.notes && <p className="text-xs text-muted-foreground mt-2 ml-13 italic">📝 {c.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Reportes ───────────────────────────────────────── */}
        <TabsContent value="reportes" className="space-y-6 mt-4">
          {customers.length === 0 ? (
            <Card className="border-dashed"><CardContent className="py-12 text-center text-muted-foreground"><BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>Registra clientes para ver reportes</p></CardContent></Card>
          ) : (
            <>
              {/* Top Compradores */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><Crown className="h-5 w-5 text-yellow-500" /> Top 10 Compradores</CardTitle>
                </CardHeader>
                <CardContent>
                  {topBuyers.length > 0 ? (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topBuyers} layout="vertical" margin={{ left: 10, right: 20 }}>
                          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `S/${v}`} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                          <Tooltip
                            formatter={(value: number) => [`${CURRENCY}${value.toLocaleString()}`, "Total gastado"]}
                            contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
                          />
                          <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Distribución de fidelización */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2"><Award className="h-5 w-5 text-primary" /> Nivel de Fidelización</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loyaltyDistribution.length > 0 ? (
                      <div className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={loyaltyDistribution}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={90}
                              dataKey="value"
                              nameKey="name"
                              label={({ name, value }) => `${name}: ${value}`}
                              labelLine={false}
                            >
                              {loyaltyDistribution.map((_, i) => (
                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>}
                    <div className="flex flex-wrap gap-2 mt-2 justify-center">
                      {loyaltyDistribution.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-1.5 text-xs">
                          <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          <span className="text-muted-foreground">{d.name}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Distribución por gasto */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-5 w-5 text-success" /> Distribución por Gasto</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {spendingDistribution.length > 0 ? (
                      <div className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={spendingDistribution} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorClientes" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                            <Tooltip
                              contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
                            />
                            <Area type="monotone" dataKey="clientes" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorClientes)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>}
                  </CardContent>
                </Card>
              </div>

              {/* Ranking table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><Gift className="h-5 w-5 text-pink-500" /> Clientes para Sorteos / Regalos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="py-2 px-2 font-medium text-muted-foreground">#</th>
                          <th className="py-2 px-2 font-medium text-muted-foreground">Cliente</th>
                          <th className="py-2 px-2 font-medium text-muted-foreground text-center">Compras</th>
                          <th className="py-2 px-2 font-medium text-muted-foreground text-right">Total</th>
                          <th className="py-2 px-2 font-medium text-muted-foreground text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...customers]
                          .sort((a: any, b: any) => (b.total_purchases || 0) - (a.total_purchases || 0))
                          .slice(0, 20)
                          .map((c: any, i: number) => (
                            <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30">
                              <td className="py-2 px-2">
                                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                              </td>
                              <td className="py-2 px-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{c.full_name}</span>
                                  {c.is_vip && <Badge className="bg-yellow-500/20 text-yellow-600 text-[10px]">VIP</Badge>}
                                </div>
                              </td>
                              <td className="py-2 px-2 text-center font-mono">{c.total_purchases || 0}</td>
                              <td className="py-2 px-2 text-right font-mono">{CURRENCY}{Number(c.total_spent || 0).toLocaleString()}</td>
                              <td className="py-2 px-2 text-center">
                                {(c.total_purchases || 0) >= 20 ? (
                                  <Badge className="bg-primary/20 text-primary text-[10px]">Premium</Badge>
                                ) : (c.total_purchases || 0) >= 10 ? (
                                  <Badge className="bg-yellow-500/20 text-yellow-600 text-[10px]">Fiel</Badge>
                                ) : (c.total_purchases || 0) >= 5 ? (
                                  <Badge className="bg-blue-500/20 text-blue-500 text-[10px]">Frecuente</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-[10px]">Nuevo</Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CustomersPage;
