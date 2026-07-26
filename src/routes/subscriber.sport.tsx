import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Dumbbell,
  Lock,
  Clock3,
  FileText,
  Target,
  Check,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { SubscriberLayout } from "@/layouts/SubscriberLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAccessRights } from "@/hooks/useAccessRights";
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

export const Route = createFileRoute("/subscriber/sport")({
  head: () => ({ meta: [{ title: "Sport — DietFitPro" }] }),
  component: SubscriberSportPage,
});

function SubscriberSportPage() {
  return (
    <ProtectedRoute allow={["subscriber"]}>
      <SubscriberLayout>
        <SportContent />
      </SubscriberLayout>
    </ProtectedRoute>
  );
}

type PremiumExercise = {
  id?: string;
  name: string;
  sets?: number | string;
  reps?: number | string;
  rest_sec?: number | string;
  notes?: string;
};

type PremiumSession = {
  id: string;
  name: string;
  day: string;
  duration_min: number;
  notes: string;
  exercises?: PremiumExercise[];
};

type PremiumProgram = {
  id: string;
  name: string;
  frequency_per_week: number | null;
  level: string | null;
  goal: string | null;
  notes: string | null;
  sessions: PremiumSession[];
};

type PremiumDocument = {
  id: string;
  title: string;
  file_url: string;
  file_name: string | null;
};

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const LEVEL_LABEL: Record<string, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

function todayIso() {
  return format(new Date(), "yyyy-MM-dd");
}

function doneKey(programId: string, date: string) {
  return `dfp:subscriber-sport-done:${programId}:${date}`;
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
  const { profile, user } = useAuth();
  const { rights, loading } = useAccessRights();

  const firstName = profile?.full_name?.split(" ")[0] ?? "vous";
  const hasAccess = rights?.access_sport_programs ?? false;
  const isPremiumLike = profile?.plan === "premium" || profile?.plan === "visio";

  const [program, setProgram] = useState<PremiumProgram | null | undefined>(undefined);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [pdfDocs, setPdfDocs] = useState<PremiumDocument[]>([]);

  useEffect(() => {
    if (loading) return;

    if (!user || !hasAccess || !isPremiumLike) {
      setProgram(null);
      setPdfDocs([]);
      return;
    }

    void (async () => {
      const [progRes, docsRes] = await Promise.all([
        supabase
          .from("subscriber_sport_programs")
          .select("id, name, frequency_per_week, level, goal, notes, sessions")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1),

        supabase
          .from("subscriber_documents")
          .select("id, title, file_url, file_name")
          .eq("user_id", user.id)
          .eq("category", "sport")
          .order("created_at", { ascending: false }),
      ]);

      setPdfDocs((docsRes.data ?? []) as PremiumDocument[]);

      const row = progRes.data?.[0] as PremiumProgram | undefined;

      if (!row) {
        setProgram(null);
        return;
      }

      const prog: PremiumProgram = {
        ...row,
        sessions: Array.isArray(row.sessions) ? row.sessions : [],
      };

      setProgram(prog);
      setDone(loadDone(prog.id, todayIso()));
    })();
  }, [user, hasAccess, isPremiumLike, loading]);

  const grouped = useMemo(() => {
    const g: Record<string, PremiumSession[]> = {};
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

  if (loading || (hasAccess && isPremiumLike && program === undefined)) {
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

  if (!hasAccess) {
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

          <Card className="rounded-3xl border shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Module sport verrouillé</CardTitle>
                  <CardDescription>
                    Cette page est disponible, mais l’accès personnalisé dépend d’une formule supérieure.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                En formule basic, vous gardez une organisation simple et un aperçu générique.
              </div>
              <Button variant="outline" className="rounded-2xl">
                Découvrir une formule premium
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!isPremiumLike) {
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
              value="Progression encadrée"
              subtitle="À personnaliser selon votre formule"
            />
            <InfoCard
              icon={<Clock3 className="h-5 w-5" />}
              title="Rythme conseillé"
              value="2 à 4 séances / semaine"
              subtitle="Selon votre niveau"
            />
            <InfoCard
              icon={<FileText className="h-5 w-5" />}
              title="Supports"
              value="PDF / séances / consignes"
              subtitle="Organisation simple et claire"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SessionCard
              title="Séance 1 — Bas du corps"
              duration="45 min"
              items={[
                {
                  id: "generic-1",
                  title: "Échauffement articulaire",
                  subtitle: "Mobilité et mise en route",
                  details: [],
                  notes: "",
                  done: false,
                  onToggleDone: () => undefined,
                },
                {
                  id: "generic-2",
                  title: "Squat ou variante",
                  subtitle: "Travail de base",
                  details: [],
                  notes: "",
                  done: false,
                  onToggleDone: () => undefined,
                },
                {
                  id: "generic-3",
                  title: "Fentes ou presse",
                  subtitle: "Renforcement",
                  details: [],
                  notes: "",
                  done: false,
                  onToggleDone: () => undefined,
                },
                {
                  id: "generic-4",
                  title: "Gainage de fin de séance",
                  subtitle: "Stabilité du tronc",
                  details: [],
                  notes: "",
                  done: false,
                  onToggleDone: () => undefined,
                },
              ]}
            />
            <SessionCard
              title="Séance 2 — Haut du corps"
              duration="40 min"
              items={[
                {
                  id: "generic-5",
                  title: "Échauffement épaules / dos",
                  subtitle: "Préparation",
                  details: [],
                  notes: "",
                  done: false,
                  onToggleDone: () => undefined,
                },
                {
                  id: "generic-6",
                  title: "Tirage ou rowing",
                  subtitle: "Dos",
                  details: [],
                  notes: "",
                  done: false,
                  onToggleDone: () => undefined,
                },
                {
                  id: "generic-7",
                  title: "Développé ou pompes",
                  subtitle: "Poussée",
                  details: [],
                  notes: "",
                  done: false,
                  onToggleDone: () => undefined,
                },
                {
                  id: "generic-8",
                  title: "Travail bras / posture",
                  subtitle: "Finition",
                  details: [],
                  notes: "",
                  done: false,
                  onToggleDone: () => undefined,
                },
              ]}
            />
            <SessionCard
              title="Séance 3 — Cardio / dépense"
              duration="30 min"
              items={[
                {
                  id: "generic-9",
                  title: "Marche active ou vélo",
                  subtitle: "Cardio léger",
                  details: [],
                  notes: "",
                  done: false,
                  onToggleDone: () => undefined,
                },
                {
                  id: "generic-10",
                  title: "Intervalles légers",
                  subtitle: "Endurance",
                  details: [],
                  notes: "",
                  done: false,
                  onToggleDone: () => undefined,
                },
                {
                  id: "generic-11",
                  title: "Retour au calme",
                  subtitle: "Récupération",
                  details: [],
                  notes: "",
                  done: false,
                  onToggleDone: () => undefined,
                },
              ]}
            />
            <DocumentsCard docs={[]} onOpen={handleOpenPdf} generic />
          </div>

          <Card className="rounded-3xl border shadow-sm">
            <CardHeader>
              <CardTitle>Étape suivante</CardTitle>
              <CardDescription>
                Cette version reste générique. La version premium permet un programme réellement personnalisé.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="rounded-2xl">
                Passer en premium
              </Button>
            </CardContent>
          </Card>
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
            subtitle="Programme personnalisé"
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

        <div className="grid gap-4 lg:grid-cols-2">
          {program && orderedDays.length > 0 ? (
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
                title="Séance 1"
                duration="À définir"
                items={[
                  {
                    id: "premium-empty-1",
                    title: "Programme personnalisé à venir",
                    subtitle: "Votre coach pourra ajouter vos exercices détaillés",
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
                    id: "premium-empty-2",
                    title: "Organisation future",
                    subtitle: "Les séries, répétitions et repos apparaîtront ici",
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

          {!program?.notes && (
            <SessionCard
              title="Notes"
              duration="Suivi"
              items={[
                {
                  id: "premium-empty-3",
                  title: "Aucune note pour le moment",
                  subtitle: "Les consignes coach apparaîtront ici",
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
              Votre espace premium est prêt pour accueillir un vrai programme personnalisé et des documents réels.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="rounded-2xl">
              Programme premium prêt
            </Button>
          </CardContent>
        </Card>

        {program?.notes && (
          <Card className="rounded-3xl border shadow-sm">
            <CardHeader>
              <CardTitle>Notes du coach</CardTitle>
              <CardDescription>
                Consignes complémentaires liées à votre programme sport.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {program.notes}
              </p>
            </CardContent>
          </Card>
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

                {!item.id.startsWith("generic-") &&
                  !item.id.startsWith("premium-empty-") && (
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
  generic = false,
}: {
  docs: PremiumDocument[];
  onOpen: (filePath: string) => void;
  generic?: boolean;
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
        {generic ? (
          <ul className="space-y-2 text-sm text-muted-foreground">
            {["Programme PDF n°1", "Programme PDF n°2", "Conseils récupération"].map((item) => (
              <li key={item} className="rounded-xl bg-muted/30 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        ) : docs.length > 0 ? (
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