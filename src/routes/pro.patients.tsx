import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, UserPlus, Bell } from "lucide-react";
import { toast } from "sonner";
import { ProLayout } from "@/layouts/ProLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/pro/patients")({
  head: () => ({ meta: [{ title: "Mes patients — DietFitPro" }] }),
  component: PatientsPage,
});

interface PatientRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  goal: string | null;
  is_active: boolean;
  updated_at: string;
  user_id: string | null;
  lastAppointment?: string | null;
}

type StatusFilter = "all" | "active" | "inactive";

const GOAL_LABEL: Record<string, string> = {
  perte_de_poids: "Perte de poids",
  prise_de_masse: "Prise de masse",
  maintien: "Maintien",
  autre: "Autre",
};

function getGoal(p: PatientRow): string {
  return (p.goal && GOAL_LABEL[p.goal]) || "—";
}

function PatientsPage() {
  return (
    <ProtectedRoute allow={["pro"]}>
      <ProLayout>
        <PatientsContent />
      </ProLayout>
    </ProtectedRoute>
  );
}

function PatientsContent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<PatientRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [modalOpen, setModalOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    setError(null);
    const { data, error: err } = await supabase
      .from("patients")
      .select("id, first_name, last_name, email, goal, is_active, updated_at, user_id")
      .eq("pro_id", user.id)
      .order("updated_at", { ascending: false });

    if (err) {
      console.error("[patients] load error", err);
      setError(err.message);
      setPatients([]);
      return;
    }

    const rows = (data ?? []) as PatientRow[];
    const userIds = rows.map((r) => r.user_id).filter((x): x is string => Boolean(x));
    if (userIds.length) {
      const { data: appts } = await supabase
        .from("appointments")
        .select("patient_user_id, starts_at")
        .eq("pro_id", user.id)
        .in("patient_user_id", userIds)
        .order("starts_at", { ascending: false });
      const last = new Map<string, string>();
      (appts ?? []).forEach((a: { patient_user_id: string; starts_at: string }) => {
        if (!last.has(a.patient_user_id)) last.set(a.patient_user_id, a.starts_at);
      });
      rows.forEach((r) => {
        if (r.user_id) r.lastAppointment = last.get(r.user_id) ?? null;
      });
    }
    setPatients(rows);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filtered = useMemo(() => {
    if (!patients) return null;
    const q = search.trim().toLowerCase();
    return patients.filter((p) => {
      const matchQ =
        !q ||
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q);
      const active = p.is_active;
      const matchStatus =
        status === "all" || (status === "active" ? active : !active);
      return matchQ && matchStatus;
    });
  }, [patients, search, status]);

  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">Mes patients</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell className="h-5 w-5" />
          </Button>
          <Button
            className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white"
            onClick={() => setModalOpen(true)}
          >
            <UserPlus className="h-4 w-4" /> Nouveau patient
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="active">Actifs</SelectItem>
              <SelectItem value="inactive">Inactifs</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="rounded-lg border bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14"></TableHead>
                <TableHead>Nom complet</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Objectif</TableHead>
                <TableHead>Dernier RDV</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered === null
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : filtered.length === 0
                  ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        Aucun patient ne correspond à votre recherche.
                        <div className="mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setModalOpen(true)}
                          >
                            <UserPlus className="h-4 w-4" /> Ajouter un patient
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                  : filtered.map((p) => {
                      const active = p.is_active;
                      const initials = `${p.first_name[0] ?? ""}${p.last_name[0] ?? ""}`.toUpperCase();
                      return (
                        <TableRow
                          key={p.id}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() =>
                            navigate({
                              to: "/pro/patients/$patientId",
                              params: { patientId: p.id },
                            })
                          }
                        >
                          <TableCell>
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="bg-[#6DB33F]/10 text-[#2D7A1F] text-xs font-semibold">
                                {initials || "?"}
                              </AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell className="font-medium">
                            {p.first_name} {p.last_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {p.email ?? "—"}
                          </TableCell>
                          <TableCell>{getGoal(p)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {p.lastAppointment
                              ? new Date(p.lastAppointment).toLocaleDateString("fr-FR")
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                active
                                  ? "bg-[#6DB33F]/15 text-[#2D7A1F]"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {active ? "Actif" : "Inactif"}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
            </TableBody>
          </Table>
        </div>
      </div>

      <NewPatientDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        onCreated={() => {
          setModalOpen(false);
          void load();
        }}
      />
    </div>
  );
}

function NewPatientDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [goal, setGoal] = useState<string>("perte_de_poids");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setBirthDate("");
    setGoal("perte_de_poids");
    setNotes("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Prénom et nom obligatoires");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("patients").insert({
      pro_id: user.id,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      birth_date: birthDate || null,
      medical_notes: notes.trim() || null,
      goal,
      is_active: true,
    });
    setSubmitting(false);
    if (error) {
      console.error("[patients] insert error", error);
      toast.error(error.message);
      return;
    }
    toast.success("Patient créé");
    reset();
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau patient</DialogTitle>
          <DialogDescription>Renseignez les informations principales.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="fn">Prénom *</Label>
              <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} required maxLength={100} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ln">Nom *</Label>
              <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} required maxLength={100} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="em">Email</Label>
            <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ph">Téléphone</Label>
              <Input id="ph" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bd">Date de naissance</Label>
              <Input id="bd" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="goal">Objectif</Label>
            <Select value={goal} onValueChange={setGoal}>
              <SelectTrigger id="goal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weight_loss">Perte de poids</SelectItem>
                <SelectItem value="muscle_gain">Prise de masse</SelectItem>
                <SelectItem value="maintenance">Maintien</SelectItem>
                <SelectItem value="other">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white"
            >
              {submitting ? "Création…" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
