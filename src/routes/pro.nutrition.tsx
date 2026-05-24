import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { ProLayout } from "@/layouts/ProLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/pro/nutrition")({
  head: () => ({ meta: [{ title: "Programmes nutrition — DietFitPro" }] }),
  component: Page,
});

interface PatientLite { id: string; first_name: string; last_name: string }
interface NutritionRow {
  id: string;
  name: string;
  patient_id: string;
  daily_kcal_target: number | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  patient?: PatientLite | null;
}

function Page() {
  return (
    <ProtectedRoute allow={["pro"]}>
      <ProLayout><Content /></ProLayout>
    </ProtectedRoute>
  );
}

function weeksBetween(start: string, end: string | null): string {
  if (!end) return "—";
  const d = (new Date(end).getTime() - new Date(start).getTime()) / 86400000;
  return d > 0 ? `${Math.round(d / 7)} sem.` : "—";
}

function Content() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<NutritionRow[] | null>(null);
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const [{ data: progs }, { data: pats }] = await Promise.all([
      supabase
        .from("nutrition_programs")
        .select("id, name, patient_id, daily_kcal_target, start_date, end_date, is_active, created_at")
        .eq("pro_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("patients")
        .select("id, first_name, last_name")
        .eq("pro_id", user.id),
    ]);
    const pmap = new Map((pats ?? []).map((p) => [p.id, p as PatientLite]));
    setPatients((pats ?? []) as PatientLite[]);
    setRows(((progs ?? []) as NutritionRow[]).map((r) => ({ ...r, patient: pmap.get(r.patient_id) ?? null })));
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [user]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const pname = r.patient ? `${r.patient.first_name} ${r.patient.last_name}`.toLowerCase() : "";
      return r.name.toLowerCase().includes(q) || pname.includes(q);
    });
  }, [rows, search]);

  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <h1 className="text-xl font-semibold">Programmes nutrition</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon"><Bell className="h-5 w-5" /></Button>
          <Button className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Nouveau programme
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher par nom ou patient…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="rounded-lg border bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Calories/j</TableHead>
                <TableHead>Durée</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Créé le</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered === null
                ? Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>{Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}</TableRow>
                  ))
                : filtered.length === 0
                  ? (<TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Aucun programme.</TableCell></TableRow>)
                  : filtered.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40"
                      onClick={() => navigate({ to: "/pro/nutrition/$programId", params: { programId: r.id } })}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.patient ? `${r.patient.first_name} ${r.patient.last_name}` : "—"}</TableCell>
                      <TableCell>{r.daily_kcal_target ?? "—"}</TableCell>
                      <TableCell>{weeksBetween(r.start_date, r.end_date)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${r.is_active ? "bg-[#6DB33F]/15 text-[#2D7A1F]" : "bg-muted text-muted-foreground"}`}>
                          {r.is_active ? "Actif" : "Inactif"}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString("fr-FR")}</TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <NewProgramDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        patients={patients}
        onCreated={() => { setModalOpen(false); void load(); }}
      />
    </div>
  );
}

function NewProgramDialog({
  open, onOpenChange, patients, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; patients: PatientLite[]; onCreated: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [patientId, setPatientId] = useState("");
  const [kcal, setKcal] = useState("");
  const [weeks, setWeeks] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => { setName(""); setPatientId(""); setKcal(""); setWeeks(""); setNotes(""); setIsActive(true); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim() || !patientId) { toast.error("Nom et patient obligatoires"); return; }
    setSubmitting(true);
    const start = new Date();
    const end = weeks ? new Date(start.getTime() + Number(weeks) * 7 * 86400000) : null;
    const { error } = await supabase.from("nutrition_programs").insert({
      pro_id: user.id,
      patient_id: patientId,
      name: name.trim(),
      daily_kcal_target: kcal ? Number(kcal) : null,
      start_date: start.toISOString().slice(0, 10),
      end_date: end ? end.toISOString().slice(0, 10) : null,
      notes: notes.trim() || null,
      is_active: isActive,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Programme créé"); reset(); onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau programme nutrition</DialogTitle>
          <DialogDescription>Renseignez les informations principales.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label>Nom *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={150} />
          </div>
          <div className="space-y-1">
            <Label>Patient *</Label>
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Calories / jour</Label>
              <Input type="number" min={0} value={kcal} onChange={(e) => setKcal(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Nombre de semaines</Label>
              <Input type="number" min={1} value={weeks} onChange={(e) => setWeeks(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} />
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label htmlFor="active">Programme actif</Label>
            <Switch id="active" checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={submitting} className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white">
              {submitting ? "Création…" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
