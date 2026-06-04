import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Pencil, TrendingUp, Plus, Save, X, ChevronDown, ChevronUp, Mail, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ProLayout } from "@/layouts/ProLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/pro/patients/$patientId")({
  head: () => ({ meta: [{ title: "Fiche patient — DietFitPro" }] }),
  component: PatientDetailPage,
});

interface Patient {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  gender: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  target_weight_kg: number | null;
  medical_notes: string | null;
  allergies: string[] | null;
  goal: string | null;
  is_active: boolean;
  created_at: string;
}

interface NutritionProgram {
  id: string; name: string; is_active: boolean;
  start_date: string; end_date: string | null; daily_kcal_target: number | null;
}
interface SportProgram {
  id: string; name: string; is_active: boolean;
  frequency_per_week: number | null; duration_min: number | null;
}
interface BodyMeasurement {
  id: string; measured_at: string;
  weight_kg: number | null; body_fat_pct: number | null;
  muscle_mass_kg: number | null; metabolic_age: number | null;
  visceral_fat: number | null; waist_cm: number | null;
  hip_cm: number | null; arm_cm: number | null;
  thigh_cm: number | null; chest_cm: number | null; notes: string | null;
}
interface Appointment {
  id: string; starts_at: string; ends_at: string; status: string; is_visio: boolean;
}

const GOAL_LABEL: Record<string, string> = {
  perte_de_poids: "Perte de poids", prise_de_masse: "Prise de masse",
  maintien: "Maintien", autre: "Autre",
};
const STATUS_LABEL: Record<string, string> = {
  scheduled: "Planifié", completed: "Terminé",
  cancelled: "Annulé", no_show: "Absent",
};

function calcBmi(weight: number | null, height: number | null): string {
  if (!weight || !height) return "—";
  return (weight / Math.pow(height / 100, 2)).toFixed(1);
}

function PatientDetailPage() {
  return (
    <ProtectedRoute allow={["pro"]}>
      <ProLayout><PatientDetailContent /></ProLayout>
    </ProtectedRoute>
  );
}

function PatientDetailContent() {
  const { patientId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nutritionPrograms, setNutritionPrograms] = useState<NutritionProgram[]>([]);
  const [sportPrograms, setSportPrograms] = useState<SportProgram[]>([]);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [measureOpen, setMeasureOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadPatient = async () => {
    if (!user) return;
    const { data: p } = await supabase
      .from("patients").select("*")
      .eq("id", patientId).eq("pro_id", user.id).maybeSingle();
    if (p) setPatient(p as Patient);
  };

  const loadSecondary = async (patientRow: Patient) => {
    const userId = patientRow.user_id;
    const [npRes, spRes, mRes, aRes] = await Promise.all([
      supabase.from("nutrition_programs")
        .select("id, name, is_active, start_date, end_date, daily_kcal_target")
        .eq("patient_id", patientRow.id).order("start_date", { ascending: false }),
      supabase.from("sport_programs")
        .select("id, name, is_active, frequency_per_week, duration_min")
        .eq("patient_id", patientRow.id).order("created_at", { ascending: false }),
      supabase.from("body_measurements")
        .select("id, measured_at, weight_kg, body_fat_pct, muscle_mass_kg, metabolic_age, visceral_fat, waist_cm, hip_cm, arm_cm, thigh_cm, chest_cm, notes")
        .eq("patient_id", patientRow.id)
        .order("measured_at", { ascending: true }),
      userId
        ? supabase.from("appointments")
            .select("id, starts_at, ends_at, status, is_visio")
            .eq("pro_id", user!.id).eq("patient_user_id", userId)
            .order("starts_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);
    setNutritionPrograms((npRes.data as NutritionProgram[]) ?? []);
    setSportPrograms((spRes.data as SportProgram[]) ?? []);
    setMeasurements((mRes.data as BodyMeasurement[]) ?? []);
    setAppointments((aRes.data as Appointment[]) ?? []);
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      const { data: p, error: err } = await supabase
        .from("patients").select("*")
        .eq("id", patientId).eq("pro_id", user.id).maybeSingle();
      if (cancelled) return;
      if (err) { setError(err.message); setLoading(false); return; }
      if (!p) { setError("Patient introuvable."); setLoading(false); return; }
      const row = p as Patient;
      setPatient(row); setLoading(false);
      await loadSecondary(row);
    })();
    return () => { cancelled = true; };
  }, [patientId, user]);

  const handleInvite = async () => {
    if (!patient?.email) { toast.error("Ce patient n'a pas d'email renseigné."); return; }
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-patient", {
        body: {
          email: patient.email,
          patient_id: patient.id,
          pro_id: user?.id,
          redirect_to: `${window.location.origin}/bienvenue`,
        },
      });
      if (error || data?.error) {
        toast.error(data?.error ?? error?.message ?? "Erreur inconnue");
        return;
      }
      toast.success(`Invitation envoyée à ${patient.email} ✉️`);
    } finally {
      setInviting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await supabase.from("body_measurements").delete().eq("patient_id", patientId);
      await supabase.from("nutrition_programs").delete().eq("patient_id", patientId);
      await supabase.from("sport_programs").delete().eq("patient_id", patientId);
      if (patient?.user_id) {
        await supabase.from("appointments").delete().eq("patient_user_id", patient.user_id);
      }
      const { error } = await supabase.from("patients").delete().eq("id", patientId);
      if (error) { toast.error(error.message); return; }
      toast.success("Patient supprimé ✅");
      navigate({ to: "/pro/patients" });
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  if (loading) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" /><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" />
    </div>
  );

  if (error || !patient) return (
    <div className="p-6">
      <Button variant="ghost" onClick={() => navigate({ to: "/pro/patients" })}>
        <ArrowLeft className="h-4 w-4" /> Retour
      </Button>
      <p className="mt-4 text-destructive">{error ?? "Patient introuvable."}</p>
    </div>
  );

  const initials = `${patient.first_name[0] ?? ""}${patient.last_name[0] ?? ""}`.toUpperCase();
  const goal = patient.goal ? (GOAL_LABEL[patient.goal] ?? "—") : "—";
  const bmi = calcBmi(patient.weight_kg, patient.height_cm);

  return (
    <div className="flex flex-col">
      {/* HEADER */}
      <header className="flex items-center gap-3 border-b bg-white px-6 py-4 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/pro/patients" })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-12 w-12">
          <AvatarFallback className="bg-[#6DB33F]/10 text-[#2D7A1F] font-semibold">{initials || "?"}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">{patient.first_name} {patient.last_name}</h1>
            {patient.user_id
              ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✅ Compte actif</span>
              : <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">⏳ Sans compte</span>
            }
          </div>
          <p className="text-sm text-muted-foreground">Objectif : {goal}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!patient.user_id && patient.email && (
            <Button variant="outline" onClick={handleInvite} disabled={inviting}
              className="border-amber-300 text-amber-700 hover:bg-amber-50">
              <Mail className="h-4 w-4 mr-1" />
              {inviting ? "Envoi…" : "Envoyer l'invitation"}
            </Button>
          )}
          <Button variant="outline" onClick={() => setMeasureOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter une mesure
          </Button>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-1" /> Modifier
          </Button>
          <Button variant="outline" onClick={() => setDeleteOpen(true)}
            className="border-red-300 text-red-600 hover:bg-red-50">
            <Trash2 className="h-4 w-4 mr-1" /> Supprimer
          </Button>
        </div>
      </header>

      {!patient.user_id && !patient.email && (
        <div className="mx-6 mt-4 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-2 flex items-center gap-2">
          ⚠️ Ajoutez un email au patient pour pouvoir lui envoyer une invitation.
          <Button variant="link" className="text-amber-800 p-0 h-auto text-sm" onClick={() => setEditOpen(true)}>
            Modifier la fiche →
          </Button>
        </div>
      )}

      <div className="p-6">
        <Tabs defaultValue="evolution">
          <TabsList className="mb-4">
            <TabsTrigger value="evolution">📈 Évolution</TabsTrigger>
            <TabsTrigger value="info">Infos générales</TabsTrigger>
            <TabsTrigger value="programs">Programmes</TabsTrigger>
            <TabsTrigger value="measurements">Mesures</TabsTrigger>
            <TabsTrigger value="appointments">Historique RDV</TabsTrigger>
          </TabsList>

          {/* ── ÉVOLUTION ── */}
          <TabsContent value="evolution" className="mt-2 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KpiCard label="Poids actuel" value={patient.weight_kg ? `${patient.weight_kg} kg` : "—"} />
              <KpiCard label="Poids cible" value={patient.target_weight_kg ? `${patient.target_weight_kg} kg` : "—"} color="green" />
              <KpiCard label="IMC" value={bmi} />
              <KpiCard
                label={patient.goal === "prise_de_masse" ? "À gagner" : "À perdre"}
                value={patient.weight_kg && patient.target_weight_kg
                  ? `${Math.abs(patient.weight_kg - patient.target_weight_kg).toFixed(1)} kg` : "—"}
                color="orange"
              />
            </div>

            {measurements.length === 0 ? (
              <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
                <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Aucune mesure enregistrée</p>
                <p className="text-sm mt-1 mb-4">Ajoutez la première mesure pour démarrer le suivi.</p>
                <Button variant="outline" onClick={() => setMeasureOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Ajouter une mesure
                </Button>
              </div>
            ) : (
              <>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">⚖️ Poids & IMC</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={measurements.map((m) => ({
                        date: new Date(m.measured_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
                        Poids: m.weight_kg,
                        IMC: m.weight_kg && patient.height_cm ? parseFloat(calcBmi(m.weight_kg, patient.height_cm)) : null,
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                        <Tooltip /><Legend />
                        <Line yAxisId="left" type="monotone" dataKey="Poids" stroke="#6DB33F" strokeWidth={2} dot={{ r: 4 }} unit=" kg" />
                        <Line yAxisId="right" type="monotone" dataKey="IMC" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                        {patient.target_weight_kg && (
                          <Line yAxisId="left" type="monotone" dataKey={() => patient.target_weight_kg} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Objectif" unit=" kg" />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {measurements.some((m) => m.body_fat_pct || m.muscle_mass_kg || m.metabolic_age || m.visceral_fat) && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">💪 Composition corporelle</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={measurements.map((m) => ({
                          date: new Date(m.measured_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
                          "% Graisse": m.body_fat_pct,
                          "Masse musc. (kg)": m.muscle_mass_kg,
                          "Âge métabo.": m.metabolic_age,
                          "Graisse visc.": m.visceral_fat,
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                          <Tooltip /><Legend />
                          <Line type="monotone" dataKey="% Graisse" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="Masse musc. (kg)" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="Âge métabo." stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="Graisse visc." stroke="#ec4899" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {measurements.some((m) => m.waist_cm || m.hip_cm || m.arm_cm || m.thigh_cm) && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">📏 Mensurations (cm)</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={measurements.map((m) => ({
                          date: new Date(m.measured_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
                          "Taille": m.waist_cm, "Hanches": m.hip_cm, "Bras": m.arm_cm, "Cuisse": m.thigh_cm,
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                          <Tooltip /><Legend />
                          <Line type="monotone" dataKey="Taille" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="Hanches" stroke="#ec4899" strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="Bras" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="Cuisse" stroke="#14b8a6" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* ── INFOS ── */}
          <TabsContent value="info" className="mt-4">
            <Card>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 p-6">
                <InfoRow label="Prénom" value={patient.first_name} />
                <InfoRow label="Nom" value={patient.last_name} />
                <InfoRow label="Email" value={patient.email ?? "—"} />
                <InfoRow label="Téléphone" value={patient.phone ?? "—"} />
                <InfoRow label="Date de naissance" value={patient.birth_date ? new Date(patient.birth_date).toLocaleDateString("fr-FR") : "—"} />
                <InfoRow label="Genre" value={patient.gender ?? "—"} />
                <InfoRow label="Taille" value={patient.height_cm ? `${patient.height_cm} cm` : "—"} />
                <InfoRow label="Poids actuel" value={patient.weight_kg ? `${patient.weight_kg} kg` : "—"} />
                <InfoRow label="Poids cible" value={patient.target_weight_kg ? `${patient.target_weight_kg} kg` : "—"} />
                <InfoRow label="IMC" value={bmi} />
                <InfoRow label="Objectif" value={goal} />
                <InfoRow label="Compte plateforme" value={patient.user_id ? "✅ Actif" : "⏳ Invitation à envoyer"} />
                <InfoRow label="Allergies" value={patient.allergies?.length ? patient.allergies.join(", ") : "—"} full />
                <InfoRow label="Notes médicales" value={patient.medical_notes ?? "—"} full />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── PROGRAMMES ── */}
          <TabsContent value="programs" className="mt-4 space-y-4">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-3">🥗 Programmes nutrition</h3>
                {nutritionPrograms.length === 0
                  ? <p className="text-sm text-muted-foreground">Aucun programme. (PDF à venir)</p>
                  : <ul className="space-y-2">{nutritionPrograms.map((np) => (
                      <li key={np.id} className="flex items-center justify-between text-sm">
                        <span>{np.name}</span>
                        <span className="text-muted-foreground">{np.daily_kcal_target ? `${np.daily_kcal_target} kcal/j` : ""} {np.is_active ? "• actif" : "• inactif"}</span>
                      </li>))}</ul>}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-3">🏋️ Programmes sport</h3>
                {sportPrograms.length === 0
                  ? <p className="text-sm text-muted-foreground">Aucun programme. (PDF à venir)</p>
                  : <ul className="space-y-2">{sportPrograms.map((sp) => (
                      <li key={sp.id} className="flex items-center justify-between text-sm">
                        <span>{sp.name}</span>
                        <span className="text-muted-foreground">{sp.frequency_per_week ? `${sp.frequency_per_week}x/sem` : ""} {sp.is_active ? "• actif" : "• inactif"}</span>
                      </li>))}</ul>}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── MESURES ── */}
          <TabsContent value="measurements" className="mt-4">
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead><TableHead>Poids</TableHead><TableHead>IMC</TableHead>
                      <TableHead>% MG</TableHead><TableHead>Masse musc.</TableHead>
                      <TableHead>Âge métabo.</TableHead><TableHead>Graisse visc.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {measurements.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Aucune mesure.</TableCell></TableRow>
                    ) : [...measurements].reverse().map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>{new Date(m.measured_at).toLocaleDateString("fr-FR")}</TableCell>
                        <TableCell>{m.weight_kg ? `${m.weight_kg} kg` : "—"}</TableCell>
                        <TableCell>{calcBmi(m.weight_kg, patient.height_cm)}</TableCell>
                        <TableCell>{m.body_fat_pct ? `${m.body_fat_pct}%` : "—"}</TableCell>
                        <TableCell>{m.muscle_mass_kg ? `${m.muscle_mass_kg} kg` : "—"}</TableCell>
                        <TableCell>{m.metabolic_age ? `${m.metabolic_age} ans` : "—"}</TableCell>
                        <TableCell>{m.visceral_fat ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── RDV ── */}
          <TabsContent value="appointments" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Statut</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointments.length === 0
                      ? <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Aucun rendez-vous.</TableCell></TableRow>
                      : appointments.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>{new Date(a.starts_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</TableCell>
                          <TableCell>{a.is_visio ? "Visio" : "Cabinet"}</TableCell>
                          <TableCell>{STATUS_LABEL[a.status] ?? a.status}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <EditPatientSheet open={editOpen} onOpenChange={setEditOpen} patient={patient}
        onSaved={async () => { setEditOpen(false); await loadPatient(); toast.success("Fiche mise à jour ✅"); }} />

      <AddMeasureDialog open={measureOpen} onOpenChange={setMeasureOpen}
        patient={patient} proId={user?.id ?? ""}
        onSaved={async () => {
          setMeasureOpen(false);
          await loadSecondary(patient);
          toast.success("Mesure enregistrée ✅");
        }} />

      {/* ── DIALOG SUPPRESSION ── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Supprimer ce patient ?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Vous allez supprimer <strong>{patient?.first_name} {patient?.last_name}</strong> ainsi que toutes ses données (mesures, programmes, rendez-vous). Cette action est <strong>irréversible</strong>.
          </p>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              <Trash2 className="h-4 w-4 mr-1" />
              {deleting ? "Suppression…" : "Supprimer définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ══════════════════════════════════════════
   DRAWER — MODIFIER LE PATIENT
══════════════════════════════════════════ */
function EditPatientSheet({ open, onOpenChange, patient, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; patient: Patient; onSaved: () => void;
}) {
  const [form, setForm] = useState({ ...patient });
  const [allergiesStr, setAllergiesStr] = useState(patient.allergies?.join(", ") ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm({ ...patient }); setAllergiesStr(patient.allergies?.join(", ") ?? ""); }, [patient, open]);

  const set = (field: keyof typeof form, value: string | number | null | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    const allergies = allergiesStr.split(",").map((s) => s.trim()).filter(Boolean);
    const { error } = await supabase.from("patients").update({
      first_name: form.first_name, last_name: form.last_name,
      email: form.email || null, phone: form.phone || null,
      birth_date: form.birth_date || null, gender: form.gender || null,
      height_cm: form.height_cm ? Number(form.height_cm) : null,
      weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      target_weight_kg: form.target_weight_kg ? Number(form.target_weight_kg) : null,
      goal: form.goal || null, medical_notes: form.medical_notes || null,
      allergies: allergies.length ? allergies : null, is_active: form.is_active,
    }).eq("id", patient.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Modifier — {patient.first_name} {patient.last_name}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 pb-6">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom *"><Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} /></Field>
            <Field label="Nom *"><Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} /></Field>
          </div>
          <Field label="Email"><Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Téléphone"><Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
            <Field label="Date de naissance"><Input type="date" value={form.birth_date ?? ""} onChange={(e) => set("birth_date", e.target.value)} /></Field>
          </div>
          <Field label="Genre">
            <Select value={form.gender ?? ""} onValueChange={(v) => set("gender", v)}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="homme">Homme</SelectItem>
                <SelectItem value="femme">Femme</SelectItem>
                <SelectItem value="autre">Autre</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Taille (cm)"><Input type="number" value={form.height_cm ?? ""} onChange={(e) => set("height_cm", e.target.value ? Number(e.target.value) : null)} /></Field>
            <Field label="Poids (kg)"><Input type="number" step="0.1" value={form.weight_kg ?? ""} onChange={(e) => set("weight_kg", e.target.value ? Number(e.target.value) : null)} /></Field>
            <Field label="Poids cible (kg)"><Input type="number" step="0.1" value={form.target_weight_kg ?? ""} onChange={(e) => set("target_weight_kg", e.target.value ? Number(e.target.value) : null)} /></Field>
          </div>
          <Field label="Objectif">
            <Select value={form.goal ?? ""} onValueChange={(v) => set("goal", v)}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="perte_de_poids">Perte de poids</SelectItem>
                <SelectItem value="prise_de_masse">Prise de masse</SelectItem>
                <SelectItem value="maintien">Maintien</SelectItem>
                <SelectItem value="autre">Autre</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Allergies (séparées par des virgules)">
            <Input value={allergiesStr} onChange={(e) => setAllergiesStr(e.target.value)} placeholder="gluten, lactose…" />
          </Field>
          <Field label="Notes médicales">
            <Textarea value={form.medical_notes ?? ""} onChange={(e) => set("medical_notes", e.target.value)} rows={4} placeholder="Antécédents, traitements…" />
          </Field>
          <Field label="Statut">
            <Select value={form.is_active ? "active" : "inactive"} onValueChange={(v) => set("is_active", v === "active")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Actif</SelectItem>
                <SelectItem value="inactive">Inactif</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <SheetFooter className="flex gap-2 pt-2 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}><X className="h-4 w-4 mr-1" />Annuler</Button>
          <Button className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />{saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ══════════════════════════════════════════
   DIALOG — AJOUTER UNE MESURE
══════════════════════════════════════════ */
function AddMeasureDialog({ open, onOpenChange, patient, proId, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  patient: Patient; proId: string; onSaved: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState("");
  const [fat, setFat] = useState("");
  const [muscle, setMuscle] = useState("");
  const [metaAge, setMetaAge] = useState("");
  const [visceralFat, setVisceralFat] = useState("");
  const [showOptional, setShowOptional] = useState(false);
  const [waist, setWaist] = useState("");
  const [hip, setHip] = useState("");
  const [arm, setArm] = useState("");
  const [thigh, setThigh] = useState("");
  const [chest, setChest] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const bmiPreview = weight && patient.height_cm
    ? calcBmi(Number(weight), patient.height_cm) : null;

  useEffect(() => {
    if (open) {
      setDate(today); setWeight(""); setFat(""); setMuscle("");
      setMetaAge(""); setVisceralFat(""); setWaist(""); setHip("");
      setArm(""); setThigh(""); setChest(""); setNotes(""); setShowOptional(false);
    }
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("body_measurements").insert({
      patient_id: patient.id,
      user_id: patient.user_id ?? null,
      measured_at: date,
      weight_kg: weight ? Number(weight) : null,
      body_fat_pct: fat ? Number(fat) : null,
      muscle_mass_kg: muscle ? Number(muscle) : null,
      metabolic_age: metaAge ? Number(metaAge) : null,
      visceral_fat: visceralFat ? Number(visceralFat) : null,
      waist_cm: waist ? Number(waist) : null,
      hip_cm: hip ? Number(hip) : null,
      arm_cm: arm ? Number(arm) : null,
      thigh_cm: thigh ? Number(thigh) : null,
      chest_cm: chest ? Number(chest) : null,
      notes: notes || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📊 Nouvelle mesure — {patient.first_name} {patient.last_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Date de la mesure">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>

          <div className="rounded-lg bg-muted/40 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Données essentielles</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Poids (kg)">
                <Input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="ex: 78.5" />
              </Field>
              <Field label="IMC calculé">
                <div className="flex h-10 items-center rounded-md border bg-background px-3 text-sm text-muted-foreground">
                  {bmiPreview ? <span className="font-semibold text-foreground">{bmiPreview}</span> : <span>auto</span>}
                </div>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="% Masse grasse">
                <Input type="number" step="0.1" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="ex: 22.3" />
              </Field>
              <Field label="Masse musculaire (kg)">
                <Input type="number" step="0.1" value={muscle} onChange={(e) => setMuscle(e.target.value)} placeholder="ex: 35.0" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Âge métabolique (ans)">
                <Input type="number" value={metaAge} onChange={(e) => setMetaAge(e.target.value)} placeholder="ex: 34" />
              </Field>
              <Field label="Graisse viscérale">
                <Input type="number" step="0.5" value={visceralFat} onChange={(e) => setVisceralFat(e.target.value)} placeholder="ex: 8" />
              </Field>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowOptional((v) => !v)}
            className="flex w-full items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            <span>📏 Mensurations optionnelles (taille, hanches, bras…)</span>
            {showOptional ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showOptional && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tour de taille (cm)"><Input type="number" step="0.5" value={waist} onChange={(e) => setWaist(e.target.value)} placeholder="ex: 82" /></Field>
                <Field label="Tour de hanches (cm)"><Input type="number" step="0.5" value={hip} onChange={(e) => setHip(e.target.value)} placeholder="ex: 96" /></Field>
                <Field label="Tour de bras (cm)"><Input type="number" step="0.5" value={arm} onChange={(e) => setArm(e.target.value)} placeholder="ex: 33" /></Field>
                <Field label="Tour de cuisse (cm)"><Input type="number" step="0.5" value={thigh} onChange={(e) => setThigh(e.target.value)} placeholder="ex: 55" /></Field>
                <Field label="Tour de poitrine (cm)"><Input type="number" step="0.5" value={chest} onChange={(e) => setChest(e.target.value)} placeholder="ex: 95" /></Field>
              </div>
            </div>
          )}

          <Field label="Notes (optionnel)">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Observations, contexte…" />
          </Field>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white" onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── UTILITAIRES ── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
function KpiCard({ label, value, color = "default" }: { label: string; value: string; color?: "default" | "green" | "orange" }) {
  const colors = { default: "bg-card border", green: "bg-[#6DB33F]/10 border-[#6DB33F]/20", orange: "bg-orange-50 border-orange-200" };
  return (
    <div className={`rounded-lg p-4 ${colors[color]}`}>
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
function InfoRow({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground mt-0.5">{value}</p>
    </div>
  );
}