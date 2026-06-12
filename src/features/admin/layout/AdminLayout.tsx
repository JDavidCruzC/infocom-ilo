import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Package, FolderTree, Tags, ShoppingBag, Image, CreditCard, Settings,
  ArrowLeft, Menu, Building2, ClipboardList, Shield, Users, CalendarDays, DollarSign,
  Wrench, ChevronDown, ShoppingCart, Store, LayoutGrid, UserCheck, CalendarClock, Bell,
  Truck, PackagePlus, History, Lock, Sparkles, LogOut, Receipt
} from "lucide-react";
import NotificationBell from "@/features/admin/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import logoDark from "@/assets/logo-dark-theme.png";

interface NavItem {
  to: string;
  icon: any;
  label: string;
  end?: boolean;
  module?: string; // permission module key
  adminOnly?: boolean;
  children?: NavItem[];
}

const allNavItems: NavItem[] = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true, module: "dashboard" },
  { to: "/admin/recepcion", icon: ClipboardList, label: "Recepción Técnica", module: "recepcion" },
  { to: "/admin/soporte", icon: Wrench, label: "Soporte Técnico", module: "soporte" },
  {
    to: "/admin/productos", icon: Package, label: "Productos",
    children: [
      { to: "/admin/productos", icon: Package, label: "Inventario", end: true, module: "inventario" },
      { to: "/admin/combos", icon: Sparkles, label: "Combos & Promos", module: "combos" },
      { to: "/admin/vitrinas", icon: LayoutGrid, label: "Vitrinas", module: "vitrinas" },
      { to: "/admin/categorias", icon: FolderTree, label: "Categorías", module: "categorias" },
      { to: "/admin/marcas", icon: Tags, label: "Marcas", module: "marcas" },
      { to: "/admin/kardex", icon: History, label: "Kardex", module: "kardex" },
    ],
  },
  {
    to: "/admin/compras", icon: PackagePlus, label: "Compras",
    children: [
      { to: "/admin/compras", icon: PackagePlus, label: "Compras", end: true, module: "compras" },
      { to: "/admin/gastos", icon: Receipt, label: "Gastos", module: "gastos" },
      { to: "/admin/proveedores", icon: Truck, label: "Proveedores", module: "proveedores" },
    ],
  },
  {
    to: "/admin/ventas", icon: Store, label: "Ventas",
    children: [
      { to: "/admin/ventas/pos", icon: ShoppingCart, label: "Punto de Venta", module: "pos" },
      { to: "/admin/pedidos", icon: ShoppingBag, label: "Pedidos Online", module: "pedidos" },
    ],
  },
  { to: "/admin/contabilidad", icon: DollarSign, label: "Contabilidad", module: "contabilidad", adminOnly: true },
  {
    to: "/admin/clientes", icon: UserCheck, label: "Clientes",
    children: [
      { to: "/admin/clientes", icon: UserCheck, label: "Directorio", end: true, module: "clientes" },
      { to: "/admin/agenda", icon: CalendarClock, label: "Agenda / Citas", module: "agenda" },
    ],
  },
  { to: "/admin/banners", icon: Image, label: "Banners", module: "banners" },
  { to: "/admin/pagos", icon: CreditCard, label: "Cuentas de Pago", module: "pagos" },
  { to: "/admin/empresa", icon: Building2, label: "Empresa", module: "empresa" },
  {
    to: "/admin/personal", icon: Users, label: "Personal",
    children: [
      { to: "/admin/personal", icon: Users, label: "Gestión", end: true, module: "personal" },
      { to: "/admin/asistencias", icon: CalendarDays, label: "Asistencias", module: "asistencias" },
      { to: "/admin/roles", icon: Shield, label: "Roles", module: "roles" },
      { to: "/admin/permisos", icon: Lock, label: "Permisos", module: "roles" },
    ],
  },

  { to: "/admin/configuracion", icon: Settings, label: "Configuración", module: "configuracion" },
];

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const { roles, signOut } = useAuth();
  const { canAccess } = usePermissions();

  const isActive = (path: string, end?: boolean) => {
    if (end) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const toggleSection = (label: string) => {
    setExpandedSections(prev =>
      prev.includes(label) ? prev.filter(s => s !== label) : [...prev, label]
    );
  };

  const isChildActive = (item: NavItem) => {
    return item.children?.some(c => isActive(c.to, c.end));
  };

  // Filter by permission
  const filterByPermission = (item: NavItem): NavItem | null => {
    if (item.children) {
      const filteredChildren = item.children
        .map(c => filterByPermission(c))
        .filter(Boolean) as NavItem[];
      if (filteredChildren.length === 0) return null;
      return { ...item, children: filteredChildren };
    }
    if (item.module && !canAccess(item.module)) return null;
    return item;
  };

  const navItems = allNavItems
    .map(filterByPermission)
    .filter(Boolean) as NavItem[];

  const renderNavItem = (item: NavItem) => {
    const hasChildren = item.children && item.children.length > 0;
    const expanded = expandedSections.includes(item.label) || isChildActive(item);

    if (hasChildren && item.children) {
      return (
        <div key={item.label}>
          <button
            onClick={() => toggleSection(item.label)}
            className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isChildActive(item)
                ? "bg-primary/10 text-primary"
                : "hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            <div className="flex items-center gap-3">
              <item.icon className="h-4 w-4" />
              {item.label}
            </div>
            <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
          {expanded && (
            <div className="ml-4 mt-1 space-y-0.5 border-l border-primary/10 pl-3">
              {item.children.map(child => (
                <Link
                  key={child.to}
                  to={child.to}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive(child.to, child.end)
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <child.icon className="h-3.5 w-3.5" />
                  {child.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
          isActive(item.to, item.end)
            ? "bg-primary/10 text-primary border border-primary/20"
            : "hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
        }`}
      >
        <item.icon className="h-4 w-4" />
        {item.label}
      </Link>
    );
  };

  const roleLabel = roles.includes("admin" as any) ? "ADMIN" : "PERSONAL";

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const sidebar = (
    <div className="h-full flex flex-col bg-card border-r border-primary/10">
      <div className="p-4 border-b border-primary/10">
        <Link to="/" className="flex items-center gap-3">
          <img src={logoDark} alt="INFOCOM" className="h-8 object-contain" />
          <div>
            <span className="font-display font-bold text-sm text-primary">{roleLabel}</span>
          </div>
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map(renderNavItem)}
      </nav>
      <div className="p-3 border-t border-primary/10">
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </Button>
        <Link to="/">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
            <ArrowLeft className="h-4 w-4" /> Volver a la tienda
          </Button>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebar}
      </aside>
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 z-50">{sidebar}</div>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-xl border-b border-primary/10 px-4 py-3 flex items-center justify-between lg:hidden">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <span className="font-display font-bold text-primary">INFOCOM {roleLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Cerrar sesión">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>
        <div className="hidden lg:flex sticky top-0 z-40 bg-card/95 backdrop-blur-xl border-b border-primary/10 px-6 py-2 justify-end gap-2">
          <NotificationBell />
          <Button variant="ghost" size="sm" className="gap-2" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </Button>
        </div>
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
