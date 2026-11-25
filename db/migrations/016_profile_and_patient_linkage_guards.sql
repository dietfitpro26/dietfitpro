-- Diet Fit Pro: close profile/patient linkage write gaps found during V1 review.
-- PREPARED LOCALLY ONLY. Apply only after reviewing the complete SQL and
-- verifying the 013-015 migration history in the controlled environment.

BEGIN;

CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  caller_role public.app_role;
  target_role public.app_role;
  target_pro_id uuid;
BEGIN
  IF auth.role() = 'service_role'
     OR pg_catalog.current_setting('app.allow_trusted_profile_write', true) = 'true' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'PROFILE_ID_SERVER_ONLY';
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'PROFILE_ROLE_SERVER_ONLY';
  END IF;
  IF NEW.pro_id IS DISTINCT FROM OLD.pro_id THEN
    RAISE EXCEPTION 'PROFILE_LINK_SERVER_ONLY';
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'PROFILE_EMAIL_MUST_USE_AUTH_FLOW';
  END IF;
  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
     OR NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
    RAISE EXCEPTION 'FINANCIAL_PROFILE_FIELDS_SERVER_ONLY';
  END IF;
  SELECT p.role INTO caller_role FROM public.profiles AS p WHERE p.id = auth.uid();
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    SELECT p.role, p.pro_id INTO target_role, target_pro_id
      FROM public.profiles AS p WHERE p.id = OLD.id;
    IF pg_catalog.current_setting('app.allow_patient_plan_update', true) IS DISTINCT FROM 'true'
       OR caller_role IS DISTINCT FROM 'pro'::public.app_role
       OR target_role NOT IN ('patient'::public.app_role, 'subscriber'::public.app_role)
       OR target_pro_id IS DISTINCT FROM auth.uid()
       OR (pg_catalog.to_jsonb(NEW) - 'plan' - 'updated_at')
          IS DISTINCT FROM (pg_catalog.to_jsonb(OLD) - 'plan' - 'updated_at') THEN
      RAISE EXCEPTION 'COMMERCIAL_PLAN_REQUIRES_AUTHORIZED_RPC';
    END IF;
  END IF;
  IF caller_role = 'pro'::public.app_role
     AND NEW.id IS DISTINCT FROM auth.uid()
     AND (pg_catalog.to_jsonb(NEW) - 'plan' - 'updated_at')
         IS DISTINCT FROM (pg_catalog.to_jsonb(OLD) - 'plan' - 'updated_at') THEN
    RAISE EXCEPTION 'PRO_CANNOT_EDIT_PATIENT_ACCOUNT_PROFILE';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_sensitive_profile_fields() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.protect_patient_linkage_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE caller_role public.app_role;
BEGIN
  IF auth.role() = 'service_role' OR public.is_current_super_admin() THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  SELECT p.role INTO caller_role FROM public.profiles AS p WHERE p.id = auth.uid();
  IF TG_OP = 'INSERT' THEN
    IF caller_role IS DISTINCT FROM 'pro'::public.app_role
       OR NEW.pro_id IS DISTINCT FROM auth.uid() OR NEW.user_id IS NOT NULL THEN
      RAISE EXCEPTION 'PATIENT_INSERT_LINK_SERVER_ONLY';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.pro_id IS DISTINCT FROM OLD.pro_id THEN
    RAISE EXCEPTION 'PATIENT_ACCOUNT_LINK_SERVER_ONLY';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_patient_linkage_fields() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS protect_patient_linkage_fields_trg ON public.patients;
CREATE TRIGGER protect_patient_linkage_fields_trg
  BEFORE INSERT OR UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.protect_patient_linkage_fields();

COMMIT;
