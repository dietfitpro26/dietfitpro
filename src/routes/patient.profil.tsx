import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format, differenceInYears } from "date-fns";
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { PatientLayout } from "@/layouts/PatientLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/patient/profil")({
  head: () => ({ meta: [{ title: "Mon profil — DietFitPro" }] }),
  component: () => (
    <ProtectedRoute allow={["patient"]}>
      <PatientLayout><ProfilContent /></PatientLayout>
    </ProtectedRoute>
  ),
});

type Goal = "weight_loss" | "muscle_gain" | "balance";
const GOAL_LABEL: Record<Goal, string> = {
  weight_loss: "Perte de poids",
  muscle_gain: "Prise de masse",
  balance: "Équilibre",
};

interface PatientRow {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  target_weight_kg: number | null;
  preferences: Record<string, unknown> | null;
}
interface Measurement {
  id: string;
  measured_at: string;
  weight_kg: number | null;
}

function ProfilContent() {
  const { user, profile } = useAuth();
  const [patient, setPatient] = useState<PatientRow | null | undefined>(undefined);
  const [measurements, setMeasurements] = useState<Measurement[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [openWeight, setOpenWeight] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data: p } = await supabase.from("patients")
      .select("id, first_name, last_name, birth_date, height_cm, weight_kg, target_weight_kg, preferences")
      .eq("user_id", user.id).maybeSingle();
    setPatient((p as PatientRow | null) ?? null);
    const { data: m } = await supabase.from("body_measurements")
      .select("id, measured_at, weight_kg")
      .eq("user_id", user.id)
      .order("measured_at", { ascending: true })
      .limit(60);
    setMeasurements((m ?? []) as Measurement[]);
  };

  useEffect(() => { void load(); }, [user]);

  const age = patient?.birth_date ? differenceInYears(new Date(), new Date(patient.birth_date)) : null;
  const goal = ((patient?.preferences as { goal?: Goal } | null)?.goal ?? "balance") as Goal;

  const chartData = useMemo(
    () => (measurements ?? []).filter((m) => m.weight_kg != null).map((m) => ({
      date: format(new Date(m.measured_at), "dd/MM"),
      weight: Number(m.weight_kg),
    })),
    [measurements],
  );

  if (patient === undefined) {
    return <div className="p-6 max-w-3xl mx-auto"><Skeleton className="h-40 w-full" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">Mon profil</h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Infos personnelles</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Modifier</Button>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <Info label="Nom" value={patient ? `${patient.first_name} ${patient.last_name}` : profile?.full_name ?? "—"} />
          <Info label="Âge" value={age != null ? `${age} ans` : "—"} />
          <Info label="Taille" value={patient?.height_cm ? `${patient.height_cm} cm` : "—"} />
          <Info label="Poids actuel" value={patient?.weight_kg ? `${patient.weight_kg} kg` : "—"} />
          <Info label="Objectif" value={GOAL_LABEL[goal]} />
          <Info label="Poids cible" value={patient?.target_weight_kg ? `${patient.target_weight_kg} kg` : "—"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Évolution du poids</CardTitle>
          <Button size="sm" className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white" onClick={() => setOpenWeight(true)}>
            <Plus className="h-4 w-4" /> Nouvelle pesée
          </Button>
        </CardHeader>
        <CardContent>
          {measurements === null ? (
            <Skeleton className="h-40 w-full" />
          ) : chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune pesée enregistrée.</p>
          ) : (
            <>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="date" fontSize={11} />
                    <YAxis domain={["auto", "auto"]} fontSize={11} />
                    <Tooltip />
                    <Line type="monotone" dataKey="weight" stroke="#6DB33F" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <ul className="divide-y mt-4 text-sm max-h-60 overflow-y-auto">
                {[...(measurements ?? [])].reverse().map((m) => (
                  <li key={m.id} className="flex justify-between py-2">
                    <span>{format(new Date(m.measured_at), "dd/MM/yyyy")}</span>
                    <span className="font-medium">{m.weight_kg != null ? `${m.weight_kg} kg` : "—"}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <EditDialog
        open={editing}
        onOpenChange={setEditing}
        patient={patient}
        userId={user?.id ?? ""}
        proId={profile?.pro_id ?? null}
        onSaved={() => { setEditing(false); void load(); }}
      />
      <WeightDialog
        open={openWeight}
        onOpenChange={setOpenWeight}
        userId={user?.id ?? ""}
        patientId={patient?.id ?? null}
        onSaved={() => { setOpenWeight(false); void load(); }}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function EditDialog({
  open, onOpenChange, patient, userId, proId, onSaved,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  patient: PatientRow | null; userId: string; proId: string | null; onSaved: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birth, setBirth] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [target, setTarget] = useState("");
  const [goal, setGoal] = useState<Goal>("balance");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFirstName(patient?.first_name ?? "");
    setLastName(patient?.last_name ?? "");
    setBirth(patient?.birth_date ?? "");
    setHeight(patient?.height_cm?.toString() ?? "");
    setWeight(patient?.weight_kg?.toString() ?? "");
    setTarget(patient?.target_weight_kg?.toString() ?? "");
    setGoal(((patient?.preferences as { goal?: Goal } | null)?.goal ?? "balance") as Goal);
  }, [open, patient]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    const payload = {
      user_id: userId,
      first_name: firstName.trim() || "—",
      last_name: lastName.trim() || "—",
      birth_date: birth || null,
      height_cm: height ? Number(height) : null,
      weight_kg: weight ? Number(weight) : null,
      target_weight_kg: target ? Number(target) : null,
      preferences: { ...(patient?.preferences ?? {}), goal },
    };
    let error;
    if (patient) {
      ({ error } = await supabase.from("patients").update(payload).eq("id", patient.id));
    } else {
      if (!proId) {
        setSaving(false);
        toast.error("Aucun praticien associé.");
        return;
      }
      ({ error } = await supabase.from("patients").insert({ ...payload, pro_id: proId }));
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profil mis à jour");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Modifier mon profil</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom"><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></Field>
            <Field label="Nom"><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></Field>
          </div>
          <Field label="Date de naissance">
            <Input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Taille (cm)"><Input type="number" value={height} onChange={(e) => setHeight(e.target.value)} /></Field>
            <Field label="Poids (kg)"><Input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} /></Field>
            <Field label="Cible (kg)"><Input type="number" step="0.1" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
          </div>
          <Field label="Objectif">
            <Select value={goal} onValueChange={(v) => setGoal(v as Goal)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => (
                  <SelectItem key={g} value={g}>{GOAL_LABEL[g]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={saving} className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white">
              {saving ? "…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WeightDialog({
  open, onOpenChange, userId, patientId, onSaved,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  userId: string; patientId: string | null; onSaved: () => void;
}) {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [kg, setKg] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId || !kg) return;
    setSaving(true);
    const { error } = await supabase.from("body_measurements").insert({
      user_id: userId,
      measured_at: date,
      weight_kg: Number(kg),
    });
    if (!error && patientId) {
      await supabase.from("patients").update({ weight_kg: Number(kg) }).eq("id", patientId);
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Pesée enregistrée");
    setKg("");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Nouvelle pesée</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Poids (kg)"><Input type="number" step="0.1" value={kg} onChange={(e) => setKg(e.target.value)} required /></Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={saving} className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white">
              {saving ? "…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
