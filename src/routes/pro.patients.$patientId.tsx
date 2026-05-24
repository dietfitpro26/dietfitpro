import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Pencil } from "lucide-react";
import { ProLayout } from "@/layouts/ProLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
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
  id: string;
  name: string;
  is_active: boolean;
  start_date: string;
  end_date: string | null;
  daily_kcal_target: number | null;
}
interface SportProgram {
  id: string;
  name: string;
  is_active: boolean;
  frequency_per_week: number | null;
  duration_min: number | null;
}
interface BodyMeasurement {
  id: string;
  measured_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  waist_cm: number | null;
}
interface Appointment {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  is_visio: boolean;
}

const GOAL_LABEL: Record<string, string> = {
  perte_de_poids: "Perte de poids",
  prise_de_masse: "Prise de masse",
  maintien: "Maintien",
  autre: "Autre",
};

function PatientDetailPage() {
  return (
    <ProtectedRoute allow={["pro"]}>
      <ProLayout>
        <PatientDetailContent />
      </ProLayout>
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

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data: p, error: err } = await supabase
        .from("patients")
        .select("*")
        .eq("id", patientId)
        .eq("pro_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (err) {
        console.error("[patient] load error", err);
        setError(err.message);
        setLoading(false);
        return;
      }
      if (!p) {
        setError("Patient introuvable.");
        setLoading(false);
        return;
      }
      const patientRow = p as Patient;
      setPatient(patientRow);
      setLoading(false);

      // Charge les données secondaires en parallèle
      const userId = patientRow.user_id;
      const [npRes, spRes, mRes, aRes] = await Promise.all([
        supabase
          .from("nutrition_programs")
          .select("id, name, is_active, start_date, end_date, daily_kcal_target")
          .eq("patient_id", patientRow.id)
          .order("start_date", { ascending: false }),
        supabase
          .from("sport_programs")
          .select("id, name, is_active, frequency_per_week, duration_min")
          .eq("patient_id", patientRow.id)
          .order("created_at", { ascending: false }),
        userId
          ? supabase
              .from("body_measurements")
              .select("id, measured_at, weight_kg, body_fat_pct, waist_cm")
              .eq("user_id", userId)
              .order("measured_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        userId
          ? supabase
              .from("appointments")
              .select("id, starts_at, ends_at, status, is_visio")
              .eq("pro_id", user.id)
              .eq("patient_user_id", userId)
              .order("starts_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (cancelled) return;
      setNutritionPrograms((npRes.data as NutritionProgram[]) ?? []);
      setSportPrograms((spRes.data as SportProgram[]) ?? []);
      setMeasurements((mRes.data as BodyMeasurement[]) ?? []);
      setAppointments((aRes.data as Appointment[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId, user]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate({ to: "/pro/patients" })}>
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <p className="mt-4 text-destructive">{error ?? "Patient introuvable."}</p>
      </div>
    );
  }

  const initials = `${patient.first_name[0] ?? ""}${patient.last_name[0] ?? ""}`.toUpperCase();
  const goal = patient.goal ? (GOAL_LABEL[patient.goal] ?? "—") : "—";

  return (
    <div className="flex flex-col">
      <header className="flex items-center gap-3 border-b bg-white px-6 py-4">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/pro/patients" })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-12 w-12">
          <AvatarFallback className="bg-[#6DB33F]/10 text-[#2D7A1F] font-semibold">
            {initials || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">
            {patient.first_name} {patient.last_name}
          </h1>
          <p className="text-sm text-muted-foreground">Objectif : {goal}</p>
        </div>
        <Button variant="outline">
          <Pencil className="h-4 w-4" /> Modifier
        </Button>
      </header>

      <div className="p-6">
        <Tabs defaultValue="info">
          <TabsList>
            <TabsTrigger value="info">Infos générales</TabsTrigger>
            <TabsTrigger value="programs">Programmes</TabsTrigger>
            <TabsTrigger value="measurements">Mesures corporelles</TabsTrigger>
            <TabsTrigger value="appointments">Historique RDV</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-4">
            <Card>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 p-6">
                <InfoRow label="Prénom" value={patient.first_name} />
                <InfoRow label="Nom" value={patient.last_name} />
                <InfoRow label="Email" value={patient.email ?? "—"} />
                <InfoRow label="Téléphone" value={patient.phone ?? "—"} />
                <InfoRow
                  label="Date de naissance"
                  value={
                    patient.birth_date
                      ? new Date(patient.birth_date).toLocaleDateString("fr-FR")
                      : "—"
                  }
                />
                <InfoRow label="Genre" value={patient.gender ?? "—"} />
                <InfoRow label="Taille" value={patient.height_cm ? `${patient.height_cm} cm` : "—"} />
                <InfoRow label="Poids actuel" value={patient.weight_kg ? `${patient.weight_kg} kg` : "—"} />
                <InfoRow
                  label="Poids cible"
                  value={patient.target_weight_kg ? `${patient.target_weight_kg} kg` : "—"}
                />
                <InfoRow label="Objectif" value={goal} />
                <InfoRow
                  label="Allergies"
                  value={patient.allergies?.length ? patient.allergies.join(", ") : "—"}
                  full
                />
                <InfoRow label="Notes médicales" value={patient.medical_notes ?? "—"} full />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="programs" className="mt-4 space-y-4">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-3">Programmes nutrition</h3>
                {nutritionPrograms.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun programme.</p>
                ) : (
                  <ul className="space-y-2">
                    {nutritionPrograms.map((np) => (
                      <li key={np.id} className="flex items-center justify-between text-sm">
                        <span>{np.name}</span>
                        <span className="text-muted-foreground">
                          {np.daily_kcal_target ? `${np.daily_kcal_target} kcal/j` : ""}{" "}
                          {np.is_active ? "• actif" : "• inactif"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-3">Programmes sport</h3>
                {sportPrograms.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun programme.</p>
                ) : (
                  <ul className="space-y-2">
                    {sportPrograms.map((sp) => (
                      <li key={sp.id} className="flex items-center justify-between text-sm">
                        <span>{sp.name}</span>
                        <span className="text-muted-foreground">
                          {sp.frequency_per_week ? `${sp.frequency_per_week}x/sem` : ""}{" "}
                          {sp.is_active ? "• actif" : "• inactif"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="measurements" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Poids</TableHead>
                      <TableHead>% MG</TableHead>
                      <TableHead>Tour de taille</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {measurements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                          Aucune mesure enregistrée.
                        </TableCell>
                      </TableRow>
                    ) : (
                      measurements.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>
                            {new Date(m.measured_at).toLocaleDateString("fr-FR")}
                          </TableCell>
                          <TableCell>{m.weight_kg ? `${m.weight_kg} kg` : "—"}</TableCell>
                          <TableCell>{m.body_fat_pct ? `${m.body_fat_pct}%` : "—"}</TableCell>
                          <TableCell>{m.waist_cm ? `${m.waist_cm} cm` : "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appointments" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                          Aucun rendez-vous.
                        </TableCell>
                      </TableRow>
                    ) : (
                      appointments.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>
                            {new Date(a.starts_at).toLocaleString("fr-FR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </TableCell>
                          <TableCell>{a.is_visio ? "Visio" : "Cabinet"}</TableCell>
                          <TableCell className="capitalize">{a.status}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
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
