import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Beef,
  CheckCircle,
  Droplets,
  Flame,
  Lock,
  Sparkles,
  Utensils,
  Wheat,
} from "lucide-react";
import { toast } from "sonner";
import { SubscriberLayout } from "@/layouts/SubscriberLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { NutritionTips } from "@/components/nutrition/NutritionTips";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  calculateNutritionProfile,
  isMinor,
  type ActivityLevel,
  type Gender,
  type NutritionCalcResult,
  type NutritionGoal,
} from "@/lib/nutritionCalc";
import {
  BASIC_PLANS,
  PREMIUM_PLANS,
  SLOT_LABEL,
  computePlan,
  defaultBasicPlanId,
  getPlan,
  type ComputedMeal,
  type NutritionPlan,
} from "@/lib/nutritionPlans";


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


interface ProfileRow {
  full_name: string | null;
  plan: string | null;
  age: number | null;
  gender: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  activity_level: string | null;
  goal: string | null;
  is_pregnant_or_breastfeeding: boolean | null;
  program_start_date: string | null;
}


const GOALS: NutritionGoal[] = ["perte_de_poids", "prise_de_masse", "maintien", "equilibre"];
const ACTIVITIES: ActivityLevel[] = ["sedentaire", "actif", "tres_actif"];


function asGoal(value: unknown): NutritionGoal | null {
  return GOALS.includes(value as NutritionGoal) ? (value as NutritionGoal) : null;
}


function asActivity(value: unknown): ActivityLevel | null {
  return ACTIVITIES.includes(value as ActivityLevel) ? (value as ActivityLevel) : null;
}


function asGender(value: unknown): Gender | null {
  return value === "homme" || value === "femme" ? value : null;
}


type CalcState =
  | { status: "ok"; result: NutritionCalcResult }
  | { status: "minor" }
  | { status: "incomplete" };


function computeTargets(prof: ProfileRow, goal: NutritionGoal | null): CalcState {
  if (typeof prof.age === "number" && isMinor(prof.age)) return { status: "minor" };


  const gender = asGender(prof.gender);
  const activity = asActivity(prof.activity_level);


  if (
    !goal ||
    !gender ||
    !activity ||
    typeof prof.age !== "number" ||
    typeof prof.weight_kg !== "number" ||
    typeof prof.height_cm !== "number"
  ) {
    return { status: "incomplete" };
  }


  const result = calculateNutritionProfile({
    weightKg: prof.weight_kg,
    heightCm: prof.height_cm,
    age: prof.age,
    gender,
    activityLevel: activity,
    goal,
    programStartDate: prof.program_start_date ?? new Date().toISOString().slice(0, 10),
    isPregnantOrBreastfeeding: prof.is_pregnant_or_breastfeeding ?? false,
  });


  return { status: "ok", result };
}


function NutritionContent() {
  const { user } = useAuth();


  const [loading, setLoading] = useState(true);
  const [prof, setProf] = useState<ProfileRow | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);


  useEffect(() => {
    if (!user) return;
    let cancelled = false;


    void (async () => {
      setLoading(true);


      const [profRes, choiceRes] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "full_name, plan, age, gender, weight_kg, height_cm, activity_level, goal, is_pregnant_or_breastfeeding, program_start_date",
          )
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("subscriber_nutrition_choice")
          .select("plan_id")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);


      if (cancelled) return;


      if (profRes.error) setLoadError(profRes.error.message);
      if (choiceRes.error) console.error("Erreur lecture choix nutrition :", choiceRes.error);


      setProf((profRes.data as ProfileRow | null) ?? null);
      setChoice((choiceRes.data as { plan_id?: string } | null)?.plan_id ?? null);
      setLoading(false);
    })();


    return () => {
      cancelled = true;
    };
  }, [user]);


  const isPremium = prof?.plan === "premium";
  const firstName = prof?.full_name?.split(" ")[0] ?? "vous";
  const profileGoal = asGoal(prof?.goal);


  // Plan actif : le choix enregistré, sauf s'il est Premium alors que le compte est Basic.
  const activePlan: NutritionPlan = useMemo(() => {
    const saved = getPlan(choice);
    if (saved && (saved.tier === "basic" || isPremium)) return saved;
    return getPlan(defaultBasicPlanId(profileGoal)) ?? BASIC_PLANS[1];
  }, [choice, isPremium, profileGoal]);


  const calc: CalcState = useMemo(() => {
    if (!prof) return { status: "incomplete" };
    return computeTargets(prof, activePlan.goal ?? profileGoal);
  }, [prof, activePlan, profileGoal]);


  const meals: ComputedMeal[] = useMemo(() => {
    if (calc.status !== "ok") return [];
    return computePlan(activePlan, {
      kcal: calc.result.targetKcal,
      proteinG: calc.result.targetProteinG,
      carbsG: calc.result.targetCarbsG,
      fatG: calc.result.targetFatG,
    });
  }, [calc, activePlan]);


  const choosePlan = async (plan: NutritionPlan) => {
    if (!user) return;
    if (plan.tier === "premium" && !isPremium) return;


    const previous = choice;
    setChoice(plan.id);
    setSavingId(plan.id);


    const { error } = await supabase
      .from("subscriber_nutrition_choice")
      .upsert(
        { user_id: user.id, plan_id: plan.id, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );


    setSavingId(null);


    if (error) {
      setChoice(previous);
      toast.error("Impossible d'enregistrer votre choix : " + error.message);
      return;
    }


    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };


  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="h-32 animate-pulse rounded-3xl bg-muted" />
          <div className="grid gap-4 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-3xl bg-muted" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-3xl bg-muted" />
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-full bg-gradient-to-b from-background to-muted/20 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* 1. En-tête */}
        <Card className="rounded-3xl border shadow-sm">
          <CardHeader className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Utensils className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl sm:text-2xl">Nutrition</CardTitle>
                  <CardDescription className="mt-1 text-sm sm:text-base">
                    Bonjour {firstName}, retrouvez ici vos objectifs et votre plan alimentaire.
                  </CardDescription>
                </div>
              </div>


              {isPremium ? (
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


        {loadError ? (
          <Card className="rounded-3xl border border-destructive/40 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Chargement impossible</CardTitle>
              <CardDescription>{loadError}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}


        {calc.status === "minor" ? (
          <Card className="rounded-3xl border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Accompagnement personnalisé</CardTitle>
              <CardDescription>
                Pour les moins de 18 ans, votre professionnel établit lui-même votre programme.
                Il prendra contact avec vous directement.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}


        {calc.status === "incomplete" ? (
          <Card className="rounded-3xl border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Complétez votre profil</CardTitle>
              <CardDescription>
                Il nous manque des informations (âge, poids, taille, sexe, activité ou objectif)
                pour calculer vos besoins.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="rounded-2xl bg-[#6DB33F] text-white hover:bg-[#2D7A1F]">
                <Link to="/subscriber/profile">Compléter mon profil</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}


        {/* 2. Objectifs du jour */}
        {calc.status === "ok" ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <InfoCard
                icon={<Flame className="h-5 w-5" />}
                title="Objectif kcal / jour"
                value={`${calc.result.targetKcal} kcal`}
                subtitle={`Mois ${calc.result.programMonth} de votre programme`}
              />
              <InfoCard
                icon={<Beef className="h-5 w-5" />}
                title="Protéines"
                value={`${calc.result.targetProteinG} g`}
                subtitle={`${calc.result.proteinPct} % des calories`}
              />
              <InfoCard
                icon={<Wheat className="h-5 w-5" />}
                title="Glucides"
                value={`${calc.result.targetCarbsG} g`}
                subtitle={`${calc.result.carbsPct} % des calories`}
              />
              <InfoCard
                icon={<Droplets className="h-5 w-5" />}
                title="Lipides"
                value={`${calc.result.targetFatG} g`}
                subtitle={`${calc.result.fatPct} % des calories`}
              />
            </div>


            {calc.result.warnings.map((warning) => (
              <div
                key={warning}
                className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"
              >
                {warning}
              </div>
            ))}


            {/* 3. Programme proposé */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Votre programme du jour
                  </p>
                  <h2 className="text-lg font-semibold">{activePlan.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{activePlan.tagline}</p>
                </div>
                <a
                  href="#programmes"
                  className="text-sm font-medium text-[#2D7A1F] underline-offset-4 hover:underline"
                >
                  Changer de programme ↓
                </a>
              </div>


              <div className="grid gap-4 lg:grid-cols-2">
                {meals.map((meal) => (
                  <MealCard key={meal.slot} meal={meal} />
                ))}
              </div>


              <NutritionTips planName={activePlan.name} planTips={activePlan.tips} />
            </section>
          </>
        ) : null}


        {/* 4. Gamme de programmes (Basic puis Premium) */}
        <section id="programmes" className="scroll-mt-20 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Changer de programme</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isPremium
                ? "Choisissez parmi les 3 programmes Basic et les 9 programmes Premium."
                : "Choisissez l'un de vos 3 programmes Basic."}
            </p>
          </div>


          <h3 className="text-base font-medium">Programmes Basic</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {BASIC_PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                active={activePlan.id === plan.id}
                locked={false}
                recommended={plan.id === defaultBasicPlanId(profileGoal)}
                saving={savingId === plan.id}
                onChoose={() => void choosePlan(plan)}
              />
            ))}
          </div>


          <h3 className="pt-2 text-base font-medium">Programmes Premium</h3>


          {!isPremium ? (
            <Card className="rounded-3xl border border-primary/20 bg-primary/5 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Passez à Premium</CardTitle>
                    <CardDescription>
                      Débloquez 9 programmes supplémentaires (méditerranéen, végétarien, sans
                      gluten, sportif…), le journal par photo, l'historique sur 3 mois, ainsi que
                      les PDF et notes.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ) : null}


          <div className="grid gap-4 md:grid-cols-3">
            {PREMIUM_PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                active={activePlan.id === plan.id}
                locked={!isPremium}
                recommended={false}
                saving={savingId === plan.id}
                onChoose={() => void choosePlan(plan)}
              />
            ))}
          </div>


          {isPremium ? (
            <Card className="rounded-3xl border border-dashed shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Plan sur mesure par votre diététicien</CardTitle>
                <CardDescription>
                  Un programme construit pour vous à partir d'un questionnaire complet
                  (supplément de 5 €, une seule fois). Bientôt disponible.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}
        </section>


        <p className="text-center text-xs text-muted-foreground">
          Ces repères sont indicatifs et ne remplacent pas un avis médical. En cas de pathologie,
          de grossesse ou de doute, consultez votre professionnel de santé.
        </p>
      </div>
    </div>
  );
}


function PlanCard({
  plan,
  active,
  locked,
  recommended,
  saving,
  onChoose,
}: {
  plan: NutritionPlan;
  active: boolean;
  locked: boolean;
  recommended: boolean;
  saving: boolean;
  onChoose: () => void;
}) {
  return (
    <Card
      className={cn(
        "rounded-3xl border shadow-sm",
        active && "border-[#6DB33F] bg-[#6DB33F]/5",
        locked && "opacity-70",
      )}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{plan.name}</CardTitle>
          {recommended && !active ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              Conseillé
            </span>
          ) : null}
          {locked ? <Lock className="h-4 w-4 text-muted-foreground" /> : null}
        </div>
        <CardDescription>{plan.tagline}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          size="sm"
          variant={active ? "default" : "outline"}
          disabled={locked || saving || active}
          onClick={onChoose}
          className={cn(
            "w-full rounded-xl",
            active && "bg-[#6DB33F] text-white hover:bg-[#2D7A1F]",
          )}
        >
          {locked
            ? "Réservé à Premium"
            : active
              ? "Plan actuel"
              : saving
                ? "Enregistrement…"
                : "Choisir ce plan"}
        </Button>
      </CardContent>
    </Card>
  );
}


function MealCard({ meal }: { meal: ComputedMeal }) {
  return (
    <Card className="rounded-3xl border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">{SLOT_LABEL[meal.slot]}</CardTitle>
          <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            ≈ {meal.kcal} kcal
          </span>
        </div>
        <CardDescription>
          P {meal.proteinG} g · G {meal.carbsG} g · L {meal.fatG} g
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {meal.lines.map((line) => (
            <li key={line.label + (line.options ?? "")} className="rounded-xl bg-muted/30 px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium">{line.label}</span>
                {line.quantity ? (
                  <span className="shrink-0 text-muted-foreground">{line.quantity}</span>
                ) : null}
              </div>
              {line.options ? (
                <p className="mt-1 text-xs text-muted-foreground">{line.options}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
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