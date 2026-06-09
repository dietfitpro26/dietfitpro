import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Video, Calendar as CalendarIcon, Target, Dumbbell, Utensils, ChevronRight } from "lucide-react";
import { PatientLayout } from "@/layouts/PatientLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/patient/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — DietFitPro" }] }),
  component: () => (
    <ProtectedRoute allow={["patient"]}>
      <PatientLayout><DashboardContent /></PatientLayout>
    </ProtectedRoute>
  ),
});

type Status = "scheduled" | "completed" | "cancelled" | "refunded" | "no_show";
type PayStatus = "pending" | "paid" | "refunded" | "partial_refund" | "failed";

interface Consultation {
  id: string;
  scheduled_at: string | null;
  duration_min: number | null;
  status: Status;
  payment_status: PayStatus;
  amount_cents: number | null;
  room_url: string | null;
  pro_id: string;
}

interface NutritionProgram {
  id: string;
  name: string;
  kcal_per_day: number | null;
  duration_weeks: number | null;
  is_active: boolean;
}

interface SportProgram {
  id: string;
  name: string;
  frequency_per_week: number | null;
  level: "debutant" | "intermediaire" | "avance" | null;
  is_active: boolean;
}

const STATUS_LABEL: Record<Status, string> = {
  scheduled: "Planifiée", completed: "Terminée", cancelled: "Annulée",
  refunded: "Remboursée", no_show: "Absent",
};

const LEVEL_LABEL: Record<string, string> = {
  debutant: "Débutant", intermediaire: "Intermédiaire", avance: "Avancé",
};

function DashboardContent() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [upcoming, setUpcoming] = useState<Consultation | null | undefined>(undefined);
  const [past, setPast] = useState<Consultation[] | null>(null);
  const [proName, setProName] = useState<string>("");

  // Fix 4 — programmes du pro
  const [nutritionPrograms, setNutritionPrograms] = useState<NutritionProgram[] | null>(null);
  const [sportPrograms, setSportPrograms] = useState<SportProgram[] | null>(null);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const nowIso = new Date().toISOString();

      // Récupérer le patient_id lié à ce user
      const { data: patientRow } = await supabase
        .from("patients")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const patientId = (patientRow as { id?: string } | null)?.id ?? null;

      const [upRes, histRes, nutriRes, sportRes] = await Promise.all([
        supabase.from("visio_consultations")
          .select("id, scheduled_at, duration_min, status, payment_status, amount_cents, room_url, pro_id")
          .eq("patient_user_id", user.id)
          .eq("status", "scheduled")
          .gte("scheduled_at", nowIso)
          .order("scheduled_at", { ascending: true })
          .limit(1),

        supabase.from("visio_consultations")
          .select("id, scheduled_at, duration_min, status, payment_status, amount_cents, room_url, pro_id")
          .eq("patient_user_id", user.id)
          .in("status", ["completed", "cancelled", "refunded", "no_show"])
          .order("scheduled_at", { ascending: false })
          .limit(10),

        patientId
          ? supabase.from("nutrition_programs")
              .select("id, name, kcal_per_day, duration_weeks, is_active")
              .eq("patient_id", patientId)
              .eq("is_active", true)
              .order("created_at", { ascending: false })
              .limit(3)
          : Promise.resolve({ data: [] }),

        patientId
          ? supabase.from("sport_programs")
              .select("id, name, frequency_per_week, level, is_active")
              .eq("patient_id", patientId)
              .eq("is_active", true)
              .order("created_at", { ascending: false })
              .limit(3)
          : Promise.resolve({ data: [] }),
      ]);

      const next = (upRes.data?.[0] as Consultation | undefined) ?? null;
      setUpcoming(next);

      if (next?.pro_id) {
        const { data: p } = await supabase.from("profiles").select("full_name").eq("id", next.pro_id).maybeSingle();
        setProName((p as { full_name?: string } | null)?.full_name ?? "");
      }

      setPast((histRes.data ?? []) as Consultation[]);
      setNutritionPrograms((nutriRes.data ?? []) as NutritionProgram[]);
      setSportPrograms((sportRes.data ?? []) as SportProgram[]);
    })();
  }, [user]);

  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Bonjour {firstName} 👋</h1>
        <p className="text-sm text-muted-foreground">Voici un aperçu de votre suivi.</p>
      </div>

      {/* Prochaine consultation */}
      <Card>
        <CardHeader><CardTitle className="text-base">Prochaine consultation</CardTitle></CardHeader>
        <CardContent>
          {upcoming === undefined ? (
            <Skeleton className="h-20 w-full" />
          ) : !upcoming ? (
            <p className="text-sm text-muted-foreground">Aucune consultation planifiée.</p>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <CalendarIcon className="h-4 w-4 text-[#6DB33F]" />
                  <span className="font-medium">
                    {upcoming.scheduled_at
                      ? format(new Date(upcoming.scheduled_at), "EEEE dd MMMM 'à' HH:mm", { locale: fr })
                      : "—"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {proName ? `Avec ${proName}` : "Avec votre praticien"} · {upcoming.duration_min ?? 30} min
                </p>
              </div>
              <Button
                className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white"
                onClick={() => {
                  if (upcoming.room_url) window.open(upcoming.room_url, "_blank", "noopener");
                  else navigate({ to: "/patient/consultations" });
                }}
              >
                <Video className="h-4 w-4" /> Rejoindre
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fix 4 — Plan nutritionnel actif */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Utensils className="h-4 w-4 text-[#6DB33F]" /> Mon plan nutritionnel
          </CardTitle>
          <Link to="/patient/nutrition" className="text-xs text-[#6DB33F] hover:underline flex items-center gap-0.5">
            Voir tout <ChevronRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {nutritionPrograms === null ? (
            <Skeleton className="h-16 w-full" />
          ) : nutritionPrograms.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun plan nutritionnel actif.</p>
          ) : (
            <ul className="divide-y">
              {nutritionPrograms.map((n) => (
                <li key={n.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{n.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {n.kcal_per_day ? `${n.kcal_per_day} kcal/j` : ""}
                      {n.kcal_per_day && n.duration_weeks ? " · " : ""}
                      {n.duration_weeks ? `${n.duration_weeks} semaines` : ""}
                    </p>
                  </div>
                  <span className="text-xs rounded-full bg-[#6DB33F]/15 text-[#2D7A1F] px-2 py-0.5 font-medium">
                    Actif
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Fix 4 — Programme sport actif */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-[#6DB33F]" /> Mon programme sport
          </CardTitle>
          <Link to="/patient/sport" className="text-xs text-[#6DB33F] hover:underline flex items-center gap-0.5">
            Voir tout <ChevronRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {sportPrograms === null ? (
            <Skeleton className="h-16 w-full" />
          ) : sportPrograms.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun programme sport actif.</p>
          ) : (
            <ul className="divide-y">
              {sportPrograms.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.frequency_per_week ? `${s.frequency_per_week}×/sem.` : ""}
                      {s.frequency_per_week && s.level ? " · " : ""}
                      {s.level ? LEVEL_LABEL[s.level] : ""}
                    </p>
                  </div>
                  <span className="text-xs rounded-full bg-[#6DB33F]/15 text-[#2D7A1F] px-2 py-0.5 font-medium">
                    Actif
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Raccourcis */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QuickCard icon={Utensils} label="Mon plan nutritionnel" to="/patient/nutrition" />
        <QuickCard icon={Dumbbell} label="Mon programme sport" to="/patient/sport" />
        <QuickCard icon={Target} label="Mes objectifs" to="/patient/profil" />
      </div>

      {/* Historique consultations */}
      <Card>
        <CardHeader><CardTitle className="text-base">Historique des consultations</CardTitle></CardHeader>
        <CardContent>
          {past === null ? (
            <Skeleton className="h-24 w-full" />
          ) : past.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune consultation passée.</p>
          ) : (
            <ul className="divide-y">
              {past.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <div className="font-medium">
                      {c.scheduled_at ? format(new Date(c.scheduled_at), "dd/MM/yyyy HH:mm") : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">{STATUS_LABEL[c.status]}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{c.amount_cents != null ? `${(c.amount_cents / 100).toFixed(2)} €` : "—"}</div>
                    <PaymentBadge status={c.payment_status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function QuickCard({ icon: Icon, label, to }: { icon: typeof Video; label: string; to: string }) {
  return (
    <Link to={to} className="block">
      <Card className="hover:bg-muted/40 transition-colors h-full">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-[#6DB33F]/10 text-[#6DB33F] flex items-center justify-center">
            <Icon className="h-5 w-5" />
          </div>
          <span className="text-sm font-medium">{label}</span>
        </CardContent>
      </Card>
    </Link>
  );
}

function PaymentBadge({ status }: { status: PayStatus }) {
  const label: Record<PayStatus, string> = {
    pending: "En attente", paid: "Payé", refunded: "Remboursé",
    partial_refund: "Remb. partiel", failed: "Échec",
  };
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
      status === "paid" && "bg-[#6DB33F]/15 text-[#2D7A1F]",
      status === "pending" && "bg-amber-100 text-amber-700",
      status === "refunded" && "bg-blue-100 text-blue-700",
      status === "partial_refund" && "bg-blue-100 text-blue-700",
      status === "failed" && "bg-red-100 text-red-700",
    )}>{label[status]}</span>
  );
}