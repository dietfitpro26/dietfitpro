import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PatientLayout } from "@/layouts/PatientLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { BodyMetricsChart, MetricKey } from "@/components/BodyMetricsChart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

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
  "weight_kg", "bmi", "body_fat_pct",
  "muscle_mass_kg", "water_pct", "metabolic_age",
];

function MesuresContent() {
  const { user } = useAuth();
  const [patientId, setPatientId] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    weight_kg: "", height_cm: "", body_fat_pct: "",
    muscle_mass_kg: "", water_pct: "", metabolic_age: "",
    bone_mass_kg: "", visceral_fat: "", notes: "",
  });

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: p } = await supabase
        .from("patients")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (p?.id) {
        setPatientId(p.id);
        await loadMeasurements(p.id);
      }
      setLoading(false);
    })();
  }, [user]);

  async function loadMeasurements(pid: string) {
    const { data } = await supabase
      .from("body_measurements")
      .select("*")
      .eq("patient_id", pid)
      .order("measured_at", { ascending: true });
    setMeasurements(data ?? []);
  }

  async function handleSave() {
    if (!patientId) {
      toast.error("Profil patient introuvable");
      return;
    }
    if (!form.weight_kg) {
      toast.error("Le poids est obligatoire");
      return;
    }

    setSaving(true);
    const payload = {
      patient_id:     patientId,
      created_by:     user!.id,           // ← nouveau : qui a saisi
      measured_at:    new Date().toISOString().split("T")[0],
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
    await loadMeasurements(patientId);
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
    if (patientId) await loadMeasurements(patientId);
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

  if (loading) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Chargement…
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">

      <div>
        <h1 className="text-2xl font-bold">📊 Mes mesures corporelles</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Suivez l'évolution de votre composition corporelle dans le temps.
        </p>
      </div>

      {/* Formulaire */}
      <Card>
        <CardHeader>
          <CardTitle>Ajouter une mesure aujourd'hui</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {fields.map(({ key, label, unit, required }) => (
              <div key={key} className="space-y-1">
                <Label>
                  {label}
                  {unit && <span className="text-muted-foreground ml-1 text-xs">({unit})</span>}
                  {required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form[key as keyof typeof form]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <Label>Notes (optionnel)</Label>
            <Input
              placeholder="ex: après sport, à jeun..."
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer la mesure"}
          </Button>
        </CardContent>
      </Card>

      {/* Graphique */}
      <Card>
        <CardHeader>
          <CardTitle>Courbe d'évolution</CardTitle>
        </CardHeader>
        <CardContent>
          <BodyMetricsChart
            data={measurements}
            availableMetrics={ALL_METRICS}
          />
        </CardContent>
      </Card>

      {/* Historique */}
      {measurements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historique complet</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 pr-4">Date</th>
                  <th className="text-right pr-4">Poids</th>
                  <th className="text-right pr-4">IMC</th>
                  <th className="text-right pr-4">Masse grasse</th>
                  <th className="text-right pr-4">Musculaire</th>
                  <th className="text-right pr-4">Hydrique</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {[...measurements].reverse().map((m) => (
                  <tr key={m.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-2 pr-4 font-medium">
                      {new Date(m.measured_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="text-right pr-4">{m.weight_kg ? `${m.weight_kg} kg` : "—"}</td>
                    <td className="text-right pr-4">
                      {m.bmi
                        ? m.bmi
                        : m.weight_kg && m.height_cm
                        ? (m.weight_kg / Math.pow(m.height_cm / 100, 2)).toFixed(1)
                        : "—"}
                    </td>
                    <td className="text-right pr-4">{m.body_fat_pct ? `${m.body_fat_pct} %` : "—"}</td>
                    <td className="text-right pr-4">{m.muscle_mass_kg ? `${m.muscle_mass_kg} kg` : "—"}</td>
                    <td className="text-right pr-4">{m.water_pct ? `${m.water_pct} %` : "—"}</td>
                    <td className="text-right">
                      {(!m.created_by || m.created_by === user?.id) && (
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="text-xs text-red-500 hover:text-red-700 transition-colors px-2 py-1"
                          title="Supprimer cette mesure"
                        >
                          🗑️
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

    </div>
  );
}