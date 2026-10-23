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

    const body = (await request.json().catch(() => ({}))) as { returnUrl?: string };
    const returnUrl = safeUrl(body.returnUrl);
    if (!returnUrl) return json({ error: "Adresse de retour non autorisée." }, 400);

    const { data: billing } = await admin
      .from("subscriber_billing")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!billing?.stripe_customer_id) {
      return json({ error: "Aucun abonnement en ligne à gérer." }, 404);
    }

    const session = await stripeCall("/billing_portal/sessions", "POST", {
      customer: billing.stripe_customer_id,
      return_url: returnUrl.toString(),
      locale: "fr",
    });

    return json({ url: session.url });
  } catch (error) {
    console.error("[create-portal-session]", error);
    return json({ error: "Impossible d'ouvrir le portail pour le moment." }, 500);
  }
});