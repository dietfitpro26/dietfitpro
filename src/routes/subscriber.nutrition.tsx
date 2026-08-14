import { createFileRoute } from "@tanstack/react-router";
import { Utensils, Lock, Flame, Target, CheckCircle } from "lucide-react";
import { SubscriberLayout } from "@/layouts/SubscriberLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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

  const firstName = profile?.full_name?.split(" ")[0] ?? "vous";

  // Vérification de l'accès : abonné actif (Basic ou Premium)
  const isSubscriber = profile?.role === "subscriber";
  const isActive =
    profile?.subscription_status === "active" ||
    profile?.subscription_status === "trialing";
  const isPremium = profile?.plan === "premium";

  const hasAccess = isSubscriber && isActive;
  const isPremiumUser = isSubscriber && isActive && isPremium;

  if (!hasAccess) {
    return (
      <div className="min-h-full bg-gradient-to-b from-background to-muted/20 p-4 sm:p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <Card className="rounded-3xl border shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Accès non disponible</CardTitle>
                  <CardDescription>
                    Votre abonnement n'est pas actif. Veuillez contacter le support ou régulariser votre situation.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
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
              {isPremiumUser && (
                <div className="flex items-center gap-2 rounded-full bg-[#6DB33F]/10 px-3 py-1 text-xs font-medium text-[#2D7A1F]">
                  <CheckCircle className="h-4 w-4" />
                  Premium
                </div>
              )}
            </div>
          </CardHeader>
        </Card>

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
              value={isPremiumUser ? "Programme Premium" : "Programme Basic"}
              subtitle={isPremiumUser ? "Fonctionnalités avancées" : "Version abonnés selon votre offre"}
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

          {isPremiumUser ? (
            <Card className="rounded-3xl border shadow-sm">
              <CardHeader>
                <CardTitle>Fonctionnalités Premium</CardTitle>
                <CardDescription>
                  Vous avez accès aux fonctionnalités avancées de nutrition.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-2xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                  Contenu Premium à intégrer : plans personnalisés, suivi avancé, etc.
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-3xl border shadow-sm">
              <CardHeader>
                <CardTitle>Passer en Premium</CardTitle>
                <CardDescription>
                  Débloquez toutes les fonctionnalités de nutrition avec l'offre Premium.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                  Vous gardez ainsi la même structure d'application entre patient et abonné,
                  avec un accès qui varie selon vos règles métier.
                </div>
                <Button variant="outline" className="rounded-2xl">
                  Découvrir une formule supérieure
                </Button>
              </CardContent>
            </Card>
          )}
        </>
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