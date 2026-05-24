-- Migration 006 : intégration Stripe pour les téléconsultations
ALTER TABLE public.visio_consultations
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

CREATE INDEX IF NOT EXISTS idx_visio_consultations_stripe_pi
  ON public.visio_consultations (stripe_payment_intent_id);
