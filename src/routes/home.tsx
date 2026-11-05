import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { SubscriberLayout } from "@/layouts/SubscriberLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LevelBadgesCard } from "@/components/gamification/LevelBadgesCard";
import { useAuth } from "@/hooks/useAuth";
import { useAccessRights } from "@/hooks/useAccessRights";
import {
  UtensilsCrossed,
  Bike,
  Video,
  Lock,
  TrendingDown,
  Dumbbell,
  Scale,
  Heart,
  Target,
  Flame,
  ArrowRight,
  ChevronRight,
  BarChart2,
  Sparkles,
  UserRound,
  Rss,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";


export const Route = createFileRoute("/home")({
  head: () => ({ meta: [{ title: "Accueil — DietFitPro" }] }),
  component: SubscriberHomePage,
});


function getBMIInfo(bmi: number | null) {
  if (!bmi) return null;


  if (bmi < 18.5) {
    return {
      label: "Repère inférieur",
      color: "text-blue-600",
      bg: "bg-blue-50",
    };
  }


  if (bmi < 25) {
    return {
      label: "Repère général",
      color: "text-green-700",
      bg: "bg-green-50",
    };
  }


  if (bmi < 30) {
    return {
      label: "Repère supérieur",
      color: "text-orange-600",
      bg: "bg-orange-50",
    };
  }


  return {
    label: "À interpréter avec un professionnel",
    color: "text-red-600",
    bg: "bg-red-50",
  };
}


function calcBMI(weight: number | null, height: number | null): number | null {
  if (!weight || !height || height <= 0) return null;
  const h = height / 100;
  return Math.round((weight / (h * h)) * 10) / 10;
}


const WEIGHT_LOSS = {
  label: "Perte de poids",
  icon: <TrendingDown className="h-4 w-4" />,
};
const MUSCLE_GAIN = {
  label: "Prise de masse",
  icon: <Dumbbell className="h-4 w-4" />,
};
const MAINTENANCE = {
  label: "Maintien",
  icon: <Scale className="h-4 w-4" />,
};
const GENERAL_HEALTH = {
  label: "Santé générale",
  icon: <Heart className="h-4 w-4" />,
};

// Les deux séries de noms existent : anciens comptes et inscription actuelle.
const GOAL_LABELS: Record<string, { label: string; icon: ReactNode }> = {
  weight_loss: WEIGHT_LOSS,
  muscle_gain: MUSCLE_GAIN,
  maintenance: MAINTENANCE,
  general_health: GENERAL_HEALTH,
  perte_de_poids: WEIGHT_LOSS,
  prise_de_masse: MUSCLE_GAIN,
  maintien: MAINTENANCE,
  equilibre: GENERAL_HEALTH,
};


function formatPlanLabel(plan: string | null | undefined) {
  if (!plan) return "Basic";
  if (plan === "premium") return "Premium";
  if (plan === "patient") return "Patient";
  return "Basic";
}


function SubscriberHomePage() {
  return (
    <ProtectedRoute allow={["subscriber"]}>
      <SubscriberLayout>
        <HomeContent />
      </SubscriberLayout>
    </ProtectedRoute>
  );
}


function HomeContent() {
  const { user, profile } = useAuth();
  const { rights, loading } = useAccessRights();


  const firstName = profile?.full_name?.split(" ")[0] ?? "vous";
  const weightKg = profile?.weight_kg ?? null;
  const targetWeightKg = profile?.target_weight_kg ?? null;
  const dailyKcalTarget = profile?.daily_kcal_target ?? null;
  const heightCm = profile?.height_cm ?? null;


  const currentBmi = calcBMI(weightKg, heightCm);
  const bmiInfo = getBMIInfo(currentBmi);
  const goalInfo = profile?.goal ? GOAL_LABELS[profile.goal] : null;
  const hasWeightGoal = weightKg != null && targetWeightKg != null;


  const weightDiff = useMemo(() => {
    if (!hasWeightGoal) return null;
    return Math.round((weightKg - targetWeightKg) * 10) / 10;
  }, [hasWeightGoal, weightKg, targetWeightKg]);


  const displayedPlan = rights?.plan_label ?? "basic";
  const sportLimit = rights?.sport_session_limit ?? null;
  const isBasic = displayedPlan === "basic";
  const isPremium = displayedPlan === "premium";


  if (loading || !rights) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="h-44 animate-pulse rounded-3xl bg-muted" />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="h-28 animate-pulse rounded-3xl bg-muted" />
            <div className="h-28 animate-pulse rounded-3xl bg-muted" />
            <div className="h-28 animate-pulse rounded-3xl bg-muted" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-52 animate-pulse rounded-3xl bg-muted" />
            <div className="h-52 animate-pulse rounded-3xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }


  const primaryAction = !profile?.goal
    ? {
        title: "Définissez votre objectif",
        text: "Un objectif clair vous aide à personnaliser votre expérience.",
        to: "/subscriber/profile" as const,
        label: "Compléter mon profil",
      }
    : isBasic
      ? {
          title: "Passez à Premium",
          text: "Débloquez un accompagnement plus complet pour progresser avec davantage de repères.",
          to: "/subscriber/profile" as const,
          label: "Voir mon offre",
        }
      : {
          title: "Continuez votre progression",
          text: "Retrouvez vos programmes nutrition et sport depuis votre espace personnel.",
          to: rights.access_nutrition_programs
            ? ("/subscriber/nutrition" as const)
            : ("/subscriber/sport" as const),
          label: "Ouvrir mon programme",
        };


  const subline =
    weightDiff !== null && weightDiff !== 0
      ? `Plus que ${Math.abs(weightDiff)} kg ${weightDiff > 0 ? "à perdre" : "à prendre"} pour atteindre votre objectif.`
      : weightDiff === 0
        ? "Objectif de poids atteint : bravo, continuez ainsi."
        : "Bienvenue sur votre espace DietFitPro.";


  return (
    <div className="min-h-full p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* En-tête vert */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-[#1F5A2E] p-6 text-white shadow-lg sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-20 right-24 h-48 w-48 rounded-full bg-brand/30 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/5" />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-4">
              <div>
                <p className="mb-1 text-sm font-bold uppercase tracking-wider text-white/80">
                  Votre espace personnel
                </p>
                <h1 className="text-3xl font-extrabold sm:text-4xl">Bonjour {firstName}</h1>
                <p className="mt-2 max-w-xl text-base text-white/90 sm:text-lg">{subline}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {goalInfo ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-sm font-semibold text-white">
                    {goalInfo.icon}
                    {goalInfo.label}
                  </span>
                ) : null}

                {currentBmi != null && bmiInfo ? (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${bmiInfo.bg} ${bmiInfo.color}`}
                    title="L'IMC est un indicateur général qui doit être interprété dans son contexte."
                  >
                    IMC {currentBmi} · {bmiInfo.label}
                  </span>
                ) : null}

                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${
                    isPremium ? "bg-white text-primary" : "bg-white/20 text-white"
                  }`}
                >
                  {isPremium ? <Star className="h-4 w-4 fill-current" /> : null}
                  Plan {formatPlanLabel(displayedPlan)}
                </span>

                {isBasic && sportLimit ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300 px-3 py-1.5 text-sm font-semibold text-amber-950">
                    <Bike className="h-4 w-4" />
                    {sportLimit} séances incluses
                  </span>
                ) : null}
              </div>
            </div>

            <Link
              to="/subscriber/profile"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-primary shadow-md transition-colors hover:bg-white/90"
            >
              <UserRound className="h-4 w-4" />
              Mon profil
            </Link>
          </div>
        </section>


        {user ? <LevelBadgesCard userId={user.id} /> : null}


        {/* Prochaine étape */}
        <section className="rounded-3xl border-2 border-primary/25 bg-accent p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-primary">
                Prochaine étape
              </p>
              <h2 className="mt-1 text-2xl">{primaryAction.title}</h2>
              <p className="mt-1 max-w-2xl text-muted-foreground">{primaryAction.text}</p>
            </div>
            <Button
              asChild
              className="h-12 w-full rounded-full px-6 text-base font-bold shadow-lg shadow-primary/25 sm:w-auto"
            >
              <Link to={primaryAction.to}>
                {primaryAction.label}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </section>


        {/* Objectifs */}
        {(weightKg != null || targetWeightKg != null || dailyKcalTarget != null || currentBmi != null) && (
          <section className="rounded-3xl border bg-card p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" />
              <h2 className="text-xl">Mes objectifs</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {weightKg != null ? (
                <MetricCard label="Poids actuel" value={`${weightKg} kg`} hint="Mesure actuelle" />
              ) : null}
              {targetWeightKg != null ? (
                <MetricCard label="Poids cible" value={`${targetWeightKg} kg`} hint="Objectif défini" highlight />
              ) : null}
              {currentBmi != null ? (
                <MetricCard label="IMC actuel" value={`${currentBmi}`} hint="Repère indicatif" />
              ) : null}
              {dailyKcalTarget != null ? (
                <MetricCard
                  label="Calories / jour"
                  value={`${dailyKcalTarget} kcal`}
                  hint="Repère nutritionnel"
                  icon={<Flame className="h-4 w-4 text-orange-500" />}
                />
              ) : null}
            </div>

            <p className="mt-5 text-xs text-muted-foreground">
              Ces indicateurs sont des repères généraux. Contactez votre professionnel de santé pour les interpréter dans votre contexte.
            </p>
          </section>
        )}


        {/* Modules principaux */}
        <section className="grid gap-4 lg:grid-cols-2">
          <PrimaryModuleCard
            title="Nutrition"
            description={
              rights.access_nutrition_programs
                ? "Accédez à votre programme nutritionnel."
                : "Les programmes nutrition complets sont disponibles dans Premium."
            }
            icon={<BarChart2 className="h-6 w-6" />}
            to={rights.access_nutrition_programs ? "/subscriber/nutrition" : undefined}
            active={rights.access_nutrition_programs}
            badge={rights.access_nutrition_programs ? "Disponible" : "Disponible dans Premium"}
          />


          <PrimaryModuleCard
            title="Sport"
            description={
              rights.access_sport_programs
                ? sportLimit
                  ? `Accès à ${sportLimit} séances incluses dans votre offre.`
                  : "Retrouvez l’ensemble de votre espace sport."
                : "Les programmes sport sont disponibles dans Premium."
            }
            icon={<Bike className="h-6 w-6" />}
            to={rights.access_sport_programs ? "/subscriber/sport" : undefined}
            active={rights.access_sport_programs}
            badge={
              rights.access_sport_programs
                ? sportLimit
                  ? `${sportLimit} séances`
                  : "Disponible"
                : "Disponible dans Premium"
            }
          />
        </section>


        <section>
          <PrimaryModuleCard
            title="Feed & communauté"
            description="Conseils, recettes et défis. Aimez, partagez et échangez avec la communauté pour rester motivé."
            icon={<Rss className="h-6 w-6" />}
            to="/feed"
            active
            badge="Disponible pour tous"
          />
        </section>


        {/* Bientôt */}
        <section className="space-y-3">
          <h2 className="text-xl">Bientôt sur DietFitPro</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <SoonCard
              icon={<UtensilsCrossed className="h-5 w-5" />}
              title="Recettes"
              text="Une bibliothèque de recettes arrive prochainement."
            />
            <SoonCard
              icon={<Sparkles className="h-5 w-5" />}
              title="Coach IA"
              text="Votre assistant intelligent arrive prochainement."
            />
            <SoonCard
              icon={<Video className="h-5 w-5" />}
              title="Visio"
              text="La réservation de consultations vidéo arrive prochainement."
            />
          </div>
        </section>
      </div>
    </div>
  );
}


function MetricCard({
  label,
  value,
  hint,
  highlight = false,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  highlight?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        highlight ? "border-primary/30 bg-accent" : "bg-muted/40"
      }`}
    >
      <div className="mb-1 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-2xl font-extrabold ${highlight ? "text-primary" : ""}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}


function PrimaryModuleCard({
  title,
  description,
  icon,
  to,
  active,
  badge,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  to?: string;
  active: boolean;
  badge: string;
}) {
  const content = (
    <div
      className={`h-full rounded-3xl border p-6 shadow-sm transition-all ${
        active
          ? "bg-card hover:-translate-y-1 hover:shadow-xl"
          : "border-dashed bg-muted/40"
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
              active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {icon}
          </div>
          <div>
            <h3 className="text-xl font-extrabold">{title}</h3>
            <p className="text-sm font-medium text-muted-foreground">{badge}</p>
          </div>
        </div>

        {!active ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            <Lock className="h-3 w-3" />
            Premium
          </span>
        ) : null}
      </div>

      <p className="mb-5 text-base text-muted-foreground">{description}</p>

      {active ? (
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-primary">Ouvrir</span>
          <ChevronRight className="h-5 w-5 text-primary" />
        </div>
      ) : (
        <Link
          to="/subscriber/profile"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-md shadow-primary/25 transition-opacity hover:opacity-90"
        >
          <Star className="h-4 w-4" />
          Découvrir le Premium
        </Link>
      )}
    </div>
  );


  if (active && to) {
    return (
      <Link to={to} className="block">
        {content}
      </Link>
    );
  }


  return content;
}


function SoonCard({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed bg-muted/30 p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <h3 className="font-bold text-foreground">{title}</h3>
        </div>
        <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">
          Bientôt
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}