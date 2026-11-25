import { Link } from "@tanstack/react-router";
import { useSuperAdminStatus } from "@/hooks/useSuperAdminStatus";

export function SuperAdminAccessGate({ children }: { children: React.ReactNode }) {
  const { status, retry } = useSuperAdminStatus();

  if (status === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5">
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          Vérification de l’accès administrateur…
        </p>
      </main>
    );
  }

  if (status !== "confirmed") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
        <section className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Accès administrateur indisponible</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Le serveur n’a pas confirmé le privilège Super Administrateur. Aucun outil
            administratif n’est chargé. Si ce problème persiste, reconnectez-vous ou
            contactez le propriétaire du projet.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={retry}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Vérifier à nouveau
            </button>
            <Link
              to="/login"
              className="inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-medium transition-colors hover:bg-muted"
            >
              Se connecter
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return children;
}
