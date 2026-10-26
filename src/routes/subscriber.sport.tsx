import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Clock3,
  Download,
  Dumbbell,
  FileText,
  Lock,
  Sparkles,
  Target,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

type Program = {
  id: string;
  name: string;
  tier: "basic" | "premium";
  location: "home" | "gym";
  level: "beginner" | "intermediate";
  duration_min: number;
  frequency_per_week: number;
  description: string | null;
  is_active: boolean;
};

type Exercise = {
  id: string;
  program_id: string;
  order_index: number;
  name: string;
  type: "warmup" | "strength" | "cardio" | "core" | "cooldown";
  sets: number | null;
  reps: string | null;
  rest_sec: number | null;
  notes: string | null;
};

type ScheduleItem = {
  day: string;
  programId: string | null;
};

type SubscriberDocument = {
  id: string;
  title: string | null;
  file_url: string;
  file_name: string | null;
};

const DAYS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
];

const NO_PROGRAM_VALUE = "__no_program__";

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Débutant",
  intermediate: "Intermédiaire",
};

const LOCATION_LABEL: Record<string, string> = {
  home: "Maison",
  gym: "Salle",
};

const EXERCISE_TYPE_LABEL: Record<string, string> = {
  warmup: "Échauffement",
  strength: "Renforcement",
  cardio: "Cardio",
  core: "Gainage",
  cooldown: "Retour au calme",
};

function SportContent() {
  const { profile, user } = useAuth();
  const { rights, loading: accessLoading } = useAccessRights();

  const firstName = profile?.full_name?.split(" ")[0] ?? "vous";
  const userId = user?.id ?? null;
  const hasAccess = rights?.access_sport_programs ?? false;

  const sportLimit = rights?.sport_session_limit ?? null;

  const isBasicLimited =
    typeof sportLimit === "number" && sportLimit > 0;

  const isPremiumLike =
    Boolean(rights) &&
    !isBasicLimited &&
    Boolean(rights?.access_sport_programs);

  const [loading, setLoading] = useState(true);
  const [savingDay, setSavingDay] = useState<string | null>(null);

  const [programs, setPrograms] = useState<Program[]>([]);
  const [exercisesByProgram, setExercisesByProgram] = useState<
    Record<string, Exercise[]>
  >({});

  const [schedule, setSchedule] = useState<ScheduleItem[]>(
    DAYS.map((day) => ({
      day,
      programId: null,
    }))
  );

  const [docs, setDocs] = useState<SubscriberDocument[]>([]);

  useEffect(() => {
    if (!userId || !hasAccess) {
      setPrograms([]);
      setExercisesByProgram({});
      setSchedule(
        DAYS.map((day) => ({
          day,
          programId: null,
        }))
      );
      setDocs([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadSportData() {
      setLoading(true);

      const requestedTiers: Array<"basic" | "premium"> = isPremiumLike
        ? ["basic", "premium"]
        : ["basic"];

      try {
        const [
          programsResponse,
          scheduleResponse,
          documentsResponse,
        ] = await Promise.all([
          supabase
            .from("sport_programs")
            .select(
              "id, name, tier, location, level, duration_min, frequency_per_week, description, is_active"
            )
            .in("tier", requestedTiers)
            .eq("is_active", true)
            .order("tier", { ascending: true })
            .order("location", { ascending: true })
            .order("level", { ascending: true })
            .order("name", { ascending: true }),

          supabase
            .from("user_sport_schedule")
            .select("day_of_week, program_id")
            .eq("user_id", userId)
            .eq("is_active", true),

          supabase
            .from("subscriber_documents")
            .select("id, title, file_url, file_name")
            .eq("user_id", userId)
            .eq("category", "sport")
            .order("created_at", { ascending: false }),
        ]);

        if (programsResponse.error) {
          throw programsResponse.error;
        }

        if (scheduleResponse.error) {
          console.error(
            "Erreur chargement planning Sport :",
            scheduleResponse.error
          );
        }

        if (documentsResponse.error) {
          console.error(
            "Erreur chargement documents Sport :",
            documentsResponse.error
          );
        }

        const loadedPrograms = (programsResponse.data ?? []) as Program[];

        if (!cancelled) {
          setPrograms(loadedPrograms);

          setDocs(
            (documentsResponse.data ?? []) as SubscriberDocument[]
          );

          setSchedule(
            DAYS.map((day) => {
              const scheduled = scheduleResponse.data?.find(
                (item) => item.day_of_week === day
              );

              return {
                day,
                programId: scheduled?.program_id ?? null,
              };
            })
          );
        }

        if (loadedPrograms.length === 0) {
          if (!cancelled) {
            setExercisesByProgram({});
          }
          return;
        }

        const programIds = loadedPrograms.map((program) => program.id);

        const { data: exercisesData, error: exercisesError } =
          await supabase
            .from("sport_exercises")
            .select(
              "id, program_id, order_index, name, type, sets, reps, rest_sec, notes"
            )
            .in("program_id", programIds)
            .order("program_id", { ascending: true })
            .order("order_index", { ascending: true });

        if (exercisesError) {
          console.error(
            "Erreur chargement exercices Sport :",
            exercisesError
          );

          if (!cancelled) {
            setExercisesByProgram({});
          }

          return;
        }

        if (!cancelled) {
          const groupedExercises: Record<string, Exercise[]> = {};

          for (const exercise of exercisesData ?? []) {
            const typedExercise = exercise as Exercise;

            if (!groupedExercises[typedExercise.program_id]) {
              groupedExercises[typedExercise.program_id] = [];
            }

            groupedExercises[typedExercise.program_id].push(
              typedExercise
            );
          }

          setExercisesByProgram(groupedExercises);
        }
      } catch (error) {
        console.error("Erreur chargement bibliothèque Sport :", error);

        if (!cancelled) {
          setPrograms([]);
          setExercisesByProgram({});
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSportData();

    return () => {
      cancelled = true;
    };
  }, [userId, hasAccess, isPremiumLike]);

  const displayedPrograms = useMemo(() => {
    if (isPremiumLike) {
      return programs;
    }

    return programs.filter((program) => program.tier === "basic");
  }, [isPremiumLike, programs]);

  const basicPrograms = useMemo(
    () =>
      displayedPrograms.filter(
        (program) => program.tier === "basic"
      ),
    [displayedPrograms]
  );

  const premiumPrograms = useMemo(
    () =>
      displayedPrograms.filter(
        (program) => program.tier === "premium"
      ),
    [displayedPrograms]
  );

  const plannedDays = schedule.filter(
    (item) => item.programId !== null
  ).length;

  const updateDayProgram = async (
    day: string,
    selectedValue: string
  ) => {
    if (!userId) {
      return;
    }

    const programId =
      selectedValue === NO_PROGRAM_VALUE ? null : selectedValue;

    const previousSchedule = schedule;

    setSchedule((current) =>
      current.map((item) =>
        item.day === day
          ? {
              ...item,
              programId,
            }
          : item
      )
    );

    setSavingDay(day);

    try {
      if (!programId) {
        const { error } = await supabase
          .from("user_sport_schedule")
          .delete()
          .eq("user_id", userId)
          .eq("day_of_week", day);

        if (error) {
          throw error;
        }

        return;
      }

      const { error } = await supabase
        .from("user_sport_schedule")
        .upsert(
          {
            user_id: userId,
            day_of_week: day,
            program_id: programId,
            is_active: true,
          },
          {
            onConflict: "user_id,day_of_week",
          }
        );

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error("Erreur sauvegarde planning Sport :", error);

      setSchedule(previousSchedule);

      alert(
        "Impossible d'enregistrer votre planning. Vérifiez votre connexion puis réessayez."
      );
    } finally {
      setSavingDay(null);
    }
  };

  const handleOpenPdf = async (filePath: string) => {
    const { data, error } = await supabase.storage
      .from("message-attachments")
      .createSignedUrl(filePath, 3600);

    if (error || !data?.signedUrl) {
      console.error("Erreur ouverture PDF :", error);

      alert("Impossible d'ouvrir le document, réessayez.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  if (accessLoading || loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="mx-auto max-w-6xl space-y-4">
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
          <PageHeader
            firstName={firstName}
            description="Retrouvez ici vos séances, votre planning et vos documents sportifs."
          />

          <Card className="rounded-3xl border shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Lock className="h-5 w-5" />
                </div>

                <div>
                  <CardTitle>Module Sport verrouillé</CardTitle>

                  <CardDescription>
                    Cette page est visible, mais votre accès au module Sport
                    n’est pas activé.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="rounded-2xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                Contactez votre coach si cette option devait être incluse dans
                votre accompagnement.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-background to-muted/20 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          firstName={firstName}
          description={
            isPremiumLike
              ? "Votre bibliothèque Premium, votre planning et vos documents sportifs."
              : "Vos 3 programmes Basic, votre planning et vos documents sportifs."
          }
        />

        <div className="grid gap-4 md:grid-cols-3">
          <InfoCard
            icon={<Target className="h-5 w-5" />}
            title="Programmes disponibles"
            value={`${displayedPrograms.length} programme${
              displayedPrograms.length > 1 ? "s" : ""
            }`}
            subtitle={
              isPremiumLike
                ? "3 Basic + 6 Premium"
                : "3 programmes maison débutant"
            }
          />

          <InfoCard
            icon={<Clock3 className="h-5 w-5" />}
            title="Ton planning"
            value={`${plannedDays} jour${
              plannedDays > 1 ? "s" : ""
            }`}
            subtitle="Programme choisi par jour"
          />

          <InfoCard
            icon={<FileText className="h-5 w-5" />}
            title="Documents"
            value={`${docs.length} PDF`}
            subtitle="Documents liés au sport"
          />
        </div>

        {!isPremiumLike ? (
          <Card className="rounded-3xl border border-primary/20 bg-primary/5 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>

                <div>
                  <CardTitle className="text-base">
                    Passez à Premium
                  </CardTitle>

                  <CardDescription>
                    Débloquez 6 programmes supplémentaires : maison
                    intermédiaire et salle de sport.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        ) : null}

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">
              Ton planning de la semaine
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Choisis le programme que tu souhaites réaliser chaque jour. Tu
              peux laisser un jour vide.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {DAYS.map((day) => {
              const daySchedule = schedule.find(
                (item) => item.day === day
              );

              const selectedProgram = daySchedule?.programId
                ? displayedPrograms.find(
                    (program) => program.id === daySchedule.programId
                  ) ?? null
                : null;

              return (
                <Card key={day} className="rounded-3xl border shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{day}</CardTitle>

                    <CardDescription>
                      {selectedProgram
                        ? `${selectedProgram.name} · ${selectedProgram.duration_min} min`
                        : "Jour de repos ou programme non défini"}
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    <Select
                      value={
                        daySchedule?.programId ?? NO_PROGRAM_VALUE
                      }
                      onValueChange={(value) =>
                        void updateDayProgram(day, value)
                      }
                      disabled={savingDay === day}
                    >
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue placeholder="Sélectionner un programme" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value={NO_PROGRAM_VALUE}>
                          Aucun programme / repos
                        </SelectItem>

                        {displayedPrograms.map((program) => (
                          <SelectItem key={program.id} value={program.id}>
                            {program.name} ·{" "}
                            {program.tier === "premium"
                              ? "Premium"
                              : "Basic"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {savingDay === day ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Enregistrement…
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">
              {isPremiumLike
                ? "Bibliothèque de programmes"
                : "Bibliothèque Basic"}
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Consulte le détail des programmes accessibles et ajoute-les à ton
              planning.
            </p>
          </div>

          {basicPrograms.length > 0 ? (
            <>
              {isPremiumLike ? (
                <h3 className="text-base font-medium">
                  Programmes Basic
                </h3>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                {basicPrograms.map((program) => (
                  <ProgramCard
                    key={program.id}
                    program={program}
                    exercises={exercisesByProgram[program.id] ?? []}
                  />
                ))}
              </div>
            </>
          ) : null}

          {isPremiumLike && premiumPrograms.length > 0 ? (
            <>
              <h3 className="pt-2 text-base font-medium">
                Programmes Premium
              </h3>

              <div className="grid gap-4 lg:grid-cols-2">
                {premiumPrograms.map((program) => (
                  <ProgramCard
                    key={program.id}
                    program={program}
                    exercises={exercisesByProgram[program.id] ?? []}
                    premium
                  />
                ))}
              </div>
            </>
          ) : null}

          {displayedPrograms.length === 0 ? (
            <Card className="rounded-3xl border shadow-sm">
              <CardContent className="p-5 text-sm text-muted-foreground">
                Aucun programme n’est disponible pour le moment.
              </CardContent>
            </Card>
          ) : null}
        </section>

        <DocumentsCard docs={docs} onOpen={handleOpenPdf} />

        <Card className="rounded-3xl border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">
              Conseil de sécurité
            </CardTitle>

            <CardDescription>
              Pour une pratique progressive et adaptée.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <p className="text-sm text-muted-foreground">
              Arrêtez l’exercice en cas de douleur, de malaise,
              d’essoufflement inhabituel ou de vertige. Demandez l’avis d’un
              professionnel de santé avant de reprendre une activité sportive
              après une blessure, une maladie ou une longue période
              d’inactivité.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PageHeader({
  firstName,
  description,
}: {
  firstName: string;
  description: string;
}) {
  return (
    <Card className="rounded-3xl border shadow-sm">
      <CardHeader className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Dumbbell className="h-6 w-6" />
          </div>

          <div>
            <CardTitle className="text-xl sm:text-2xl">Sport</CardTitle>

            <CardDescription className="mt-1 text-sm sm:text-base">
              Bonjour {firstName}, {description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
    </Card>
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

        <div className="mt-1 text-xs text-muted-foreground">
          {subtitle}
        </div>
      </CardContent>
    </Card>
  );
}

function ProgramCard({
  program,
  exercises,
  premium = false,
}: {
  program: Program;
  exercises: Exercise[];
  premium?: boolean;
}) {
  return (
    <Card className="rounded-3xl border shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{program.name}</CardTitle>

            <CardDescription className="mt-1">
              {program.description ??
                "Programme de renforcement progressif."}
            </CardDescription>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              premium
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {premium ? "Premium" : "Basic"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            {LOCATION_LABEL[program.location] ?? program.location}
          </span>

          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            {LEVEL_LABEL[program.level] ?? program.level}
          </span>

          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            {program.duration_min} min
          </span>

          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            {program.frequency_per_week}x / semaine
          </span>
        </div>
      </CardHeader>

      <CardContent>
        {exercises.length > 0 ? (
          <div className="space-y-3">
            {exercises.map((exercise) => (
              <div
                key={exercise.id}
                className="rounded-2xl bg-muted/30 px-3 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {exercise.order_index}. {exercise.name}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {EXERCISE_TYPE_LABEL[exercise.type] ?? exercise.type}
                    </p>
                  </div>

                  {exercise.reps ? (
                    <span className="shrink-0 rounded-full bg-background px-2 py-1 text-xs text-muted-foreground">
                      {exercise.sets ? `${exercise.sets} × ` : ""}
                      {exercise.reps}
                    </span>
                  ) : null}
                </div>

                {exercise.rest_sec ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Repos : {exercise.rest_sec} sec
                  </p>
                ) : null}

                {exercise.notes ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {exercise.notes}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
            Les exercices détaillés seront ajoutés prochainement.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DocumentsCard({
  docs,
  onOpen,
}: {
  docs: SubscriberDocument[];
  onOpen: (filePath: string) => void;
}) {
  return (
    <Card className="rounded-3xl border shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Documents</CardTitle>

            <CardDescription>
              Fiches et documents PDF liés à votre suivi sportif.
            </CardDescription>
          </div>

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
                    {doc.title ?? doc.file_name ?? "Document sport"}
                  </div>
                </div>

                <Button
                  size="sm"
                  className="rounded-xl"
                  onClick={() => void onOpen(doc.file_url)}
                >
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