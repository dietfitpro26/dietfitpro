// @ts-nocheck 
// import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Envoi d'e-mail via Resend. Ne fait jamais échouer le webhook : en cas de problème, on note l'erreur dans les journaux.
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");

  if (!apiKey) {
    console.error("[stripe-webhook] RESEND_API_KEY manquante : e-mail non envoyé.");
    return;
  }

  const from = Deno.env.get("RESEND_FROM") ?? "DietFitPro <onboarding@resend.dev>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[stripe-webhook] Resend a refusé l'envoi :", response.status, detail);
    }
  } catch (error) {
    console.error("[stripe-webhook] Resend injoignable :", error instanceof Error ? error.message : error);
  }
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

// Paiement d'abonnement refusé : on prévient l'abonné par e-mail pour qu'il mette à jour sa carte.
async function onPaymentFailed(admin: Admin, invoice: any) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const { data: billing } = await admin
    .from("subscriber_billing")
    .select("user_id, managed_by_pro")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (!billing?.user_id) return;

  // Formule gérée à la main par le professionnel : pas d'e-mail automatique.
  if (billing.managed_by_pro) return;

  const { data: profile } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", billing.user_id)
    .maybeSingle();

  const to: string | null = profile?.email ?? invoice.customer_email ?? null;
  if (!to) return;

  const siteUrl = (Deno.env.get("SITE_URL") ?? "http://localhost:8080").replace(/\/$/, "");
  const profileUrl = `${siteUrl}/subscriber/profile`;

  const firstName = escapeHtml(((profile?.full_name as string | null) ?? "").trim().split(" ")[0] ?? "");
  const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";

  const amount = (((invoice.amount_due as number | undefined) ?? 0) / 100).toFixed(2).replace(".", ",");

  const nextAttempt = typeof invoice.next_payment_attempt === "number"
    ? new Date(invoice.next_payment_attempt * 1000).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    : null;

  const retryLine = nextAttempt
    ? `<p>Une nouvelle tentative de prélèvement aura lieu le ${nextAttempt}.</p>`
    : "<p>Sans mise à jour de votre moyen de paiement, votre accès pourra être suspendu.</p>";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1f2937; line-height: 1.5;">
      <h2 style="color: #2D7A1F;">Votre paiement n'a pas abouti</h2>
      <p>${greeting}</p>
      <p>Nous n'avons pas pu prélever ${amount} € pour votre abonnement DietFitPro.</p>
      ${retryLine}
      <p>Pour éviter toute interruption, mettez à jour votre moyen de paiement depuis votre espace :</p>
      <p style="margin: 24px 0;">
        <a href="${profileUrl}" style="background: #6DB33F; color: #ffffff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          Mettre à jour mon moyen de paiement
        </a>
      </p>
      <p style="font-size: 12px; color: #6b7280;">Dans votre profil, utilisez « Gérer mon abonnement et mes factures ». Vos données sont conservées. Si vous avez déjà régularisé, ignorez ce message.</p>
    </div>
  `;

  await sendEmail(to, "Votre paiement DietFitPro n'a pas abouti", html);
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
      case "invoice.payment_failed":
        await onPaymentFailed(admin, event.data.object);
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