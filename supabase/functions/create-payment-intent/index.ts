// Edge function: create-payment-intent
// Crée un PaymentIntent Stripe pour une téléconsultation et met à jour
// payment_status = 'pending' + stripe_payment_intent_id dans visio_consultations.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  consultation_id: string;
  amount_cents: number;
  patient_email: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const { consultation_id, amount_cents, patient_email } =
      (await req.json()) as Body;

    if (!consultation_id || !amount_cents || amount_cents < 50) {
      return new Response(
        JSON.stringify({ error: "Paramètres invalides" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-06-20",
    });
    const publishableKey = Deno.env.get("STRIPE_PUBLISHABLE_KEY")!;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount_cents,
      currency: "eur",
      receipt_email: patient_email,
      automatic_payment_methods: { enabled: true },
      metadata: { consultation_id },
    });

    const { error: updateError } = await supabaseAdmin
      .from("visio_consultations")
      .update({
        payment_status: "pending",
        stripe_payment_intent_id: paymentIntent.id,
        amount_cents,
      })
      .eq("id", consultation_id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        client_secret: paymentIntent.client_secret,
        publishable_key: publishableKey,
        payment_intent_id: paymentIntent.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("create-payment-intent error", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
