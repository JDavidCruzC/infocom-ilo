import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const ALL_MODULES = [
  { key: "dashboard", label: "Dashboard", icon: "📊", group: "General" },
  { key: "recepcion", label: "Recepción Técnica", icon: "📋", group: "Servicios" },
  { key: "soporte", label: "Soporte Técnico", icon: "🔧", group: "Servicios" },
  { key: "inventario", label: "Inventario", icon: "📦", group: "Productos" },
  { key: "combos", label: "Combos & Promos", icon: "✨", group: "Productos" },
  { key: "vitrinas", label: "Vitrinas", icon: "🏪", group: "Productos" },
  { key: "categorias", label: "Categorías", icon: "📂", group: "Productos" },
  { key: "marcas", label: "Marcas", icon: "🏷️", group: "Productos" },
  { key: "kardex", label: "Kardex", icon: "📜", group: "Productos" },
  { key: "compras", label: "Compras", icon: "🛒", group: "Compras" },
  { key: "gastos", label: "Gastos Empresa", icon: "🧾", group: "Compras" },
  { key: "proveedores", label: "Proveedores", icon: "🚚", group: "Compras" },
  { key: "pos", label: "Punto de Venta", icon: "💳", group: "Ventas" },
  { key: "pedidos", label: "Pedidos Online", icon: "🛍️", group: "Ventas" },
  { key: "contabilidad", label: "Contabilidad", icon: "💰", group: "Finanzas" },
  { key: "clientes", label: "Directorio Clientes", icon: "👥", group: "Clientes" },
  { key: "agenda", label: "Agenda / Citas", icon: "📅", group: "Clientes" },
  { key: "banners", label: "Banners", icon: "🖼️", group: "Tienda" },
  { key: "pagos", label: "Cuentas de Pago", icon: "💳", group: "Finanzas" },
  { key: "empresa", label: "Empresa", icon: "🏢", group: "General" },
  { key: "personal", label: "Gestión Personal", icon: "👤", group: "Personal" },
  { key: "asistencias", label: "Asistencias", icon: "📆", group: "Personal" },
  { key: "roles", label: "Roles", icon: "🛡️", group: "Sistema" },
  { key: "configuracion", label: "Configuración", icon: "⚙️", group: "Sistema" },
] as const;

export type ModuleKey = typeof ALL_MODULES[number]["key"];

export function usePermissions() {
  const { roles, loading: authLoading } = useAuth();

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ["role_permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("role, module, can_access");
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
  });

  const canAccess = (moduleKey: string): boolean => {
    if (roles.includes("admin")) return true;
    return roles.some(role => {
      const perm = permissions.find(
        (p: any) => p.role === role && p.module === moduleKey
      );
      return perm?.can_access === true;
    });
  };

  return {
    permissions,
    canAccess,
    loading: authLoading || isLoading,
    allModules: ALL_MODULES,
  };
}
