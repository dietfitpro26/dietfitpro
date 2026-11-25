import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Crown, MessagesSquare, Settings2 } from "lucide-react";
import { SuperAdminLayout } from "@/layouts/SuperAdminLayout";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Administration — DietFitPro" }] }),
  component: AdminHomePage,
});

const ADMIN_SECTIONS = [
  {
    title: "Communauté et groupes",
    description: "Accéder à la supervision des groupes, des demandes et des bannissements.",
    to: "/admin/community" as const,
    icon: MessagesSquare,
    action: "Ouvrir la communauté",
  },
  {
    title: "Droits Premium individuels",
    description: "Attribuer ou révoquer une option et consulter son historique.",
    to: "/admin/premium" as const,
    icon: Crown,
    action: "Gérer les droits Premium",
  },
  {
    title: "Compte et sécurité",
    description: "Ouvrir les paramètres de compte et de mot de passe déjà disponibles.",
    to: "/admin/security" as const,
    icon: Settings2,
    action: "Ouvrir les paramètres",
  },
];

function AdminHomePage() {
  return (
    <SuperAdminLayout>
      <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <header className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            DietFitPro · Super Administration
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Espace d’administration
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            Retrouvez les outils administratifs déjà disponibles. Aucun tableau de bord
            statistique ni gestion de comptes non existante n’est affiché ici.
          </p>
        </header>

        <section aria-label="Outils administratifs" className="grid gap-4 lg:grid-cols-2">
          {ADMIN_SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <Link
                key={section.title}
                to={section.to}
                className="group flex min-h-40 flex-col justify-between rounded-2xl border border-stone-200 bg-card p-5 transition-colors hover:border-primary/35 hover:bg-white sm:p-6"
              >
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#edf4e9] text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold tracking-tight">{section.title}</h2>
                    <p className="mt-1.5 max-w-lg text-sm leading-6 text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                </div>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                  {section.action}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </section>
      </div>
    </SuperAdminLayout>
  );
}
