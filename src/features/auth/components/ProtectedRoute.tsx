import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { AppRole } from "@/lib/types";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  allowedRoles?: AppRole[];
  fallbackPath?: string;
}

const ADMIN_PANEL_ROLES: AppRole[] = ["admin", "moderator", "user", "terminal"];

const ProtectedRoute = ({ children, requireAdmin = false, allowedRoles, fallbackPath = "/" }: ProtectedRouteProps) => {
  const { user, loading, roles } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const requiredRoles = allowedRoles?.length ? allowedRoles : (requireAdmin ? ADMIN_PANEL_ROLES : []);
  if (requiredRoles.length > 0 && !requiredRoles.some((role) => roles.includes(role))) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
