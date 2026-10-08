import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";


/**
 * État d'accès d'un abonné, calculé côté base de données :
 * - unrestricted : paiement désactivé, ou compte non concerné (pro, patient)
 * - active / trial : abonnement payé ou en essai
 * - managed : formule gérée à la main par le professionnel
 * - past_due : paiement en retard (accès conservé, bandeau d'alerte)
 * - suspended : abonnement terminé ou impayé (seul le profil est visible)
 */
export type AccessState =
  | "unrestricted"
  | "active"
  | "trial"
  | "managed"
  | "past_due"
  | "suspended";


const KNOWN_STATES: AccessState[] = [
  "unrestricted",
  "active",
  "trial",
  "managed",
  "past_due",
  "suspended",
];


export function useAccessState() {
  const { user, role } = useAuth();
  const enabled = Boolean(user) && role === "subscriber";


  const query = useQuery({
    queryKey: ["access-state", user?.id ?? null],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<AccessState> => {
      const { data, error } = await supabase.rpc("my_access_state");
      if (error) {
        // En cas d'erreur technique, on ne bloque jamais l'abonné.
        console.error("[useAccessState]", error);
        return "unrestricted";
      }
      return KNOWN_STATES.includes(data as AccessState) ? (data as AccessState) : "unrestricted";
    },
  });


  return {
    state: (query.data ?? "unrestricted") as AccessState,
    loading: enabled && query.isLoading,
  };
}


/** Le paiement en ligne est-il activé ? (interrupteur dans la base de données) */
export function useBillingEnabled() {
  const { user } = useAuth();


  const query = useQuery({
    queryKey: ["billing-enabled"],
    enabled: Boolean(user),
    staleTime: 60_000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("billing_enabled");
      if (error) {
        console.error("[useBillingEnabled]", error);
        return false;
      }
      return data === true;
    },
  });


  return { billingEnabled: query.data ?? false, loading: query.isLoading };
}


export interface MyBillingRow {
  status: string;
  billing_plan: string | null;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  managed_by_pro: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}


/** Ligne d'abonnement de l'utilisateur connecté (vide tant qu'il n'a jamais payé). */
export function useMyBilling() {
  const { user, role } = useAuth();


  const query = useQuery({
    queryKey: ["my-billing", user?.id ?? null],
    enabled: Boolean(user) && role === "subscriber",
    staleTime: 60_000,
    queryFn: async (): Promise<MyBillingRow | null> => {
      const { data, error } = await supabase
        .from("subscriber_billing")
        .select(
          "status, billing_plan, trial_end, current_period_end, cancel_at_period_end, managed_by_pro, stripe_customer_id, stripe_subscription_id",
        )
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) {
        console.error("[useMyBilling]", error);
        return null;
      }
      return (data as MyBillingRow | null) ?? null;
    },
  });


  return { billing: query.data ?? null, loading: query.isLoading };
}