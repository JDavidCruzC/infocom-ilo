import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { usePermissions, type ModuleKey } from "@/features/auth/hooks/usePermissions";

interface PermissionRouteProps {
  children: React.ReactNode;
  module: ModuleKey | string;
  fallbackPath?: string;
}

/**
 * Allows access if the user is admin OR has explicit permission for the module
 * via role_permissions (configurable in /admin/permisos).
 */
const PermissionRoute = ({ children, module, fallbackPath = "/admin" }: PermissionRouteProps) => {
  const { loading: authLoading, user } = useAuth();
  const { canAccess, loading } = usePermissions();

  if (authLoading || loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!canAccess(module)) return <Navigate to={fallbackPath} replace />;

  return <>{children}</>;
};

export default PermissionRoute;
