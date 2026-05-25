import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, Utensils } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { PatientLayout } from "@/layouts/PatientLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/patient/nutrition")({
  head: () => ({ meta: [{ title: "Mon plan nutritionnel — DietFitPro" }] }),
  component: () => (
    <ProtectedRoute allow={["patient"]}>
      <PatientLayout><Content /></PatientLayout>
    </ProtectedRoute>
  ),
});

type MealMoment = "matin" | "midi" | "soir" | "collation";
const MOMENT_LABEL: Record<MealMoment, string> = {
  matin: "Petit-déjeuner", midi: "Déjeuner", soir: "Dîner", collation: "Collations",
};
const MOMENTS: MealMoment[] = ["matin", "midi", "soir", "collation"];
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

interface Meal {
  id: string; moment: MealMoment; name: string;
  kcal: number; protein_g: number; carbs_g: number; fat_g: number;
}
interface Program {
  id: string; name: string; start_date: string;
  daily_kcal_target: number | null; daily_protein_g: number | null;
  daily_carbs_g: number | null; daily_fat_g: number | null;
  notes: string | null; meals: Meal[];
}

function todayIso() { return format(new Date(), "yyyy-MM-dd"); }
function todayWeekdayIdx() { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; }
function doneKey(programId: string, date: string) { return `dfp:meal-done:${programId}:${date}`; }
function loadDone(programId: string, date: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(doneKey(programId, date)) ?? "[]")); }
  catch { return new Set(); }
}
function saveDone(programId: string, date: string, set: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(doneKey(programId, date), JSON.stringify([...set]));
}

function Content() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [program, setProgram] = useState<Program | null | undefined>(undefined);
  const [proName, setProName] = useState<string>("");
  const [activeDay, setActiveDay] = useState<number>(todayWeekdayIdx());
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: pat } = await supabase
        .from("patients").select("id").eq("user_id", user.id).maybeSingle();
      const patientId = (pat as { id?: string } | null)?.id;
      if (!patientId) { setProgram(null); return; }
      const { data } = await supabase
        .from("nutrition_programs")
        .select("id, name, start_date, daily_kcal_target, daily_protein_g, daily_carbs_g, daily_fat_g, notes, meals, pro_id")
        .eq("patient_id", patientId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1);
      const row = data?.[0] as (Program & { pro_id?: string }) | undefined;
      if (!row) { setProgram(null); return; }
      const prog: Program = { ...row, meals: Array.isArray(row.meals) ? row.meals : [] };
      setProgram(prog);
      setDone(loadDone(prog.id, todayIso()));
      if (row.pro_id) {
        const { data: p } = await supabase.from("profiles").select("full_name").eq("id", row.pro_id).maybeSingle();
        setProName((p as { full_name?: string } | null)?.full_name ?? "");
      }
    })();
  }, [user]);

  const grouped = useMemo(() => {
    const g: Record<MealMoment, Meal[]> = { matin: [], midi: [], soir: [], collation: [] };
    program?.meals.forEach((m) => g[m.moment]?.push(m));
    return g;
  }, [program]);

  const isToday = activeDay === todayWeekdayIdx();

  const toggleDone = (mealId: string) => {
    if (!program || !isToday) return;
    const next = new Set(done);
    if (next.has(mealId)) next.delete(mealId); else next.add(mealId);
    setDone(next);
    saveDone(program.id, todayIso(), next);
  };

  if (program === undefined) {
    return <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/patient/dashboard" })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Mon plan nutritionnel</h1>
      </div>

      {!program ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          <Utensils className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Aucun programme nutritionnel actif. Votre praticien vous en assignera un prochainement.
        </CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{program.name}</CardTitle>
              {proName && <p className="text-xs text-muted-foreground">Assigné par {proName}</p>}
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <Stat label="Kcal/jour" value={program.daily_kcal_target} />
              <Stat label="Protéines" value={program.daily_protein_g} unit="g" />
              <Stat label="Glucides" value={program.daily_carbs_g} unit="g" />
              <Stat label="Lipides" value={program.daily_fat_g} unit="g" />
            </CardContent>
          </Card>

          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {DAYS.map((d, i) => {
              const active = i === activeDay;
              const today = i === todayWeekdayIdx();
              return (
                <button
                  key={d}
                  onClick={() => setActiveDay(i)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors",
                    active ? "bg-[#6DB33F] text-white border-[#6DB33F]" : "bg-background hover:bg-muted",
                    !active && today && "border-[#6DB33F] text-[#2D7A1F]",
                  )}
                >
                  {d}{today && !active && " •"}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground">
            {isToday
              ? `Aujourd'hui — ${format(new Date(), "EEEE dd MMMM", { locale: fr })}`
              : `Aperçu — ${DAYS[activeDay]}`}
          </p>

          <div className="space-y-3">
            {MOMENTS.map((m) => (
              <Card key={m}>
                <CardHeader className="pb-2"><CardTitle className="text-sm">{MOMENT_LABEL[m]}</CardTitle></CardHeader>
                <CardContent>
                  {grouped[m].length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun repas prévu</p>
                  ) : (
                    <ul className="space-y-2">
                      {grouped[m].map((meal) => {
                        const isDone = done.has(meal.id);
                        return (
                          <li key={meal.id} className={cn(
                            "rounded-md border p-3 flex items-start justify-between gap-3 transition-colors",
                            isDone && isToday && "bg-[#6DB33F]/5 border-[#6DB33F]/40",
                          )}>
                            <div className="min-w-0 flex-1">
                              <div className={cn("font-medium text-sm", isDone && isToday && "line-through text-muted-foreground")}>
                                {meal.name}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {meal.kcal} kcal · P {meal.protein_g}g · G {meal.carbs_g}g · L {meal.fat_g}g
                              </div>
                            </div>
                            {isToday && (
                              <Button
                                size="sm"
                                variant={isDone ? "default" : "outline"}
                                className={cn(isDone && "bg-[#6DB33F] hover:bg-[#2D7A1F] text-white")}
                                onClick={() => toggleDone(meal.id)}
                              >
                                <Check className="h-4 w-4" />
                                {isDone ? "Fait" : "Marquer"}
                              </Button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {program.notes && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Notes du praticien</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{program.notes}</p></CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number | null; unit?: string }) {
  return (
    <div>
      <div className="text-lg font-semibold">{value != null ? `${value}${unit ?? ""}` : "—"}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
