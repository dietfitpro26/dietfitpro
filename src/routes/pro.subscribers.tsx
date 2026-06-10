import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { ProLayout } from "@/layouts/ProLayout";
import {
  UserCheck, Search, SlidersHorizontal, TrendingDown,
  Dumbbell, Scale, Heart, ChevronDown, ChevronUp,
  UtensilsCrossed, Bike, MessageCircle, Video, BarChart2, Star
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/pro/subscribers")({
  component: Page,
});

// ── Types ─────────────────────────────────────────────────────────
type Subscriber = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  plan: string | null;
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number | null;
  goal: string | null;
  created_at: string;
};

type Overrides = Record<string, boolean>; // { feature_key: enabled }

// ── Features disponibles ──────────────────────────────────────────
const FEATURES = [
  { key: "access_recipes",            label: "Recettes",            icon: <UtensilsCrossed className="h-3.5 w-3.5" /> },
  { key: "access_sport_programs",     label: "Programmes sport",    icon: <Bike className="h-3.5 w-3.5" /> },
  { key: "access_nutrition_programs", label: "Programmes nutrition", icon: <BarChart2 className="h-3.5 w-3.5" /> },
  { key: "access_messaging",          label: "Messagerie coach",    icon: <MessageCircle className="h-3.5 w-3.5" /> },
  { key: "access_visio",              label: "Visio",               icon: <Video className="h-3.5 w-3.5" /> },
  { key: "access_premium_content",    label: "Contenu premium",     icon: <Star className="h-3.5 w-3.5" /> },
];

// ── Helpers ───────────────────────────────────────────────────────
const GOAL_MAP: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  weight_loss:    { label: "Perte de poids", icon: <TrendingDown className="h-3 w-3" />, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  muscle_gain:    { label: "Prise de masse", icon: <Dumbbell className="h-3 w-3" />,    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  maintenance:    { label: "Maintien",        icon: <Scale className="h-3 w-3" />,        color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  general_health: { label: "Santé générale", icon: <Heart className="h-3 w-3" />,        color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
};

function getBMIInfo(bmi: number | null) {
  if (!bmi) return { label: "—", color: "text-muted-foreground" };
  if (bmi < 18.5) return { label: `${bmi} · Insuffisance`, color: "text-blue-500" };
  if (bmi < 25)   return { label: `${bmi} · Normal ✅`,    color: "text-green-600" };
  if (bmi < 30)   return { label: `${bmi} · Surpoids`,     color: "text-orange-500" };
  return           { label: `${bmi} · Obésité`,            color: "text-red-500" };
}

function getPlanBadge(plan: string | null) {
  if (plan === "premium") return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-0">⭐ Premium</Badge>;
  return <Badge variant="secondary">Basic</Badge>;
}

function getRoleBadge(role: string) {
  if (role === "patient") return <Badge className="bg-primary/10 text-primary border-0">Patient</Badge>;
  return <Badge variant="outline">Abonné</Badge>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Composant Toggle ──────────────────────────────────────────────
function Toggle({ enabled, onChange, loading }: { enabled: boolean; onChange: () => void; loading: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={loading}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none
        ${enabled ? "bg-primary" : "bg-muted-foreground/30"}
        ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform
        ${enabled ? "translate-x-4" : "translate-x-0.5"}`}
      />
    </button>
  );
}

// ── Panneau overrides d'un abonné ─────────────────────────────────
function OverridesPanel({ userId }: { userId: string }) {
  const [overrides, setOverrides]   = useState<Overrides>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [fetched, setFetched]       = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("subscriber_overrides")
        .select("feature_key, enabled")
        .eq("user_id", userId);
      if (data) {
        const map: Overrides = {};
        data.forEach((r: { feature_key: string; enabled: boolean }) => {
          map[r.feature_key] = r.enabled;
        });
        setOverrides(map);
      }
      setFetched(true);
    };
    load();
  }, [userId]);

  const toggle = useCallback(async (featureKey: string) => {
    const current = overrides[featureKey] ?? false;
    const next    = !current;
    setLoadingKey(featureKey);
    setOverrides((prev) => ({ ...prev, [featureKey]: next }));

    const { error } = await supabase
      .from("subscriber_overrides")
      .upsert(
        { user_id: userId, feature_key: featureKey, enabled: next },
        { onConflict: "user_id,feature_key" }
      );

    if (error) {
      // Rollback si erreur
      setOverrides((prev) => ({ ...prev, [featureKey]: current }));
      console.error("Toggle error:", error);
    }
    setLoadingKey(null);
  }, [overrides, userId]);

  if (!fetched) {
    return (
      <div className="px-4 pb-4 pt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {FEATURES.map((f) => (
          <div key={f.key} className="h-8 rounded bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="px-4 pb-4 pt-2 border-t">
      <p className="text-xs text-muted-foreground font-medium mb-3 uppercase tracking-wide">
        Accès activés
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {FEATURES.map((f) => {
          const enabled = overrides[f.key] ?? false;
          return (
            <div
              key={f.key}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-colors
                ${enabled ? "border-primary/30 bg-primary/5" : "border-border bg-background"}`}
            >
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <span className={enabled ? "text-primary" : "text-muted-foreground"}>{f.icon}</span>
                <span className={enabled ? "text-foreground" : "text-muted-foreground"}>{f.label}</span>
              </div>
              <Toggle
                enabled={enabled}
                onChange={() => toggle(f.key)}
                loading={loadingKey === f.key}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────
function Page() {
  return <ProLayout><Content /></ProLayout>;
}

function Content() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [filterGoal, setFilterGoal]   = useState("all");
  const [filterRole, setFilterRole]   = useState("all");
  const [expandedId, setExpandedId]   = useState<string | null>(null);

  useEffect(() => {
    const fetchSubscribers = async () => {
      const { data, error } = await supabase
        .from("pro_subscribers_view")
        .select("id, email, full_name, role, plan, age, weight_kg, height_cm, bmi, goal, created_at")
        .in("role", ["subscriber", "patient"])
        .order("created_at", { ascending: false });
      if (!error && data) setSubscribers(data as Subscriber[]);
      setLoading(false);
    };
    fetchSubscribers();
  }, []);

  const filtered = subscribers.filter((s) => {
    const matchSearch = !search ||
      s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase());
    const matchGoal = filterGoal === "all" || s.goal === filterGoal;
    const matchRole = filterRole === "all" || s.role === filterRole;
    return matchSearch && matchGoal && matchRole;
  });

  const totalSubscribers = subscribers.filter(s => s.role === "subscriber").length;
  const totalPatients    = subscribers.filter(s => s.role === "patient").length;
  const avgBMI = subscribers.filter(s => s.bmi).length > 0
    ? (subscribers.filter(s => s.bmi).reduce((acc, s) => acc + Number(s.bmi), 0) / subscribers.filter(s => s.bmi).length).toFixed(1)
    : null;

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <UserCheck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Abonnés & Patients</h1>
        <Badge variant="secondary" className="ml-auto">{subscribers.length} au total</Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-primary">{totalSubscribers}</p>
          <p className="text-xs text-muted-foreground mt-1">Abonnés</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-primary">{totalPatients}</p>
          <p className="text-xs text-muted-foreground mt-1">Patients</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-primary">{avgBMI ?? "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">IMC moyen</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Rechercher par nom ou email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="all">Tous les rôles</option>
            <option value="subscriber">Abonnés</option>
            <option value="patient">Patients</option>
          </select>
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={filterGoal}
            onChange={(e) => setFilterGoal(e.target.value)}
          >
            <option value="all">Tous les objectifs</option>
            <option value="weight_loss">Perte de poids</option>
            <option value="muscle_gain">Prise de masse</option>
            <option value="maintenance">Maintien</option>
            <option value="general_health">Santé générale</option>
          </select>
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border bg-card p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucun résultat</p>
          <p className="text-sm mt-1">
            {subscribers.length === 0
              ? "Vos abonnés apparaîtront ici après leur inscription"
              : "Essayez de modifier vos filtres"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const bmiInfo   = getBMIInfo(s.bmi);
            const goalInfo  = s.goal ? GOAL_MAP[s.goal] : null;
            const initials  = (s.full_name ?? s.email).slice(0, 2).toUpperCase();
            const isOpen    = expandedId === s.id;

            return (
              <div key={s.id} className="rounded-lg border bg-card overflow-hidden transition-shadow hover:shadow-sm">

                {/* Ligne principale — cliquable pour ouvrir les toggles */}
                <div
                  className="p-4 flex items-center gap-4 cursor-pointer select-none"
                  onClick={() => setExpandedId(isOpen ? null : s.id)}
                >
                  {/* Avatar */}
                  <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                    {initials}
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{s.full_name ?? "—"}</span>
                      {getRoleBadge(s.role)}
                      {getPlanBadge(s.plan)}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{s.email}</p>
                  </div>

                  {/* IMC */}
                  <div className="hidden md:flex flex-col items-center gap-1 min-w-[90px]">
                    <span className={`text-sm font-medium ${bmiInfo.color}`}>{bmiInfo.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {s.weight_kg ? `${s.weight_kg} kg` : "—"} · {s.height_cm ? `${s.height_cm} cm` : "—"}
                    </span>
                  </div>

                  {/* Objectif */}
                  <div className="hidden lg:block min-w-[130px]">
                    {goalInfo ? (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${goalInfo.color}`}>
                        {goalInfo.icon}{goalInfo.label}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Pas d'objectif</span>
                    )}
                  </div>

                  {/* Âge + date + chevron */}
                  <div className="hidden xl:flex flex-col items-end gap-1 text-xs text-muted-foreground min-w-[80px]">
                    {s.age && <span>{s.age} ans</span>}
                    <span>{formatDate(s.created_at)}</span>
                  </div>

                  <div className="text-muted-foreground ml-2">
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>

                {/* Panneau toggles — s'ouvre au clic */}
                {isOpen && <OverridesPanel userId={s.id} />}

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}