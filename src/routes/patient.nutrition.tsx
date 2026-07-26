import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Utensils, Flame, Beef, Wheat, Droplets, Check } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { PatientLayout } from "@/layouts/PatientLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/patient/nutrition")({
  head: () => ({ meta: [{ title: "Mon plan nutritionnel — DietFitPro" }] }),
  component: () => (
    <ProtectedRoute allow={["patient"]}>
      <PatientLayout>
        <Content />
      </PatientLayout>
    </ProtectedRoute>
  ),
});

type MealMoment = "matin" | "midi" | "soir" | "collation";

const MOMENT_LABEL: Record<MealMoment, string> = {
  matin: "Petit-déjeuner",
  midi: "Déjeuner",
  soir: "Dîner",
  collation: "Collations",
};

const MOMENTS: MealMoment[] = ["matin", "midi", "soir", "collation"];

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

interface Meal {
  id: string;
  moment: MealMoment;
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface Program {
  id: string;
  name: string;
  start_date: string;
  daily_kcal_target: number | null;
  daily_protein_g: number | null;
  daily_carbs_g: number | null;
  daily_fat_g: number | null;
  notes: string | null;
  meals: Meal[];
}

function todayIso() {
  return format(new Date(), "yyyy-MM-dd");
}

function todayWeekdayIdx() {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
}

function doneKey(programId: string, date: string) {
  return `dfp:meal-done:${programId}:${date}`;
}

function loadDone(programId: string, date: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(doneKey(programId, date)) ?? "[]"));
  } catch {
    return new Set();
  }
}

function saveDone(programId: string, date: string, set: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(doneKey(programId, date), JSON.stringify([...set]));
}

function Content() {
  const { user, profile } = useAuth();
  const [program, setProgram] = useState<Program | null | undefined>(undefined);
  const [proName, setProName] = useState<string>("");
  const [activeDay, setActiveDay] = useState<number>(todayWeekdayIdx());
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    void (async () => {
      const { data: pat } = await supabase
        .from("patients")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const patientId = (pat as { id?: string } | null)?.id;

      if (!patientId) {
        setProgram(null);
        return;
      }

      const { data } = await supabase
        .from("nutrition_programs")
        .select("id, name, start_date, daily_kcal_target, daily_protein_g, daily_carbs_g, daily_fat_g, notes, meals, pro_id")
        .eq("patient_id", patientId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1);

      const row = data?.[0] as (Program & { pro_id?: string }) | undefined;

      if (!row) {
        setProgram(null);
        return;
      }

      const prog: Program = {
        ...row,
        meals: Array.isArray(row.meals) ? row.meals : [],
      };

      setProgram(prog);
      setDone(loadDone(prog.id, todayIso()));

      if (row.pro_id) {
        const { data: p } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", row.pro_id)
          .maybeSingle();

        setProName((p as { full_name?: string } | null)?.full_name ?? "");
      }
    })();
  }, [user]);

  const grouped = useMemo(() => {
    const g: Record<MealMoment, Meal[]> = {
      matin: [],
      midi: [],
      soir: [],
      collation: [],
    };

    program?.meals.forEach((m) => g[m.moment]?.push(m));
    return g;
  }, [program]);

  const isToday = activeDay === todayWeekdayIdx();
  const firstName = profile?.full_name?.split(" ")[0] ?? "vous";

  const toggleDone = (mealId: string) => {
    if (!program || !isToday) return;
    const next = new Set(done);
    if (next.has(mealId)) next.delete(mealId);
    else next.add(mealId);
    setDone(next);
    saveDone(program.id, todayIso(), next);
  };

  if (program === undefined) {
    return (
      <div className="p-4 sm:p-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <Skeleton className="h-32 rounded-3xl" />
          <div className="grid gap-4 md:grid-cols-4">
            <Skeleton className="h-32 rounded-3xl" />
            <Skeleton className="h-32 rounded-3xl" />
            <Skeleton className="h-32 rounded-3xl" />
            <Skeleton className="h-32 rounded-3xl" />
          </div>
          <Skeleton className="h-16 rounded-3xl" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-64 rounded-3xl" />
            <Skeleton className="h-64 rounded-3xl" />
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
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Utensils className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl sm:text-2xl">Nutrition</CardTitle>
                <CardDescription className="mt-1 text-sm sm:text-base">
                  Bonjour {firstName}, retrouvez ici votre plan alimentaire,
                  vos repas et votre organisation nutritionnelle.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {!program ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <InfoCard
                icon={<Flame className="h-5 w-5" />}
                title="Apport journalier"
                value="À définir"
                subtitle="Votre praticien précisera votre cible"
              />
              <InfoCard
                icon={<Beef className="h-5 w-5" />}
                title="Protéines"
                value="À définir"
                subtitle="Objectif personnalisé à venir"
              />
              <InfoCard
                icon={<Wheat className="h-5 w-5" />}
                title="Glucides"
                value="À définir"
                subtitle="Adapté à votre profil"
              />
              <InfoCard
                icon={<Droplets className="h-5 w-5" />}
                title="Lipides"
                value="À définir"
                subtitle="Répartition future"
              />
            </div>

            <Card className="rounded-3xl border shadow-sm">
              <CardHeader>
                <CardTitle>Aucun programme actif</CardTitle>
                <CardDescription>
                  Votre praticien ne vous a pas encore attribué de plan nutritionnel.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-2xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                  Dès qu’un programme nutritionnel sera créé, vos repas, objectifs et consignes apparaîtront ici.
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <InfoCard
                icon={<Flame className="h-5 w-5" />}
                title="Apport journalier"
                value={program.daily_kcal_target ? `${program.daily_kcal_target} kcal` : "—"}
                subtitle={proName ? `Programme par ${proName}` : "Cible énergétique"}
              />
              <InfoCard
                icon={<Beef className="h-5 w-5" />}
                title="Protéines"
                value={program.daily_protein_g ? `${program.daily_protein_g} g` : "—"}
                subtitle="Référence journalière"
              />
              <InfoCard
                icon={<Wheat className="h-5 w-5" />}
                title="Glucides"
                value={program.daily_carbs_g ? `${program.daily_carbs_g} g` : "—"}
                subtitle="Répartition alimentaire"
              />
              <InfoCard
                icon={<Droplets className="h-5 w-5" />}
                title="Lipides"
                value={program.daily_fat_g ? `${program.daily_fat_g} g` : "—"}
                subtitle="Équilibre nutritionnel"
              />
            </div>

            <Card className="rounded-3xl border shadow-sm">
              <CardHeader>
                <CardTitle>{program.name}</CardTitle>
                <CardDescription>
                  Plan nutritionnel actif depuis le{" "}
                  {program.start_date
                    ? format(new Date(program.start_date), "dd MMMM yyyy", { locale: fr })
                    : "—"}
                </CardDescription>
              </CardHeader>
            </Card>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {DAYS.map((day, index) => {
                const active = index === activeDay;
                const today = index === todayWeekdayIdx();

                return (
                  <button
                    key={day}
                    onClick={() => setActiveDay(index)}
                    className={cn(
                      "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "border-[#6DB33F] bg-[#6DB33F] text-white"
                        : "bg-background hover:bg-muted",
                      !active && today && "border-[#6DB33F] text-[#2D7A1F]",
                    )}
                  >
                    {day}
                    {today && !active ? " •" : ""}
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground">
              {isToday
                ? `Aujourd'hui — ${format(new Date(), "EEEE dd MMMM", { locale: fr })}`
                : `Aperçu — ${DAYS[activeDay]}`}
            </p>

            <div className="grid gap-4 lg:grid-cols-2">
              {MOMENTS.map((moment) => (
                <MealMomentCard
                  key={moment}
                  title={MOMENT_LABEL[moment]}
                  meals={grouped[moment]}
                  isToday={isToday}
                  done={done}
                  onToggleDone={toggleDone}
                />
              ))}
            </div>

            {program.notes && (
              <Card className="rounded-3xl border shadow-sm">
                <CardHeader>
                  <CardTitle>Notes du praticien</CardTitle>
                  <CardDescription>
                    Consignes complémentaires liées à votre plan alimentaire.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {program.notes}
                  </p>
                </CardContent>
              </Card>
            )}

            <Card className="rounded-3xl border shadow-sm">
              <CardHeader>
                <CardTitle>Étape suivante</CardTitle>
                <CardDescription>
                  Votre plan nutritionnel est en place. Vous pouvez suivre vos repas
                  et valider votre progression quotidienne.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="rounded-2xl">
                  Programme nutrition patient prêt
                </Button>
              </CardContent>
            </Card>
          </>
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

function MealMomentCard({
  title,
  meals,
  isToday,
  done,
  onToggleDone,
}: {
  title: string;
  meals: Meal[];
  isToday: boolean;
  done: Set<string>;
  onToggleDone: (mealId: string) => void;
}) {
  return (
    <Card className="rounded-3xl border shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {meals.length === 0 ? (
          <div className="rounded-xl bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            Aucun repas prévu.
          </div>
        ) : (
          <div className="space-y-3">
            {meals.map((meal) => {
              const isDone = done.has(meal.id);

              return (
                <div
                  key={meal.id}
                  className={cn(
                    "rounded-2xl px-3 py-3",
                    isDone && isToday
                      ? "border border-[#6DB33F]/40 bg-[#6DB33F]/5"
                      : "bg-muted/30",
                  )}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div
                        className={cn(
                          "text-sm font-medium",
                          isDone && isToday && "line-through text-muted-foreground",
                        )}
                      >
                        {meal.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {meal.kcal} kcal · {meal.protein_g}g prot · {meal.carbs_g}g gluc · {meal.fat_g}g lip
                      </div>
                    </div>

                    {isToday && (
                      <Button
                        size="sm"
                        variant={isDone ? "default" : "outline"}
                        className={cn(
                          isDone && "bg-[#6DB33F] text-white hover:bg-[#2D7A1F]",
                        )}
                        onClick={() => onToggleDone(meal.id)}
                      >
                        <Check className="mr-1 h-4 w-4" />
                        {isDone ? "Fait" : "Valider"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}