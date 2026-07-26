import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Dumbbell,
  Clock3,
  FileText,
  Download,
  Target,
  Check,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { PatientLayout } from "@/layouts/PatientLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/patient/sport")({
  head: () => ({ meta: [{ title: "Sport — DietFitPro" }] }),
  component: PatientSportPage,
});

function PatientSportPage() {
  return (
    <ProtectedRoute allow={["patient"]}>
      <PatientLayout>
        <SportContent />
      </PatientLayout>
    </ProtectedRoute>
  );
}

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const LEVEL_LABEL: Record<string, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

interface Exercise {
  id?: string;
  name: string;
  sets?: number | string;
  reps?: number | string;
  rest_sec?: number | string;
  notes?: string;
}

interface Session {
  id: string;
  name: string;
  day: string;
  duration_min: number;
  notes: string;
  exercises?: Exercise[];
}

interface Program {
  id: string;
  name: string;
  frequency_per_week: number | null;
  level: string | null;
  goal: string | null;
  notes: string | null;
  sessions: Session[];
}

interface PatientDocument {
  id: string;
  title: string;
  file_url: string;
  file_name: string | null;
}

function todayIso() {
  return format(new Date(), "yyyy-MM-dd");
}

function doneKey(programId: string, date: string) {
  return `dfp:sport-done:${programId}:${date}`;
}

function loadDone(programId: string, date: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(doneKey(programId, date)) ?? "[]"));
  } catch {
    return new Set();
  }
}

function saveDone(programId: string, date: string, set: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(doneKey(programId, date), JSON.stringify([...set]));
}

function SportContent() {
  const { user, profile } = useAuth();
  const [program, setProgram] = useState<Program | null | undefined>(undefined);
  const [proName, setProName] = useState<string>("");
  const [done, setDone] = useState<Set<string>>(new Set());
  const [pdfDocs, setPdfDocs] = useState<PatientDocument[]>([]);

  const firstName = profile?.full_name?.split(" ")[0] ?? "vous";

  useEffect(() => {
    if (!user) return;

    void (async () => {
      const { data: pat } = await supabase
        .from("patients")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const patientId = (pat as { id?: string } | null)?.id;

      if (!patientId) {
        setProgram(null);
        setPdfDocs([]);
        return;
      }

      const [progRes, docsRes] = await Promise.all([
        supabase
          .from("sport_programs")
          .select("id, name, frequency_per_week, level, goal, notes, sessions, pro_id")
          .eq("patient_id", patientId)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1),

        supabase
          .from("patient_documents")
          .select("id, title, file_url, file_name")
          .eq("patient_id", patientId)
          .eq("category", "sport")
          .order("created_at", { ascending: false }),
      ]);

      setPdfDocs((docsRes.data ?? []) as PatientDocument[]);

      const row = progRes.data?.[0] as (Program & { pro_id?: string }) | undefined;

      if (!row) {
        setProgram(null);
        return;
      }

      const prog: Program = {
        ...row,
        sessions: Array.isArray(row.sessions) ? row.sessions : [],
      };

      setProgram(prog);
      setDone(loadDone(prog.id, todayIso()));

      if (row.pro_id) {
        const { data: p } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", row.pro_id)
          .maybeSingle();

        setProName((p as { full_name?: string } | null)?.full_name ?? "");
      }
    })();
  }, [user]);

  const grouped = useMemo(() => {
    const g: Record<string, Session[]> = {};
    DAYS.forEach((d) => (g[d] = []));
    g["Autres"] = [];

    program?.sessions.forEach((s) => {
      const key = DAYS.includes(s.day) ? s.day : "Autres";
      g[key].push(s);
    });

    return g;
  }, [program]);

  const orderedDays = [...DAYS, "Autres"].filter((d) => grouped[d]?.length);

  const toggleDone = (id: string) => {
    if (!program) return;
    const next = new Set(done);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDone(next);
    saveDone(program.id, todayIso(), next);
  };

  const handleOpenPdf = async (filePath: string) => {
    const { data, error } = await supabase.storage
      .from("message-attachments")
      .createSignedUrl(filePath, 3600);

    if (error || !data?.signedUrl) {
      alert("Impossible d'ouvrir le PDF, réessayez.");
      return;
    }

    window.open(data.signedUrl, "_blank");
  };

  if (program === undefined) {
    return (
      <div className="p-4 sm:p-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="h-32 animate-pulse rounded-3xl bg-muted" />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="h-40 animate-pulse rounded-3xl bg-muted" />
            <div className="h-40 animate-pulse rounded-3xl bg-muted" />
            <div className="h-40 animate-pulse rounded-3xl bg-muted" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-64 animate-pulse rounded-3xl bg-muted" />
            <div className="h-64 animate-pulse rounded-3xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  const objectiveValue = program?.goal || "Progression encadrée";
  const rhythmValue =
    program?.frequency_per_week != null
      ? `${program.frequency_per_week} séance${program.frequency_per_week > 1 ? "s" : ""} / semaine`
      : "À définir";
  const rhythmSubtitle =
    program?.level ? LEVEL_LABEL[program.level] ?? program.level : "Selon votre niveau";
  const docsValue =
    pdfDocs.length > 0
      ? `${pdfDocs.length} document${pdfDocs.length > 1 ? "s" : ""}`
      : "Aucun PDF";

  return (
    <div className="min-h-full bg-gradient-to-b from-background to-muted/20 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card className="rounded-3xl border shadow-sm">
          <CardHeader className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Dumbbell className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl sm:text-2xl">Sport</CardTitle>
                <CardDescription className="mt-1 text-sm sm:text-base">
                  Bonjour {firstName}, retrouvez ici vos séances, vos documents et
                  votre organisation sportive.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <InfoCard
            icon={<Target className="h-5 w-5" />}
            title="Objectif sport"
            value={objectiveValue}
            subtitle={proName ? `Attribué par ${proName}` : "À personnaliser selon votre suivi"}
          />
          <InfoCard
            icon={<Clock3 className="h-5 w-5" />}
            title="Rythme conseillé"
            value={rhythmValue}
            subtitle={rhythmSubtitle}
          />
          <InfoCard
            icon={<FileText className="h-5 w-5" />}
            title="Supports"
            value={docsValue}
            subtitle="Organisation simple et claire"
          />
        </div>

        {program ? (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              {orderedDays.length > 0 ? (
                orderedDays.map((day) => (
                  <SessionCard
                    key={day}
                    title={day}
                    duration={`${grouped[day].length} séance${grouped[day].length > 1 ? "s" : ""}`}
                    items={grouped[day].map((session) => ({
                      id: session.id,
                      title: session.name,
                      subtitle:
                        session.duration_min > 0
                          ? `${session.duration_min} min`
                          : "Durée non précisée",
                      details: Array.isArray(session.exercises)
                        ? session.exercises.map((exercise) => {
                            const parts = [
                              exercise.name,
                              exercise.sets ? `${exercise.sets}×` : null,
                              exercise.reps ?? null,
                              exercise.rest_sec ? `${exercise.rest_sec}s repos` : null,
                            ].filter(Boolean);
                            return parts.join(" · ");
                          })
                        : [],
                      notes: session.notes || "",
                      done: done.has(session.id),
                      onToggleDone: () => toggleDone(session.id),
                    }))}
                  />
                ))
              ) : (
                <>
                  <SessionCard
                    title="Séances"
                    duration="À venir"
                    items={[
                      {
                        id: "empty-1",
                        title: "Aucune séance planifiée",
                        subtitle: "Votre praticien ajoutera bientôt votre programme",
                        details: [],
                        notes: "",
                        done: false,
                        onToggleDone: () => undefined,
                      },
                    ]}
                  />
                  <SessionCard
                    title="Organisation"
                    duration={format(new Date(), "dd MMM", { locale: fr })}
                    items={[
                      {
                        id: "empty-2",
                        title: "Programme en préparation",
                        subtitle: "Les exercices et paramètres apparaîtront ici",
                        details: [],
                        notes: "",
                        done: false,
                        onToggleDone: () => undefined,
                      },
                    ]}
                  />
                </>
              )}

              <DocumentsCard docs={pdfDocs} onOpen={handleOpenPdf} />

              {!program.notes && (
                <SessionCard
                  title="Notes"
                  duration="Suivi"
                  items={[
                    {
                      id: "empty-notes",
                      title: "Aucune note pour le moment",
                      subtitle: "Les consignes du praticien s'afficheront ici",
                      details: [],
                      notes: "",
                      done: false,
                      onToggleDone: () => undefined,
                    },
                  ]}
                />
              )}
            </div>

            <Card className="rounded-3xl border shadow-sm">
              <CardHeader>
                <CardTitle>Étape suivante</CardTitle>
                <CardDescription>
                  Votre programme patient est en place. Vous pouvez suivre vos séances,
                  consulter vos documents et valider votre progression.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="rounded-2xl">
                  Programme patient prêt
                </Button>
              </CardContent>
            </Card>

            {program.notes && (
              <Card className="rounded-3xl border shadow-sm">
                <CardHeader>
                  <CardTitle>Notes du praticien</CardTitle>
                  <CardDescription>
                    Consignes complémentaires liées à votre accompagnement.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {program.notes}
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <SessionCard
                title="Séance 1"
                duration="À définir"
                items={[
                  {
                    id: "placeholder-1",
                    title: "Programme personnalisé à venir",
                    subtitle: "Les exercices, séries et répétitions seront ajoutés ici",
                    details: [],
                    notes: "",
                    done: false,
                    onToggleDone: () => undefined,
                  },
                ]}
              />
              <SessionCard
                title="Séance 2"
                duration="À définir"
                items={[
                  {
                    id: "placeholder-2",
                    title: "Organisation future",
                    subtitle: "Votre praticien pourra structurer votre entraînement",
                    details: [],
                    notes: "",
                    done: false,
                    onToggleDone: () => undefined,
                  },
                ]}
              />
              <DocumentsCard docs={pdfDocs} onOpen={handleOpenPdf} />
              <SessionCard
                title="Documents complémentaires"
                duration="PDF"
                items={[
                  {
                    id: "placeholder-3",
                    title: "Aucun document pour le moment",
                    subtitle: "Les PDF sportifs apparaîtront ici",
                    details: [],
                    notes: "",
                    done: false,
                    onToggleDone: () => undefined,
                  },
                ]}
              />
            </div>

            <Card className="rounded-3xl border shadow-sm">
              <CardHeader>
                <CardTitle>Étape suivante</CardTitle>
                <CardDescription>
                  La mise en page est déjà identique à celle de l’abonné. Il reste à
                  rattacher ou créer le programme personnalisé de ce patient.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="rounded-2xl">
                  Programme patient en attente
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  value,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <Card className="rounded-3xl border shadow-sm">
      <CardContent className="p-5">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="text-sm text-muted-foreground">{title}</div>
        <div className="mt-1 text-lg font-semibold">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
      </CardContent>
    </Card>
  );
}

function SessionCard({
  title,
  duration,
  items,
}: {
  title: string;
  duration: string;
  items: {
    id: string;
    title: string;
    subtitle: string;
    details: string[];
    notes: string;
    done: boolean;
    onToggleDone: () => void;
  }[];
}) {
  return (
    <Card className="rounded-3xl border shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            {duration}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl px-3 py-3 ${
                item.done
                  ? "border border-[#6DB33F]/40 bg-[#6DB33F]/5"
                  : "bg-muted/30"
              }`}
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div
                    className={`text-sm font-medium ${
                      item.done ? "line-through text-muted-foreground" : ""
                    }`}
                  >
                    {item.title}
                  </div>
                  <div className="text-xs text-muted-foreground">{item.subtitle}</div>
                </div>

                {!item.id.startsWith("placeholder") &&
                  !item.id.startsWith("empty") && (
                    <Button
                      size="sm"
                      variant={item.done ? "default" : "outline"}
                      className={item.done ? "bg-[#6DB33F] text-white hover:bg-[#2D7A1F]" : "rounded-xl"}
                      onClick={item.onToggleDone}
                    >
                      <Check className="mr-1 h-4 w-4" />
                      {item.done ? "Terminée" : "Valider"}
                    </Button>
                  )}
              </div>

              {item.details.length > 0 && (
                <ul className="space-y-2">
                  {item.details.map((detail, index) => (
                    <li
                      key={`${item.id}-${index}`}
                      className="rounded-xl bg-background px-3 py-2 text-sm text-muted-foreground"
                    >
                      {detail}
                    </li>
                  ))}
                </ul>
              )}

              {item.notes && (
                <p className="mt-3 whitespace-pre-wrap text-xs text-muted-foreground">
                  {item.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DocumentsCard({
  docs,
  onOpen,
}: {
  docs: PatientDocument[];
  onOpen: (filePath: string) => void;
}) {
  return (
    <Card className="rounded-3xl border shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Documents</CardTitle>
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            PDF
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {docs.length > 0 ? (
          <div className="space-y-2">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">
                    {doc.title || doc.file_name || "Document sport"}
                  </div>
                </div>
                <Button size="sm" className="rounded-xl" onClick={() => onOpen(doc.file_url)}>
                  <Download className="mr-1 h-4 w-4" />
                  Ouvrir
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            Aucun document disponible pour le moment.
          </div>
        )}
      </CardContent>
    </Card>
  );
}