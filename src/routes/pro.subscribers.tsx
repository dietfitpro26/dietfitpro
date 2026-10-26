import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ProLayout } from "@/layouts/ProLayout";
import {
  UserCheck,
  Search,
  SlidersHorizontal,
  TrendingDown,
  Dumbbell,
  Scale,
  Heart,
  ChevronDown,
  ChevronUp,
  UtensilsCrossed,
  Bike,
  MessageCircle,
  Video,
  BarChart2,
  Star,
  Loader2,
  Trash2,
  CreditCard,
} from "lucide-react";


import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useBillingEnabled } from "@/hooks/useAccessState";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubscriberDocumentsManager } from "@/components/subscribers/SubscriberDocumentsManager";


export const Route = createFileRoute("/pro/subscribers")({
  component: Page,
});


type SubscriberPlan =
  | "basic"
  | "premium"
  | "visio"
  | "patient"
  | null;


type Subscriber = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  plan: SubscriberPlan;
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number | null;
  goal: string | null;
  created_at: string;
};


type BillingRow = {
  user_id: string;
  status: string;
  billing_plan: string | null;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  managed_by_pro: boolean;
  stripe_subscription_id: string | null;
};


type Overrides = Record<string, boolean>;


type FeatureItem = {
  key: string;
  label: string;
  icon: ReactNode;
};


const FEATURES: FeatureItem[] = [
  {
    key: "access_recipes",
    label: "Recettes",
    icon: <UtensilsCrossed className="h-3.5 w-3.5" />,
  },
  {
    key: "access_sport_programs",
    label: "Programmes sport",
    icon: <Bike className="h-3.5 w-3.5" />,
  },
  {
    key: "access_nutrition_programs",
    label: "Programmes nutrition",
    icon: <BarChart2 className="h-3.5 w-3.5" />,
  },
  {
    key: "access_messaging",
    label: "Messagerie coach",
    icon: <MessageCircle className="h-3.5 w-3.5" />,
  },
  {
    key: "access_visio",
    label: "Visio",
    icon: <Video className="h-3.5 w-3.5" />,
  },
  {
    key: "access_premium_content",
    label: "Contenu premium",
    icon: <Star className="h-3.5 w-3.5" />,
  },
];


// Les objectifs sont enregistrés sous les valeurs de l'inscription (perte_de_poids, etc.).
const GOAL_MAP: Record<
  string,
  {
    label: string;
    icon: ReactNode;
    color: string;
  }
> = {
  perte_de_poids: {
    label: "Perte de poids",
    icon: <TrendingDown className="h-3 w-3" />,
    color:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  prise_de_masse: {
    label: "Prise de masse",
    icon: <Dumbbell className="h-3 w-3" />,
    color:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  maintien: {
    label: "Maintien",
    icon: <Scale className="h-3 w-3" />,
    color:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
  equilibre: {
    label: "Santé générale",
    icon: <Heart className="h-3 w-3" />,
    color:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
};


// Anciennes valeurs encore présentes dans certains comptes.
const LEGACY_GOALS: Record<string, string> = {
  weight_loss: "perte_de_poids",
  muscle_gain: "prise_de_masse",
  maintenance: "maintien",
  general_health: "equilibre",
};


function normalizeGoal(goal: string | null): string | null {
  if (!goal) return null;
  return LEGACY_GOALS[goal] ?? goal;
}


function getBMIInfo(bmi: number | null) {
  if (!bmi) {
    return {
      label: "—",
      color: "text-muted-foreground",
    };
  }


  if (bmi < 18.5) {
    return {
      label: `${bmi} · Insuffisance`,
      color: "text-blue-500",
    };
  }


  if (bmi < 25) {
    return {
      label: `${bmi} · Normal ✅`,
      color: "text-green-600",
    };
  }


  if (bmi < 30) {
    return {
      label: `${bmi} · Surpoids`,
      color: "text-orange-500",
    };
  }


  return {
    label: `${bmi} · Obésité`,
    color: "text-red-500",
  };
}


function getPlanBadge(plan: SubscriberPlan) {
  if (plan === "premium") {
    return (
      <Badge className="border-0 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
        ⭐ Premium
      </Badge>
    );
  }


  if (plan === "visio") {
    return (
      <Badge className="border-0 bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300">
        Visio
      </Badge>
    );
  }


  return <Badge variant="secondary">Basic</Badge>;
}


function getBillingBadge(billing: BillingRow | undefined, billingEnabled: boolean) {
  if (billing?.managed_by_pro) {
    return (
      <Badge className="border-0 bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300">
        Géré par vous
      </Badge>
    );
  }


  const status = billing?.status ?? "none";


  if (status === "trialing") {
    return (
      <Badge className="border-0 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
        Essai gratuit
      </Badge>
    );
  }


  if (status === "active") {
    return (
      <Badge className="border-0 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
        {billing?.cancel_at_period_end ? "Actif · fin prévue" : "Abonnement actif"}
      </Badge>
    );
  }


  if (status === "past_due") {
    return (
      <Badge className="border-0 bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
        Paiement en retard
      </Badge>
    );
  }


  if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") {
    return (
      <Badge className="border-0 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
        Suspendu
      </Badge>
    );
  }


  return <Badge variant="outline">{billingEnabled ? "Sans abonnement" : "Paiement désactivé"}</Badge>;
}


function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}


function getErrorMessage(error: unknown, data: unknown): string {
  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data
  ) {
    const serverError = (data as { error?: unknown }).error;


    if (typeof serverError === "string") {
      return serverError;
    }
  }


  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    const message = (error as { message?: unknown }).message;


    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }


  if (error instanceof Error && error.message) {
    return error.message;
  }


  return "Erreur inconnue lors de la suppression.";
}


function Toggle({
  enabled,
  onChange,
  loading,
}: {
  enabled: boolean;
  onChange: () => void;
  loading: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={loading}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        enabled ? "bg-primary" : "bg-muted-foreground/30"
      } ${loading ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
      aria-label={
        enabled ? "Désactiver l'accès" : "Activer l'accès"
      }
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          enabled ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}


function BillingPanel({
  subscriberId,
  displayName,
  billing,
  billingEnabled,
  onModeChanged,
}: {
  subscriberId: string;
  displayName: string;
  billing: BillingRow | undefined;
  billingEnabled: boolean;
  onModeChanged: (subscriberId: string, managed: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);
  const managed = billing?.managed_by_pro ?? false;
  const hasStripeSubscription = Boolean(billing?.stripe_subscription_id);


  const changeMode = async (nextManaged: boolean) => {
    let message: string;


    if (nextManaged) {
      message = hasStripeSubscription
        ? `Gérer manuellement ${displayName} ?\n\nSon abonnement Stripe reste actif : pensez à le résilier dans Stripe pour éviter un double paiement.`
        : `Gérer manuellement ${displayName} ?\n\nIl gardera son accès sans paiement en ligne.`;
    } else {
      message = billingEnabled
        ? `Rendre la main à Stripe pour ${displayName} ?\n\nSon accès dépendra désormais de son abonnement en ligne : s'il n'en a pas, il devra souscrire pour continuer.`
        : `Rendre la main à Stripe pour ${displayName} ?\n\nLe paiement en ligne est encore désactivé : son accès ne change pas pour le moment.`;
    }


    if (!window.confirm(message)) return;


    setSaving(true);


    const { error } = await supabase.rpc("pro_set_billing_mode", {
      p_subscriber_id: subscriberId,
      p_managed: nextManaged,
    });


    setSaving(false);


    if (error) {
      console.error("[BillingPanel] Erreur :", error);
      window.alert(`Impossible de modifier le mode de paiement : ${error.message}`);
      return;
    }


    onModeChanged(subscriberId, nextManaged);
  };


  return (
    <div className="border-t px-4 pb-4 pt-3">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <CreditCard className="h-3.5 w-3.5" />
        Abonnement et paiement
      </p>


      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background px-3 py-3">
        <div className="space-y-1 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            {getBillingBadge(billing, billingEnabled)}
            {billing?.billing_plan ? (
              <span className="text-xs text-muted-foreground">
                Formule en ligne : {billing.billing_plan}
              </span>
            ) : null}
          </div>


          {billing?.status === "trialing" && billing.trial_end ? (
            <p className="text-xs text-muted-foreground">
              Essai jusqu'au {formatDate(billing.trial_end)}
            </p>
          ) : null}


          {billing?.status === "active" && billing.current_period_end ? (
            <p className="text-xs text-muted-foreground">
              {billing.cancel_at_period_end ? "Se termine le" : "Prochain renouvellement le"}{" "}
              {formatDate(billing.current_period_end)}
            </p>
          ) : null}


          <p className="text-xs text-muted-foreground">
            {managed
              ? "Vous gérez son accès à la main : Stripe n'a aucun effet sur son compte."
              : "Son accès dépend de son abonnement en ligne (Stripe)."}
          </p>
        </div>


        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-xl"
          disabled={saving}
          onClick={() => void changeMode(!managed)}
        >
          {saving ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              Mise à jour…
            </>
          ) : managed ? (
            "Rendre la main à Stripe"
          ) : (
            "Gérer manuellement"
          )}
        </Button>
      </div>
    </div>
  );
}


function OverridesPanel({ userId }: { userId: string }) {
  const [overrides, setOverrides] = useState<Overrides>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);


  useEffect(() => {
    let mounted = true;


    const load = async () => {
      const { data, error } = await supabase
        .from("subscriber_overrides")
        .select("feature_key, enabled")
        .eq("user_id", userId);


      if (!mounted) return;


      if (error) {
        console.error("[OverridesPanel] Erreur :", error);
        setFetched(true);
        return;
      }


      const map: Overrides = {};


      for (const row of data ?? []) {
        map[row.feature_key] = row.enabled;
      }


      setOverrides(map);
      setFetched(true);
    };


    void load();


    return () => {
      mounted = false;
    };
  }, [userId]);


  const toggle = useCallback(
    async (featureKey: string) => {
      const current = overrides[featureKey] ?? false;
      const next = !current;


      setLoadingKey(featureKey);
      setOverrides((previous) => ({
        ...previous,
        [featureKey]: next,
      }));


      const { error } = await supabase
        .from("subscriber_overrides")
        .upsert(
          {
            user_id: userId,
            feature_key: featureKey,
            enabled: next,
          },
          {
            onConflict: "user_id,feature_key",
          },
        );


      if (error) {
        setOverrides((previous) => ({
          ...previous,
          [featureKey]: current,
        }));


        console.error("[OverridesPanel] Erreur toggle :", error);
      }


      setLoadingKey(null);
    },
    [overrides, userId],
  );


  if (!fetched) {
    return (
      <div className="grid grid-cols-2 gap-2 px-4 pb-4 pt-2 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <div
            key={feature.key}
            className="h-8 animate-pulse rounded bg-muted"
          />
        ))}
      </div>
    );
  }


  return (
    <div className="border-t px-4 pb-4 pt-2">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Accès activés
      </p>


      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {FEATURES.map((feature) => {
          const enabled = overrides[feature.key] ?? false;


          return (
            <div
              key={feature.key}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                enabled
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-background"
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <span
                  className={
                    enabled
                      ? "text-primary"
                      : "text-muted-foreground"
                  }
                >
                  {feature.icon}
                </span>


                <span
                  className={
                    enabled
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }
                >
                  {feature.label}
                </span>
              </div>


              <Toggle
                enabled={enabled}
                onChange={() => void toggle(feature.key)}
                loading={loadingKey === feature.key}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}


function PremiumToggleButton({
  subscriber,
  loading,
  onToggle,
}: {
  subscriber: Subscriber;
  loading: boolean;
  onToggle: (subscriber: Subscriber) => void;
}) {
  const isPremium = subscriber.plan === "premium";


  return (
    <Button
      type="button"
      size="sm"
      variant={isPremium ? "outline" : "default"}
      className={
        isPremium
          ? "rounded-xl"
          : "rounded-xl bg-[#6DB33F] text-white hover:bg-[#2D7A1F]"
      }
      disabled={loading}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(subscriber);
      }}
    >
      {loading ? (
        <>
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          Mise à jour…
        </>
      ) : isPremium ? (
        "Remettre Basic"
      ) : (
        "Passer Premium"
      )}
    </Button>
  );
}


function DeleteButton({
  subscriber,
  loading,
  onDelete,
}: {
  subscriber: Subscriber;
  loading: boolean;
  onDelete: (subscriber: Subscriber) => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="destructive"
      className="rounded-xl"
      disabled={loading}
      onClick={(event) => {
        event.stopPropagation();
        onDelete(subscriber);
      }}
      aria-label={`Supprimer ${subscriber.full_name ?? subscriber.email}`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <Trash2 className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Supprimer</span>
        </>
      )}
    </Button>
  );
}


function Page() {
  return (
    <ProLayout>
      <Content />
    </ProLayout>
  );
}


function Content() {
  const { user } = useAuth();
  const { billingEnabled } = useBillingEnabled();


  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [billingMap, setBillingMap] = useState<Record<string, BillingRow>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterGoal, setFilterGoal] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingPlanId, setUpdatingPlanId] =
    useState<string | null>(null);
  const [deletingSubscriberId, setDeletingSubscriberId] =
    useState<string | null>(null);


  useEffect(() => {
    if (!user) return;


    let mounted = true;


    const fetchSubscribers = async () => {
      setLoading(true);


      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, email, full_name, role, plan, age, weight_kg, height_cm, bmi, goal, created_at",
        )
        .eq("pro_id", user.id)
        .eq("role", "subscriber")
        .order("created_at", {
          ascending: false,
        });


      if (!mounted) return;


      if (error) {
        console.error(
          "[pro.subscribers] Erreur chargement abonnés :",
          error,
        );
        setSubscribers([]);
        setBillingMap({});
      } else {
        const list = (data ?? []) as Subscriber[];
        setSubscribers(list);


        if (list.length > 0) {
          const { data: billingData, error: billingError } = await supabase
            .from("subscriber_billing")
            .select(
              "user_id, status, billing_plan, trial_end, current_period_end, cancel_at_period_end, managed_by_pro, stripe_subscription_id",
            )
            .in(
              "user_id",
              list.map((item) => item.id),
            );


          if (!mounted) return;


          if (billingError) {
            console.error("[pro.subscribers] Erreur chargement paiements :", billingError);
            setBillingMap({});
          } else {
            const map: Record<string, BillingRow> = {};
            for (const row of (billingData ?? []) as BillingRow[]) {
              map[row.user_id] = row;
            }
            setBillingMap(map);
          }
        } else {
          setBillingMap({});
        }
      }


      setLoading(false);
    };


    void fetchSubscribers();


    return () => {
      mounted = false;
    };
  }, [user]);


  const handleBillingModeChanged = useCallback((subscriberId: string, managed: boolean) => {
    setBillingMap((previous) => ({
      ...previous,
      [subscriberId]: {
        user_id: subscriberId,
        status: previous[subscriberId]?.status ?? "none",
        billing_plan: previous[subscriberId]?.billing_plan ?? null,
        trial_end: previous[subscriberId]?.trial_end ?? null,
        current_period_end: previous[subscriberId]?.current_period_end ?? null,
        cancel_at_period_end: previous[subscriberId]?.cancel_at_period_end ?? false,
        stripe_subscription_id: previous[subscriberId]?.stripe_subscription_id ?? null,
        managed_by_pro: managed,
      },
    }));
  }, []);


  const handleTogglePremium = useCallback(
    async (subscriber: Subscriber) => {
      if (!user) return;


      const currentPlan = subscriber.plan ?? "basic";
      const nextPlan: SubscriberPlan =
        currentPlan === "premium" ? "basic" : "premium";


      const displayName =
        subscriber.full_name ?? subscriber.email;


      const confirmed = window.confirm(
        nextPlan === "premium"
          ? `Passer ${displayName} en Premium ?`
          : `Remettre ${displayName} en Basic ?`,
      );


      if (!confirmed) return;


      setUpdatingPlanId(subscriber.id);


      const { error } = await supabase.rpc(
        "pro_set_subscriber_plan",
        {
          p_subscriber_id: subscriber.id,
          p_new_plan: nextPlan,
        },
      );


      if (error) {
        console.error(
          "[pro.subscribers] Erreur changement plan :",
          error,
        );


        window.alert(
          `Impossible de mettre à jour le plan : ${error.message}`,
        );


        setUpdatingPlanId(null);
        return;
      }


      setSubscribers((previous) =>
        previous.map((item) =>
          item.id === subscriber.id
            ? {
                ...item,
                plan: nextPlan,
              }
            : item,
        ),
      );


      setUpdatingPlanId(null);
    },
    [user],
  );


  const handleDeleteSubscriber = useCallback(
    async (subscriber: Subscriber) => {
      if (!user) return;


      const displayName =
        subscriber.full_name ?? subscriber.email;


      const confirmed = window.confirm(
        `Supprimer définitivement l'abonné ${displayName} ?\n\n` +
          "Cette action supprimera son compte Auth et toutes ses données. " +
          "Cette action est irréversible.",
      );


      if (!confirmed) return;


      setDeletingSubscriberId(subscriber.id);


      try {
        const result = await supabase.functions.invoke(
          "delete-account",
          {
            body: {
              user_id: subscriber.id,
            },
          },
        );


        if (result.error || !result.data?.success) {
          const message = getErrorMessage(
            result.error,
            result.data,
          );


          throw new Error(message);
        }


        setSubscribers((current) =>
          current.filter(
            (item) => item.id !== subscriber.id,
          ),
        );


        setExpandedId((current) =>
          current === subscriber.id ? null : current,
        );


        window.alert("Abonné supprimé avec succès.");
      } catch (error) {
        console.error(
          "[pro.subscribers] Erreur suppression :",
          error,
        );


        const message = getErrorMessage(error, null);


        window.alert(
          `Impossible de supprimer l'abonné : ${message}`,
        );
      } finally {
        setDeletingSubscriberId(null);
      }
    },
    [user],
  );


  const filtered = subscribers.filter((subscriber) => {
    const query = search.trim().toLowerCase();


    const matchSearch =
      !query ||
      subscriber.full_name
        ?.toLowerCase()
        .includes(query) ||
      subscriber.email.toLowerCase().includes(query);


    const matchGoal =
      filterGoal === "all" ||
      normalizeGoal(subscriber.goal) === filterGoal;


    return matchSearch && matchGoal;
  });


  const bmiValues = subscribers
    .filter(
      (subscriber) =>
        subscriber.bmi !== null &&
        subscriber.bmi !== undefined,
    )
    .map((subscriber) => Number(subscriber.bmi))
    .filter((value) => Number.isFinite(value));


  const avgBMI =
    bmiValues.length > 0
      ? (
          bmiValues.reduce(
            (total, value) => total + value,
            0,
          ) / bmiValues.length
        ).toFixed(1)
      : null;


  const pastDueCount = subscribers.filter(
    (subscriber) => billingMap[subscriber.id]?.status === "past_due",
  ).length;


  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <UserCheck className="h-6 w-6 text-primary" />


        <h1 className="text-2xl font-bold">Abonnés</h1>


        <Badge variant="secondary" className="ml-auto">
          {subscribers.length} au total
        </Badge>
      </div>


      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-primary">
            {subscribers.length}
          </p>


          <p className="mt-1 text-xs text-muted-foreground">
            Abonnés
          </p>
        </div>


        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-primary">
            {avgBMI ?? "—"}
          </p>


          <p className="mt-1 text-xs text-muted-foreground">
            IMC moyen
          </p>
        </div>


        <div className="rounded-lg border bg-card p-4 text-center">
          <p
            className={`text-2xl font-bold ${
              pastDueCount > 0 ? "text-orange-500" : "text-primary"
            }`}
          >
            {pastDueCount}
          </p>


          <p className="mt-1 text-xs text-muted-foreground">
            Paiements en retard
          </p>
        </div>
      </div>


      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />


          <Input
            className="pl-9"
            placeholder="Rechercher par nom ou email…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>


        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />


          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={filterGoal}
            onChange={(event) =>
              setFilterGoal(event.target.value)
            }
          >
            <option value="all">Tous les objectifs</option>
            <option value="perte_de_poids">
              Perte de poids
            </option>
            <option value="prise_de_masse">
              Prise de masse
            </option>
            <option value="maintien">Maintien</option>
            <option value="equilibre">
              Santé générale
            </option>
          </select>
        </div>
      </div>


      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="animate-pulse rounded-lg border bg-card p-4"
            >
              <div className="mb-2 h-4 w-1/3 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          <UserCheck className="mx-auto mb-3 h-10 w-10 opacity-30" />


          <p className="font-medium">Aucun résultat</p>


          <p className="mt-1 text-sm">
            {subscribers.length === 0
              ? "Vos abonnés apparaîtront ici après leur inscription"
              : "Essayez de modifier vos filtres"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((subscriber) => {
            const bmiInfo = getBMIInfo(subscriber.bmi);
            const goalKey = normalizeGoal(subscriber.goal);
            const goalInfo = goalKey
              ? GOAL_MAP[goalKey]
              : null;


            const initials = (
              subscriber.full_name ?? subscriber.email
            )
              .slice(0, 2)
              .toUpperCase();


            const isOpen = expandedId === subscriber.id;


            return (
              <div
                key={subscriber.id}
                className="overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-sm"
              >
                <div
                  className="flex cursor-pointer select-none items-center gap-4 p-4"
                  onClick={() =>
                    setExpandedId(
                      isOpen ? null : subscriber.id,
                    )
                  }
                >
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {initials}
                  </div>


                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">
                        {subscriber.full_name ?? "—"}
                      </span>


                      {getPlanBadge(subscriber.plan)}


                      {getBillingBadge(billingMap[subscriber.id], billingEnabled)}
                    </div>


                    <p className="truncate text-sm text-muted-foreground">
                      {subscriber.email}
                    </p>
                  </div>


                  <div className="hidden min-w-[90px] flex-col items-center gap-1 md:flex">
                    <span
                      className={`text-sm font-medium ${bmiInfo.color}`}
                    >
                      {bmiInfo.label}
                    </span>


                    <span className="text-xs text-muted-foreground">
                      {subscriber.weight_kg
                        ? `${subscriber.weight_kg} kg`
                        : "—"}{" "}
                      ·{" "}
                      {subscriber.height_cm
                        ? `${subscriber.height_cm} cm`
                        : "—"}
                    </span>
                  </div>


                  <div className="hidden min-w-[130px] lg:block">
                    {goalInfo ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${goalInfo.color}`}
                      >
                        {goalInfo.icon}
                        {goalInfo.label}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Pas d'objectif
                      </span>
                    )}
                  </div>


                  <div className="hidden min-w-[80px] flex-col items-end gap-1 text-xs text-muted-foreground xl:flex">
                    {subscriber.age ? (
                      <span>{subscriber.age} ans</span>
                    ) : null}


                    <span>
                      {formatDate(subscriber.created_at)}
                    </span>
                  </div>


                  <div
                    className="ml-2 flex-shrink-0"
                    onClick={(event) =>
                      event.stopPropagation()
                    }
                  >
                    <PremiumToggleButton
                      subscriber={subscriber}
                      loading={
                        updatingPlanId === subscriber.id
                      }
                      onToggle={handleTogglePremium}
                    />
                  </div>


                  <div
                    className="ml-2 flex-shrink-0"
                    onClick={(event) =>
                      event.stopPropagation()
                    }
                  >
                    <DeleteButton
                      subscriber={subscriber}
                      loading={
                        deletingSubscriberId === subscriber.id
                      }
                      onDelete={handleDeleteSubscriber}
                    />
                  </div>


                  <div className="ml-1 text-muted-foreground">
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </div>


                {isOpen ? (
                  <>
                    <BillingPanel
                      subscriberId={subscriber.id}
                      displayName={subscriber.full_name ?? subscriber.email}
                      billing={billingMap[subscriber.id]}
                      billingEnabled={billingEnabled}
                      onModeChanged={handleBillingModeChanged}
                    />


                    <OverridesPanel userId={subscriber.id} />


                    <div className="border-t px-4 pb-4 pt-3">
                      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Documents PDF
                      </p>
                      <SubscriberDocumentsManager
                        subscriberUserId={subscriber.id}
                        proId={user?.id ?? ""}
                      />
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}