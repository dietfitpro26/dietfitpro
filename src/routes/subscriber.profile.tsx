import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { differenceInYears, format } from "date-fns";
import {
  User,
  Mail,
  Phone,
  Ruler,
  Weight,
  Target,
  Shield,
  BadgeCheck,
} from "lucide-react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { SubscriberLayout } from "@/layouts/SubscriberLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/subscriber/profile")({
  head: () => ({ meta: [{ title: "Profil — DietFitPro" }] }),
  component: SubscriberProfilePage,
});

type Goal = "weight_loss" | "muscle_gain" | "maintenance" | "general_health";

type SubscriberDetails = {
  birth_date: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  target_weight_kg: number | null;
  phone: string | null;
  preferences: Record<string, unknown> | null;
};

type Measurement = {
  id: string;
  measured_at: string;
  weight_kg: number | null;
};

const GOAL_LABELS: Record<Goal, string> = {
  weight_loss: "Perte de poids",
  muscle_gain: "Prise de masse",
  maintenance: "Maintien",
  general_health: "Santé générale",
};

function SubscriberProfilePage() {
  return (
    <ProtectedRoute allow={["subscriber"]}>
      <SubscriberLayout>
        <SubscriberProfileContent />
      </SubscriberLayout>
    </ProtectedRoute>
  );
}

function SubscriberProfileContent() {
  const { user, profile } = useAuth();
  const [details, setDetails] = useState<SubscriberDetails | null | undefined>(undefined);
  const [measurements, setMeasurements] = useState<Measurement[] | null>(null);

  useEffect(() => {
    if (!user) return;

    void (async () => {
      const { data: subscriberData } = await supabase
        .from("subscribers")
        .select("birth_date, height_cm, weight_kg, target_weight_kg, phone, preferences")
        .eq("user_id", user.id)
        .maybeSingle();

      setDetails((subscriberData as SubscriberDetails | null) ?? null);

      const { data: measurementData } = await supabase
        .from("body_measurements")
        .select("id, measured_at, weight_kg")
        .eq("user_id", user.id)
        .order("measured_at", { ascending: true })
        .limit(60);

      setMeasurements((measurementData ?? []) as Measurement[]);
    })();
  }, [user]);

  const age =
    details?.birth_date ? differenceInYears(new Date(), new Date(details.birth_date)) : null;

  const goal = ((details?.preferences as { goal?: Goal } | null)?.goal ?? "general_health") as Goal;

  const chartData = useMemo(
    () =>
      (measurements ?? [])
        .filter((m) => m.weight_kg != null)
        .map((m) => ({
          date: format(new Date(m.measured_at), "dd/MM"),
          weight: Number(m.weight_kg),
        })),
    [measurements],
  );

  if (details === undefined) {
    return (
      <div className="p-4 sm:p-6">
        <div className="mx-auto max-w-4xl">
          <Skeleton className="h-40 w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-background to-muted/20 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <Card className="rounded-3xl border shadow-sm">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <User className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl sm:text-2xl">Profil</CardTitle>
                <CardDescription className="mt-1 text-sm sm:text-base">
                  Retrouvez ici vos informations personnelles, votre type de compte
                  et vos repères de suivi.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <InfoCard
            icon={<BadgeCheck className="h-5 w-5" />}
            label="Type de compte"
            value={profile?.role === "subscriber" ? "Abonné" : "Utilisateur"}
          />
          <InfoCard
            icon={<Mail className="h-5 w-5" />}
            label="Adresse e-mail"
            value={profile?.email ?? "—"}
          />
          <InfoCard
            icon={<User className="h-5 w-5" />}
            label="Nom complet"
            value={profile?.full_name ?? "—"}
          />
          <InfoCard
            icon={<Phone className="h-5 w-5" />}
            label="Téléphone"
            value={details?.phone ?? "—"}
          />
          <InfoCard
            icon={<Ruler className="h-5 w-5" />}
            label="Taille"
            value={details?.height_cm ? `${details.height_cm} cm` : "—"}
          />
          <InfoCard
            icon={<Weight className="h-5 w-5" />}
            label="Poids actuel"
            value={details?.weight_kg ? `${details.weight_kg} kg` : "—"}
          />
          <InfoCard
            icon={<Target className="h-5 w-5" />}
            label="Poids objectif"
            value={details?.target_weight_kg ? `${details.target_weight_kg} kg` : "—"}
          />
          <InfoCard
            icon={<Shield className="h-5 w-5" />}
            label="Objectif principal"
            value={GOAL_LABELS[goal]}
          />
        </div>

        <Card className="rounded-3xl border shadow-sm">
          <CardHeader>
            <CardTitle>Repères personnels</CardTitle>
            <CardDescription>
              Ces données pourront ensuite être enrichies ou verrouillées selon votre offre.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-muted/30 p-4">
              <div className="text-xs text-muted-foreground">Âge</div>
              <div className="mt-1 text-lg font-semibold">{age != null ? `${age} ans` : "—"}</div>
            </div>
            <div className="rounded-2xl bg-muted/30 p-4">
              <div className="text-xs text-muted-foreground">Plan</div>
              <div className="mt-1 text-lg font-semibold">{profile?.plan ?? "—"}</div>
            </div>
            <div className="rounded-2xl bg-muted/30 p-4">
              <div className="text-xs text-muted-foreground">Statut</div>
              <div className="mt-1 text-lg font-semibold">{profile?.subscription_status ?? "—"}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border shadow-sm">
          <CardHeader>
            <CardTitle>Évolution du poids</CardTitle>
            <CardDescription>
              Historique simple pour garder une expérience cohérente avec l’espace patient.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {measurements === null ? (
              <Skeleton className="h-48 w-full rounded-2xl" />
            ) : chartData.length === 0 ? (
              <div className="rounded-2xl bg-muted/30 p-4 text-sm text-muted-foreground">
                Aucune mesure enregistrée pour le moment.
              </div>
            ) : (
              <>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" fontSize={11} />
                      <YAxis domain={["auto", "auto"]} fontSize={11} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke="#6DB33F"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 rounded-2xl border">
                  <ul className="divide-y text-sm">
                    {[...(measurements ?? [])].reverse().map((m) => (
                      <li key={m.id} className="flex items-center justify-between px-4 py-3">
                        <span>{format(new Date(m.measured_at), "dd/MM/yyyy")}</span>
                        <span className="font-medium">
                          {m.weight_kg != null ? `${m.weight_kg} kg` : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border shadow-sm">
          <CardHeader>
            <CardTitle>Sécurité</CardTitle>
            <CardDescription>
              Cette zone servira ensuite à regrouper mot de passe, sécurité du compte et préférences.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="rounded-2xl">
              Gérer mes informations de compte
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="rounded-3xl border shadow-sm">
      <CardContent className="p-5">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-1 text-base font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}