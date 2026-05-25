import { useEffect, type ReactNode } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth, type AppRole } from "@/hooks/useAuth";

const ROLE_HOME: Record<AppRole, string> = {
  pro: "/pro/dashboard",
  patient: "/patient/dashboard",
  subscriber: "/home",
};

interface Props {
  children: ReactNode;
  /** If set, only these roles can access. Other roles get redirected to their home. */
  allow?: AppRole[];
}

/**
 * Garde de route :
 *  - non authentifié → /login
 *  - rôle non autorisé → redirige vers son interface
 */
export function ProtectedRoute({ children, allow }: Props) {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: "/login", search: { redirect: location.pathname } });
      return;
    }
    if (allow && role && !allow.includes(role)) {
      void navigate({ to: ROLE_HOME[role] });
    }
  }, [user, role, loading, allow, navigate, location.pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Chargement…</div>
      </div>
    );
  }
  if (allow && role && !allow.includes(role)) return null;
  return <>{children}</>;
}

export { ROLE_HOME };
