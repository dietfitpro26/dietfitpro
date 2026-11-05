import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PatientLayout } from "@/layouts/PatientLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { BodyMetricsChart, MetricKey } from "@/components/BodyMetricsChart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Activity,
  CalendarDays,
  ChartNoAxesCombined,
  Loader2,
  Plus,
  Ruler,
  Scale,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/patient/mesures")({
  head: () => ({ meta: [{ title: "Mes mesures — DietFitPro" }] }),
  component: () => (
    <ProtectedRoute allow={["patient"]}>
      <PatientLayout>
        <MesuresContent />
      </PatientLayout>
    </ProtectedRoute>
  ),
});

const ALL_METRICS: MetricKey[] = [
  "weight_kg",
  "bmi",
  "body_fat_pct",
  "muscle_mass_kg",
  "water_pct",
  "metabolic_age",
];

type FormState = {
  weight_kg: string;
  height_cm: string;
  body_fat_pct: string;
  muscle_mass_kg: string;
  water_pct: string;
  metabolic_age: string;
  bone_mass_kg: string;
  visceral_fat: string;
  notes: string;
};

type Measurement = {
  id: string;
  patient_id: string;
  created_by: string | null;
  measured_at: string;
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  water_pct: number | null;
  metabolic_age: number | null;
  bone_mass_kg: number | null;
  visceral_fat: number | null;
  notes: string | null;
};

const INITIAL_FORM: FormState = {
  weight_kg: "",
  height_cm: "",
  body_fat_pct: "",
  muscle_mass_kg: "",
  water_pct: "",
  metabolic_age: "",
  bone_mass_kg: "",
  visceral_fat: "",
  notes: "",
};

const FIELDS: {
  key: Exclude<keyof FormState, "notes">;
  label: string;
  unit: string;
  required?: boolean;
  step?: string;
}[] = [
  { key: "weight_kg", label: "Poids", unit: "kg", required: true, step: "0.1" },
  { key: "height_cm", label: "Taille", unit: "cm", step: "0.1" },
  { key: "body_fat_pct", label: "Masse grasse", unit: "%", step: "0.1" },
  { key: "muscle_mass_kg", label: "Masse musculaire", unit: "kg", step: "0.1" },
  { key: "water_pct", label: "Masse hydrique", unit: "%", step: "0.1" },
  { key: "metabolic_age", label: "Âge métabolique", unit: "ans", step: "1" },
  { key: "bone_mass_kg", label: "Masse osseuse", unit: "kg", step: "0.1" },
  { key: "visceral_fat", label: "Graisse viscérale", unit: "", step: "0.1" },
];

function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMeasurementDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("fr-FR").format(
    new Date(year, month - 1, day),
  );
}

function MesuresContent() {
  const { user } = useAuth();
  const [patientId, setPatientId] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [form, setForm] = useState<FormState>({ ...INITIAL_FORM });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadMeasurements = useCallback(async (pid: string) => {
    const { data, error } = await supabase
      .from("body_measurements")
      .select("*")
      .eq("patient_id", pid)
      .order("measured_at", { ascending: true });

    if (error) {
      setLoadError(true);
      toast.error("Impossible de charger vos mesures.");
      return false;
    }

    setMeasurements((data ?? []) as Measurement[]);
    setLoadError(false);
    return true;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data: patient, error } = await supabase
        .from("patients")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        toast.error("Impossible de récupérer votre profil patient.");
        setLoadError(true);
        setLoading(false);
        return;
      }

      if (!patient?.id) {
        setPatientId(null);
        setLoading(false);
        return;
      }

      setPatientId(patient.id);
      await loadMeasurements(patient.id);

      if (!cancelled) setLoading(false);
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [user, loadMeasurements]);

  async function handleSave() {
    if (!patientId || !user) {
      toast.error("Profil patient introuvable. Veuillez vous reconnecter.");
      return;
    }

    if (!form.weight_kg.trim()) {
      toast.error("Le poids est obligatoire.");
      return;
    }

    const numericFields = FIELDS.filter(({ key }) => form[key].trim() !== "");
    for (const field of numericFields) {
      const value = Number(form[field.key]);
      if (!Number.isFinite(value) || value < 0) {
        toast.error(`Vérifiez la valeur du champ « ${field.label} ».`);
        return;
      }
    }

    if (Number(form.weight_kg) <= 0) {
      toast.error("Le poids doit être supérieur à zéro.");
      return;
    }

    if (form.height_cm.trim() && Number(form.height_cm) <= 0) {
      toast.error("La taille doit être supérieure à zéro.");
      return;
    }

    setSaving(true);

    const numericValue = (value: string) =>
      value.trim() === "" ? null : Number(value);

    const payload = {
      patient_id: patientId,
      created_by: user.id,
      measured_at: getLocalDateString(),
      weight_kg: numericValue(form.weight_kg),
      height_cm: numericValue(form.height_cm),
      body_fat_pct: numericValue(form.body_fat_pct),
      muscle_mass_kg: numericValue(form.muscle_mass_kg),
      water_pct: numericValue(form.water_pct),
      metabolic_age: numericValue(form.metabolic_age),
      bone_mass_kg: numericValue(form.bone_mass_kg),
      visceral_fat: numericValue(form.visceral_fat),
      notes: form.notes.trim() || null,
    };

    const { error } = await supabase
      .from("body_measurements")
      .insert(payload);

    setSaving(false);

    if (error) {
      toast.error("L'enregistrement a échoué. " + error.message);
      return;
    }

    toast.success("Mesure enregistrée.");
    setForm({ ...INITIAL_FORM });
    await loadMeasurements(patientId);
  }

  async function handleDelete(id: string) {
    if (!patientId || deletingId) return;
    if (!window.confirm("Voulez-vous vraiment supprimer cette mesure ?")) return;

    setDeletingId(id);

    const { error } = await supabase
      .from("body_measurements")
      .delete()
      .eq("id", id)
      .eq("patient_id", patientId)
      .eq("created_by", user?.id);

    setDeletingId(null);

    if (error) {
      toast.error("La suppression a échoué. " + error.message);
      return;
    }

    toast.success("Mesure supprimée.");
    await loadMeasurements(patientId);
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        Chargement de vos mesures…
      </div>
    );
  }

  if (!patientId) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        <Card className="rounded-3xl">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Activity className="h-10 w-10 text-muted-foreground" />
            <h1 className="text-xl font-semibold">Profil patient introuvable</h1>
            <p className="max-w-md text-sm text-muted-foreground">
              Votre espace patient n'est pas encore associé à un profil.
              Contactez votre professionnel de santé ou notre assistance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-primary/5 p-5 shadow-sm sm:p-7">
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/80 px-3 py-1.5 text-xs font-semibold text-primary">
            <ChartNoAxesCombined className="h-4 w-4" aria-hidden="true" />
            Mon suivi
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Mes mesures corporelles
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Retrouvez vos mesures et suivez leur évolution au fil du temps.
            Renseignez-les dans des conditions similaires pour faciliter la comparaison.
          </p>
        </div>
      </header>

      <Card className="rounded-3xl border-border/70 shadow-sm">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Plus className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-lg">Ajouter une mesure</CardTitle>
              <CardDescription>
                Saisissez les valeurs disponibles aujourd'hui.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FIELDS.map(({ key, label, unit, required, step }) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`measurement-${key}`}>
                  {label}
                  {unit && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      ({unit})
                    </span>
                  )}
                  {required && (
                    <span className="ml-1 text-destructive" aria-hidden="true">
                      *
                    </span>
                  )}
                </Label>
                <Input
                  id={`measurement-${key}`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step={step}
                  placeholder="—"
                  value={form[key]}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  className="h-11 rounded-xl"
                  aria-required={required || undefined}
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="measurement-notes">Notes (facultatif)</Label>
            <Input
              id="measurement-notes"
              placeholder="Ex. : mesure prise le matin, après le sport…"
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              className="h-11 rounded-xl"
            />
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              <span className="text-destructive">*</span> Champ obligatoire :
              le poids.
            </p>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-11 w-full rounded-xl sm:w-auto"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement…
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Enregistrer la mesure
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-border/70 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ChartNoAxesCombined className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-lg">Évolution de mes mesures</CardTitle>
              <CardDescription>
                Choisissez un indicateur pour consulter sa courbe.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <div className="space-y-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-center">
              <p className="text-sm text-muted-foreground">
                Le chargement des mesures a rencontré un problème.
              </p>
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => void loadMeasurements(patientId)}
              >
                Réessayer
              </Button>
            </div>
          ) : (
            <BodyMetricsChart
              data={measurements}
              availableMetrics={ALL_METRICS}
            />
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-border/70 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CalendarDays className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-lg">Historique des mesures</CardTitle>
              <CardDescription>
                {measurements.length === 0
                  ? "Vos mesures enregistrées apparaîtront ici."
                  : `${measurements.length} mesure${measurements.length > 1 ? "s" : ""} enregistrée${measurements.length > 1 ? "s" : ""}`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {measurements.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed p-8 text-center">
              <Scale className="h-8 w-8 text-muted-foreground" />
              <p className="font-medium">Aucune mesure pour le moment</p>
              <p className="text-sm text-muted-foreground">
                Votre première saisie sera affichée dans cet historique.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th scope="col" className="py-3 pr-4 text-left font-medium">
                      Date
                    </th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">
                      Poids
                    </th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">
                      IMC
                    </th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">
                      Masse grasse
                    </th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">
                      Musculaire
                    </th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">
                      Hydrique
                    </th>
                    <th scope="col" className="py-3 pl-3 text-right font-medium">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...measurements].reverse().map((measurement) => {
                    const bmi =
                      measurement.bmi ??
                      (measurement.weight_kg &&
                      measurement.height_cm &&
                      measurement.height_cm > 0
                        ? (
                            measurement.weight_kg /
                            Math.pow(measurement.height_cm / 100, 2)
                          ).toFixed(1)
                        : null);

                    return (
                      <tr
                        key={measurement.id}
                        className="border-b last:border-0 hover:bg-muted/30"
                      >
                        <td className="py-3 pr-4 font-medium">
                          {formatMeasurementDate(measurement.measured_at)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {measurement.weight_kg != null
                            ? `${measurement.weight_kg} kg`
                            : "—"}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {bmi ?? "—"}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {measurement.body_fat_pct != null
                            ? `${measurement.body_fat_pct} %`
                            : "—"}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {measurement.muscle_mass_kg != null
                            ? `${measurement.muscle_mass_kg} kg`
                            : "—"}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {measurement.water_pct != null
                            ? `${measurement.water_pct} %`
                            : "—"}
                        </td>
                        <td className="py-3 pl-3 text-right">
                          {measurement.created_by === user?.id && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive"
                              aria-label="Supprimer cette mesure"
                              title="Supprimer cette mesure"
                              disabled={deletingId !== null}
                              onClick={() => void handleDelete(measurement.id)}
                            >
                              {deletingId === measurement.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-2xl bg-muted/40 p-4 text-xs text-muted-foreground">
        <Ruler className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          Les mesures corporelles sont des indicateurs de suivi. Elles peuvent
          varier selon les conditions de mesure et ne constituent pas, à elles
          seules, un diagnostic médical.
        </p>
      </div>
    </div>
  );
}
