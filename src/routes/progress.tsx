import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp, TrendingDown, Trash2, Scale, CalendarDays } from "lucide-react";
import { SubscriberLayout } from "@/layouts/SubscriberLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { BodyMetricsChart, MetricKey } from "@/components/BodyMetricsChart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";


export const Route = createFileRoute("/progress")({
  head: () => ({ meta: [{ title: "Ma Progression — DietFitPro" }] }),
  component: () => (
    <ProtectedRoute allow={["subscriber"]}>
      <SubscriberLayout>
        <ProgressContent />
      </SubscriberLayout>
    </ProtectedRoute>
  ),
});


const ALL_METRICS: MetricKey[] = [
  "weight_kg", "bmi", "body_fat_pct",
  "muscle_mass_kg", "water_pct", "metabolic_age",
];


function ProgressContent() {
  const { user } = useAuth();
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);


  const [form, setForm] = useState({
    weight_kg: "", height_cm: "", body_fat_pct: "",
    muscle_mass_kg: "", water_pct: "", metabolic_age: "",
    bone_mass_kg: "", visceral_fat: "", notes: "",
  });


  useEffect(() => {
    if (!user) return;
    void (async () => {
      await loadMeasurements();
      setLoading(false);
    })();
  }, [user]);


  async function loadMeasurements() {
    if (!user) return;
    const { data, error } = await supabase
      .from("body_measurements")
      .select("*")
      .eq("user_id", user.id)
      .order("measured_at", { ascending: true });
    if (error) setLoadError(error.message);
    setMeasurements(data ?? []);
  }


  async function handleSave() {
    if (!user) return;
    if (!form.weight_kg) {
      toast.error("Le poids est obligatoire");
      return;
    }


    setSaving(true);
    const payload = {
      user_id:         user.id,
      created_by:      user.id,          // ← nouveau : qui a saisi
      measured_at:     new Date().toISOString().split("T")[0],
      weight_kg:       form.weight_kg      ? +form.weight_kg      : null,
      height_cm:       form.height_cm      ? +form.height_cm      : null,
      body_fat_pct:    form.body_fat_pct   ? +form.body_fat_pct   : null,
      muscle_mass_kg:  form.muscle_mass_kg ? +form.muscle_mass_kg : null,
      water_pct:       form.water_pct      ? +form.water_pct      : null,
      metabolic_age:   form.metabolic_age  ? +form.metabolic_age  : null,
      bone_mass_kg:    form.bone_mass_kg   ? +form.bone_mass_kg   : null,
      visceral_fat:    form.visceral_fat   ? +form.visceral_fat   : null,
      notes:           form.notes || null,
    };


    const { error } = await supabase.from("body_measurements").insert(payload);
    setSaving(false);


    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }


    toast.success("✅ Mesure enregistrée !");
    setForm({
      weight_kg: "", height_cm: "", body_fat_pct: "",
      muscle_mass_kg: "", water_pct: "", metabolic_age: "",
      bone_mass_kg: "", visceral_fat: "", notes: "",
    });
    await loadMeasurements();
  }


  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette mesure ?")) return;
    const { error } = await supabase
      .from("body_measurements")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    toast.success("Mesure supprimée");
    await loadMeasurements();
  }


  const fields = [
    { key: "weight_kg",      label: "Poids",            unit: "kg",  required: true  },
    { key: "height_cm",      label: "Taille",            unit: "cm",  required: false },
    { key: "body_fat_pct",   label: "Masse grasse",      unit: "%",   required: false },
    { key: "muscle_mass_kg", label: "Masse musculaire",  unit: "kg",  required: false },
    { key: "water_pct",      label: "Masse hydrique",    unit: "%",   required: false },
    { key: "metabolic_age",  label: "Âge métabolique",   unit: "ans", required: false },
    { key: "bone_mass_kg",   label: "Masse osseuse",     unit: "kg",  required: false },
    { key: "visceral_fat",   label: "Graisse viscérale", unit: "",    required: false },
  ];


  const weights = measurements
    .filter((m) => m.weight_kg != null)
    .map((m) => Number(m.weight_kg));
  const lastWeight = weights.length ? weights[weights.length - 1] : null;
  const delta =
    weights.length >= 2
      ? Math.round((weights[weights.length - 1] - weights[0]) * 10) / 10
      : null;


  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
        <div className="h-40 animate-pulse rounded-3xl bg-muted" />
        <div className="h-64 animate-pulse rounded-3xl bg-muted" />
        <div className="h-64 animate-pulse rounded-3xl bg-muted" />
      </div>
    );
  }


  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">

      {/* En-tête vert */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-[#1F5A2E] p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-48 w-48 rounded-full bg-brand/30 blur-2xl" />

        <div className="relative flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
            <TrendingUp className="h-7 w-7" />
          </div>
          <div>
            <p className="mb-1 text-sm font-bold uppercase tracking-wider text-white/80">
              Votre suivi
            </p>
            <h1 className="text-3xl font-extrabold sm:text-4xl">Ma Progression</h1>
            <p className="mt-2 max-w-xl text-base text-white/90 sm:text-lg">
              Suivez l'évolution de votre composition corporelle dans le temps.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-sm font-semibold text-white">
                <CalendarDays className="h-4 w-4" />
                {measurements.length} mesure{measurements.length > 1 ? "s" : ""}
              </span>
              {lastWeight !== null ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-sm font-semibold text-white">
                  <Scale className="h-4 w-4" />
                  {lastWeight} kg
                </span>
              ) : null}
              {delta !== null ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-sm font-semibold text-white">
                  {delta <= 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                  {delta > 0 ? "+" : ""}
                  {delta} kg depuis le début
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>


      {loadError ? (
        <div className="rounded-2xl border border-destructive/40 px-4 py-3 text-sm text-destructive">
          Chargement impossible : {loadError}
        </div>
      ) : null}


      {/* Formulaire */}
      <Card className="rounded-3xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Ajouter une mesure aujourd'hui</CardTitle>
          <CardDescription>
            Seul le poids est obligatoire. Les autres champs sont facultatifs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {fields.map(({ key, label, unit, required }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-sm font-semibold">
                  {label}
                  {unit && (
                    <span className="text-muted-foreground ml-1 text-xs">({unit})</span>
                  )}
                  {required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  className="h-12 rounded-xl text-base"
                  value={form[key as keyof typeof form]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>


          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Notes (optionnel)</Label>
            <Input
              className="h-12 rounded-xl text-base"
              placeholder="ex: après sport, à jeun..."
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>


          <Button
            onClick={handleSave}
            disabled={saving}
            className="h-12 rounded-full px-8 text-base font-bold shadow-lg shadow-primary/25"
          >
            {saving ? "Enregistrement…" : "Enregistrer la mesure"}
          </Button>
        </CardContent>
      </Card>


      {/* Graphique */}
      <Card className="rounded-3xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Courbe d'évolution</CardTitle>
        </CardHeader>
        <CardContent>
          <BodyMetricsChart
            data={measurements}
            availableMetrics={ALL_METRICS}
          />
        </CardContent>
      </Card>


      {/* Historique */}
      {measurements.length > 0 ? (
        <Card className="rounded-3xl border shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Historique complet</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 pr-4 font-semibold">Date</th>
                  <th className="text-right pr-4 font-semibold">Poids</th>
                  <th className="text-right pr-4 font-semibold">IMC</th>
                  <th className="text-right pr-4 font-semibold">Masse grasse</th>
                  <th className="text-right pr-4 font-semibold">Musculaire</th>
                  <th className="text-right pr-4 font-semibold">Hydrique</th>
                  <th className="text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {[...measurements].reverse().map((m) => (
                  <tr key={m.id} className="border-b last:border-0 hover:bg-accent/50 transition-colors">
                    <td className="py-3 pr-4 font-semibold">
                      {new Date(m.measured_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="text-right pr-4">
                      {m.weight_kg ? `${m.weight_kg} kg` : "—"}
                    </td>
                    <td className="text-right pr-4">
                      {m.bmi
                        ? m.bmi
                        : m.weight_kg && m.height_cm
                        ? (m.weight_kg / Math.pow(m.height_cm / 100, 2)).toFixed(1)
                        : "—"}
                    </td>
                    <td className="text-right pr-4">
                      {m.body_fat_pct ? `${m.body_fat_pct} %` : "—"}
                    </td>
                    <td className="text-right pr-4">
                      {m.muscle_mass_kg ? `${m.muscle_mass_kg} kg` : "—"}
                    </td>
                    <td className="text-right pr-4">
                      {m.water_pct ? `${m.water_pct} %` : "—"}
                    </td>
                    <td className="text-right">
                      {/* Abonné supprime uniquement SES propres saisies */}
                      {(!m.created_by || m.created_by === user?.id) && (
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="inline-flex items-center rounded-full p-2 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
                          title="Supprimer cette mesure"
                          aria-label="Supprimer cette mesure"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-3xl border-2 border-dashed shadow-sm">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Aucune mesure pour le moment. Saisissez votre poids ci-dessus pour démarrer votre suivi.
          </CardContent>
        </Card>
      )}


    </div>
  );
}