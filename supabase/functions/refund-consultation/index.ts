// Edge function: refund-consultation
// Rembourse une consultation via Stripe.
// > 24h avant le RDV : remboursement total → payment_status = 'refunded'
// < 24h avant le RDV : remboursement partiel (montant - 500 c) → 'partial_refund'
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CANCELLATION_FEE_CENTS = 500;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const { consultation_id } = (await req.json()) as { consultation_id: string };
    if (!consultation_id) {
      return new Response(JSON.stringify({ error: "consultation_id requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-06-20",
    });
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: consultation, error: fetchError } = await supabaseAdmin
      .from("visio_consultations")
      .select(
        "id, scheduled_at, amount_cents, stripe_payment_intent_id, payment_status",
      )
      .eq("id", consultation_id)
      .single();

    if (fetchError) throw fetchError;
    if (!consultation?.stripe_payment_intent_id) {
      throw new Error("Aucun paiement Stripe associé à cette consultation");
    }
    if (consultation.payment_status === "refunded" || consultation.payment_status === "partial_refund") {
      throw new Error("Consultation déjà remboursée");
    }

    const scheduledAt = new Date(consultation.scheduled_at as string).getTime();
    const hoursBefore = (scheduledAt - Date.now()) / (1000 * 60 * 60);
    const within24h = hoursBefore < 24;

    const amount = consultation.amount_cents ?? 0;
    const refundAmount = within24h
      ? Math.max(0, amount - CANCELLATION_FEE_CENTS)
      : amount;

    const refund = await stripe.refunds.create({
      payment_intent: consultation.stripe_payment_intent_id,
      amount: refundAmount,
      metadata: { consultation_id, within24h: String(within24h) },
    });

    const newStatus = within24h ? "partial_refund" : "refunded";

    const { error: updateError } = await supabaseAdmin
      .from("visio_consultations")
      .update({
        payment_status: newStatus,
        status: "cancelled",
        cancellation_fee_cents: within24h ? CANCELLATION_FEE_CENTS : 0,
      })
      .eq("id", consultation_id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        refund_id: refund.id,
        refunded_cents: refundAmount,
        payment_status: newStatus,
        within_24h: within24h,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("refund-consultation error", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
