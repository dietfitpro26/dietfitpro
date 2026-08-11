import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { SubscriberLayout } from "@/layouts/SubscriberLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { useAccessRights } from "@/hooks/useAccessRights";
import {
  UtensilsCrossed,
  Bike,
  MessageCircle,
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
      label: "Insuffisance pondérale",
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    };
  }

  if (bmi < 25) {
    return {
      label: "Poids normal",
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-900/20",
    };
  }

  if (bmi < 30) {
    return {
      label: "Surpoids",
      color: "text-orange-500",
      bg: "bg-orange-50 dark:bg-orange-900/20",
    };
  }

  return {
    label: "Obésité",
    color: "text-red-500",
    bg: "bg-red-50 dark:bg-red-900/20",
  };
}

function calcBMI(weight: number | null, height: number | null): number | null {
  if (!weight || !height || height <= 0) return null;
  const h = height / 100;
  return Math.round((weight / (h * h)) * 10) / 10;
}

const GOAL_LABELS: Record<string, { label: string; icon: ReactNode }> = {
  weight_loss: {
    label: "Perte de poids",
    icon: <TrendingDown className="h-4 w-4" />,
  },
  muscle_gain: {
    label: "Prise de masse",
    icon: <Dumbbell className="h-4 w-4" />,
  },
  maintenance: {
    label: "Maintien",
    icon: <Scale className="h-4 w-4" />,
  },
  general_health: {
    label: "Santé générale",
    icon: <Heart className="h-4 w-4" />,
  },
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
  const { profile } = useAuth();
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

  if (loading || !rights) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <div className="h-32 animate-pulse rounded-3xl bg-muted" />
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
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-background to-muted/20 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-3xl border bg-card p-5 shadow-sm">
          <div className="space-y-3">
            <div>
              <h1 className="text-2xl font-bold">Bonjour {firstName}</h1>
              <p className="text-sm text-muted-foreground">
                Bienvenue sur votre espace DietFitPro.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {goalInfo ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
                  {goalInfo.icon}
                  {goalInfo.label}
                </span>
              ) : null}

              {currentBmi != null && bmiInfo ? (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${bmiInfo.bg} ${bmiInfo.color}`}
                >
                  IMC {currentBmi} · {bmiInfo.label}
                </span>
              ) : null}

              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
                Plan {formatPlanLabel(displayedPlan)}
              </span>

              {isBasic && sportLimit ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-700 dark:text-amber-300">
                  <Bike className="h-4 w-4" />
                  {sportLimit} séances incluses
                </span>
              ) : null}
            </div>
          </div>
        </section>

        {(weightKg != null ||
          targetWeightKg != null ||
          dailyKcalTarget != null ||
          currentBmi != null) && (
          <section className="rounded-3xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Mes objectifs</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {weightKg != null ? (
                <MetricCard
                  label="Poids actuel"
                  value={`${weightKg} kg`}
                  hint="Mesure actuelle"
                />
              ) : null}

              {targetWeightKg != null ? (
                <MetricCard
                  label="Poids cible"
                  value={`${targetWeightKg} kg`}
                  hint="Objectif défini"
                  highlight
                />
              ) : null}

              {currentBmi != null ? (
                <MetricCard
                  label="IMC actuel"
                  value={`${currentBmi}`}
                  hint={bmiInfo?.label ?? "Indice de masse corporelle"}
                />
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

            {weightDiff !== null && weightDiff !== 0 ? (
              <div className="mt-4 flex items-start gap-2 rounded-2xl bg-muted/40 px-4 py-3">
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Il vous reste{" "}
                  <span className="font-semibold text-foreground">
                    {Math.abs(weightDiff)} kg
                  </span>{" "}
                  {weightDiff > 0 ? "à perdre" : "à prendre"} pour atteindre votre objectif.
                </p>
              </div>
            ) : null}

            <p className="mt-4 text-xs text-muted-foreground">
              Contactez votre coach pour ajuster vos objectifs.
            </p>
          </section>
        )}

        <section className="grid gap-4 lg:grid-cols-2">
          <PrimaryModuleCard
            title="Nutrition"
            description={
              rights.access_nutrition_programs
                ? "Accédez à votre programme nutritionnel."
                : "Disponible dans Premium."
            }
            icon={<BarChart2 className="h-5 w-5" />}
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
                : "Disponible dans Premium."
            }
            icon={<Bike className="h-5 w-5" />}
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

        <section className="grid gap-4 md:grid-cols-4">
          <SecondaryModuleCard
            icon={<UtensilsCrossed className="h-5 w-5" />}
            title="Recettes"
            text="Consultez vos recettes avec l’offre Premium."
            active={rights.access_recipes}
            locked={!rights.access_recipes}
            lockedLabel="Option Premium"
          />

          <SecondaryModuleCard
            icon={<MessageCircle className="h-5 w-5" />}
            title="Messagerie"
            text="Échangez avec votre coach avec l’offre Premium."
            active={rights.access_messaging}
            locked={!rights.access_messaging}
            lockedLabel="Option Premium"
          />

          <SecondaryModuleCard
            icon={<Sparkles className="h-5 w-5" />}
            title="Coach IA"
            text={
              rights.access_ai_coach
                ? "Profitez de votre assistant intelligent."
                : "Disponible dans Premium."
            }
            active={rights.access_ai_coach}
            locked={!rights.access_ai_coach}
            lockedLabel="Option Premium"
          />

          <SecondaryModuleCard
            icon={<Video className="h-5 w-5" />}
            title="Visio"
            text={
              rights.access_visio
                ? "Réservez vos consultations vidéo."
                : "Option disponible en supplément."
            }
            active={rights.access_visio}
            locked={!rights.access_visio}
            lockedLabel="Option en supplément"
          />
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
      className={`rounded-2xl border p-4 ${
        highlight ? "border-primary/20 bg-primary/5" : "bg-muted/30"
      }`}
    >
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-xl font-bold ${highlight ? "text-primary" : ""}`}>
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
      className={`rounded-3xl border p-5 shadow-sm transition-all ${
        active ? "bg-card hover:shadow-md" : "bg-muted/30 opacity-80"
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
              active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            {icon}
          </div>
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground">{badge}</p>
          </div>
        </div>

        {!active ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            Restreint
          </span>
        ) : null}
      </div>

      <p className="mb-4 text-sm text-muted-foreground">{description}</p>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {active ? "Ouvrir le module" : "Accès indisponible"}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
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

function SecondaryModuleCard({
  icon,
  title,
  text,
  active,
  locked = false,
  lockedLabel = "Option Premium",
}: {
  icon: ReactNode;
  title: string;
  text: string;
  active: boolean;
  locked?: boolean;
  lockedLabel?: string;
}) {
  const isLocked = locked || !active;

  return (
    <div
      className={`rounded-3xl border p-4 shadow-sm transition-all ${
        isLocked
          ? "bg-muted/25 opacity-55 grayscale"
          : "bg-card hover:shadow-sm"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={isLocked ? "text-muted-foreground" : "text-primary"}>
            {icon}
          </span>
          <h3 className={`font-medium ${isLocked ? "text-muted-foreground" : ""}`}>
            {title}
          </h3>
        </div>
        {isLocked ? <Lock className="h-4 w-4 text-muted-foreground" /> : null}
      </div>

      <p className="mb-4 min-h-[48px] text-sm text-muted-foreground">
        {text}
      </p>

      {isLocked ? (
        <div className="mb-3 inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          {lockedLabel}
        </div>
      ) : null}

      <Button variant="outline" className="w-full rounded-2xl" disabled>
        {isLocked ? lockedLabel : "Disponible"}
      </Button>
    </div>
  );
}