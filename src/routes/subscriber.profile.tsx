import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  User,
  Mail,
  Ruler,
  Weight,
  Target,
  Shield,
  BadgeCheck,
  Trash2,
  AlertTriangle,
  Pencil,
  Star,
} from "lucide-react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import { SubscriberLayout } from "@/layouts/SubscriberLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SubscriptionOfferCard } from "@/components/billing/SubscriptionOfferCard";
import { useAuth } from "@/hooks/useAuth";
import { useAccessState } from "@/hooks/useAccessState";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  calculateNutritionProfile,
  isMinor,
  type ActivityLevel,
  type Gender,
  type NutritionGoal,
} from "@/lib/nutritionCalc";


export const Route = createFileRoute("/subscriber/profile")({
  head: () => ({ meta: [{ title: "Profil — DietFitPro" }] }),
  component: SubscriberProfilePage,
});


interface ProfileRow {
  age: number | null;
  gender: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  target_weight_kg: number | null;
  activity_level: string | null;
  goal: string | null;
  is_pregnant_or_breastfeeding: boolean | null;
  program_start_date: string | null;
}


type Measurement = {
  id: string;
  measured_at: string;
  weight_kg: number | null;
};


const GOALS: { value: NutritionGoal; label: string }[] = [
  { value: "perte_de_poids", label: "🥗 Perte de poids" },
  { value: "prise_de_masse", label: "💪 Prise de masse" },
  { value: "maintien", label: "⚖️ Maintien du poids" },
  { value: "equilibre", label: "❤️ Santé générale" },
];


const ACTIVITY_LEVELS: { value: ActivityLevel; label: string; hint: string }[] = [
  { value: "sedentaire", label: "🪑 Sédentaire", hint: "Bureau, peu ou pas de sport" },
  { value: "actif", label: "🏃 Actif", hint: "Sport 2-3x / semaine" },
  { value: "tres_actif", label: "🔥 Très actif", hint: "Sport 4-6x / semaine ou métier physique" },
];


const GOAL_LABELS: Record<string, string> = Object.fromEntries(
  GOALS.map((g) => [g.value, g.label.replace(/^\S+\s/, "")]),
);


const ACTIVITY_LABELS: Record<string, string> = Object.fromEntries(
  ACTIVITY_LEVELS.map((a) => [a.value, a.label.replace(/^\S+\s/, "")]),
);


const ACCESS_STATE_LABELS: Record<string, string> = {
  unrestricted: "Accès actif",
  managed: "Géré par votre professionnel",
  active: "Actif",
  trial: "Période d'essai",
  past_due: "Paiement en retard",
  suspended: "Suspendu",
};

const CHOICE_BASE =
  "rounded-xl border-2 px-4 py-3 text-left text-base transition-all disabled:opacity-60";
const CHOICE_ON =
  "border-primary bg-accent font-semibold text-accent-foreground ring-2 ring-primary/20";
const CHOICE_OFF =
  "border-border bg-background text-foreground hover:border-primary/50";
const FIELD = "h-12 rounded-xl text-base";


function calcBmi(weight: number | null, height: number | null): number | null {
  if (!weight || !height || weight <= 0 || height <= 0) return null;
  const m = height / 100;
  return Math.round((weight / (m * m)) * 10) / 10;
}


function isRowComplete(row: ProfileRow | null): boolean {
  if (!row || row.age == null || !row.goal) return false;
  if (isMinor(row.age)) return true;
  return !!row.gender && !!row.activity_level && !!row.weight_kg && !!row.height_cm;
}


function SubscriberProfilePage() {
  return (
    <ProtectedRoute allow={["subscriber"]}>
      <SubscriberLayout>
        <SubscriberProfileContent />
      </SubscriberLayout>
    </ProtectedRoute>
  );
}


function SubscriberProfileContent() {
  const { user, profile } = useAuth();
  const { state: accessState } = useAccessState();
  const navigate = useNavigate();


  const isSuspended = accessState === "suspended";


  const [row, setRow] = useState<ProfileRow | null | undefined>(undefined);
  const [measurements, setMeasurements] = useState<Measurement[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);


  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);


  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [activity, setActivity] = useState<ActivityLevel | "">("");
  const [goal, setGoal] = useState<NutritionGoal | "">("");
  const [pregnant, setPregnant] = useState(false);


  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);


  const loadMeasurements = useCallback(async () => {
    if (!user) return;


    const { data } = await supabase
      .from("body_measurements")
      .select("id, measured_at, weight_kg")
      .eq("user_id", user.id)
      .order("measured_at", { ascending: true })
      .limit(60);


    setMeasurements((data ?? []) as Measurement[]);
  }, [user]);


  const fillForm = (r: ProfileRow | null) => {
    setAge(r?.age != null ? String(r.age) : "");
    setGender(r?.gender === "homme" || r?.gender === "femme" ? r.gender : "");
    setWeight(r?.weight_kg != null ? String(r.weight_kg) : "");
    setHeight(r?.height_cm != null ? String(r.height_cm) : "");
    setTargetWeight(r?.target_weight_kg != null ? String(r.target_weight_kg) : "");
    setActivity(
      r?.activity_level === "sedentaire" || r?.activity_level === "actif" || r?.activity_level === "tres_actif"
        ? r.activity_level
        : "",
    );


    const g = GOALS.find((x) => x.value === r?.goal);
    setGoal(g ? g.value : "");
    setPregnant(r?.is_pregnant_or_breastfeeding ?? false);
  };


  useEffect(() => {
    if (!user) return;


    let cancelled = false;


    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "age, gender, weight_kg, height_cm, target_weight_kg, activity_level, goal, is_pregnant_or_breastfeeding, program_start_date",
        )
        .eq("id", user.id)
        .maybeSingle();


      if (cancelled) return;


      if (error) setLoadError(error.message);


      const r = (data as ProfileRow | null) ?? null;
      setRow(r);
      fillForm(r);


      if (!isRowComplete(r)) setEditing(true);


      await loadMeasurements();
    })();


    return () => {
      cancelled = true;
    };
  }, [user, loadMeasurements]);


  const chartData = useMemo(
    () =>
      (measurements ?? [])
        .filter((m) => m.weight_kg != null)
        .map((m) => ({
          date: format(new Date(m.measured_at), "dd/MM"),
          weight: Number(m.weight_kg),
        })),
    [measurements],
  );


  const numericAge = age ? Number(age) : null;
  const minorPreview = numericAge !== null && Number.isFinite(numericAge) && isMinor(numericAge);


  const handleSave = async () => {
    if (!user) return;


    setFormError(null);


    const a = Number(age);


    if (!age || !Number.isFinite(a) || a < 10 || a > 120) {
      setFormError("Indiquez un âge valide (10 à 120 ans).");
      return;
    }


    if (!goal) {
      setFormError("Choisissez votre objectif principal.");
      return;
    }


    const minor = isMinor(a);
    const w = weight ? Number(weight) : null;
    const h = height ? Number(height) : null;
    const tw = targetWeight ? Number(targetWeight) : null;


    if (w !== null && (!Number.isFinite(w) || w < 30 || w > 300)) {
      setFormError("Le poids doit être compris entre 30 et 300 kg.");
      return;
    }


    if (h !== null && (!Number.isFinite(h) || h < 100 || h > 250)) {
      setFormError("La taille doit être comprise entre 100 et 250 cm.");
      return;
    }


    if (tw !== null && (!Number.isFinite(tw) || tw < 30 || tw > 300)) {
      setFormError("Le poids objectif doit être compris entre 30 et 300 kg.");
      return;
    }


    if (!minor) {
      if (!gender) {
        setFormError("Indiquez votre sexe (nécessaire pour calculer vos besoins).");
        return;
      }


      if (!activity) {
        setFormError("Choisissez votre niveau d'activité physique.");
        return;
      }


      if (w === null || h === null) {
        setFormError("Le poids et la taille sont nécessaires pour calculer vos besoins.");
        return;
      }
    }


    setSaving(true);


    const programStartDate = row?.program_start_date ?? new Date().toISOString().slice(0, 10);
    const isPregnant = !minor && gender === "femme" ? pregnant : false;


    const nutrition = minor
      ? null
      : calculateNutritionProfile({
          weightKg: w as number,
          heightCm: h as number,
          age: a,
          gender: gender as Gender,
          activityLevel: activity as ActivityLevel,
          goal,
          programStartDate,
          isPregnantOrBreastfeeding: isPregnant,
        });


    const payload = {
      age: a,
      gender: minor ? null : gender,
      weight_kg: w,
      height_cm: h,
      bmi: calcBmi(w, h),
      goal,
      activity_level: minor ? null : activity,
      is_pregnant_or_breastfeeding: isPregnant,
      target_weight_kg: tw,
      program_start_date: programStartDate,
      bmr_kcal: nutrition?.bmrKcal ?? null,
      tdee_kcal: nutrition?.tdeeKcal ?? null,
      daily_kcal_target: nutrition?.targetKcal ?? null,
      target_kcal: nutrition?.targetKcal ?? null,
      target_protein_g: nutrition?.targetProteinG ?? null,
      target_carbs_g: nutrition?.targetCarbsG ?? null,
      target_fat_g: nutrition?.targetFatG ?? null,
      profile_complete: !minor,
    };


    const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);


    if (error) {
      setSaving(false);
      setFormError("Enregistrement impossible : " + error.message);
      return;
    }


    if (w !== null && w !== row?.weight_kg) {
      const { error: measureError } = await supabase.from("body_measurements").insert({
        user_id: user.id,
        measured_at: new Date().toISOString().slice(0, 10),
        weight_kg: w,
        height_cm: h,
      });


      if (measureError) console.error("Mesure de poids non enregistrée :", measureError);
    }


    const updated: ProfileRow = {
      age: a,
      gender: payload.gender,
      weight_kg: w,
      height_cm: h,
      target_weight_kg: tw,
      activity_level: payload.activity_level,
      goal,
      is_pregnant_or_breastfeeding: isPregnant,
      program_start_date: programStartDate,
    };


    setRow(updated);
    setSaving(false);
    setEditing(false);
    toast.success("Profil enregistré ✅");
    await loadMeasurements();
  };


  const handleDeleteAccount = async () => {
    if (!user) return;


    setDeleting(true);


    try {
      const { data, error } = await supabase.functions.invoke("delete-account", { body: {} });


      if (error || !(data as { success?: boolean } | null)?.success) {
        let message = "Suppression impossible pour le moment. Réessayez ou contactez votre professionnel.";
        const serverError = (data as { error?: string } | null)?.error;


        if (serverError) message = serverError;


        throw new Error(message);
      }


      await supabase.auth.signOut({ scope: "local" });
      navigate({ to: "/" });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
      setDeleting(false);
      setDeleteOpen(false);
    }
  };


  if (row === undefined) {
    return (
      <div className="p-4 sm:p-6">
        <div className="mx-auto max-w-4xl">
          <Skeleton className="h-44 w-full rounded-3xl" />
        </div>
      </div>
    );
  }


  const planLabel =
    profile?.plan === "premium" ? "Premium" : profile?.plan === "basic" ? "Basic" : (profile?.plan ?? "—");
  const statusLabel = ACCESS_STATE_LABELS[accessState] ?? "—";
  const initials =
    (profile?.full_name ?? "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";


  return (
    <div className="min-h-full p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* En-tête vert */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-[#1F5A2E] p-6 text-white shadow-lg sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-20 right-24 h-48 w-48 rounded-full bg-brand/30 blur-2xl" />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white text-2xl font-extrabold text-primary">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold uppercase tracking-wider text-white/80">
                  Mon profil
                </p>
                <h1 className="truncate text-3xl font-extrabold sm:text-4xl">
                  {profile?.full_name ?? "Profil"}
                </h1>
                <p className="truncate text-white/90">{profile?.email ?? ""}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-sm font-bold text-white">
                    {profile?.plan === "premium" ? (
                      <Star className="h-4 w-4 fill-current" />
                    ) : null}
                    {planLabel}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1.5 text-sm font-semibold text-white">
                    {statusLabel}
                  </span>
                </div>
              </div>
            </div>

            {!editing && !isSuspended ? (
              <Button
                className="h-11 shrink-0 rounded-full bg-white px-5 font-bold text-primary shadow-md hover:bg-white/90"
                onClick={() => {
                  fillForm(row);
                  setFormError(null);
                  setEditing(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Modifier
              </Button>
            ) : null}
          </div>
        </section>


        {loadError ? (
          <div className="rounded-2xl border border-destructive/40 px-4 py-3 text-sm text-destructive">
            {loadError}
          </div>
        ) : null}


        {editing && !isSuspended ? (
          <Card className="rounded-3xl border shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl">Vos informations</CardTitle>
              <CardDescription className="text-base">
                Elles servent à calculer vos besoins en calories et en macronutriments.
              </CardDescription>
            </CardHeader>


            <CardContent className="space-y-5">
              {!isRowComplete(row) ? (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Complétez ces informations pour obtenir vos objectifs nutritionnels.
                </div>
              ) : null}


              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="p-age" className="text-base font-semibold">
                    Âge
                  </Label>
                  <Input
                    id="p-age"
                    type="number"
                    min="10"
                    max="120"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    disabled={saving}
                    className={FIELD}
                  />
                </div>


                <div className="space-y-2">
                  <Label htmlFor="p-height" className="text-base font-semibold">
                    Taille (cm)
                  </Label>
                  <Input
                    id="p-height"
                    type="number"
                    min="100"
                    max="250"
                    step="0.5"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    disabled={saving}
                    className={FIELD}
                  />
                </div>


                <div className="space-y-2">
                  <Label htmlFor="p-weight" className="text-base font-semibold">
                    Poids actuel (kg)
                  </Label>
                  <Input
                    id="p-weight"
                    type="number"
                    min="30"
                    max="300"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    disabled={saving}
                    className={FIELD}
                  />
                </div>


                <div className="space-y-2">
                  <Label htmlFor="p-target" className="text-base font-semibold">
                    Poids objectif (kg)
                  </Label>
                  <Input
                    id="p-target"
                    type="number"
                    min="30"
                    max="300"
                    step="0.1"
                    value={targetWeight}
                    onChange={(e) => setTargetWeight(e.target.value)}
                    disabled={saving}
                    className={FIELD}
                  />
                </div>
              </div>


              {minorPreview ? (
                <div className="rounded-2xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                  Les moins de 18 ans nécessitent un accompagnement personnalisé : votre
                  professionnel établira lui-même votre programme.
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Sexe</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {(["homme", "femme"] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          disabled={saving}
                          onClick={() => setGender(g)}
                          aria-pressed={gender === g}
                          className={cn(CHOICE_BASE, gender === g ? CHOICE_ON : CHOICE_OFF)}
                        >
                          {g === "homme" ? "👨 Homme" : "👩 Femme"}
                        </button>
                      ))}
                    </div>
                  </div>


                  {gender === "femme" ? (
                    <label className="flex items-center gap-3 rounded-xl border bg-muted/50 px-4 py-3 text-sm">
                      <input
                        type="checkbox"
                        className="h-5 w-5 shrink-0 accent-[var(--primary)]"
                        checked={pregnant}
                        onChange={(e) => setPregnant(e.target.checked)}
                        disabled={saving}
                      />
                      Je suis enceinte ou j'allaite (facultatif)
                    </label>
                  ) : null}


                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Niveau d'activité physique</Label>
                    <div className="grid grid-cols-1 gap-3">
                      {ACTIVITY_LEVELS.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          disabled={saving}
                          onClick={() => setActivity(item.value)}
                          aria-pressed={activity === item.value}
                          className={cn(
                            CHOICE_BASE,
                            activity === item.value ? CHOICE_ON : CHOICE_OFF,
                          )}
                        >
                          {item.label}
                          <span className="block text-sm font-normal text-muted-foreground">
                            {item.hint}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}


              <div className="space-y-2">
                <Label className="text-base font-semibold">Votre objectif principal</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {GOALS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      disabled={saving}
                      onClick={() => setGoal(item.value)}
                      aria-pressed={goal === item.value}
                      className={cn(CHOICE_BASE, goal === item.value ? CHOICE_ON : CHOICE_OFF)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>


              {formError ? (
                <div className="rounded-2xl border border-destructive/40 px-4 py-3 text-sm text-destructive">
                  {formError}
                </div>
              ) : null}


              <div className="flex justify-end gap-2">
                {isRowComplete(row) ? (
                  <Button
                    variant="ghost"
                    className="h-12 rounded-full px-6"
                    onClick={() => {
                      fillForm(row);
                      setFormError(null);
                      setEditing(false);
                    }}
                    disabled={saving}
                  >
                    Annuler
                  </Button>
                ) : null}


                <Button
                  className="h-12 rounded-full px-8 text-base font-bold shadow-lg shadow-primary/25"
                  onClick={() => void handleSave()}
                  disabled={saving}
                >
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}


        <div className="grid gap-4 sm:grid-cols-2">
          <InfoCard
            icon={<BadgeCheck className="h-5 w-5" />}
            label="Type de compte"
            value={profile?.role === "subscriber" ? "Abonné" : "Utilisateur"}
          />


          <InfoCard
            icon={<Mail className="h-5 w-5" />}
            label="Adresse e-mail"
            value={profile?.email ?? "—"}
          />


          <InfoCard
            icon={<User className="h-5 w-5" />}
            label="Nom complet"
            value={profile?.full_name ?? "—"}
          />


          {!isSuspended ? (
            <>
              <InfoCard
                icon={<Shield className="h-5 w-5" />}
                label="Objectif principal"
                value={row?.goal ? (GOAL_LABELS[row.goal] ?? "—") : "—"}
              />


              <InfoCard
                icon={<Ruler className="h-5 w-5" />}
                label="Taille"
                value={row?.height_cm ? `${row.height_cm} cm` : "—"}
              />


              <InfoCard
                icon={<Weight className="h-5 w-5" />}
                label="Poids actuel"
                value={row?.weight_kg ? `${row.weight_kg} kg` : "—"}
              />


              <InfoCard
                icon={<Target className="h-5 w-5" />}
                label="Poids objectif"
                value={row?.target_weight_kg ? `${row.target_weight_kg} kg` : "—"}
              />


              <InfoCard
                icon={<User className="h-5 w-5" />}
                label="Sexe · activité"
                value={
                  row?.gender || row?.activity_level
                    ? `${row?.gender === "homme" ? "Homme" : row?.gender === "femme" ? "Femme" : "—"} · ${
                        row?.activity_level ? (ACTIVITY_LABELS[row.activity_level] ?? "—") : "—"
                      }`
                    : "—"
                }
              />
            </>
          ) : null}
        </div>


        <Card className="rounded-3xl border shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Repères personnels</CardTitle>
            <CardDescription>
              Ces données pourront ensuite être enrichies ou verrouillées selon votre offre.
            </CardDescription>
          </CardHeader>


          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-muted/40 p-4">
              <div className="text-sm font-medium text-muted-foreground">Âge</div>
              <div className="mt-1 text-2xl font-extrabold">
                {row?.age != null ? `${row.age} ans` : "—"}
              </div>
            </div>


            <div className="rounded-2xl bg-muted/40 p-4">
              <div className="text-sm font-medium text-muted-foreground">Plan</div>
              <div className="mt-1 text-2xl font-extrabold">{planLabel}</div>
            </div>


            <div className="rounded-2xl bg-muted/40 p-4">
              <div className="text-sm font-medium text-muted-foreground">Statut</div>
              <div className="mt-1 text-2xl font-extrabold">{statusLabel}</div>
            </div>
          </CardContent>
        </Card>


        <SubscriptionOfferCard />


        {!isSuspended ? (
          <Card className="rounded-3xl border shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Évolution du poids</CardTitle>
              <CardDescription>
                Historique simple pour garder une expérience cohérente avec l'espace patient.
              </CardDescription>
            </CardHeader>


            <CardContent>
              {measurements === null ? (
                <Skeleton className="h-48 w-full rounded-2xl" />
              ) : chartData.length === 0 ? (
                <div className="rounded-2xl bg-muted/30 p-4 text-sm text-muted-foreground">
                  Aucune mesure enregistrée pour le moment.
                </div>
              ) : (
                <>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" fontSize={11} />
                        <YAxis domain={["auto", "auto"]} fontSize={11} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="weight"
                          stroke="#357F1E"
                          strokeWidth={3}
                          dot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>


                  <div className="mt-4 rounded-2xl border">
                    <ul className="divide-y text-sm">
                      {[...(measurements ?? [])].reverse().map((m) => (
                        <li key={m.id} className="flex items-center justify-between px-4 py-3">
                          <span>{format(new Date(m.measured_at), "dd/MM/yyyy")}</span>
                          <span className="font-semibold">
                            {m.weight_kg != null ? `${m.weight_kg} kg` : "—"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ) : null}


        <Card className="rounded-3xl border shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Sécurité</CardTitle>
            <CardDescription>
              Gérez votre nom complet et votre mot de passe.
            </CardDescription>
          </CardHeader>


          <CardContent className="space-y-5">
            <Button
              variant="outline"
              className="h-11 rounded-full px-6 font-bold"
              onClick={() => navigate({ to: "/subscriber/account" })}
            >
              Gérer mes informations de compte
            </Button>


            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-bold text-destructive">Zone sensible</p>

              <Button
                variant="destructive"
                className="mt-3 h-11 rounded-full px-6 font-bold"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer mon compte
              </Button>


              <p className="mt-2 text-xs text-muted-foreground">
                Cette action est irréversible. Toutes vos données seront supprimées, et votre
                abonnement en ligne éventuel sera annulé.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>


      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Supprimer votre compte ?
            </DialogTitle>


            <DialogDescription>
              Vous allez supprimer définitivement votre compte abonné et toutes vos données. Votre
              abonnement en ligne éventuel sera annulé. Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>


          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Annuler
            </Button>


            <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleting}>
              {deleting ? "Suppression…" : "Supprimer mon compte"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="rounded-3xl border shadow-sm">
      <CardContent className="p-5">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          {icon}
        </div>
        <div className="text-sm font-medium text-muted-foreground">{label}</div>
        <div className="mt-1 break-words text-lg font-extrabold">{value}</div>
      </CardContent>
    </Card>
  );
}