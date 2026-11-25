import { createFileRoute } from "@tanstack/react-router";
import { AccountPasswordCard } from "@/components/admin/AccountPasswordCard";
import { SuperAdminLayout } from "@/layouts/SuperAdminLayout";

export const Route = createFileRoute("/admin/security")({
  head: () => ({ meta: [{ title: "Compte et sécurité — Administration — DietFitPro" }] }),
  component: AdminSecurityPage,
});

function AdminSecurityPage() {
  return (
    <SuperAdminLayout>
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Administration</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Compte et sécurité</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Cette section réutilise le réglage existant du mot de passe de votre compte. Aucun réglage global de sécurité distinct n’est actuellement disponible dans l’application.
          </p>
        </header>
        <AccountPasswordCard />
      </div>
    </SuperAdminLayout>
  );
}
