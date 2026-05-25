import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, Dumbbell, Clock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { PatientLayout } from "@/layouts/PatientLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/patient/sport")({
  head: () => ({ meta: [{ title: "Mon programme sport — DietFitPro" }] }),
  component: () => (
    <ProtectedRoute allow={["patient"]}>
      <PatientLayout><Content /></PatientLayout>
    </ProtectedRoute>
  ),
});

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const LEVEL_LABEL: Record<string, string> = {
  debutant: "Débutant", intermediaire: "Intermédiaire", avance: "Avancé",
};

interface Exercise {
  id?: string; name: string; sets?: number | string; reps?: number | string;
  rest_sec?: number | string; notes?: string;
}
interface Session {
  id: string; name: string; day: string;
  duration_min: number; notes: string;
  exercises?: Exercise[];
}
interface Program {
  id: string; name: string; frequency_per_week: number | null;
  level: string | null; goal: string | null; notes: string | null;
  sessions: Session[];
}

function todayIso() { return format(new Date(), "yyyy-MM-dd"); }
function doneKey(programId: string, date: string) { return `dfp:sport-done:${programId}:${date}`; }
function loadDone(programId: string, date: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(doneKey(programId, date)) ?? "[]")); }
  catch { return new Set(); }
}
function saveDone(programId: string, date: string, set: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(doneKey(programId, date), JSON.stringify([...set]));
}

function Content() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [program, setProgram] = useState<Program | null | undefined>(undefined);
  const [proName, setProName] = useState<string>("");
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: pat } = await supabase
        .from("patients").select("id").eq("user_id", user.id).maybeSingle();
      const patientId = (pat as { id?: string } | null)?.id;
      if (!patientId) { setProgram(null); return; }
      const { data } = await supabase
        .from("sport_programs")
        .select("id, name, frequency_per_week, level, goal, notes, sessions, pro_id")
        .eq("patient_id", patientId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1);
      const row = data?.[0] as (Program & { pro_id?: string }) | undefined;
      if (!row) { setProgram(null); return; }
      const prog: Program = { ...row, sessions: Array.isArray(row.sessions) ? row.sessions : [] };
      setProgram(prog);
      setDone(loadDone(prog.id, todayIso()));
      if (row.pro_id) {
        const { data: p } = await supabase.from("profiles").select("full_name").eq("id", row.pro_id).maybeSingle();
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

  const toggleDone = (id: string) => {
    if (!program) return;
    const next = new Set(done);
    if (next.has(id)) next.delete(id); else next.add(id);
    setDone(next);
    saveDone(program.id, todayIso(), next);
  };

  if (program === undefined) {
    return <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /></div>;
  }

  const orderedDays = [...DAYS, "Autres"].filter((d) => grouped[d]?.length);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/patient/dashboard" })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Mon programme sport</h1>
      </div>

      {!program ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          <Dumbbell className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Aucun programme sportif actif. Votre praticien vous en assignera un prochainement.
        </CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{program.name}</CardTitle>
              {proName && <p className="text-xs text-muted-foreground">Assigné par {proName}</p>}
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 text-xs">
              {program.frequency_per_week != null && (
                <Badge>{program.frequency_per_week}×/semaine</Badge>
              )}
              {program.level && <Badge>{LEVEL_LABEL[program.level] ?? program.level}</Badge>}
              {program.goal && <Badge>{program.goal}</Badge>}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Aujourd'hui — {format(new Date(), "EEEE dd MMMM", { locale: fr })}
          </p>

          {orderedDays.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
              Aucune séance planifiée.
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {orderedDays.map((d) => (
                <Card key={d}>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{d}</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {grouped[d].map((s) => {
                      const isDone = done.has(s.id);
                      return (
                        <div
                          key={s.id}
                          className={cn(
                            "rounded-md border p-3 transition-colors",
                            isDone && "bg-[#6DB33F]/5 border-[#6DB33F]/40",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className={cn("font-medium text-sm", isDone && "line-through text-muted-foreground")}>
                                {s.name}
                              </div>
                              {s.duration_min > 0 && (
                                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> {s.duration_min} min
                                </div>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant={isDone ? "default" : "outline"}
                              className={cn(isDone && "bg-[#6DB33F] hover:bg-[#2D7A1F] text-white")}
                              onClick={() => toggleDone(s.id)}
                            >
                              <Check className="h-4 w-4" />
                              {isDone ? "Terminée" : "Séance terminée"}
                            </Button>
                          </div>

                          {Array.isArray(s.exercises) && s.exercises.length > 0 && (
                            <ul className="mt-3 space-y-1.5 border-t pt-3">
                              {s.exercises.map((ex, i) => (
                                <li key={ex.id ?? i} className="text-xs flex items-baseline justify-between gap-2">
                                  <span className="font-medium">{ex.name}</span>
                                  <span className="text-muted-foreground whitespace-nowrap">
                                    {ex.sets ? `${ex.sets} × ` : ""}{ex.reps ?? ""}
                                    {ex.rest_sec ? ` · ${ex.rest_sec}s` : ""}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}

                          {s.notes && (
                            <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">{s.notes}</p>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {program.notes && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Notes du praticien</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{program.notes}</p></CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[#6DB33F]/10 text-[#2D7A1F] px-2.5 py-0.5 font-medium">
      {children}
    </span>
  );
}
