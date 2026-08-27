import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { Search, UserPlus, Bell, RefreshCw, Users, FileText } from "lucide-react";
import { toast } from "sonner";
import { PatientQuickPanel } from "@/components/patients/PatientQuickPanel";
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
import { cn } from "@/lib/utils";

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

function getGoal(patient: PatientRow): string {
  return (patient.goal && GOAL_LABEL[patient.goal]) || "Non défini";
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
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;

    setError(null);

    const { data, error: patientsError } = await supabase
      .from("patients")
      .select(
        "id, first_name, last_name, email, goal, is_active, updated_at, user_id",
      )
      .eq("pro_id", user.id)
      .order("updated_at", { ascending: false });

    if (patientsError) {
      console.error("[patients] load error", patientsError);
      setError(patientsError.message);
      setPatients([]);
      return;
    }

    const rows = (data ?? []) as PatientRow[];
    const userIds = rows
      .map((patient) => patient.user_id)
      .filter((id): id is string => Boolean(id));

    if (userIds.length > 0) {
      const { data: appointments } = await supabase
        .from("appointments")
        .select("patient_user_id, starts_at")
        .eq("pro_id", user.id)
        .in("patient_user_id", userIds)
        .order("starts_at", { ascending: false });

      const lastAppointments = new Map<string, string>();

      (appointments ?? []).forEach(
        (appointment: { patient_user_id: string; starts_at: string }) => {
          if (!lastAppointments.has(appointment.patient_user_id)) {
            lastAppointments.set(
              appointment.patient_user_id,
              appointment.starts_at,
            );
          }
        },
      );

      rows.forEach((patient) => {
        if (patient.user_id) {
          patient.lastAppointment =
            lastAppointments.get(patient.user_id) ?? null;
        }
      });
    }

    setPatients(rows);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!patients) return null;

    const query = search.trim().toLowerCase();

    return patients.filter((patient) => {
      const matchesSearch =
        !query ||
        `${patient.first_name} ${patient.last_name}`
          .toLowerCase()
          .includes(query) ||
        (patient.email ?? "").toLowerCase().includes(query);

      const matchesStatus =
        status === "all" ||
        (status === "active" && patient.is_active) ||
        (status === "inactive" && !patient.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [patients, search, status]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  // Ouvre la fiche patient complète (page dédiée avec tous les onglets :
  // Évolution, Infos, Programmes, Mesures, RDV, Accès).
  function openFullProfile(patientId: string) {
    void navigate({ to: "/pro/patients/$patientId", params: { patientId } });
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-background to-muted/20">
      <header className="border-b bg-card/95 px-4 py-5 shadow-sm backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">
              Espace professionnel
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              Mes patients
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gérez vos patients et accédez rapidement à leur suivi.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl"
              aria-label="Ouvrir les notifications"
              onClick={() => void navigate({ to: "/pro/notifications" })}
            >
              <Bell className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
            >
              <RefreshCw
                className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")}
              />
              Actualiser
            </Button>

            <Button
              className="rounded-xl bg-[#6DB33F] text-white hover:bg-[#2D7A1F]"
              onClick={() => setModalOpen(true)}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Nouveau patient
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6">
        <section className="rounded-3xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom ou email…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-11 rounded-xl pl-9"
              />
            </div>

            <Select
              value={status}
              onValueChange={(value) => setStatus(value as StatusFilter)}
            >
              <SelectTrigger className="h-11 w-full rounded-xl lg:w-48">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les patients</SelectItem>
                <SelectItem value="active">Patients actifs</SelectItem>
                <SelectItem value="inactive">Patients inactifs</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>
              {filtered === null
                ? "Chargement des patients…"
                : `${filtered.length} patient${filtered.length > 1 ? "s" : ""} affiché${filtered.length > 1 ? "s" : ""}`}
            </span>
          </div>
        </section>

        {error ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
            <span>Impossible de charger les patients : {error}</span>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Réessayer
            </Button>
          </div>
        ) : null}

        <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14" />
                  <TableHead>Nom complet</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Objectif</TableHead>
                  <TableHead>Dernier rendez-vous</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filtered === null ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 7 }).map((__, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-16 text-center text-muted-foreground"
                    >
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                        <Users className="h-10 w-10 text-muted-foreground/40" />
                        <p className="text-sm">
                          Aucun patient ne correspond à votre recherche.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => setModalOpen(true)}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Ajouter un patient
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((patient) => {
                    const initials =
                      `${patient.first_name[0] ?? ""}${patient.last_name[0] ?? ""}`.toUpperCase();

                    return (
                      <TableRow
                        key={patient.id}
                        className="cursor-pointer transition-colors hover:bg-muted/40"
                        onClick={() => setSelectedPatientId(patient.id)}
                      >
                        <TableCell>
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-[#6DB33F]/10 text-xs font-semibold text-[#2D7A1F]">
                              {initials || "?"}
                            </AvatarFallback>
                          </Avatar>
                        </TableCell>

                        <TableCell className="font-medium">
                          {patient.first_name} {patient.last_name}
                        </TableCell>

                        <TableCell className="text-muted-foreground">
                          {patient.email ?? "—"}
                        </TableCell>

                        <TableCell>{getGoal(patient)}</TableCell>

                        <TableCell className="text-muted-foreground">
                          {patient.lastAppointment
                            ? new Date(
                                patient.lastAppointment,
                              ).toLocaleDateString("fr-FR")
                            : "—"}
                        </TableCell>

                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                              patient.is_active
                                ? "bg-[#6DB33F]/15 text-[#2D7A1F]"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {patient.is_active ? "Actif" : "Inactif"}
                          </span>
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-lg"
                            onClick={(event) => {
                              // Empêche le clic sur la ligne (qui ouvre la
                              // fiche rapide) de se déclencher en même temps.
                              event.stopPropagation();
                              openFullProfile(patient.id);
                            }}
                          >
                            <FileText className="mr-1.5 h-3.5 w-3.5" />
                            Fiche complète
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </main>

      <NewPatientDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        onCreated={() => {
          setModalOpen(false);
          void load();
        }}
      />

      <PatientQuickPanel
        patientId={selectedPatientId}
        open={Boolean(selectedPatientId)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedPatientId(null);
        }}
        onUpdated={() => {
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
  onOpenChange: (value: boolean) => void;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [goal, setGoal] = useState("perte_de_poids");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setBirthDate("");
    setGoal("perte_de_poids");
    setNotes("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!user) return;

    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Prénom et nom obligatoires");
      return;
    }

    setSubmitting(true);

    const { data: inserted, error } = await supabase
      .from("patients")
      .insert({
        pro_id: user.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        birth_date: birthDate || null,
        medical_notes: notes.trim() || null,
        goal,
        is_active: true,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[patients] insert error", error);
      toast.error(error.message);
      setSubmitting(false);
      return;
    }

    if (email.trim() && inserted?.id) {
      const { error: inviteError } = await supabase.functions.invoke(
        "invite-patient",
        {
          body: {
            email: email.trim(),
            patient_id: inserted.id,
            pro_id: user.id,
            role: "patient",
          },
        },
      );

      if (inviteError) {
        let errorMessage = "Erreur inconnue";

        try {
          const raw = await (inviteError as any).context?.text();

          if (raw) {
            const parsed = JSON.parse(raw);
            errorMessage = parsed?.error ?? parsed?.message ?? raw;
          } else {
            errorMessage = inviteError.message || JSON.stringify(inviteError);
          }
        } catch {
          errorMessage = inviteError.message || JSON.stringify(inviteError);
        }

        console.error("[patients] invite error:", errorMessage);
        toast.warning(`Invitation échouée : ${errorMessage}`);
      } else {
        toast.success("Patient créé et invitation envoyée ✉️");
      }
    } else {
      toast.success("Patient créé");
    }

    setSubmitting(false);
    reset();
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau patient</DialogTitle>
          <DialogDescription>
            Renseignez les informations principales.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="patient-first-name">Prénom *</Label>
              <Input
                id="patient-first-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
                maxLength={100}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="patient-last-name">Nom *</Label>
              <Input
                id="patient-last-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
                maxLength={100}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="patient-email">Email</Label>
            <Input
              id="patient-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={255}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="patient-phone">Téléphone</Label>
              <Input
                id="patient-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                maxLength={30}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="patient-birth-date">Date de naissance</Label>
              <Input
                id="patient-birth-date"
                type="date"
                value={birthDate}
                onChange={(event) => setBirthDate(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="patient-goal">Objectif</Label>
            <Select value={goal} onValueChange={setGoal}>
              <SelectTrigger id="patient-goal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="perte_de_poids">Perte de poids</SelectItem>
                <SelectItem value="prise_de_masse">Prise de masse</SelectItem>
                <SelectItem value="maintien">Maintien</SelectItem>
                <SelectItem value="autre">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="patient-notes">Notes</Label>
            <Textarea
              id="patient-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={2000}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>

            <Button
              type="submit"
              disabled={submitting}
              className="bg-[#6DB33F] text-white hover:bg-[#2D7A1F]"
            >
              {submitting ? "Création…" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}