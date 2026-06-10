import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CURRENCY } from "@/lib/types";
import { Package, ShoppingBag, TrendingUp, AlertTriangle, Wrench, CalendarDays, Receipt, DollarSign, Users, ShoppingCart, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, Area, AreaChart } from "recharts";

const MONTHS_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const CHART_COLORS = ["hsl(var(--primary))", "hsl(142 71% 45%)", "hsl(200 80% 55%)", "hsl(38 92% 50%)", "hsl(280 65% 60%)", "hsl(0 72% 51%)"];

const DashboardPage = () => {
  const [stats, setStats] = useState({
    products: 0, orders: 0, revenue: 0, lowStock: 0, pendingServices: 0,
    attendancePct: 0, monthSales: 0, monthServices: 0, monthTotal: 0,
    totalTransactions: 0, activeStaff: 0, todaySales: 0, prevMonthTotal: 0,
    monthExpenses: 0, monthExpensesCount: 0, monthPurchases: 0, monthPurchasesCount: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [serviceStatusData, setServiceStatusData] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      const now = new Date();
      const year = now.getFullYear();
      const mStr = String(now.getMonth() + 1).padStart(2, "0");
      const today = now.toISOString().split("T")[0];
      const mStart = `${year}-${mStr}-01`;
      const mEnd = `${year}-${mStr}-${String(new Date(year, now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;

      // Previous month
      const prevM = new Date(year, now.getMonth() - 1, 1);
      const pmStart = `${prevM.getFullYear()}-${String(prevM.getMonth() + 1).padStart(2, "0")}-01`;
      const pmEnd = `${prevM.getFullYear()}-${String(prevM.getMonth() + 1).padStart(2, "0")}-${String(new Date(prevM.getFullYear(), prevM.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;

      const [
        { count: prodCount },
        { count: orderCount },
        { data: orders },
        { count: lowStockCount },
        { data: serviceOrders },
        { data: txMonth },
        { data: txToday },
        { count: staffCount },
        { data: recentTx },
        { data: attendanceData },
        { data: txPrevMonth },
      ] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("orders").select("*", { count: "exact", head: true }),
        supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(5),
        supabase.from("products").select("*", { count: "exact", head: true }).lt("stock", 5),
        supabase.from("service_orders").select("status"),
        supabase.from("transactions").select("subtotal_productos, subtotal_servicios, total").eq("estado", "emitido").gte("fecha", mStart).lte("fecha", mEnd),
        supabase.from("transactions").select("total").eq("estado", "emitido").eq("fecha", today),
        supabase.from("staff_members").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("transactions").select("*").eq("estado", "emitido").order("fecha", { ascending: false }).limit(10),
        supabase.from("attendance_records").select("status").gte("date", mStart).lte("date", mEnd),
        supabase.from("transactions").select("total").eq("estado", "emitido").gte("fecha", pmStart).lte("fecha", pmEnd),
      ]);

      const revenue = (orders || []).reduce((sum: number, o: any) => sum + Number(o.total), 0);
      const pendingServices = (serviceOrders || []).filter((s: any) => s.status === "pending" || s.status === "in_progress").length;

      const statusCounts: Record<string, number> = {};
      (serviceOrders || []).forEach((s: any) => { statusCounts[s.status] = (statusCounts[s.status] || 0) + 1; });
      const statusLabels: Record<string, string> = { pending: "Pendiente", in_progress: "En Proceso", completed: "Completado", delivered: "Entregado", cancelled: "Cancelado", waiting_parts: "Esp. Repuestos" };
      setServiceStatusData(Object.entries(statusCounts).map(([k, v]) => ({ name: statusLabels[k] || k, value: v })));

      const monthlyArr: any[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(year, now.getMonth() - i, 1);
        const m = d.getMonth(); const y = d.getFullYear();
        const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
        const end = `${y}-${String(m + 1).padStart(2, "0")}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, "0")}`;
        const { data: txData } = await supabase.from("transactions").select("subtotal_productos, subtotal_servicios")
          .eq("estado", "emitido").gte("fecha", start).lte("fecha", end);
        const salesTotal = (txData || []).reduce((s: number, r: any) => s + Number(r.subtotal_productos || 0), 0);
        const servicesTotal = (txData || []).reduce((s: number, r: any) => s + Number(r.subtotal_servicios || 0), 0);
        monthlyArr.push({ month: MONTHS_SHORT[m], ventas: salesTotal, servicios: servicesTotal, total: salesTotal + servicesTotal });
      }
      setMonthlyData(monthlyArr);

      const totalRecs = (attendanceData || []).length;
      const presentRecs = (attendanceData || []).filter((r: any) => r.status === "A").length;
      const attPct = totalRecs > 0 ? Math.round((presentRecs / totalRecs) * 100) : 0;

      const monthSales = (txMonth || []).reduce((a: number, t: any) => a + Number(t.subtotal_productos || 0), 0);
      const monthServices = (txMonth || []).reduce((a: number, t: any) => a + Number(t.subtotal_servicios || 0), 0);
      const monthTotal = (txMonth || []).reduce((a: number, t: any) => a + Number(t.total || 0), 0);
      const todaySales = (txToday || []).reduce((a: number, t: any) => a + Number(t.total || 0), 0);
      const prevMonthTotal = (txPrevMonth || []).reduce((a: number, t: any) => a + Number(t.total || 0), 0);

      setStats({
        products: prodCount || 0, orders: orderCount || 0, revenue, lowStock: lowStockCount || 0,
        pendingServices, attendancePct: attPct, monthSales, monthServices, monthTotal,
        totalTransactions: (txMonth || []).length, activeStaff: staffCount || 0, todaySales, prevMonthTotal,
      });
      setRecentOrders(orders || []);
      setRecentTransactions(recentTx || []);
    };
    fetchAll();
  }, []);

  const monthGrowth = stats.prevMonthTotal > 0
    ? Math.round(((stats.monthTotal - stats.prevMonthTotal) / stats.prevMonthTotal) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" /> Dashboard
        </h1>
        <p className="text-xs text-muted-foreground">
          {new Date().toLocaleDateString("es-PE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Hero Cards - Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total del Mes - Hero */}
        <Card className="md:col-span-1 border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="p-5 relative">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Total del Mes</p>
                <p className="text-3xl font-bold mt-1 text-primary">{CURRENCY}{stats.monthTotal.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</p>
                <div className="flex items-center gap-1 mt-2">
                  {monthGrowth >= 0 ? (
                    <span className="flex items-center gap-0.5 text-xs font-medium text-emerald-500">
                      <ArrowUpRight className="h-3 w-3" /> {monthGrowth}%
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 text-xs font-medium text-destructive">
                      <ArrowDownRight className="h-3 w-3" /> {Math.abs(monthGrowth)}%
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">vs mes anterior</span>
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="bg-secondary/50 rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground uppercase">Productos</p>
                <p className="text-sm font-bold">{CURRENCY}{stats.monthSales.toLocaleString()}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground uppercase">Servicios</p>
                <p className="text-sm font-bold">{CURRENCY}{stats.monthServices.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ventas Hoy */}
        <Card className="border-primary/10 relative overflow-hidden">
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-500/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          <CardContent className="p-5 relative">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Ventas Hoy</p>
                <p className="text-3xl font-bold mt-1">{CURRENCY}{stats.todaySales.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-muted-foreground mt-2">{stats.totalTransactions} transacciones este mes</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          <MiniStatCard icon={Package} label="Productos" value={stats.products} color="text-cyan-400" />
          <MiniStatCard icon={AlertTriangle} label="Stock Bajo" value={stats.lowStock} color="text-destructive" highlight={stats.lowStock > 0} />
          <MiniStatCard icon={Wrench} label="Serv. Pendientes" value={stats.pendingServices} color="text-purple-400" highlight={stats.pendingServices > 0} />
          <MiniStatCard icon={Users} label="Personal" value={stats.activeStaff} color="text-orange-400" />
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SmallStatCard icon={CalendarDays} label="Asistencia Mes" value={`${stats.attendancePct}%`} color="text-cyan-400" />
        <SmallStatCard icon={ShoppingBag} label="Pedidos Online" value={stats.orders} color="text-indigo-400" />
        <SmallStatCard icon={Receipt} label="Transacciones Mes" value={stats.totalTransactions} color="text-yellow-400" />
        <SmallStatCard icon={Receipt} label="Ingresos Online" value={`${CURRENCY}${stats.revenue.toLocaleString()}`} color="text-pink-400" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-primary/10">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Ingresos Mensuales (6 meses)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="gradVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradServicios" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(200 80% 55%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(200 80% 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `S/${v}`} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} formatter={(value: number) => [`S/ ${value.toFixed(2)}`, undefined]} />
                <Area type="monotone" dataKey="ventas" stroke={CHART_COLORS[0]} fill="url(#gradVentas)" strokeWidth={2} name="Ventas" />
                <Area type="monotone" dataKey="servicios" stroke={CHART_COLORS[2]} fill="url(#gradServicios)" strokeWidth={2} name="Servicios" />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-primary/10">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Tendencia Total</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `S/${v}`} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} formatter={(value: number) => [`S/ ${value.toFixed(2)}`, undefined]} />
                <Line type="monotone" dataKey="total" stroke={CHART_COLORS[0]} strokeWidth={3} dot={{ r: 5, fill: "hsl(var(--primary))" }} activeDot={{ r: 7 }} name="Total" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-primary/10">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Órdenes de Servicio</CardTitle></CardHeader>
          <CardContent>
            {serviceStatusData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No hay órdenes</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={serviceStatusData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false} paddingAngle={2}>
                    {serviceStatusData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Legend />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/10">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Últimas Transacciones</CardTitle></CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No hay transacciones</p>
            ) : (
              <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                {recentTransactions.slice(0, 8).map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between p-2.5 bg-secondary/30 rounded-lg text-xs hover:bg-secondary/50 transition-colors">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{tx.cliente_nombre || "Sin cliente"}</p>
                      <p className="text-muted-foreground">{tx.fecha} • {tx.tipo_general === "venta" ? "🛒" : tx.tipo_general === "servicio" ? "🔧" : "📦"} {tx.tipo_general}</p>
                    </div>
                    <span className="font-bold text-primary ml-2 whitespace-nowrap">{CURRENCY}{Number(tx.total).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Online Orders */}
      {recentOrders.length > 0 && (
        <Card className="border-primary/10">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pedidos Online Recientes</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg text-sm hover:bg-secondary/50 transition-colors">
                  <div>
                    <p className="font-medium">{order.order_number}</p>
                    <p className="text-xs text-muted-foreground">{order.customer_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">{CURRENCY}{Number(order.total).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground capitalize">{order.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

/* Mini stat card for the 2x2 grid */
const MiniStatCard = ({ icon: Icon, label, value, color, highlight }: { icon: any; label: string; value: number | string; color: string; highlight?: boolean }) => (
  <Card className={`border-primary/10 ${highlight ? "border-destructive/30 bg-destructive/5" : ""}`}>
    <CardContent className="p-3 flex items-center gap-2">
      <Icon className={`h-4 w-4 ${color} shrink-0`} />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase leading-tight truncate">{label}</p>
        <p className="text-base font-bold">{value}</p>
      </div>
    </CardContent>
  </Card>
);

/* Small horizontal stat card */
const SmallStatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) => (
  <Card className="border-primary/10">
    <CardContent className="p-3 flex items-center gap-2.5">
      <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase leading-tight truncate">{label}</p>
        <p className="text-sm font-bold">{value}</p>
      </div>
    </CardContent>
  </Card>
);

export default DashboardPage;
