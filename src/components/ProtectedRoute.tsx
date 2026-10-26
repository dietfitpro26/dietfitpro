import { useEffect, useState, type ReactNode } from "react";
import {
  useNavigate,
  useLocation,
} from "@tanstack/react-router";
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

function isAppRole(value: unknown): value is AppRole {
  return (
    value === "pro" ||
    value === "patient" ||
    value === "subscriber"
  );
}

export function ProtectedRoute({
  children,
  allow,
}: Props) {
  const {
    user,
    role,
    profile,
    loading,
    signOut,
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<
    string | null
  >(null);

  // L'option requireProfileComplete reste acceptée pour
  // préserver les appels existants, mais son contrôle
  // reste désactivé comme dans la version précédente.

  const verifiedRole: AppRole | null =
    user &&
    profile &&
    profile.id === user.id &&
    isAppRole(role) &&
    profile.role === role
      ? role
      : null;

  const roleAllowed =
    verifiedRole !== null &&
    (!allow || allow.includes(verifiedRole));

  useEffect(() => {
    if (loading) return;

    if (!user) {
      void navigate({
        to: "/login",
        search: { redirect: location.pathname },
        replace: true,
      });
      return;
    }

    // En cas de profil absent ou de rôle non vérifié,
    // on affiche l'écran d'erreur, sans redirection.
    if (!verifiedRole) return;

    if (!roleAllowed) {
      void navigate({
        to: ROLE_HOME[verifiedRole],
        replace: true,
      });
    }
  }, [
    loading,
    user,
    verifiedRole,
    roleAllowed,
    navigate,
    location.pathname,
  ]);

  const handleSignOut = async () => {
    if (signingOut) return;

    setSigningOut(true);
    setSignOutError(null);

    try {
      await signOut();

      await navigate({
        to: "/login",
        replace: true,
      });
    } catch (error) {
      console.error(
        "[ProtectedRoute] Erreur de déconnexion :",
        error,
      );

      setSignOutError(
        "La déconnexion a échoué. Réessayez dans quelques instants.",
      );
      setSigningOut(false);
    }
  };

  if (loading || !user) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-background px-4"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm text-muted-foreground">
          Vérification de votre connexion…
        </p>
      </div>
    );
  }

  if (!verifiedRole) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
        <section className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold">
            Impossible de vérifier votre accès
          </h1>

          <p className="text-sm text-muted-foreground">
            Votre connexion est détectée, mais votre profil
            n’a pas pu être vérifié. Par sécurité, cette
            page n’est pas affichée.
          </p>

          <p className="text-sm text-muted-foreground">
            Réessayez de charger la page. Si le problème
            persiste, déconnectez-vous puis reconnectez-vous.
          </p>

          {signOutError && (
            <p
              className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              {signOutError}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={signingOut}
              onClick={() => window.location.reload()}
              className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Réessayer
            </button>

            <button
              type="button"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
              className="flex-1 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {signingOut
                ? "Déconnexion…"
                : "Se déconnecter"}
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (!roleAllowed) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-background px-4"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm text-muted-foreground">
          Redirection vers votre espace…
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

export { ROLE_HOME };