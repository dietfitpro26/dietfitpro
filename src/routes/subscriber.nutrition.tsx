import { createFileRoute } from "@tanstack/react-router";
import {
  Utensils,
  Lock,
  Flame,
  Target,
  CheckCircle,
} from "lucide-react";
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
  const isSubscriber = profile?.role === "subscriber";
  const isPremiumUser = isSubscriber && profile?.plan === "premium";

  if (!isSubscriber) {
    return (
      <div className="min-h-full bg-gradient-to-b from-background to-muted/20 p-4 sm:p-6">
        <div className="mx-auto max-w-5xl">
          <Card className="rounded-3xl border shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Lock className="h-5 w-5" />
                </div>

                <div>
                  <CardTitle>Accès non disponible</CardTitle>
                  <CardDescription>
                    Cette page est réservée aux abonnés DietFitPro.
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
                    vos objectifs journaliers et votre organisation des repas.
                  </CardDescription>
                </div>
              </div>

              {isPremiumUser ? (
                <div className="flex items-center gap-2 rounded-full bg-[#6DB33F]/10 px-3 py-1 text-xs font-medium text-[#2D7A1F]">
                  <CheckCircle className="h-4 w-4" />
                  Premium
                </div>
              ) : (
                <div className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                  Basic
                </div>
              )}
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <InfoCard
            icon={<Flame className="h-5 w-5" />}
            title="Objectif kcal / jour"
            value="À calculer"
            subtitle="Calcul personnalisé à venir selon votre profil"
          />

          <InfoCard
            icon={<Target className="h-5 w-5" />}
            title="Votre accompagnement"
            value={
              isPremiumUser
                ? "Programme Premium"
                : "Programme Basic"
            }
            subtitle={
              isPremiumUser
                ? "Programme personnalisé et suivi renforcé"
                : "Programme général selon votre objectif"
            }
          />

          <InfoCard
            icon={<Utensils className="h-5 w-5" />}
            title="Organisation repas"
            value="Matin · Midi · Soir"
            subtitle="Collation selon vos besoins"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <MealCard
            title="Petit-déjeuner"
            items={[
              "Source de protéines",
              "Produit céréalier ou équivalent",
              "Fruit ou laitage selon le programme",
            ]}
          />

          <MealCard
            title="Déjeuner"
            items={[
              "Protéines",
              "Féculents selon votre objectif",
              "Légumes et matière grasse adaptée",
            ]}
          />

          <MealCard
            title="Dîner"
            items={[
              "Repas structuré et digeste",
              "Légumes à chaque repas",
              "Répartition adaptée à votre objectif kcal",
            ]}
          />

          <MealCard
            title="Collation"
            items={[
              "Uniquement si elle est prévue",
              "Fruit ou source de protéines selon le besoin",
              "Adaptée à l'organisation de votre journée",
            ]}
          />
        </div>

        {isPremiumUser ? (
          <Card className="rounded-3xl border border-[#6DB33F] shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-[#6DB33F]" />
                <CardTitle>Votre programme personnalisé</CardTitle>
              </div>

              <CardDescription>
                Votre programme Premium sera adapté à votre objectif, vos
                mesures et vos préférences alimentaires.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="rounded-2xl border border-dashed bg-green-50 p-4 text-sm text-green-800">
                <p className="mb-2 font-semibold">
                  Inclus dans Premium :
                </p>

                <ul className="space-y-1">
                  <li>• Plan alimentaire adapté à votre profil</li>
                  <li>• Ajustements selon votre évolution</li>
                  <li>• Prise en compte de vos goûts et contraintes</li>
                  <li>• Suivi renforcé avec votre professionnel</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-3xl border shadow-sm">
            <CardHeader>
              <CardTitle>Votre programme Basic</CardTitle>

              <CardDescription>
                Un cadre alimentaire général sera calculé selon votre objectif
                et votre profil.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                <p className="mb-2 font-semibold">
                  Inclus dans Basic :
                </p>

                <ul className="space-y-1">
                  <li>• Structure de repas simple et équilibrée</li>
                  <li>• Objectifs caloriques calculés selon votre profil</li>
                  <li>• Conseils nutritionnels de base</li>
                  <li>• Programme général selon votre objectif</li>
                </ul>
              </div>

              <Button
                className="w-full rounded-2xl bg-[#6DB33F] text-white hover:bg-[#2D7A1F]"
                disabled
              >
                Programme personnalisé réservé à Premium
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

        <div className="mt-1 text-xs text-muted-foreground">
          {subtitle}
        </div>
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