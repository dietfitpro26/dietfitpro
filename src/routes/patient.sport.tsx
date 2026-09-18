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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

type PatientDocument = {
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
  const { user, profile } = useAuth();
  const userId = user?.id ?? null;
  const isPremium = profile?.plan === "premium";

  const [loading, setLoading] = useState(true);
  const [savingDay, setSavingDay] = useState<string | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [exercisesByProgram, setExercisesByProgram] = useState<
    Record<string, Exercise[]>
  >({});
  const [schedule, setSchedule] = useState<ScheduleItem[]>(
    DAYS.map((day) => ({ day, programId: null }))
  );
  const [docs, setDocs] = useState<PatientDocument[]>([]);
  const [proName, setProName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadSportData() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const tiers: Array<"basic" | "premium"> = isPremium
          ? ["basic", "premium"]
          : ["basic"];

        const [programsResponse, scheduleResponse, documentsResponse] =
          await Promise.all([
            supabase
              .from("sport_programs")
              .select(
                "id, name, tier, location, level, duration_min, frequency_per_week, description, is_active"
              )
              .in("tier", tiers)
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
              .from("patient_documents")
              .select("id, title, file_url, file_name")
              .eq("patient_id", userId)
              .eq("category", "sport")
              .order("created_at", { ascending: false }),
          ]);

        if (programsResponse.error) {
          throw programsResponse.error;
        }

        const loadedPrograms = (programsResponse.data ?? []) as Program[];

        if (!cancelled) {
          setPrograms(loadedPrograms);
          setDocs((documentsResponse.data ?? []) as PatientDocument[]);
          setSchedule(
            DAYS.map((day) => {
              const row = scheduleResponse.data?.find(
                (item) => item.day_of_week === day
              );

              return {
                day,
                programId: row?.program_id ?? null,
              };
            })
          );
        }

        if (scheduleResponse.error) {
          console.error("Erreur planning patient :", scheduleResponse.error);
        }

        if (documentsResponse.error) {
          console.error("Erreur documents patient :", documentsResponse.error);
        }

        if (loadedPrograms.length > 0) {
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
            console.error("Erreur exercices patient :", exercisesError);
          }

          if (!cancelled) {
            const grouped: Record<string, Exercise[]> = {};

            for (const exercise of exercisesData ?? []) {
              const typedExercise = exercise as Exercise;
              grouped[typedExercise.program_id] ??= [];
              grouped[typedExercise.program_id].push(typedExercise);
            }

            setExercisesByProgram(grouped);
          }
        }

        if (profile?.pro_id) {
          const { data: proProfile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", profile.pro_id)
            .maybeSingle();

          if (!cancelled) {
            setProName(
              (proProfile as { full_name?: string } | null)?.full_name ?? ""
            );
          }
        }
      } catch (error) {
        console.error("Erreur chargement Sport patient :", error);

        if (!cancelled) {
          setErrorMessage(
            "Impossible de charger vos programmes Sport pour le moment."
          );
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
  }, [userId, isPremium, profile?.pro_id]);

  const basicPrograms = useMemo(
    () => programs.filter((program) => program.tier === "basic"),
    [programs]
  );

  const premiumPrograms = useMemo(
    () => programs.filter((program) => program.tier === "premium"),
    [programs]
  );

  const updateDayProgram = async (
    day: string,
    selectedValue: string
  ) => {
    if (!userId) return;

    const programId =
      selectedValue === NO_PROGRAM_VALUE ? null : selectedValue;
    const previousSchedule = schedule;

    setSchedule((current) =>
      current.map((item) =>
        item.day === day ? { ...item, programId } : item
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

        if (error) throw error;
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
          { onConflict: "user_id,day_of_week" }
        );

      if (error) throw error;
    } catch (error) {
      console.error("Erreur sauvegarde planning patient :", error);
      setSchedule(previousSchedule);
      alert("Impossible d'enregistrer ce jour de sport.");
    } finally {
      setSavingDay(null);
    }
  };

  const handleOpenPdf = async (filePath: string) => {
    const { data, error } = await supabase.storage
      .from("message-attachments")
      .createSignedUrl(filePath, 3600);

    if (error || !data?.signedUrl) {
      alert("Impossible d'ouvrir le document, réessayez.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="h-32 animate-pulse rounded-3xl bg-muted" />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="h-40 animate-pulse rounded-3xl bg-muted" />
            <div className="h-40 animate-pulse rounded-3xl bg-muted" />
            <div className="h-40 animate-pulse rounded-3xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="p-4 sm:p-6">
        <Card className="mx-auto max-w-5xl rounded-3xl border shadow-sm">
          <CardHeader>
            <CardTitle>Sport</CardTitle>
            <CardDescription>{errorMessage}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const plannedDays = schedule.filter((item) => item.programId).length;

  return (
    <div className="min-h-full bg-gradient-to-b from-background to-muted/20 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card className="rounded-3xl border shadow-sm">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Dumbbell className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl sm:text-2xl">Sport</CardTitle>
                <CardDescription className="mt-1 text-sm sm:text-base">
                  Bonjour {profile?.full_name?.split(" ")[0] ?? "vous"}, voici
                  vos programmes et votre planning sportif.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <InfoCard
            icon={<Target className="h-5 w-5" />}
            title="Programmes disponibles"
            value={`${programs.length} programme${programs.length > 1 ? "s" : ""}`}
            subtitle={isPremium ? "3 Basic + 6 Premium" : "3 programmes Basic"}
          />
          <InfoCard
            icon={<Clock3 className="h-5 w-5" />}
            title="Ton planning"
            value={`${plannedDays} jour${plannedDays > 1 ? "s" : ""}`}
            subtitle="Programme choisi par jour"
          />
          <InfoCard
            icon={<FileText className="h-5 w-5" />}
            title="Documents"
            value={`${docs.length} PDF`}
            subtitle={proName ? `Suivi par ${proName}` : "Documents sportifs"}
          />
        </div>

        {!isPremium ? (
          <Card className="rounded-3xl border border-primary/20 bg-primary/5 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-base">Formule Basic</CardTitle>
                  <CardDescription>
                    Votre professionnel peut activer Premium pour débloquer les
                    6 programmes supplémentaires.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        ) : null}

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Ton planning de la semaine</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choisis le programme que tu souhaites réaliser chaque jour.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {DAYS.map((day) => {
              const daySchedule = schedule.find((item) => item.day === day);
              const selectedProgram = daySchedule?.programId
                ? programs.find(
                    (program) => program.id === daySchedule.programId
                  )
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
                      value={daySchedule?.programId ?? NO_PROGRAM_VALUE}
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
                        {programs.map((program) => (
                          <SelectItem key={program.id} value={program.id}>
                            {program.name} · {program.tier === "premium" ? "Premium" : "Basic"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Bibliothèque Sport</h2>

          <ProgramSection
            title="Programmes Basic"
            programs={basicPrograms}
            exercisesByProgram={exercisesByProgram}
          />

          {isPremium && premiumPrograms.length > 0 ? (
            <ProgramSection
              title="Programmes Premium"
              programs={premiumPrograms}
              exercisesByProgram={exercisesByProgram}
              premium
            />
          ) : null}
        </section>

        <DocumentsCard docs={docs} onOpen={handleOpenPdf} />

        <Card className="rounded-3xl border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Conseil de sécurité</CardTitle>
            <CardDescription>
              Pour une pratique progressive et adaptée.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Arrêtez l’exercice en cas de douleur, de malaise,
              d’essoufflement inhabituel ou de vertige. Demandez l’avis d’un
              professionnel de santé avant de reprendre une activité sportive.
            </p>
          </CardContent>
        </Card>
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

function ProgramSection({
  title,
  programs,
  exercisesByProgram,
  premium = false,
}: {
  title: string;
  programs: Program[];
  exercisesByProgram: Record<string, Exercise[]>;
  premium?: boolean;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-base font-medium">{title}</h3>
      <div className="grid gap-4 lg:grid-cols-2">
        {programs.map((program) => (
          <ProgramCard
            key={program.id}
            program={program}
            exercises={exercisesByProgram[program.id] ?? []}
            premium={premium}
          />
        ))}
      </div>
    </div>
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
              {program.description ?? "Programme de renforcement progressif."}
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
                  <div>
                    <p className="text-sm font-medium">
                      {exercise.order_index}. {exercise.name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {EXERCISE_TYPE_LABEL[exercise.type] ?? exercise.type}
                    </p>
                  </div>

                  {exercise.reps ? (
                    <span className="rounded-full bg-background px-2 py-1 text-xs text-muted-foreground">
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
            Aucun exercice détaillé disponible pour le moment.
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
  docs: PatientDocument[];
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