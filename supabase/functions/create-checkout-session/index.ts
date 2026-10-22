// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type FormValue = string | number | boolean | null | undefined;

async function stripeCall(
  path: string,
  method: "GET" | "POST",
  params?: Record<string, FormValue>,
): Promise<any> {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) throw new Error("STRIPE_SECRET_KEY manquante.");

  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null) form.append(key, String(value));
  }

  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: method === "POST" ? form.toString() : undefined,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error?.message ?? `Erreur Stripe (${response.status}).`);
  }

  return data;
}

// N'accepte que le site officiel (SITE_URL) ou un site local de développement.
function safeUrl(value: unknown): URL | null {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    const siteUrl = Deno.env.get("SITE_URL");
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const isSite = Boolean(siteUrl) && url.origin === new URL(siteUrl as string).origin;
    return isLocal || isSite ? url : null;
  } catch {
    return null;
  }
}

const ACTIVE_STATUSES = ["trialing", "active", "past_due"];
const TRIAL_DAYS = 7;

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = request.headers.get("Authorization");

    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Configuration serveur incomplète." }, 500);
    if (!authorization) return json({ error: "Connexion requise." }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const token = authorization.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userError } = await admin.auth.getUser(token);

    if (userError || !user) return json({ error: "Session invalide." }, 401);

    const body = (await request.json().catch(() => ({}))) as {
      kind?: string;
      plan?: string;
      consultationId?: string;
      returnUrl?: string;
    };

    const returnUrl = safeUrl(body.returnUrl);
    if (!returnUrl) return json({ error: "Adresse de retour non autorisée." }, 400);

    const { data: settingsRows } = await admin
      .from("app_settings")
      .select("key, value")
      .in("key", [
        "billing_enabled",
        "stripe_price_basic",
        "stripe_price_premium",
        "stripe_price_custom_program",
        "stripe_price_visio",
      ]);

    const settings: Record<string, string> = {};
    for (const row of settingsRows ?? []) settings[row.key] = row.value;

    if (settings.billing_enabled !== "true") {
      return json({ error: "Le paiement en ligne n'est pas encore disponible." }, 403);
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("id, email, role, plan")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) return json({ error: "Profil introuvable." }, 404);

    // Client Stripe : créé une seule fois puis réutilisé.
    const { data: billing } = await admin
      .from("subscriber_billing")
      .select("stripe_customer_id, stripe_subscription_id, status")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = billing?.stripe_customer_id as string | null | undefined;

    if (!customerId) {
      const customer = await stripeCall("/customers", "POST", {
        email: profile.email,
        "metadata[user_id]": user.id,
      });
      customerId = customer.id as string;

      if (billing) {
        await admin.from("subscriber_billing").update({ stripe_customer_id: customerId }).eq("user_id", user.id);
      } else {
        await admin.from("subscriber_billing").insert({ user_id: user.id, stripe_customer_id: customerId });
      }
    }

    const isSubscriber = profile.role === "subscriber";
    const origin = returnUrl.origin;
    const kind = body.kind;

    const baseParams: Record<string, FormValue> = {
      customer: customerId,
      locale: "fr",
      client_reference_id: user.id,
      "metadata[user_id]": user.id,
    };

    // 1) Abonnement Basic ou Premium
    if (kind === "subscription") {
      if (!isSubscriber) return json({ error: "Réservé aux abonnés." }, 403);

      const plan = body.plan;
      if (plan !== "basic" && plan !== "premium") return json({ error: "Formule invalide." }, 400);

      if (billing?.stripe_subscription_id && ACTIVE_STATUSES.includes(billing.status)) {
        return json({ error: "Vous avez déjà un abonnement en ligne. Utilisez « Gérer mon abonnement »." }, 409);
      }

      const priceId = settings[`stripe_price_${plan}`];
      if (!priceId) return json({ error: "Tarif non configuré." }, 500);

      // Essai gratuit : uniquement lors de la toute première souscription.
      const trialDays = billing?.stripe_subscription_id ? undefined : TRIAL_DAYS;

      const session = await stripeCall("/checkout/sessions", "POST", {
        ...baseParams,
        mode: "subscription",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": 1,
        allow_promotion_codes: true,
        "metadata[kind]": "subscription",
        "metadata[plan]": plan,
        "subscription_data[metadata][user_id]": user.id,
        "subscription_data[metadata][plan]": plan,
        "subscription_data[trial_period_days]": trialDays,
        success_url: `${origin}/home?checkout=success`,
        cancel_url: `${origin}/home?checkout=cancel`,
      });

      return json({ url: session.url });
    }

    // 2) Programme personnalisé (Premium uniquement)
    if (kind === "custom_program") {
      if (!isSubscriber) return json({ error: "Réservé aux abonnés." }, 403);
      if (profile.plan !== "premium") return json({ error: "Le programme personnalisé est réservé aux abonnés Premium." }, 403);

      const priceId = settings.stripe_price_custom_program;
      if (!priceId) return json({ error: "Tarif non configuré." }, 500);

      const session = await stripeCall("/checkout/sessions", "POST", {
        ...baseParams,
        mode: "payment",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": 1,
        "metadata[kind]": "custom_program",
        "payment_intent_data[metadata][user_id]": user.id,
        "payment_intent_data[metadata][kind]": "custom_program",
        success_url: `${origin}/home?checkout=success`,
        cancel_url: `${origin}/subscriber/nutrition`,
      });

      await admin.from("purchases").insert({
        user_id: user.id,
        kind: "custom_program",
        amount_cents: session.amount_total ?? 500,
        currency: "eur",
        status: "pending",
        stripe_checkout_session_id: session.id,
      });

      return json({ url: session.url });
    }

    // 3) Consultation en visio (patients et abonnés)
    if (kind === "visio") {
      const consultationId = body.consultationId;
      if (!consultationId) return json({ error: "Consultation manquante." }, 400);

      const { data: consultation } = await admin
        .from("visio_consultations")
        .select("id, patient_user_id, payment_status")
        .eq("id", consultationId)
        .maybeSingle();

      if (!consultation || consultation.patient_user_id !== user.id) {
        return json({ error: "Consultation introuvable." }, 404);
      }

      if (consultation.payment_status === "paid") {
        return json({ error: "Cette consultation est déjà réglée." }, 409);
      }

      const priceId = settings.stripe_price_visio;
      if (!priceId) return json({ error: "Tarif non configuré." }, 500);

      const backPath = isSubscriber ? "/subscriber/profile" : "/patient/consultations";

      const session = await stripeCall("/checkout/sessions", "POST", {
        ...baseParams,
        mode: "payment",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": 1,
        "metadata[kind]": "visio",
        "metadata[consultation_id]": consultationId,
        "payment_intent_data[metadata][user_id]": user.id,
        "payment_intent_data[metadata][kind]": "visio",
        "payment_intent_data[metadata][consultation_id]": consultationId,
        success_url: `${origin}${backPath}?payment=success`,
        cancel_url: `${origin}${backPath}?payment=cancel`,
      });

      await admin.from("purchases").insert({
        user_id: user.id,
        kind: "visio",
        amount_cents: session.amount_total ?? 3000,
        currency: "eur",
        status: "pending",
        stripe_checkout_session_id: session.id,
        visio_consultation_id: consultationId,
      });

      return json({ url: session.url });
    }

    return json({ error: "Type de paiement inconnu." }, 400);
  } catch (error) {
    console.error("[create-checkout-session]", error);
    return json({ error: "Impossible d'ouvrir la page de paiement pour le moment." }, 500);
  }
});