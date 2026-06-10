import { createFileRoute } from "@tanstack/react-router";
import { SubscriberLayout } from "@/layouts/SubscriberLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { useAccessRights } from "@/hooks/useAccessRights";
import {
  UtensilsCrossed, Bike, BarChart2, MessageCircle,
  Video, Star, Lock, TrendingDown, Dumbbell, Scale, Heart
} from "lucide-react";

export const Route = createFileRoute("/home")({
  head: () => ({ meta: [{ title: "Accueil — DietFitPro" }] }),
  component: SubscriberHomePage,
});

// ── Helpers IMC ───────────────────────────────────────────
function getBMIInfo(bmi: number | null) {
  if (!bmi) return null;
  if (bmi < 18.5) return { label: "Insuffisance pondérale", color: "text-blue-500",   bg: "bg-blue-50 dark:bg-blue-900/20" };
  if (bmi < 25)   return { label: "Poids normal",           color: "text-green-600",  bg: "bg-green-50 dark:bg-green-900/20" };
  if (bmi < 30)   return { label: "Surpoids",               color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-900/20" };
  return           { label: "Obésité",                      color: "text-red-500",    bg: "bg-red-50 dark:bg-red-900/20" };
}

const GOAL_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  weight_loss:    { label: "Perte de poids",  icon: <TrendingDown className="h-4 w-4" /> },
  muscle_gain:    { label: "Prise de masse",  icon: <Dumbbell className="h-4 w-4" /> },
  maintenance:    { label: "Maintien",         icon: <Scale className="h-4 w-4" /> },
  general_health: { label: "Santé générale",  icon: <Heart className="h-4 w-4" /> },
};

// ── Carte section avec verrou si accès OFF ────────────────
function SectionCard({
  icon, title, description, hasAccess, children
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  hasAccess: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border p-5 transition-all ${
      hasAccess
        ? "bg-card hover:shadow-sm"
        : "bg-muted/30 opacity-70"
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={hasAccess ? "text-primary" : "text-muted-foreground"}>{icon}</span>
          <h3 className="font-semibold">{title}</h3>
        </div>
        {!hasAccess && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted rounded-full px-2 py-1">
            <Lock className="h-3 w-3" /> Accès restreint
          </span>
        )}
      </div>
      {hasAccess ? (
        children ?? <p className="text-sm text-muted-foreground">{description}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Cette fonctionnalité n'est pas activée sur votre compte.
          Contactez votre coach pour y accéder.
        </p>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────
function SubscriberHomePage() {
  return (
    <ProtectedRoute allow={["subscriber"]}>
      <SubscriberLayout>
        <HomeContent />
      </SubscriberLayout>
    </ProtectedRoute>
  );
}

function HomeContent() {
  const { profile } = useAuth();
  const { rights, loading } = useAccessRights();

  const firstName = profile?.full_name?.split(" ")[0] ?? "vous";
  const bmiInfo   = getBMIInfo(profile?.bmi ?? null);
  const goalInfo  = profile?.goal ? GOAL_LABELS[profile.goal] : null;

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">

      {/* ── Bloc de bienvenue ── */}
      <div className="rounded-xl border bg-card p-5">
        <h1 className="text-xl font-bold mb-1">
          Bonjour {firstName} 👋
        </h1>
        <p className="text-sm text-muted-foreground mb-4">
          Bienvenue sur votre espace DietFit Pro
        </p>

        {/* Objectif + IMC */}
        <div className="flex flex-wrap gap-3">
          {goalInfo && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-sm font-medium">
              {goalInfo.icon}
              {goalInfo.label}
            </span>
          )}
          {bmiInfo && profile?.bmi && (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${bmiInfo.bg} ${bmiInfo.color}`}>
              IMC {profile.bmi} · {bmiInfo.label}
            </span>
          )}
          {profile?.weight_kg && profile?.height_cm && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
              {profile.weight_kg} kg · {profile.height_cm} cm
            </span>
          )}
        </div>
      </div>

      {/* ── Sections avec contrôle d'accès ── */}
      <div className="space-y-4">

        <SectionCard
          icon={<UtensilsCrossed className="h-5 w-5" />}
          title="Mes Recettes"
          description="Découvrez des recettes adaptées à vos objectifs."
          hasAccess={rights?.access_recipes ?? false}
        >
          <p className="text-sm text-muted-foreground">
            Vos recettes personnalisées sont disponibles ici.
          </p>
        </SectionCard>

        <SectionCard
          icon={<BarChart2 className="h-5 w-5" />}
          title="Programmes Nutrition"
          description="Suivez votre programme alimentaire personnalisé."
          hasAccess={rights?.access_nutrition_programs ?? false}
        >
          <p className="text-sm text-muted-foreground">
            Votre programme nutrition est en cours de préparation.
          </p>
        </SectionCard>

        <SectionCard
          icon={<Bike className="h-5 w-5" />}
          title="Programmes Sport"
          description="Accédez à vos séances d'entraînement."
          hasAccess={rights?.access_sport_programs ?? false}
        >
          <p className="text-sm text-muted-foreground">
            Vos programmes sportifs seront disponibles ici.
          </p>
        </SectionCard>

        <SectionCard
          icon={<MessageCircle className="h-5 w-5" />}
          title="Messagerie Coach"
          description="Échangez directement avec votre coach."
          hasAccess={rights?.access_messaging ?? false}
        >
          <p className="text-sm text-muted-foreground">
            Envoyez un message à votre coach depuis ici.
          </p>
        </SectionCard>

        <SectionCard
          icon={<Video className="h-5 w-5" />}
          title="Consultations Vidéo"
          description="Planifiez vos consultations en visio."
          hasAccess={rights?.access_visio ?? false}
        >
          <p className="text-sm text-muted-foreground">
            Réservez votre prochaine consultation vidéo.
          </p>
        </SectionCard>

        <SectionCard
          icon={<Star className="h-5 w-5" />}
          title="Contenu Premium"
          description="Accédez aux contenus exclusifs de votre coach."
          hasAccess={rights?.access_premium_content ?? false}
        >
          <p className="text-sm text-muted-foreground">
            Les contenus exclusifs de votre coach apparaîtront ici.
          </p>
        </SectionCard>

      </div>
    </div>
  );
}