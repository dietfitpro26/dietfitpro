import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { GroupsContent } from "@/routes/groups.index";
import { ModerationPanel } from "@/routes/pro.feed";
import { SuperAdminLayout } from "@/layouts/SuperAdminLayout";

export const Route = createFileRoute("/admin/community")({
  head: () => ({ meta: [{ title: "Communauté — Administration — DietFitPro" }] }),
  component: AdminCommunityPage,
});

function AdminCommunityPage() {
  const [section, setSection] = useState<"groups" | "feed">("groups");

  return (
    <SuperAdminLayout>
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Administration</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Communauté et modération</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Les contrôles ci-dessous réutilisent les outils déjà présents dans les espaces de groupes et de feed.
          </p>
        </header>

        <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-3" role="tablist" aria-label="Outils de communauté">
          <button
            type="button"
            role="tab"
            aria-selected={section === "groups"}
            onClick={() => setSection("groups")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${section === "groups" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            Groupes, demandes et bannissements
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={section === "feed"}
            onClick={() => setSection("feed")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${section === "feed" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            Publications et signalements
          </button>
        </div>

        <section role="tabpanel" className="min-w-0">
          {section === "groups" ? (
            <GroupsContent showPremiumEntitlements={false} />
          ) : (
            <ModerationPanel onChanged={() => undefined} />
          )}
        </section>
      </div>
    </SuperAdminLayout>
  );
}
