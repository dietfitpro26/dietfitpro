import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { Bell, CalendarIcon, Plus } from "lucide-react";
import { toast } from "sonner";
import { ProLayout } from "@/layouts/ProLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { scheduleConsultationNotifications } from "@/lib/notifications";

export const Route = createFileRoute("/pro/consultations")({
  head: () => ({ meta: [{ title: "Téléconsultations — DietFitPro" }] }),
  component: Page,
});

type Status = "scheduled" | "completed" | "cancelled" | "refunded" | "no_show";
const STATUS_LABEL: Record<Status, string> = {
  scheduled: "Planifiée",
  completed: "Terminée",
  cancelled: "Annulée",
  refunded: "Remboursée",
  no_show: "Absent",
};

interface PatientLite {
  id: string;
  first_name: string;
  last_name: string;
  user_id: string | null;
}
interface Consultation {
  id: string;
  patient_id: string | null;
  patient_user_id: string | null;
  scheduled_at: string | null;
  duration_min: number | null;
  status: Status;
  amount_cents: number | null;
  patient?: PatientLite | null;
}

type StatusFilter = "all" | Status;
type Period = "all" | "today" | "week" | "month";

function Page() {
  return (
    <ProtectedRoute allow={["pro"]}>
      <ProLayout><Content /></ProLayout>
    </ProtectedRoute>
  );
}

function Content() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Consultation[] | null>(null);
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [period, setPeriod] = useState<Period>("all");
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const [{ data: consults }, { data: pats }] = await Promise.all([
      supabase.from("visio_consultations")
        .select("id, patient_id, patient_user_id, scheduled_at, duration_min, status, amount_cents")
        .eq("pro_id", user.id)
        .order("scheduled_at", { ascending: false }),
      supabase.from("patients").select("id, first_name, last_name, user_id").eq("pro_id", user.id),
    ]);
    const pmap = new Map((pats ?? []).map((p) => [p.id, p as PatientLite]));
    setPatients((pats ?? []) as PatientLite[]);
    setRows(((consults ?? []) as Consultation[]).map((c) => ({
      ...c,
      patient: c.patient_id ? pmap.get(c.patient_id) ?? null : null,
    })));
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [user]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const now = Date.now();
    const ranges: Record<Period, number> = {
      all: Infinity,
      today: 86400000,
      week: 7 * 86400000,
      month: 30 * 86400000,
    };
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (period !== "all") {
        if (!r.scheduled_at) return false;
        const diff = Math.abs(new Date(r.scheduled_at).getTime() - now);
        if (diff > ranges[period]) return false;
      }
      return true;
    });
  }, [rows, status, period]);

  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <h1 className="text-xl font-semibold">Téléconsultations</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon"><Bell className="h-5 w-5" /></Button>
          <Button className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Planifier une consultation
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Période" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes périodes</SelectItem>
              <SelectItem value="today">Aujourd'hui</SelectItem>
              <SelectItem value="week">Cette semaine</SelectItem>
              <SelectItem value="month">Ce mois</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Date / Heure</TableHead>
                <TableHead>Durée</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered === null
                ? Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>{Array.from({ length: 5 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}</TableRow>
                  ))
                : filtered.length === 0
                  ? <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Aucune consultation.</TableCell></TableRow>
                  : filtered.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40"
                      onClick={() => navigate({ to: "/pro/consultations/$id", params: { id: r.id } })}>
                      <TableCell>{r.patient ? `${r.patient.first_name} ${r.patient.last_name}` : "—"}</TableCell>
                      <TableCell>{r.scheduled_at ? format(new Date(r.scheduled_at), "dd/MM/yyyy HH:mm") : "—"}</TableCell>
                      <TableCell>{r.duration_min ? `${r.duration_min} min` : "—"}</TableCell>
                      <TableCell>
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          r.status === "scheduled" && "bg-blue-100 text-blue-700",
                          r.status === "completed" && "bg-[#6DB33F]/15 text-[#2D7A1F]",
                          r.status === "cancelled" && "bg-muted text-muted-foreground",
                          r.status === "refunded" && "bg-amber-100 text-amber-700",
                          r.status === "no_show" && "bg-red-100 text-red-700",
                        )}>{STATUS_LABEL[r.status]}</span>
                      </TableCell>
                      <TableCell>{r.amount_cents != null ? `${(r.amount_cents / 100).toFixed(2)} €` : "—"}</TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <ScheduleDialog
        open={open}
        onOpenChange={setOpen}
        patients={patients}
        onCreated={() => { setOpen(false); void load(); }}
      />
    </div>
  );
}

const PRICE_BY_DURATION: Record<string, number> = { "30": 40, "45": 55, "60": 70 };

function ScheduleDialog({
  open, onOpenChange, patients, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; patients: PatientLite[]; onCreated: () => void }) {
  const { user } = useAuth();
  const [patientId, setPatientId] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState("30");
  const [price, setPrice] = useState("40");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onDurationChange = (v: string) => {
    setDuration(v);
    setPrice(String(PRICE_BY_DURATION[v] ?? 40));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !patientId || !date) { toast.error("Patient et date obligatoires"); return; }
    const [h, m] = time.split(":").map(Number);
    const scheduled = new Date(date);
    scheduled.setHours(h ?? 10, m ?? 0, 0, 0);
    const patient = patients.find((p) => p.id === patientId);
    setSubmitting(true);
    const { data: created, error } = await supabase.from("visio_consultations").insert({
      pro_id: user.id,
      patient_id: patientId,
      patient_user_id: patient?.user_id ?? null,
      scheduled_at: scheduled.toISOString(),
      duration_min: Number(duration),
      amount_cents: Math.round(Number(price) * 100),
      status: "scheduled",
      payment_status: "pending",
      notes: notes.trim() || null,
    }).select("id").single();
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    if (created) {
      await scheduleConsultationNotifications({
        consultationId: created.id,
        proUserId: user.id,
        patientUserId: patient?.user_id ?? null,
        scheduledAt: scheduled,
        patientName: patient ? `${patient.first_name} ${patient.last_name}` : undefined,
      });
    }
    toast.success("Consultation planifiée");
    setPatientId(""); setDate(undefined); setTime("10:00"); setDuration("30"); setPrice("40"); setNotes("");
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Planifier une consultation</DialogTitle>
          <DialogDescription>Visio avec un patient.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
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
              <Label>Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "dd/MM/yyyy") : "Choisir…"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={setDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label>Heure *</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Durée</Label>
              <Select value={duration} onValueChange={onDurationChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Prix (€)</Label>
              <Input type="number" min={0} step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notes pré-consultation</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={submitting} className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white">
              {submitting ? "…" : "Planifier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
