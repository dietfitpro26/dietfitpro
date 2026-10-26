import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, Plus, Search, Trash2 } from "lucide-react";
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
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
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
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/pro/sport")({
  head: () => ({ meta: [{ title: "Programmes sport — DietFitPro" }] }),
  component: Page,
});

type Level = "debutant" | "intermediaire" | "avance";

const LEVEL_LABEL: Record<Level, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

interface PatientLite {
  id: string;
  first_name: string;
  last_name: string;
}

interface SportRow {
  id: string;
  name: string;
  patient_id: string;
  frequency_per_week: number | null;
  level: Level | null;
  is_active: boolean;
  created_at: string;
  patient?: PatientLite | null;
}

function Page() {
  return (
    <ProtectedRoute allow={["pro"]}>
      <ProLayout>
        <Content />
      </ProLayout>
    </ProtectedRoute>
  );
}

function Content() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState<SportRow[] | null>(null);
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    if (!user) return;

    const [{ data: progs, error: programsError }, { data: pats, error: patientsError }] =
      await Promise.all([
        supabase
          .from("patient_sport_programs")
          .select(
            "id, name, patient_id, frequency_per_week, level, is_active, created_at",
          )
          .eq("pro_id", user.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("patients")
          .select("id, first_name, last_name")
          .eq("pro_id", user.id)
          .order("last_name", { ascending: true }),
      ]);

    if (programsError) {
      console.error("Erreur chargement programmes Sport :", programsError);
      toast.error("Impossible de charger les programmes Sport.");
      setRows([]);
      return;
    }

    if (patientsError) {
      console.error("Erreur chargement patients :", patientsError);
      toast.error("Impossible de charger la liste des patients.");
    }

    const patientList = (pats ?? []) as PatientLite[];
    const patientMap = new Map(
      patientList.map((patient) => [patient.id, patient]),
    );

    setPatients(patientList);

    setRows(
      ((progs ?? []) as SportRow[]).map((program) => ({
        ...program,
        patient: patientMap.get(program.patient_id) ?? null,
      })),
    );
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filtered = useMemo(() => {
    if (!rows) return null;

    const query = search.trim().toLowerCase();

    if (!query) return rows;

    return rows.filter((row) => {
      const patientName = row.patient
        ? `${row.patient.first_name} ${row.patient.last_name}`.toLowerCase()
        : "";

      return (
        row.name.toLowerCase().includes(query) ||
        patientName.includes(query)
      );
    });
  }, [rows, search]);

  const handleDelete = async () => {
    if (!deleteId) return;

    setDeleting(true);

    const { error } = await supabase
      .from("patient_sport_programs")
      .delete()
      .eq("id", deleteId);

    setDeleting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setRows((previous) =>
      previous?.filter((program) => program.id !== deleteId) ?? null,
    );

    toast.success("Programme personnalisé supprimé");

    setDeleteId(null);
    setDeleteName("");
  };

  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold">
            Programmes personnalisés
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Créez et gérez les programmes sur mesure de vos patients.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell className="h-5 w-5" />
          </Button>

          <Button
            className="bg-[#6DB33F] text-white hover:bg-[#2D7A1F]"
            onClick={() => setModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Nouveau programme
          </Button>
        </div>
      </header>

      <div className="space-y-4 p-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            placeholder="Rechercher par nom ou patient…"
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="overflow-hidden rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Fréquence</TableHead>
                <TableHead>Niveau</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Créé le</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>

            <TableBody>
              {filtered === null
                ? Array.from({ length: 4 }).map((_, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {Array.from({ length: 7 }).map((__, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : filtered.length === 0
                  ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-12 text-center text-muted-foreground"
                      >
                        Aucun programme personnalisé pour le moment.
                      </TableCell>
                    </TableRow>
                  )
                  : filtered.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() =>
                        navigate({
                          to: "/pro/sport/$programId",
                          params: { programId: row.id },
                        })
                      }
                    >
                      <TableCell className="font-medium">
                        {row.name}
                      </TableCell>

                      <TableCell>
                        {row.patient
                          ? `${row.patient.first_name} ${row.patient.last_name}`
                          : "—"}
                      </TableCell>

                      <TableCell>
                        {row.frequency_per_week
                          ? `${row.frequency_per_week}×/sem.`
                          : "—"}
                      </TableCell>

                      <TableCell>
                        {row.level ? LEVEL_LABEL[row.level] : "—"}
                      </TableCell>

                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            row.is_active
                              ? "bg-[#6DB33F]/15 text-[#2D7A1F]"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {row.is_active ? "Actif" : "Inactif"}
                        </span>
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {new Date(row.created_at).toLocaleDateString("fr-FR")}
                      </TableCell>

                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteId(row.id);
                            setDeleteName(row.name);
                          }}
                          aria-label="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog
        open={Boolean(deleteId)}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setDeleteId(null);
            setDeleteName("");
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer le programme ?</DialogTitle>
            <DialogDescription>
              Vous êtes sur le point de supprimer{" "}
              <strong>« {deleteName} »</strong>. Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setDeleteId(null);
                setDeleteName("");
              }}
            >
              Annuler
            </Button>

            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              {deleting ? "Suppression…" : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewSportDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        patients={patients}
        onCreated={() => {
          setModalOpen(false);
          void load();
        }}
      />
    </div>
  );
}

function NewSportDialog({
  open,
  onOpenChange,
  patients,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  patients: PatientLite[];
  onCreated: () => void;
}) {
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [patientId, setPatientId] = useState("");
  const [frequency, setFrequency] = useState("");
  const [level, setLevel] = useState<Level>("debutant");
  const [goal, setGoal] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setName("");
    setPatientId("");
    setFrequency("");
    setLevel("debutant");
    setGoal("");
    setNotes("");
    setIsActive(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!user || !name.trim() || !patientId) {
      toast.error("Le nom et le patient sont obligatoires.");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase
      .from("patient_sport_programs")
      .insert({
        pro_id: user.id,
        patient_id: patientId,
        name: name.trim(),
        frequency_per_week: frequency ? Number(frequency) : null,
        level,
        goal: goal.trim() || null,
        notes: notes.trim() || null,
        sessions: [],
        exercises: [],
        is_active: isActive,
      });

    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Programme personnalisé créé");

    resetForm();
    onCreated();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          resetForm();
        }

        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau programme personnalisé</DialogTitle>
          <DialogDescription>
            Créez un programme sur mesure pour un patient précis.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label>Nom du programme *</Label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={150}
              placeholder="Ex. Reprise progressive — Lucas"
            />
          </div>

          <div className="space-y-1">
            <Label>Patient *</Label>
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un patient…" />
              </SelectTrigger>

              <SelectContent>
                {patients.map((patient) => (
                  <SelectItem key={patient.id} value={patient.id}>
                    {patient.first_name} {patient.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Fréquence hebdomadaire</Label>
              <Input
                type="number"
                min={1}
                max={14}
                value={frequency}
                onChange={(event) => setFrequency(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label>Niveau</Label>
              <Select
                value={level}
                onValueChange={(value) => setLevel(value as Level)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {(Object.keys(LEVEL_LABEL) as Level[]).map((item) => (
                    <SelectItem key={item} value={item}>
                      {LEVEL_LABEL[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Objectif</Label>
            <Input
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              maxLength={200}
              placeholder="Ex. Reprendre le renforcement progressivement"
            />
          </div>

          <div className="space-y-1">
            <Label>Notes du professionnel</Label>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Consignes, adaptations, précautions…"
            />
          </div>

          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label htmlFor="active">Programme actif</Label>
            <Switch
              id="active"
              checked={isActive}
              onCheckedChange={setIsActive}
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