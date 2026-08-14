import { useEffect, type ReactNode } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth, type AppRole } from "@/hooks/useAuth";

const ROLE_HOME: Record<AppRole, string> = {
  pro: "/pro/dashboard",
  patient: "/patient/dashboard",
  subscriber: "/subscriber/dashboard",
};

interface Props {
  children: ReactNode;
  /** If set, only these roles can access. Other roles get redirected to their home. */
  allow?: AppRole[];
  /** If true, require profile_complete to be true. Otherwise redirect to /bienvenue */
  requireProfileComplete?: boolean;
}

/**
 * Garde de route :
 *  - non authentifié → /login
 *  - rôle non autorisé → redirige vers son interface
 *  - profile_complete = false → /bienvenue
 */
export function ProtectedRoute({ children, allow, requireProfileComplete = true }: Props) {
  const { user, role, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    
    // Non authentifié → /login
    if (!user) {
      void navigate({ to: "/login", search: { redirect: location.pathname } });
      return;
    }
    
    // Rôle non autorisé → redirige vers son interface
    if (allow && role && !allow.includes(role)) {
      void navigate({ to: ROLE_HOME[role] });
      return;
    }
    
    // Profil incomplet → /bienvenue (sauf si on est déjà sur /bienvenue)
    if (requireProfileComplete && profile?.profile_complete === false && location.pathname !== "/bienvenue") {
      void navigate({ to: "/bienvenue" });
      return;
    }
  }, [user, role, profile, loading, allow, requireProfileComplete, navigate, location.pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Chargement…</div>
      </div>
    );
  }
  
  // Profil incomplet → afficher rien pendant la redirection
  if (requireProfileComplete && profile?.profile_complete === false) {
    return null;
  }
  
  // Rôle non autorisé → afficher rien pendant la redirection
  if (allow && role && !allow.includes(role)) return null;
  
  return <>{children}</>;
}

export { ROLE_HOME };