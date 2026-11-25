import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";

export interface AccessRights {
  plan_label: "basic" | "premium" | "patient";
  access_recipes: boolean;
  access_sport_programs: boolean;
  access_nutrition_programs: boolean;
  access_messaging: boolean;
  access_visio: boolean;
  access_ai_coach: boolean;
  access_premium_content: boolean;
  sport_session_limit: number | null;
}
type ServerAccessRights = Partial<AccessRights> & { plan_label?: unknown };
function parseRights(value: unknown): AccessRights {
  const row = value as ServerAccessRights | null;
  if (!row || typeof row !== "object") throw new Error("R?ponse de droits invalide.");
  const plan = row.plan_label;
  if (plan !== "basic" && plan !== "premium" && plan !== "patient") throw new Error("Forfait renvoy? par le serveur invalide.");
  const bool = (key: keyof AccessRights) => {
    const field = row[key];
    if (typeof field !== "boolean") throw new Error("Droit " + key + " invalide.");
    return field;
  };
  const limit = row.sport_session_limit;
  if (limit !== null && (typeof limit !== "number" || !Number.isFinite(limit) || limit < 0)) throw new Error("Limite de s?ances renvoy?e par le serveur invalide.");
  return {
    plan_label: plan, access_recipes: bool("access_recipes"),
    access_sport_programs: bool("access_sport_programs"),
    access_nutrition_programs: bool("access_nutrition_programs"),
    access_messaging: bool("access_messaging"), access_visio: bool("access_visio"),
    access_ai_coach: bool("access_ai_coach"), access_premium_content: bool("access_premium_content"),
    sport_session_limit: limit as number | null,
  };
}
export function useAccessRights() {
  const { user, profile, loading: authLoading } = useAuth();
  const [rights, setRights] = useState<AccessRights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let cancelled = false;
    setRights(null); setError(null); setLoading(true);
    if (authLoading) return () => { cancelled = true; };
    if (!user || !profile) { setLoading(false); return () => { cancelled = true; }; }
    void (async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc("get_my_access_rights");
        if (cancelled) return;
        if (rpcError) throw rpcError;
        setRights(parseRights(data)); setLoading(false);
      } catch (caught: unknown) {
        if (cancelled) return;
        console.error("[useAccessRights] v?rification serveur impossible :", caught);
        setError(caught instanceof Error ? caught : new Error("Impossible de v?rifier les droits du compte."));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, profile, authLoading]);
  return { rights, loading: loading || authLoading, error, verified: rights !== null && error === null && !authLoading };
}
