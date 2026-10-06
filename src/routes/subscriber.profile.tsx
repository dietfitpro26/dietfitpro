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
import { useAuth } from "@/hooks/useAuth";
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

const STATUS_LABELS: Record<string, string> = {
  none: "Aucun abonnement actif",
  active: "Actif",
  trialing: "Période d'essai",
  past_due: "Paiement en retard",
  canceled: "Annulé",
};

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
  const navigate = useNavigate();

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
      // Profil incomplet : on ouvre directement le formulaire.
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

    // Uniquement des champs autorisés : jamais role, plan, pro_id, abonnement, stripe.
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

    // Nouveau poids : on l'ajoute à l'historique (sans bloquer si ça échoue).
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
      // Supprimer les mesures
      await supabase.from("body_measurements").delete().eq("user_id", user.id);

      // Supprimer le profil
      await supabase.from("profiles").delete().eq("id", user.id);

      // Déconnexion
      await supabase.auth.signOut();

      navigate({ to: "/" });
    } catch (err) {
      console.error(err);
      setDeleting(false);
    }
  };

  if (row === undefined) {
    return (
      <div className="p-4 sm:p-6">
        <div className="mx-auto max-w-4xl">
          <Skeleton className="h-40 w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  const planLabel =
    profile?.plan === "premium" ? "Premium" : profile?.plan === "basic" ? "Basic" : (profile?.plan ?? "—");
  const statusLabel = profile?.subscription_status
    ? (STATUS_LABELS[profile.subscription_status] ?? profile.subscription_status)
    : "—";

  return (
    <div className="min-h-full bg-gradient-to-b from-background to-muted/20 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <Card className="rounded-3xl border shadow-sm">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl sm:text-2xl">Profil</CardTitle>
                  <CardDescription className="mt-1 text-sm sm:text-base">
                    Retrouvez ici vos informations personnelles, votre type de compte et vos
                    repères de suivi.
                  </CardDescription>
                </div>
              </div>

              {!editing ? (
                <Button
                  variant="outline"
                  className="rounded-2xl"
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
          </CardHeader>
        </Card>

        {loadError ? (
          <div className="rounded-2xl border border-destructive/40 px-4 py-3 text-sm text-destructive">
            {loadError}
          </div>
        ) : null}

        {editing ? (
          <Card className="rounded-3xl border shadow-sm">
            <CardHeader>
              <CardTitle>Vos informations</CardTitle>
              <CardDescription>
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
                  <Label htmlFor="p-age">Âge</Label>
                  <Input
                    id="p-age"
                    type="number"
                    min="10"
                    max="120"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-height">Taille (cm)</Label>
                  <Input
                    id="p-height"
                    type="number"
                    min="100"
                    max="250"
                    step="0.5"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-weight">Poids actuel (kg)</Label>
                  <Input
                    id="p-weight"
                    type="number"
                    min="30"
                    max="300"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-target">Poids objectif (kg)</Label>
                  <Input
                    id="p-target"
                    type="number"
                    min="30"
                    max="300"
                    step="0.1"
                    value={targetWeight}
                    onChange={(e) => setTargetWeight(e.target.value)}
                    disabled={saving}
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
                    <Label>Sexe</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {(["homme", "femme"] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          disabled={saving}
                          onClick={() => setGender(g)}
                          className={cn(
                            "rounded-lg border px-4 py-2 text-sm font-medium transition-all",
                            gender === g
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background text-muted-foreground hover:border-primary/50",
                          )}
                        >
                          {g === "homme" ? "👨 Homme" : "👩 Femme"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {gender === "femme" ? (
                    <label className="flex items-center gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={pregnant}
                        onChange={(e) => setPregnant(e.target.checked)}
                        disabled={saving}
                      />
                      Je suis enceinte ou j'allaite (facultatif)
                    </label>
                  ) : null}

                  <div className="space-y-2">
                    <Label>Niveau d'activité physique</Label>
                    <div className="grid grid-cols-1 gap-2">
                      {ACTIVITY_LEVELS.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          disabled={saving}
                          onClick={() => setActivity(item.value)}
                          className={cn(
                            "rounded-lg border px-3 py-2 text-left text-sm transition-all",
                            activity === item.value
                              ? "border-primary bg-primary/10 font-medium text-primary"
                              : "border-border bg-background text-muted-foreground hover:border-primary/50",
                          )}
                        >
                          {item.label}
                          <span className="ml-1 text-xs text-muted-foreground">— {item.hint}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Votre objectif principal</Label>
                <div className="grid grid-cols-2 gap-2">
                  {GOALS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      disabled={saving}
                      onClick={() => setGoal(item.value)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left text-sm transition-all",
                        goal === item.value
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50",
                      )}
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
                    className="rounded-2xl"
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
                  className="rounded-2xl bg-[#6DB33F] text-white hover:bg-[#2D7A1F]"
                  onClick={() => void handleSave()}
                  disabled={saving}
                >
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
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
        </div>

        <Card className="rounded-3xl border shadow-sm">
          <CardHeader>
            <CardTitle>Repères personnels</CardTitle>
            <CardDescription>
              Ces données pourront ensuite être enrichies ou verrouillées selon votre offre.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-muted/30 p-4">
              <div className="text-xs text-muted-foreground">Âge</div>
              <div className="mt-1 text-lg font-semibold">
                {row?.age != null ? `${row.age} ans` : "—"}
              </div>
            </div>
            <div className="rounded-2xl bg-muted/30 p-4">
              <div className="text-xs text-muted-foreground">Plan</div>
              <div className="mt-1 text-lg font-semibold">{planLabel}</div>
            </div>
            <div className="rounded-2xl bg-muted/30 p-4">
              <div className="text-xs text-muted-foreground">Statut</div>
              <div className="mt-1 text-lg font-semibold">{statusLabel}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border shadow-sm">
          <CardHeader>
            <CardTitle>Évolution du poids</CardTitle>
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
                        stroke="#6DB33F"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 rounded-2xl border">
                  <ul className="divide-y text-sm">
                    {[...(measurements ?? [])].reverse().map((m) => (
                      <li key={m.id} className="flex items-center justify-between px-4 py-3">
                        <span>{format(new Date(m.measured_at), "dd/MM/yyyy")}</span>
                        <span className="font-medium">
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

        <Card className="rounded-3xl border shadow-sm">
          <CardHeader>
            <CardTitle>Sécurité</CardTitle>
            <CardDescription>
              Cette zone servira ensuite à regrouper mot de passe, sécurité du compte et préférences.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="rounded-2xl">
              Gérer mes informations de compte
            </Button>

            <div className="border-t pt-4">
              <Button
                variant="destructive"
                className="rounded-2xl"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer mon compte
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Cette action est irréversible. Toutes vos données seront supprimées.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Supprimer votre compte ?
            </DialogTitle>
            <DialogDescription>
              Vous allez supprimer définitivement votre compte abonné et toutes vos données. Cette
              action est irréversible.
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
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-1 text-base font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}