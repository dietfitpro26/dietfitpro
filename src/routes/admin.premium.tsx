import { createFileRoute } from "@tanstack/react-router";
import { FeatureEntitlementsPanel } from "@/components/admin/FeatureEntitlementsPanel";
import { SuperAdminLayout } from "@/layouts/SuperAdminLayout";

export const Route = createFileRoute("/admin/premium")({
  head: () => ({ meta: [{ title: "Droits Premium — Administration — DietFitPro" }] }),
  component: AdminPremiumPage,
});

function AdminPremiumPage() {
  return (
    <SuperAdminLayout>
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Administration</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Droits Premium individuels</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Outil existant d’attribution, de révocation et de consultation de l’historique des options.
          </p>
        </header>
        <FeatureEntitlementsPanel />
      </div>
    </SuperAdminLayout>
  );
}
