import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { ProLayout } from "@/layouts/ProLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Video, Phone, Plus, Calendar, Clock, User,
  ExternalLink, Salad, Dumbbell, FileText, CheckCircle2,
  XCircle, AlertCircle, Loader2
} from "lucide-react";
import { format, isPast, isFuture } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/pro/consultations")({
  component: Page,
});

function Page() {
  return (
    <ProLayout>
      <ConsultationsContent />
    </ProLayout>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Appointment = {
  id: string;
  patient_user_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  is_visio: boolean;
  meeting_url: string | null;
  notes: string | null;
  patient?: { first_name: string; last_name: string; email: string };
};

type Patient = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
};

type NutritionProgram = { id: string; name: string };
type SportProgram = { id: string; name: string };

// ─── Status helpers ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmé",
  done: "Terminé",
  cancelled: "Annulé",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  done: "bg-blue-100 text-blue-800 border-blue-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "confirmed") return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (status === "cancelled") return <XCircle className="h-3.5 w-3.5" />;
  return <AlertCircle className="h-3.5 w-3.5" />;
}

// ─── Main Content ──────────────────────────────────────────────────────────────

function ConsultationsContent() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Appointment | null>(null);

  // Fetch appointments with patient info
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["consultations", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          patient:patients!appointments_patient_user_id_fkey(first_name, last_name, email)
        `)
        .eq("pro_id", profile!.id)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data as Appointment[];
    },
  });

  const upcoming = appointments.filter((a) => isFuture(new Date(a.starts_at)) && a.status !== "cancelled");
  const past = appointments.filter((a) => isPast(new Date(a.starts_at)) || a.status === "done" || a.status === "cancelled");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Consultations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {upcoming.length} à venir · {past.length} passées
          </p>
        </div>
        <Button className="bg-[#6DB33F] hover:bg-[#5a9a32] text-white" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle consultation
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="upcoming">
        <TabsList className="mb-4">
          <TabsTrigger value="upcoming">
            À venir
            {upcoming.length > 0 && (
              <span className="ml-2 rounded-full bg-[#6DB33F] text-white text-[10px] font-bold px-1.5 py-0.5">
                {upcoming.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="past">Passées</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          <ConsultationList
            items={upcoming}
            isLoading={isLoading}
            onSelect={setSelected}
            empty="Aucune consultation à venir"
          />
        </TabsContent>

        <TabsContent value="past">
          <ConsultationList
            items={past}
            isLoading={isLoading}
            onSelect={setSelected}
            empty="Aucune consultation passée"
          />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {showNew && (
        <NewConsultationDialog
          proId={profile!.id}
          onClose={() => setShowNew(false)}
          onSuccess={() => { setShowNew(false); qc.invalidateQueries({ queryKey: ["consultations"] }); }}
        />
      )}
      {selected && (
        <ConsultationDetailDialog
          appointment={selected}
          proId={profile!.id}
          onClose={() => setSelected(null)}
          onSuccess={() => { setSelected(null); qc.invalidateQueries({ queryKey: ["consultations"] }); }}
        />
      )}
    </div>
  );
}

// ─── Consultation Card ─────────────────────────────────────────────────────────

function ConsultationList({
  items, isLoading, onSelect, empty,
}: {
  items: Appointment[];
  isLoading: boolean;
  onSelect: (a: Appointment) => void;
  empty: string;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg border bg-card animate-pulse" />
        ))}
      </div>
    );
  }
  if (!items.length) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
        <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">{empty}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {items.map((appt) => (
        <button
          key={appt.id}
          onClick={() => onSelect(appt)}
          className="w-full text-left rounded-lg border bg-card p-4 hover:shadow-md transition-shadow flex items-center gap-4"
        >
          {/* Type icon */}
          <div className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
            appt.is_visio ? "bg-blue-100 text-blue-600" : "bg-orange-100 text-orange-600"
          )}>
            {appt.is_visio ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">
                {appt.patient
                  ? `${appt.patient.first_name} ${appt.patient.last_name}`
                  : "Patient inconnu"}
              </span>
              <span className={cn(
                "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                STATUS_COLOR[appt.status] ?? STATUS_COLOR.pending
              )}>
                <StatusIcon status={appt.status} />
                {STATUS_LABEL[appt.status] ?? appt.status}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(appt.starts_at), "d MMMM yyyy", { locale: fr })}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(appt.starts_at), "HH:mm")}
                {appt.ends_at && ` → ${format(new Date(appt.ends_at), "HH:mm")}`}
              </span>
              <span className="flex items-center gap-1">
                {appt.is_visio ? <Video className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
                {appt.is_visio ? "Visio" : "Téléphone"}
              </span>
            </div>
          </div>

          {/* Visio button */}
          {appt.is_visio && appt.meeting_url && appt.status === "confirmed" && (
            <a
              href={appt.meeting_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md transition-colors shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Rejoindre
            </a>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── New Consultation Dialog ───────────────────────────────────────────────────

function NewConsultationDialog({
  proId, onClose, onSuccess,
}: {
  proId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [patientId, setPatientId] = useState("");
  const [type, setType] = useState<"visio" | "phone">("visio");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("30");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-list", proId],
    queryFn: async () => {
      const { data } = await supabase
        .from("patients")
        .select("id, user_id, first_name, last_name, email")
        .eq("pro_id", proId)
        .eq("is_active", true)
        .order("last_name");
      return (data ?? []) as Patient[];
    },
  });

  const handleSave = async () => {
    if (!patientId || !date || !time) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }
    setSaving(true);
    const startsAt = new Date(`${date}T${time}`);
    const endsAt = new Date(startsAt.getTime() + parseInt(duration) * 60000);

    const selectedPatient = patients.find((p) => p.id === patientId);

    const { error } = await supabase.from("appointments").insert({
      pro_id: proId,
      patient_user_id: selectedPatient?.user_id ?? patientId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "pending",
      is_visio: type === "visio",
      meeting_url: type === "visio" ? meetingUrl : null,
      notes: notes || null,
    });

    setSaving(false);
    if (error) { toast.error("Erreur lors de la création"); return; }
    toast.success("Consultation créée !");
    onSuccess();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle consultation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Patient */}
          <div className="space-y-1.5">
            <Label>Patient <span className="text-red-500">*</span></Label>
            <Select onValueChange={setPatientId} value={patientId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un patient" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.first_name} {p.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label>Type</Label>
            <div className="flex gap-2">
              {(["visio", "phone"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 rounded-md border text-sm font-medium transition-colors",
                    type === t
                      ? "bg-[#6DB33F] text-white border-[#6DB33F]"
                      : "bg-background hover:bg-muted"
                  )}
                >
                  {t === "visio" ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                  {t === "visio" ? "Visio" : "Téléphone"}
                </button>
              ))}
            </div>
          </div>

          {/* Date & Heure */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date <span className="text-red-500">*</span></Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Heure <span className="text-red-500">*</span></Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          {/* Durée */}
          <div className="space-y-1.5">
            <Label>Durée</Label>
            <Select onValueChange={setDuration} value={duration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 min</SelectItem>
                <SelectItem value="30">30 min</SelectItem>
                <SelectItem value="45">45 min</SelectItem>
                <SelectItem value="60">1 heure</SelectItem>
                <SelectItem value="90">1h30</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Lien visio */}
          {type === "visio" && (
            <div className="space-y-1.5">
              <Label>Lien de la visio</Label>
              <Input
                placeholder="https://meet.google.com/..."
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
              />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes (optionnel)</Label>
            <Textarea
              placeholder="Motif de consultation, préparation..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button
            className="bg-[#6DB33F] hover:bg-[#5a9a32] text-white"
            onClick={handleSave}
            disabled={saving}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Detail / Post-consultation Dialog ────────────────────────────────────────

function ConsultationDetailDialog({
  appointment, proId, onClose, onSuccess,
}: {
  appointment: Appointment;
  proId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [status, setStatus] = useState(appointment.status);
  const [notes, setNotes] = useState(appointment.notes ?? "");
  const [showSendProgram, setShowSendProgram] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("appointments")
      .update({ status, notes: notes || null })
      .eq("id", appointment.id);
    setSaving(false);
    if (error) { toast.error("Erreur de sauvegarde"); return; }
    toast.success("Consultation mise à jour");
    onSuccess();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {appointment.is_visio
              ? <Video className="h-5 w-5 text-blue-500" />
              : <Phone className="h-5 w-5 text-orange-500" />}
            Consultation — {appointment.patient
              ? `${appointment.patient.first_name} ${appointment.patient.last_name}`
              : "Patient"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Infos */}
          <div className="rounded-lg bg-muted/40 p-3 grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {format(new Date(appointment.starts_at), "d MMMM yyyy", { locale: fr })}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              {format(new Date(appointment.starts_at), "HH:mm")}
              {appointment.ends_at && ` → ${format(new Date(appointment.ends_at), "HH:mm")}`}
            </div>
          </div>

          {/* Lien visio */}
          {appointment.is_visio && appointment.meeting_url && (
            <a
              href={appointment.meeting_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 w-full justify-center py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Rejoindre la visio
            </a>
          )}

          {/* Statut */}
          <div className="space-y-1.5">
            <Label>Statut</Label>
            <Select onValueChange={setStatus} value={status}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="confirmed">Confirmé</SelectItem>
                <SelectItem value="done">Terminé</SelectItem>
                <SelectItem value="cancelled">Annulé</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              Notes de consultation
            </Label>
            <Textarea
              placeholder="Compte-rendu, observations, recommandations..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>

          {/* Envoyer programme */}
          <div className="border rounded-lg p-3 space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Salad className="h-4 w-4 text-[#6DB33F]" />
              Envoyer un programme au patient
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => setShowSendProgram(true)}
              >
                <Salad className="h-4 w-4 text-[#6DB33F]" />
                Nutrition
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => setShowSendProgram(true)}
              >
                <Dumbbell className="h-4 w-4 text-[#6DB33F]" />
                Sport
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fermer</Button>
          <Button
            className="bg-[#6DB33F] hover:bg-[#5a9a32] text-white"
            onClick={handleSave}
            disabled={saving}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Sauvegarder
          </Button>
        </DialogFooter>

        {showSendProgram && (
          <SendProgramDialog
            proId={proId}
            patientUserId={appointment.patient_user_id}
            patientName={appointment.patient
              ? `${appointment.patient.first_name} ${appointment.patient.last_name}`
              : "Patient"}
            onClose={() => setShowSendProgram(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Send Program Dialog ───────────────────────────────────────────────────────

function SendProgramDialog({
  proId, patientUserId, patientName, onClose,
}: {
  proId: string;
  patientUserId: string;
  patientName: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"nutrition" | "sport">("nutrition");
  const [selectedId, setSelectedId] = useState("");
  const [sending, setSending] = useState(false);

  // Cherche le patient_id dans la table patients à partir du user_id
  const { data: patientRow } = useQuery({
    queryKey: ["patient-row", patientUserId],
    queryFn: async () => {
      const { data } = await supabase
        .from("patients")
        .select("id")
        .eq("user_id", patientUserId)
        .eq("pro_id", proId)
        .single();
      return data;
    },
  });

  const { data: nutritionPrograms = [] } = useQuery({
    queryKey: ["nutrition-programs", proId],
    queryFn: async () => {
      const { data } = await supabase
        .from("nutrition_programs")
        .select("id, name")
        .eq("pro_id", proId)
        .eq("is_active", true);
      return (data ?? []) as NutritionProgram[];
    },
  });

  const { data: sportPrograms = [] } = useQuery({
    queryKey: ["sport-programs", proId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sport_programs")
        .select("id, name")
        .eq("pro_id", proId)
        .eq("is_active", true);
      return (data ?? []) as SportProgram[];
    },
  });

  const handleSend = async () => {
    if (!selectedId || !patientRow?.id) {
      toast.error("Sélectionnez un programme");
      return;
    }
    setSending(true);

    // Assigne le programme au patient en le liant à son patient_id
    const table = tab === "nutrition" ? "nutrition_programs" : "sport_programs";
    const { error } = await supabase
      .from(table)
      .update({ patient_id: patientRow.id })
      .eq("id", selectedId);

    setSending(false);
    if (error) { toast.error("Erreur d'envoi"); return; }
    toast.success(`Programme envoyé à ${patientName} ✓`);
    onClose();
  };

  const programs = tab === "nutrition" ? nutritionPrograms : sportPrograms;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Envoyer un programme à {patientName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Tab nutrition / sport */}
          <div className="flex gap-2">
            {(["nutrition", "sport"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setSelectedId(""); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-md border text-sm font-medium transition-colors",
                  tab === t
                    ? "bg-[#6DB33F] text-white border-[#6DB33F]"
                    : "bg-background hover:bg-muted"
                )}
              >
                {t === "nutrition"
                  ? <Salad className="h-4 w-4" />
                  : <Dumbbell className="h-4 w-4" />}
                {t === "nutrition" ? "Nutrition" : "Sport"}
              </button>
            ))}
          </div>

          {/* Liste des programmes */}
          {programs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun programme {tab === "nutrition" ? "nutrition" : "sport"} disponible
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {programs.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md border text-sm transition-colors",
                    selectedId === p.id
                      ? "border-[#6DB33F] bg-[#6DB33F]/10 font-medium"
                      : "hover:bg-muted"
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button
            className="bg-[#6DB33F] hover:bg-[#5a9a32] text-white"
            onClick={handleSend}
            disabled={sending || !selectedId}
          >
            {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}