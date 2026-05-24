-- Extend visio_consultations for scheduling/status/payment
ALTER TABLE public.visio_consultations
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS cancellation_fee_cents int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL;

ALTER TABLE public.visio_consultations
  ALTER COLUMN patient_user_id DROP NOT NULL,
  ALTER COLUMN room_url DROP NOT NULL;

ALTER TABLE public.visio_consultations
  DROP CONSTRAINT IF EXISTS visio_status_check;
ALTER TABLE public.visio_consultations
  ADD CONSTRAINT visio_status_check
  CHECK (status IN ('scheduled','completed','cancelled','refunded','no_show'));

ALTER TABLE public.visio_consultations
  DROP CONSTRAINT IF EXISTS visio_payment_status_check;
ALTER TABLE public.visio_consultations
  ADD CONSTRAINT visio_payment_status_check
  CHECK (payment_status IN ('pending','paid','refunded','partial_refund','failed'));

CREATE INDEX IF NOT EXISTS visio_scheduled_idx
  ON public.visio_consultations(scheduled_at);
