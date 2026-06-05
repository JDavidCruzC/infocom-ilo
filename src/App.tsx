import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, useTheme } from "@/features/theme/ThemeProvider";
import { FloatingThemeToggle } from "@/features/theme/FloatingThemeToggle";
import SeasonalParticles from "@/features/theme/SeasonalParticles";
import ProtectedRoute from "@/features/auth/components/ProtectedRoute";
import { AuthProvider } from "@/features/auth/hooks/useAuth";
import { usePermissions } from "@/features/auth/hooks/usePermissions";

// Shop pages
import HomePage from "@/features/shop/pages/HomePage";
import CatalogPage from "@/features/shop/pages/CatalogPage";
import ProductDetailPage from "@/features/shop/pages/ProductDetailPage";
import AboutPage from "@/features/shop/pages/AboutPage";
import ContactPage from "@/features/shop/pages/ContactPage";
import AccountPage from "@/features/shop/pages/AccountPage";

// Auth pages
import LoginPage from "@/features/auth/pages/LoginPage";
import RegisterPage from "@/features/auth/pages/RegisterPage";
import ForgotPasswordPage from "@/features/auth/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/features/auth/pages/ResetPasswordPage";

// Checkout
import CheckoutPage from "@/features/checkout/pages/CheckoutPage";

// Admin
import AdminLayout from "@/features/admin/layout/AdminLayout";
import DashboardPage from "@/features/admin/pages/DashboardPage";
import ProductsPage from "@/features/admin/pages/ProductsPage";
import CategoriesPage from "@/features/admin/pages/CategoriesPage";
import BrandsPage from "@/features/admin/pages/BrandsPage";
import OrdersPage from "@/features/admin/pages/OrdersPage";
import BannersPage from "@/features/admin/pages/BannersPage";
import SettingsPage from "@/features/admin/pages/SettingsPage";
import PaymentAccountsPage from "@/features/admin/pages/PaymentAccountsPage";
import CompanyPage from "@/features/admin/pages/CompanyPage";
import ReceptionPage from "@/features/admin/pages/ReceptionPage";
import RolesPage from "@/features/admin/pages/RolesPage";
import StaffPage from "@/features/admin/pages/StaffPage";
import AttendancePage from "@/features/admin/pages/AttendancePage";
import AccountingPage from "@/features/admin/pages/AccountingPage";
import SupportPage from "@/features/admin/pages/SupportPage";
import SalesPage from "@/features/admin/pages/SalesPage";
import VitrinasPage from "@/features/admin/pages/VitrinasPage";
import CustomersPage from "@/features/admin/pages/CustomersPage";
import AppointmentsPage from "@/features/admin/pages/AppointmentsPage";
import SuppliersPage from "@/features/admin/pages/SuppliersPage";
import PurchasesPage from "@/features/admin/pages/PurchasesPage";
import KardexPage from "@/features/admin/pages/KardexPage";
import PermissionsConfigPage from "@/features/admin/pages/PermissionsConfigPage";
import CombosPage from "@/features/admin/pages/CombosPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

const SeasonalWrapper = ({ children }: { children: React.ReactNode }) => {
  const { seasonalTheme } = useTheme();
  const particles = seasonalTheme?.key !== "default" && seasonalTheme?.value?.particles;
  return (
    <>
      {particles && <SeasonalParticles type={particles} />}
      {children}
    </>
  );
};

import PermissionRoute from "@/features/auth/components/PermissionRoute";

const AdminOnlyRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute allowedRoles={["admin"]} fallbackPath="/admin">
    {children}
  </ProtectedRoute>
);

const AdminIndexRoute = () => {
  const { canAccess, loading } = usePermissions();

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (canAccess("dashboard")) return <DashboardPage />;
  if (canAccess("asistencias")) return <Navigate to="/admin/asistencias" replace />;
  if (canAccess("pos")) return <Navigate to="/admin/ventas/pos" replace />;

  return <Navigate to="/cuenta" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <SeasonalWrapper>
            <BrowserRouter>
              <FloatingThemeToggle />
              <Routes>
                {/* Shop */}
                <Route path="/" element={<HomePage />} />
                <Route path="/catalogo" element={<CatalogPage />} />
                <Route path="/producto/:slug" element={<ProductDetailPage />} />
                <Route path="/nosotros" element={<AboutPage />} />
                <Route path="/contacto" element={<ContactPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/cuenta" element={<AccountPage />} />

                {/* Auth */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/registro" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                {/* Admin */}
                <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminLayout /></ProtectedRoute>}>
                  <Route index element={<AdminIndexRoute />} />
                  <Route path="recepcion" element={<ReceptionPage />} />
                  <Route path="productos" element={<ProductsPage />} />
                  <Route path="pedidos" element={<OrdersPage />} />
                  <Route path="soporte" element={<SupportPage />} />
                  <Route path="ventas/pos" element={<SalesPage />} />

                  <Route path="categorias" element={<PermissionRoute module="categorias"><CategoriesPage /></PermissionRoute>} />
                  <Route path="vitrinas" element={<PermissionRoute module="vitrinas"><VitrinasPage /></PermissionRoute>} />
                  <Route path="marcas" element={<PermissionRoute module="marcas"><BrandsPage /></PermissionRoute>} />
                  <Route path="kardex" element={<PermissionRoute module="kardex"><KardexPage /></PermissionRoute>} />
                  <Route path="combos" element={<PermissionRoute module="combos"><CombosPage /></PermissionRoute>} />
                  <Route path="compras" element={<PermissionRoute module="compras"><PurchasesPage /></PermissionRoute>} />
                  <Route path="proveedores" element={<PermissionRoute module="proveedores"><SuppliersPage /></PermissionRoute>} />
                  <Route path="banners" element={<PermissionRoute module="banners"><BannersPage /></PermissionRoute>} />
                  <Route path="empresa" element={<PermissionRoute module="empresa"><CompanyPage /></PermissionRoute>} />
                  <Route path="roles" element={<AdminOnlyRoute><RolesPage /></AdminOnlyRoute>} />
                  <Route path="permisos" element={<AdminOnlyRoute><PermissionsConfigPage /></AdminOnlyRoute>} />
                  <Route path="personal" element={<PermissionRoute module="personal"><StaffPage /></PermissionRoute>} />
                  <Route path="asistencias" element={<PermissionRoute module="asistencias"><AttendancePage /></PermissionRoute>} />
                  <Route path="contabilidad" element={<PermissionRoute module="contabilidad"><AccountingPage /></PermissionRoute>} />
                  <Route path="clientes" element={<PermissionRoute module="clientes"><CustomersPage /></PermissionRoute>} />
                  <Route path="agenda" element={<PermissionRoute module="agenda"><AppointmentsPage /></PermissionRoute>} />
                  <Route path="configuracion" element={<AdminOnlyRoute><SettingsPage /></AdminOnlyRoute>} />
                  <Route path="pagos" element={<PermissionRoute module="pagos"><PaymentAccountsPage /></PermissionRoute>} />

                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </SeasonalWrapper>
        </TooltipProvider>
      </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
