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
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
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

type SessionItem = {
  id: string;
  title: string;
  subtitle: string;
  details: string[];
  notes: string;
  done: boolean;
  locked: boolean;
  onToggleDone: () => void;
};

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const LEVEL_LABEL: Record<string, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

const BASIC_GENERIC_SESSIONS: {
  title: string;
  duration: string;
  locked: boolean;
  items: SessionItem[];
}[] = [
  {
    title: "Séance 1 — Haut du corps",
    duration: "40 min",
    locked: false,
    items: [
      {
        id: "basic-1",
        title: "Échauffement épaules / dos",
        subtitle: "Préparation articulaire",
        details: [],
        notes: "",
        done: false,
        locked: false,
        onToggleDone: () => undefined,
      },
      {
        id: "basic-2",
        title: "Pompes ou développé",
        subtitle: "Travail poussée",
        details: [],
        notes: "",
        done: false,
        locked: false,
        onToggleDone: () => undefined,
      },
      {
        id: "basic-3",
        title: "Tirage ou rowing",
        subtitle: "Travail dos",
        details: [],
        notes: "",
        done: false,
        locked: false,
        onToggleDone: () => undefined,
      },
      {
        id: "basic-4",
        title: "Gainage",
        subtitle: "Stabilité du tronc",
        details: [],
        notes: "",
        done: false,
        locked: false,
        onToggleDone: () => undefined,
      },
    ],
  },
  {
    title: "Séance 2 — Bas du corps",
    duration: "45 min",
    locked: false,
    items: [
      {
        id: "basic-5",
        title: "Échauffement bas du corps",
        subtitle: "Mobilité et activation",
        details: [],
        notes: "",
        done: false,
        locked: false,
        onToggleDone: () => undefined,
      },
      {
        id: "basic-6",
        title: "Squat ou variante",
        subtitle: "Travail principal",
        details: [],
        notes: "",
        done: false,
        locked: false,
        onToggleDone: () => undefined,
      },
      {
        id: "basic-7",
        title: "Fentes ou presse",
        subtitle: "Renforcement complémentaire",
        details: [],
        notes: "",
        done: false,
        locked: false,
        onToggleDone: () => undefined,
      },
      {
        id: "basic-8",
        title: "Mollets / finition",
        subtitle: "Fin de séance",
        details: [],
        notes: "",
        done: false,
        locked: false,
        onToggleDone: () => undefined,
      },
    ],
  },
  {
    title: "Séance 3 — Abdos / cardio",
    duration: "30 min",
    locked: false,
    items: [
      {
        id: "basic-9",
        title: "Crunch ou variante",
        subtitle: "Travail abdominal",
        details: [],
        notes: "",
        done: false,
        locked: false,
        onToggleDone: () => undefined,
      },
      {
        id: "basic-10",
        title: "Gainage dynamique",
        subtitle: "Ceinture abdominale",
        details: [],
        notes: "",
        done: false,
        locked: false,
        onToggleDone: () => undefined,
      },
      {
        id: "basic-11",
        title: "Cardio léger",
        subtitle: "Marche active ou vélo",
        details: [],
        notes: "",
        done: false,
        locked: false,
        onToggleDone: () => undefined,
      },
    ],
  },
  {
    title: "Séance 4 — Full body",
    duration: "40 min",
    locked: true,
    items: [
      {
        id: "basic-locked-1",
        title: "Séance premium supplémentaire",
        subtitle: "Visible mais réservée à l’offre Premium",
        details: [],
        notes: "",
        done: false,
        locked: true,
        onToggleDone: () => undefined,
      },
    ],
  },
  {
    title: "Séance 5 — Renforcement avancé",
    duration: "45 min",
    locked: true,
    items: [
      {
        id: "basic-locked-2",
        title: "Séance premium supplémentaire",
        subtitle: "Débloquez plus de variété et de personnalisation",
        details: [],
        notes: "",
        done: false,
        locked: true,
        onToggleDone: () => undefined,
      },
    ],
  },
];

function todayIso() {
  return format(new Date(), "yyyy-MM-dd");
}

function doneKey(programId: string, date: string) {
  return `dfp:subscriber-sport-done:${programId}:${date}`;
}

function loadDone(programId: string, date: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(doneKey(programId, date)) ?? "[]"));
  } catch {
    return new Set();
  }
}

function saveDone(programId: string, date: string, set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(doneKey(programId, date), JSON.stringify([...set]));
  } catch {
    console.warn("Impossible d'enregistrer l'état local des séances.");
  }
}

function SportContent() {
  const { profile, user } = useAuth();
  const { rights, loading } = useAccessRights();

  const firstName = profile?.full_name?.split(" ")[0] ?? "vous";
  const hasAccess = rights?.access_sport_programs ?? false;
  const sportLimit = rights?.sport_session_limit ?? null;
  const isBasicLimited = typeof sportLimit === "number" && sportLimit > 0;
  const isPremiumLike = !!rights && !isBasicLimited && rights.access_sport_programs;

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
                    Bonjour {firstName}, retrouvez ici vos séances, vos documents et votre organisation sportive.
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
                    Cette page est visible, mais votre accès au module sport n’est pas activé.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                Contactez votre coach si cette option devait être incluse dans votre accompagnement.
              </div>
              <Button variant="outline" className="rounded-2xl" disabled>
                Désactivé par votre coach
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isBasicLimited) {
    const visibleSessions = BASIC_GENERIC_SESSIONS.map((session, index) => ({
      ...session,
      locked: index >= sportLimit,
      items: session.items.map((item) => ({
        ...item,
        locked: index >= sportLimit ? true : item.locked,
      })),
    }));

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
                    Bonjour {firstName}, votre formule inclut {sportLimit} séance{sportLimit > 1 ? "s" : ""}.
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
              subtitle="Version basic"
            />
            <InfoCard
              icon={<Clock3 className="h-5 w-5" />}
              title="Accès inclus"
              value={`${sportLimit} séance${sportLimit > 1 ? "s" : ""}`}
              subtitle="Les autres restent visibles mais verrouillées"
            />
            <InfoCard
              icon={<Sparkles className="h-5 w-5" />}
              title="Premium"
              value="Plus de variété"
              subtitle="Débloquez plus de séances personnalisées"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {visibleSessions.map((session) => (
              <SessionCard
                key={session.title}
                title={session.title}
                duration={session.duration}
                locked={session.locked}
                lockMessage={session.locked ? "Disponible dans Premium" : undefined}
                items={session.items}
              />
            ))}

            <DocumentsCard docs={[]} onOpen={handleOpenPdf} generic />
          </div>

          <Card className="rounded-3xl border shadow-sm">
            <CardHeader>
              <CardTitle>Passer à Premium</CardTitle>
              <CardDescription>
                Débloquez plus de séances, un programme sport plus complet et une personnalisation avancée.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="rounded-2xl" disabled>
                Disponible dans Premium
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
                  Bonjour {firstName}, retrouvez ici vos séances, vos documents et votre organisation sportive.
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
                  locked: false,
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
                    locked: false,
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
                    locked: false,
                    onToggleDone: () => undefined,
                  },
                ]}
              />
            </>
          )}

          <DocumentsCard docs={pdfDocs} onOpen={handleOpenPdf} />

          {!program?.notes ? (
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
                  locked: false,
                  onToggleDone: () => undefined,
                },
              ]}
            />
          ) : null}
        </div>

        <Card className="rounded-3xl border shadow-sm">
          <CardHeader>
            <CardTitle>Étape suivante</CardTitle>
            <CardDescription>
              Votre espace premium est prêt pour accueillir un vrai programme personnalisé et des documents réels.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="rounded-2xl" disabled>
              Programme premium prêt
            </Button>
          </CardContent>
        </Card>

        {program?.notes ? (
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
        ) : null}
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
  locked = false,
  lockMessage,
}: {
  title: string;
  duration: string;
  items: SessionItem[];
  locked?: boolean;
  lockMessage?: string;
}) {
  return (
    <Card className={`rounded-3xl border shadow-sm ${locked ? "opacity-75" : ""}`}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="flex items-center gap-2">
            {locked ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                {lockMessage ?? "Verrouillé"}
              </span>
            ) : null}
            <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {duration}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item) => {
            const itemLocked = locked || item.locked;

            return (
              <div
                key={item.id}
                className={`rounded-2xl px-3 py-3 ${
                  itemLocked
                    ? "border border-dashed bg-muted/30 opacity-80"
                    : item.done
                    ? "border border-[#6DB33F]/40 bg-[#6DB33F]/5"
                    : "bg-muted/30"
                }`}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div
                      className={`text-sm font-medium ${
                        itemLocked
                          ? "text-muted-foreground"
                          : item.done
                          ? "line-through text-muted-foreground"
                          : ""
                      }`}
                    >
                      {item.title}
                    </div>
                    <div className="text-xs text-muted-foreground">{item.subtitle}</div>
                  </div>

                  {!item.id.startsWith("generic-") &&
                  !item.id.startsWith("premium-empty-") &&
                  !itemLocked ? (
                    <Button
                      size="sm"
                      variant={item.done ? "default" : "outline"}
                      className={
                        item.done
                          ? "bg-[#6DB33F] text-white hover:bg-[#2D7A1F]"
                          : "rounded-xl"
                      }
                      onClick={item.onToggleDone}
                    >
                      <Check className="mr-1 h-4 w-4" />
                      {item.done ? "Terminée" : "Valider"}
                    </Button>
                  ) : itemLocked ? (
                    <Button size="sm" variant="outline" className="rounded-xl" disabled>
                      <Lock className="mr-1 h-4 w-4" />
                      Premium
                    </Button>
                  ) : null}
                </div>

                {item.details.length > 0 ? (
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
                ) : null}

                {item.notes ? (
                  <p className="mt-3 whitespace-pre-wrap text-xs text-muted-foreground">
                    {item.notes}
                  </p>
                ) : null}
              </div>
            );
          })}
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