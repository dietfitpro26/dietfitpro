import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { ProLayout } from "@/layouts/ProLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/pro/sport/$programId")({
  head: () => ({ meta: [{ title: "Programme sport — DietFitPro" }] }),
  component: Page,
});

interface Session {
  id: string;
  name: string;
  day: string;
  duration_min: number;
  notes: string;
}
interface Program {
  id: string;
  name: string;
  patient_id: string;
  frequency_per_week: number | null;
  level: string | null;
  goal: string | null;
  notes: string | null;
  sessions: Session[];
}
interface PatientLite { id: string; first_name: string; last_name: string }

function Page() {
  return (
    <ProtectedRoute allow={["pro"]}>
      <ProLayout><Content /></ProLayout>
    </ProtectedRoute>
  );
}

function Content() {
  const { user } = useAuth();
  const { programId } = Route.useParams();
  const navigate = useNavigate();
  const [program, setProgram] = useState<Program | null>(null);
  const [patient, setPatient] = useState<PatientLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("sport_programs")
      .select("id, name, patient_id, frequency_per_week, level, goal, notes, sessions")
      .eq("id", programId)
      .eq("pro_id", user.id)
      .maybeSingle();
    if (!data) { setLoading(false); return; }
    const prog = { ...(data as Program), sessions: Array.isArray(data.sessions) ? (data.sessions as Session[]) : [] };
    setProgram(prog);
    const { data: p } = await supabase
      .from("patients").select("id, first_name, last_name").eq("id", prog.patient_id).maybeSingle();
    setPatient((p as PatientLite) ?? null);
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [user, programId]);

  const addSession = async (s: Session) => {
    if (!program) return;
    const next = [...program.sessions, s];
    const { error } = await supabase.from("sport_programs").update({ sessions: next }).eq("id", program.id);
    if (error) { toast.error(error.message); return; }
    setProgram({ ...program, sessions: next });
    toast.success("Séance ajoutée");
    setOpen(false);
  };

  if (loading) {
    return <div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /></div>;
  }
  if (!program) {
    return <div className="p-6"><Button variant="ghost" onClick={() => navigate({ to: "/pro/sport" })}><ArrowLeft className="h-4 w-4" /> Retour</Button><p className="mt-4 text-destructive">Programme introuvable.</p></div>;
  }

  return (
    <div className="flex flex-col">
      <header className="flex items-center gap-3 border-b bg-white px-6 py-4">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/pro/sport" })}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">{program.name}</h1>
          <p className="text-sm text-muted-foreground">
            {patient ? `${patient.first_name} ${patient.last_name}` : "—"}
            {program.frequency_per_week ? ` • ${program.frequency_per_week}×/sem.` : ""}
          </p>
        </div>
        <Button variant="outline"><Pencil className="h-4 w-4" /> Modifier</Button>
      </header>

      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Séances</h2>
          <Button className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Ajouter une séance
          </Button>
        </div>

        {program.sessions.length === 0
          ? <p className="text-sm text-muted-foreground">Aucune séance pour le moment.</p>
          : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {program.sessions.map((s) => (
                <Card key={s.id}>
                  <CardContent className="p-4">
                    <h3 className="font-semibold">{s.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {s.day} • {s.duration_min} min
                    </p>
                    {s.notes && <p className="mt-2 text-sm">{s.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>}
      </div>

      <AddSessionDialog open={open} onOpenChange={setOpen} onAdd={addSession} />
    </div>
  );
}

function AddSessionDialog({
  open, onOpenChange, onAdd,
}: { open: boolean; onOpenChange: (v: boolean) => void; onAdd: (s: Session) => void }) {
  const [name, setName] = useState("");
  const [day, setDay] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Nom obligatoire"); return; }
    onAdd({
      id: crypto.randomUUID(),
      name: name.trim(),
      day: day.trim(),
      duration_min: Number(duration) || 0,
      notes: notes.trim(),
    });
    setName(""); setDay(""); setDuration(""); setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Ajouter une séance</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1"><Label>Nom *</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={150} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Jour</Label><Input value={day} onChange={(e) => setDay(e.target.value)} maxLength={30} placeholder="Lundi…" /></div>
            <div className="space-y-1"><Label>Durée (min)</Label><Input type="number" min={0} value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>Notes / exercices</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={2000} /></div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white">Ajouter</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
