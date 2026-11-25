-- Rollback for db/migrations/016_profile_and_patient_linkage_guards.sql.
-- Run only if 016 has been applied and after confirming no later migration
-- depends on protect_patient_linkage_fields().
BEGIN;
DROP TRIGGER IF EXISTS protect_patient_linkage_fields_trg ON public.patients;
DROP FUNCTION IF EXISTS public.protect_patient_linkage_fields();

-- Restore the exact profile trigger implementation from migration 013.
CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.role() = 'service_role'
     OR pg_catalog.current_setting('app.allow_trusted_profile_write', true) = 'true' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN RAISE EXCEPTION 'PROFILE_ROLE_SERVER_ONLY'; END IF;
  IF NEW.pro_id IS DISTINCT FROM OLD.pro_id THEN RAISE EXCEPTION 'PROFILE_LINK_SERVER_ONLY'; END IF;
  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id THEN
    RAISE EXCEPTION 'STRIPE_STATE_SERVER_ONLY';
  END IF;
  IF NEW.plan IS DISTINCT FROM OLD.plan
     AND pg_catalog.current_setting('app.allow_patient_plan_update', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'COMMERCIAL_PLAN_REQUIRES_AUTHORIZED_RPC';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_sensitive_profile_fields()
  FROM PUBLIC, anon, authenticated, service_role;
COMMIT;
