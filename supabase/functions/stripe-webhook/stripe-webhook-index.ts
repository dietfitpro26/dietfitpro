import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// IMPORTANT : cette fonction doit être déployée avec "Verify JWT" désactivé,
// car c'est Stripe (et non un utilisateur connecté) qui l'appelle.
// La sécurité repose sur la vérification de la signature Stripe ci-dessous.

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifySignature(payload: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false;

  let timestamp = "";
  const signatures: string[] = [];

  for (const part of header.split(",")) {
    const [key, value] = part.split("=");
    if (key === "t") timestamp = value;
    if (key === "v1") signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) return false;

  // On refuse les messages de plus de 5 minutes.
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`));
  const expected = toHex(signed);

  return signatures.some((signature) => safeEqual(signature, expected));
}

async function stripeGet(path: string): Promise<any | null> {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) return null;

  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });

  return response.ok ? await response.json() : null;
}

function toIso(seconds: number | null | undefined): string | null {
  return typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null;
}

// deno-lint-ignore no-explicit-any
type Admin = any;

async function onCheckoutCompleted(admin: Admin, session: any) {
  if (session.mode !== "payment" || session.payment_status !== "paid") return;

  const { error } = await admin
    .from("purchases")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: session.payment_intent ?? null,
    })
    .eq("stripe_checkout_session_id", session.id);

  if (error) throw new Error(`purchases : ${error.message}`);

  if (session.metadata?.kind === "visio" && session.metadata?.consultation_id) {
    const { error: visioError } = await admin
      .from("visio_consultations")
      .update({
        payment_status: "paid",
        stripe_payment_intent_id: session.payment_intent ?? null,
        amount_cents: session.amount_total ?? null,
      })
      .eq("id", session.metadata.consultation_id);

    if (visioError) throw new Error(`visio_consultations : ${visioError.message}`);
  }
}

async function onSubscription(admin: Admin, eventSubscription: any, deleted: boolean) {
  // On relit l'abonnement chez Stripe : l'état est toujours le plus récent, même si les messages arrivent dans le désordre.
  const subscription = (await stripeGet(`/subscriptions/${eventSubscription.id}`)) ?? eventSubscription;

  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  let userId: string | undefined = subscription.metadata?.user_id;

  if (!userId && customerId) {
    const { data } = await admin
      .from("subscriber_billing")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    userId = data?.user_id;
  }

  if (!userId) throw new Error("Abonné introuvable pour cet abonnement.");

  const { data: settingsRows } = await admin
    .from("app_settings")
    .select("key, value")
    .in("key", ["stripe_price_basic", "stripe_price_premium"]);

  const prices: Record<string, string> = {};
  for (const row of settingsRows ?? []) prices[row.key] = row.value;

  const item = subscription.items?.data?.[0];
  const priceId: string | undefined = item?.price?.id;

  let plan: string | null = subscription.metadata?.plan ?? null;
  if (priceId === prices.stripe_price_basic) plan = "basic";
  if (priceId === prices.stripe_price_premium) plan = "premium";

  const { error } = await admin.rpc("apply_stripe_subscription", {
    p_user_id: userId,
    p_customer_id: customerId ?? null,
    p_subscription_id: subscription.id,
    p_status: deleted ? "canceled" : subscription.status,
    p_plan: plan,
    p_trial_end: toIso(subscription.trial_end),
    p_current_period_end: toIso(subscription.current_period_end ?? item?.current_period_end),
    p_cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
  });

  if (error) throw new Error(`apply_stripe_subscription : ${error.message}`);
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return new Response("Méthode non autorisée", { status: 405 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!supabaseUrl || !serviceRoleKey || !webhookSecret) {
    console.error("[stripe-webhook] Configuration incomplète.");
    return new Response("Configuration incomplète", { status: 500 });
  }

  const payload = await request.text();

  if (!(await verifySignature(payload, request.headers.get("stripe-signature"), webhookSecret))) {
    return new Response("Signature invalide", { status: 400 });
  }

  const event = JSON.parse(payload);
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Anti-doublon : on mémorise chaque événement (données minimales, sans infos personnelles).
  const { error: insertError } = await admin.from("billing_events").insert({
    stripe_event_id: event.id,
    type: event.type,
    payload: { id: event.id, type: event.type, livemode: event.livemode },
  });

  if (insertError) {
    const { data: existing } = await admin
      .from("billing_events")
      .select("processed_at")
      .eq("stripe_event_id", event.id)
      .maybeSingle();

    if (existing?.processed_at) return new Response("Déjà traité", { status: 200 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await onCheckoutCompleted(admin, event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await onSubscription(admin, event.data.object, false);
        break;
      case "customer.subscription.deleted":
        await onSubscription(admin, event.data.object, true);
        break;
      default:
        break;
    }

    await admin
      .from("billing_events")
      .update({ processed_at: new Date().toISOString(), error: null })
      .eq("stripe_event_id", event.id);

    return new Response("ok", { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[stripe-webhook]", message);

    await admin.from("billing_events").update({ error: message }).eq("stripe_event_id", event.id);

    // 500 : Stripe réessaiera automatiquement plus tard.
    return new Response("Erreur de traitement", { status: 500 });
  }
});