import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Utensils, Flame, Beef, Wheat, Droplets, Check } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { PatientLayout } from "@/layouts/PatientLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DailyJournal } from "@/components/nutrition/DailyJournal";
import { NutritionTips } from "@/components/nutrition/NutritionTips";
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



type SlotKey = "matin" | "midi" | "soir";



const SLOTS: { key: SlotKey; title: string; emoji: string }[] = [
  { key: "matin", title: "Petit-déjeuner", emoji: "🌅" },
  { key: "midi", title: "Déjeuner", emoji: "☀️" },
  { key: "soir", title: "Dîner", emoji: "🌙" },
];



const PHASE_LABEL: Record<number, string> = {
  1: "Phase 1 — déficit léger",
  2: "Phase 2 — déficit modéré",
  3: "Phase 3 — déficit important",
};



interface MealSlot {
  pain_cereales_g?: number | null;
  feculent_cru_g?: number | null;
  feculent_cuit_g?: number | null;
  feculent_nom?: string | null;
  legumes?: string | null;
  proteines?: boolean | null;
  lipides_crus_g?: number | null;
}



interface StructuredMeals {
  phase?: number | null;
  matin?: MealSlot;
  midi?: MealSlot;
  soir?: MealSlot;
}



interface LegacyMeal {
  id: string;
  moment: "matin" | "midi" | "soir" | "collation";
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}



interface ProgramRow {
  id: string;
  name: string;
  start_date: string | null;
  daily_kcal_target: number | null;
  daily_protein_g: number | null;
  daily_carbs_g: number | null;
  daily_fat_g: number | null;
  notes: string | null;
  meals: unknown;
  pro_id: string | null;
}



interface ParsedMeals {
  structured: StructuredMeals | null;
  legacy: LegacyMeal[];
}



function parseMeals(raw: unknown): ParsedMeals {
  if (Array.isArray(raw)) {
    const legacy = raw.filter(
      (m): m is LegacyMeal =>
        typeof m === "object" && m !== null && "id" in m && "moment" in m && "name" in m,
    );
    return { structured: null, legacy };
  }
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as StructuredMeals;
    if (obj.matin || obj.midi || obj.soir) {
      return { structured: obj, legacy: [] };
    }
  }
  return { structured: null, legacy: [] };
}



function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}



function buildLines(key: SlotKey, slot: MealSlot | undefined): string[] {
  if (!slot) return ["Aucune indication pour ce repas."];
  const lines: string[] = [];



  if (key === "matin") {
    const pain = num(slot.pain_cereales_g);
    if (pain) lines.push(`${pain} g de pain aux céréales`);
    if (slot.proteines !== false) lines.push("Une source de protéines (yaourt, œuf…)");
  } else {
    if (slot.proteines !== false) lines.push("Une portion de protéines (viande, poisson, œuf…)");
    lines.push(`Légumes : ${slot.legumes || "à volonté"}`);
    const cru = num(slot.feculent_cru_g);
    if (cru && cru > 0) {
      const cuit = num(slot.feculent_cuit_g) ?? cru * 2;
      lines.push(`${slot.feculent_nom || "Féculent"} : ${cru} g cru (${cuit} g cuit)`);
    } else {
      lines.push("Pas de féculent à ce repas");
    }
  }



  const lipides = num(slot.lipides_crus_g);
  if (lipides) {
    if (key === "matin") {
      lines.push(`${lipides} g de beurre OU ${lipides} g de confiture`);
    } else {
      lines.push(`${lipides} g de matières grasses crues (huile d'olive ou colza)`);
    }
  }



  return lines;
}



function todayIso() {
  return format(new Date(), "yyyy-MM-dd");
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
  const [program, setProgram] = useState<ProgramRow | null | undefined>(undefined);
  const [proName, setProName] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());



  useEffect(() => {
    if (!user) return;
    let cancelled = false;



    void (async () => {
      const { data: pat, error: patErr } = await supabase
        .from("patients")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();



      if (cancelled) return;



      if (patErr) {
        setErrorMsg(patErr.message);
        setProgram(null);
        return;
      }



      const patientId = (pat as { id?: string } | null)?.id;
      if (!patientId) {
        setProgram(null);
        return;
      }



      const { data, error } = await supabase
        .from("nutrition_programs")
        .select(
          "id, name, start_date, daily_kcal_target, daily_protein_g, daily_carbs_g, daily_fat_g, notes, meals, pro_id",
        )
        .eq("patient_id", patientId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1);



      if (cancelled) return;



      if (error) {
        setErrorMsg(error.message);
        setProgram(null);
        return;
      }



      const row = (data?.[0] as ProgramRow | undefined) ?? null;
      setProgram(row);



      if (!row) return;



      setDone(loadDone(row.id, todayIso()));



      if (row.pro_id) {
        const { data: p } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", row.pro_id)
          .maybeSingle();
        if (!cancelled) {
          setProName((p as { full_name?: string } | null)?.full_name ?? "");
        }
      }
    })();



    return () => {
      cancelled = true;
    };
  }, [user]);



  const firstName = profile?.full_name?.split(" ")[0] ?? "vous";



  const toggleDone = (slotKey: string) => {
    if (!program) return;
    const next = new Set(done);
    if (next.has(slotKey)) next.delete(slotKey);
    else next.add(slotKey);
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
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-64 rounded-3xl" />
            <Skeleton className="h-64 rounded-3xl" />
            <Skeleton className="h-64 rounded-3xl" />
          </div>
        </div>
      </div>
    );
  }



  const parsed = program ? parseMeals(program.meals) : { structured: null, legacy: [] };
  const phase = parsed.structured?.phase ?? null;
  const hasMeals = parsed.structured !== null || parsed.legacy.length > 0;



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
                  Bonjour {firstName}, retrouvez ici votre plan alimentaire et vos
                  objectifs du jour.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>



        {errorMsg ? (
          <Card className="rounded-3xl border border-destructive/40 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Impossible de charger votre plan</CardTitle>
              <CardDescription>{errorMsg}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}



        {!program ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <InfoCard icon={<Flame className="h-5 w-5" />} title="Apport journalier" value="À définir" subtitle="Votre praticien précisera votre cible" />
              <InfoCard icon={<Beef className="h-5 w-5" />} title="Protéines" value="À définir" subtitle="Objectif personnalisé à venir" />
              <InfoCard icon={<Wheat className="h-5 w-5" />} title="Glucides" value="À définir" subtitle="Adapté à votre profil" />
              <InfoCard icon={<Droplets className="h-5 w-5" />} title="Lipides" value="À définir" subtitle="Répartition à venir" />
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
                  Dès qu'un programme sera créé, vos repas et vos objectifs apparaîtront ici.
                </div>
              </CardContent>
            </Card>



            <NutritionTips />
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
                  {phase && PHASE_LABEL[phase] ? `${PHASE_LABEL[phase]} · ` : ""}
                  Plan actif depuis le{" "}
                  {program.start_date
                    ? format(new Date(program.start_date), "dd MMMM yyyy", { locale: fr })
                    : "—"}
                </CardDescription>
              </CardHeader>
            </Card>



            <p className="text-xs text-muted-foreground">
              Aujourd'hui — {format(new Date(), "EEEE dd MMMM", { locale: fr })}
            </p>



            {!hasMeals ? (
              <Card className="rounded-3xl border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Détail des repas en préparation</CardTitle>
                  <CardDescription>
                    Votre praticien finalise votre plan. Consultez aussi vos documents PDF.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : parsed.structured ? (
              <div className="grid gap-4 lg:grid-cols-3">
                {SLOTS.map((slot) => (
                  <SlotCard
                    key={slot.key}
                    title={`${slot.emoji} ${slot.title}`}
                    lines={buildLines(slot.key, parsed.structured?.[slot.key])}
                    checked={done.has(slot.key)}
                    onToggle={() => toggleDone(slot.key)}
                  />
                ))}
              </div>
            ) : (
              <LegacyMeals meals={parsed.legacy} />
            )}



            {program.notes ? (
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
            ) : null}



            {user ? <DailyJournal userId={user.id} retentionDays={270} /> : null}



            <NutritionTips />



            <p className="text-center text-xs text-muted-foreground">
              Ce plan ne remplace pas un avis médical. En cas de doute, contactez votre praticien.
            </p>
          </>
        )}
      </div>
    </div>
  );
}



function SlotCard({
  title,
  lines,
  checked,
  onToggle,
}: {
  title: string;
  lines: string[];
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Card
      className={cn(
        "rounded-3xl border shadow-sm",
        checked && "border-[#6DB33F]/50 bg-[#6DB33F]/5",
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button
          size="sm"
          variant={checked ? "default" : "outline"}
          className={cn(checked && "bg-[#6DB33F] text-white hover:bg-[#2D7A1F]")}
          onClick={onToggle}
        >
          <Check className="mr-1 h-4 w-4" />
          {checked ? "Fait" : "Valider"}
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {lines.map((line) => (
            <li key={line} className="rounded-xl bg-muted/30 px-3 py-2">
              {line}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}



function LegacyMeals({ meals }: { meals: LegacyMeal[] }) {
  return (
    <Card className="rounded-3xl border shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Vos repas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {meals.map((meal) => (
          <div key={meal.id} className="rounded-2xl bg-muted/30 px-3 py-3">
            <div className="text-sm font-medium">{meal.name}</div>
            <div className="text-xs text-muted-foreground">
              {meal.kcal} kcal · {meal.protein_g} g prot · {meal.carbs_g} g gluc · {meal.fat_g} g lip
            </div>
          </div>
        ))}
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