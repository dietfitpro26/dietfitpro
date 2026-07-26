import { createFileRoute } from "@tanstack/react-router";
import { Utensils, Lock, Flame, Target } from "lucide-react";
import { SubscriberLayout } from "@/layouts/SubscriberLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAccessRights } from "@/hooks/useAccessRights";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/subscriber/nutrition")({
  head: () => ({ meta: [{ title: "Nutrition — DietFitPro" }] }),
  component: SubscriberNutritionPage,
});

function SubscriberNutritionPage() {
  return (
    <ProtectedRoute allow={["subscriber"]}>
      <SubscriberLayout>
        <NutritionContent />
      </SubscriberLayout>
    </ProtectedRoute>
  );
}

function NutritionContent() {
  const { profile } = useAuth();
  const { rights, loading } = useAccessRights();

  const firstName = profile?.full_name?.split(" ")[0] ?? "vous";
  const hasAccess = rights?.access_nutrition_programs ?? false;

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="h-32 animate-pulse rounded-3xl bg-muted" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-56 animate-pulse rounded-3xl bg-muted" />
            <div className="h-56 animate-pulse rounded-3xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-background to-muted/20 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card className="rounded-3xl border shadow-sm">
          <CardHeader className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Utensils className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl sm:text-2xl">
                    Nutrition
                  </CardTitle>
                  <CardDescription className="mt-1 text-sm sm:text-base">
                    Bonjour {firstName}, retrouvez ici votre cadre alimentaire,
                    vos objectifs journaliers et votre organisation repas.
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {hasAccess ? (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <InfoCard
                icon={<Flame className="h-5 w-5" />}
                title="Objectif kcal / jour"
                value="À personnaliser"
                subtitle="À relier ensuite à votre vrai plan"
              />
              <InfoCard
                icon={<Target className="h-5 w-5" />}
                title="Objectif nutrition"
                value="Programme actif"
                subtitle="Version abonnés selon votre offre"
              />
              <InfoCard
                icon={<Utensils className="h-5 w-5" />}
                title="Organisation repas"
                value="Matin · Midi · Soir"
                subtitle="Collation si besoin"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <MealCard
                title="Petit-déjeuner"
                items={[
                  "Source de protéines",
                  "Produit céréalier ou équivalent",
                  "Fruit ou laitage selon le plan",
                ]}
              />
              <MealCard
                title="Déjeuner"
                items={[
                  "Protéines",
                  "Féculents selon objectif",
                  "Légumes + matière grasse adaptée",
                ]}
              />
              <MealCard
                title="Dîner"
                items={[
                  "Repas structuré et digeste",
                  "Légumes systématiques",
                  "Répartition selon votre objectif kcal",
                ]}
              />
              <MealCard
                title="Collation"
                items={[
                  "Seulement si prévue au plan",
                  "Protéines ou fruit selon besoin",
                  "Adaptée à votre journée",
                ]}
              />
            </div>

            <Card className="rounded-3xl border shadow-sm">
              <CardHeader>
                <CardTitle>Suite du raccordement</CardTitle>
                <CardDescription>
                  Cette page est maintenant créée. À l’étape suivante, on pourra
                  la connecter à vos vraies données nutrition si elles existent
                  déjà en base.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="rounded-2xl">
                  Page nutrition abonné prête
                </Button>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="rounded-3xl border shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Module nutrition verrouillé</CardTitle>
                  <CardDescription>
                    Cette page existe bien pour l’abonné, mais son ouverture dépend
                    du forfait ou d’une activation manuelle du professionnel.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                Vous gardez ainsi la même structure d’application entre patient et abonné,
                avec un accès qui varie selon vos règles métier.
              </div>
              <Button variant="outline" className="rounded-2xl">
                Découvrir une formule supérieure
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  value,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <Card className="rounded-3xl border shadow-sm">
      <CardContent className="p-5">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="text-sm text-muted-foreground">{title}</div>
        <div className="mt-1 text-lg font-semibold">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
      </CardContent>
    </Card>
  );
}

function MealCard({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <Card className="rounded-3xl border shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item} className="rounded-xl bg-muted/30 px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}