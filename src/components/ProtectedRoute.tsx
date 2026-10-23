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
  allow?: AppRole[];
  requireProfileComplete?: boolean;
}

export function ProtectedRoute({ children, allow, requireProfileComplete = true }: Props) {
  const { user, role, profile, loading } = useAuth();
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
      return;
    }
    
    // ✅ Optionnel : si tu veux garder le check profile_complete
    // Pour l'instant, on le désactive complètement
    // if (requireProfileComplete && role === "patient" && profile?.profile_complete === false) {
    //   void navigate({ to: "/home" }); // ou laisse passer
    //   return;
    // }
  }, [user, role, profile, loading, allow, requireProfileComplete, navigate, location.pathname]);

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