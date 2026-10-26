import { supabase } from "@/lib/supabase";


/**
 * Prix affichés dans l'application (TTC, micro-entreprise sans TVA).
 * Les vrais prix sont définis dans Stripe : garder ces deux endroits identiques.
 */
export const BILLING_PRICES = {
  trialDays: 7,
  basicMonthly: 9.99,
  premiumMonthly: 25.99,
  customProgramOnce: 5,
  visioPerConsultation: 30,
} as const;


export function formatEuro(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}


export type CheckoutRequest =
  | { kind: "subscription"; plan: "basic" | "premium" }
  | { kind: "custom_program" }
  | { kind: "visio"; consultationId: string };


const NOT_READY_MESSAGE = "Le paiement en ligne n'est pas encore disponible.";


async function callBillingFunction(name: string, body: Record<string, unknown>): Promise<void> {
  const { data, error } = await supabase.functions.invoke(name, { body });


  if (error) {
    let message = NOT_READY_MESSAGE;
    try {
      const context = (error as { context?: Response }).context;
      if (context) {
        const payload = await context.json();
        if (payload?.error) message = String(payload.error);
      }
    } catch {
      // on garde le message par défaut
    }
    throw new Error(message);
  }


  const url = (data as { url?: string; error?: string } | null)?.url;
  if (!url) {
    throw new Error((data as { error?: string } | null)?.error ?? NOT_READY_MESSAGE);
  }


  window.location.assign(url);
}


/** Ouvre la page de paiement sécurisée Stripe. */
export function startCheckout(request: CheckoutRequest): Promise<void> {
  return callBillingFunction("create-checkout-session", {
    ...request,
    returnUrl: window.location.origin,
  });
}


/** Ouvre le portail client Stripe (changer de carte, résilier, voir les factures). */
export function openCustomerPortal(): Promise<void> {
  return callBillingFunction("create-portal-session", {
    returnUrl: `${window.location.origin}/subscriber/profile`,
  });
}