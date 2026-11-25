import { useEffect, useState, useRef, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Plus, Upload, FileText, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { ProLayout } from "@/layouts/ProLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  pdf_url: string | null; // ✅ AJOUT
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
  const [uploading, setUploading] = useState(false);      // ✅ AJOUT
  const [deletingPdf, setDeletingPdf] = useState(false);  // ✅ AJOUT
  const fileInputRef = useRef<HTMLInputElement>(null);     // ✅ AJOUT

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("sport_programs")
      // ✅ AJOUT : pdf_url dans le select
      .select("id, name, patient_id, frequency_per_week, level, goal, notes, sessions, pdf_url")
      .eq("id", programId)
      .eq("pro_id", user.id)
      .maybeSingle();
    if (!data) { setLoading(false); return; }
    const prog = {
      ...(data as Program),
      sessions: Array.isArray(data.sessions) ? (data.sessions as Session[]) : [],
      pdf_url: (data as any).pdf_url ?? null,
    };
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

  // ✅ AJOUT : Upload PDF
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !program) return;
    if (file.type !== "application/pdf") { toast.error("Seuls les fichiers PDF sont acceptés"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Fichier trop lourd (max 10 Mo)"); return; }
    setUploading(true);
    if (program.pdf_url) {
      await supabase.storage.from("program-pdfs").remove([program.pdf_url]);
    }
    const path = `${user.id}/${program.id}-sport.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("program-pdfs")
      .upload(path, file, { upsert: true, contentType: "application/pdf" });
    if (uploadError) { toast.error("Erreur upload : " + uploadError.message); setUploading(false); return; }
    const { error: updateError } = await supabase
      .from("sport_programs").update({ pdf_url: path }).eq("id", program.id);
    if (updateError) { toast.error("Erreur sauvegarde : " + updateError.message); setUploading(false); return; }
    setProgram({ ...program, pdf_url: path });
    toast.success("✅ PDF uploadé avec succès");
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ✅ AJOUT : Supprimer PDF
  const handlePdfDelete = async () => {
    if (!program?.pdf_url || !user) return;
    if (!confirm("Supprimer le PDF de ce programme ?")) return;
    setDeletingPdf(true);
    await supabase.storage.from("program-pdfs").remove([program.pdf_url]);
    const { error } = await supabase
      .from("sport_programs").update({ pdf_url: null }).eq("id", program.id);
    if (error) { toast.error(error.message); setDeletingPdf(false); return; }
    setProgram({ ...program, pdf_url: null });
    toast.success("PDF supprimé");
    setDeletingPdf(false);
  };

  // ✅ AJOUT : Voir PDF via signed URL
  const handlePdfDownload = async () => {
    if (!program?.pdf_url) return;
    const { data, error } = await supabase.storage
      .from("program-pdfs").createSignedUrl(program.pdf_url, 60);
    if (error || !data?.signedUrl) { toast.error("Impossible d'ouvrir le PDF"); return; }
    window.open(data.signedUrl, "_blank");
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

      <div className="p-6 space-y-6">

        {/* ✅ AJOUT : Section PDF */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#6DB33F]" />
              Document PDF du programme
            </CardTitle>
          </CardHeader>
          <CardContent>
            {program.pdf_url ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-[#6DB33F]/5 border-[#6DB33F]/20">
                <FileText className="h-8 w-8 text-[#6DB33F] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Programme sport — PDF</p>
                  <p className="text-xs text-muted-foreground">Visible par le patient dans son espace</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={handlePdfDownload} title="Voir le PDF">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={handlePdfDelete} disabled={deletingPdf}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6 border-2 border-dashed rounded-lg text-center">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Aucun PDF associé à ce programme</p>
                  <p className="text-xs text-muted-foreground">Max 10 Mo · Format PDF uniquement</p>
                </div>
                <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  {uploading ? "Upload en cours…" : "Importer un PDF"}
                </Button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} />
            {program.pdf_url && (
              <div className="mt-3">
                <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3 w-3" />
                  {uploading ? "Upload en cours…" : "Remplacer le PDF"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section Séances — identique à l'original */}
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
                    <p className="text-sm text-muted-foreground">{s.day} • {s.duration_min} min</p>
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
    onAdd({ id: crypto.randomUUID(), name: name.trim(), day: day.trim(), duration_min: Number(duration) || 0, notes: notes.trim() });
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