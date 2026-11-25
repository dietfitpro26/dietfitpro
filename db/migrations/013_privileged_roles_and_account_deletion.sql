-- DietFit Pro: privileged roles, profile guards and deletion-job authorization.
-- PREPARED ONLY. Do not execute against Supabase until the full SQL has been
-- reviewed and the owner UUID has been confirmed in Supabase Auth.
--
-- This is a forward migration. Do not edit migrations already applied to a
-- remote project. The repository migration history must be reconciled first.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS private.user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('super_admin')),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

ALTER TABLE private.user_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.user_roles FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.account_deletion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL,
  target_user_id uuid NOT NULL,
  request_id uuid NOT NULL,
  authorization_scope text NOT NULL
    CHECK (authorization_scope IN ('global', 'own-patient', 'own-account')),
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'failed', 'completed', 'cancelled')),
  step text NOT NULL DEFAULT 'authorization',
  attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  lock_until timestamptz,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (requested_by, request_id)
);

ALTER TABLE public.account_deletion_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.account_deletion_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.account_deletion_jobs TO service_role;
CREATE INDEX IF NOT EXISTS account_deletion_jobs_target_idx
  ON public.account_deletion_jobs (target_user_id, status);

-- Auth email delivery and Postgres cannot share one transaction. This private
-- claim serializes invitations; the final patient/profile link is atomic.
CREATE TABLE IF NOT EXISTS private.patient_invitation_claims (
  patient_id uuid PRIMARY KEY REFERENCES public.patients(id) ON DELETE CASCADE,
  pro_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'completed', 'cancelled')),
  lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.patient_invitation_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.patient_invitation_claims
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.claim_patient_invitation(
  p_actor_id uuid, p_patient_id uuid, p_email text, p_request_id uuid
)
RETURNS TABLE (claim_request_id uuid, auth_user_id uuid, claim_status text, created_now boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor_role public.app_role;
  patient_owner uuid;
  linked_user uuid;
  patient_email text;
  old_claim private.patient_invitation_claims%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL OR p_patient_id IS NULL OR p_request_id IS NULL
     OR p_email IS NULL OR pg_catalog.strpos(p_email, '@') < 2 THEN
    RAISE EXCEPTION 'INVALID_INVITATION_REQUEST';
  END IF;
  SELECT p.role INTO actor_role FROM public.profiles AS p WHERE p.id = p_actor_id;
  IF actor_role IS DISTINCT FROM 'pro'::public.app_role THEN
    RAISE EXCEPTION 'PROFESSIONAL_REQUIRED';
  END IF;
  SELECT p.pro_id, p.user_id, p.email INTO patient_owner, linked_user, patient_email
    FROM public.patients AS p WHERE p.id = p_patient_id FOR UPDATE;
  IF NOT FOUND OR patient_owner IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'PATIENT_OUTSIDE_PRO_SCOPE';
  END IF;
  IF linked_user IS NOT NULL THEN RAISE EXCEPTION 'PATIENT_ALREADY_LINKED'; END IF;
  IF pg_catalog.lower(pg_catalog.btrim(patient_email)) IS DISTINCT FROM
     pg_catalog.lower(pg_catalog.btrim(p_email)) THEN
    RAISE EXCEPTION 'INVITED_EMAIL_DOES_NOT_MATCH_PATIENT';
  END IF;

  SELECT c.* INTO old_claim FROM private.patient_invitation_claims AS c
   WHERE c.patient_id = p_patient_id FOR UPDATE;
  IF FOUND AND old_claim.status = 'reserved' THEN
    IF pg_catalog.lower(old_claim.email) IS DISTINCT FROM pg_catalog.lower(pg_catalog.btrim(p_email)) THEN
      RAISE EXCEPTION 'INVITATION_ALREADY_IN_PROGRESS';
    END IF;
    IF old_claim.auth_user_id IS NULL
       AND (old_claim.lease_until IS NULL OR old_claim.lease_until <= pg_catalog.now()) THEN
      UPDATE private.patient_invitation_claims AS c
         SET lease_until = pg_catalog.now() + interval '5 minutes',
             updated_at = pg_catalog.now()
       WHERE c.patient_id = p_patient_id;
      RETURN QUERY SELECT old_claim.request_id, NULL::uuid, old_claim.status, true;
      RETURN;
    END IF;
    RETURN QUERY SELECT old_claim.request_id, old_claim.auth_user_id, old_claim.status, false;
    RETURN;
  ELSIF FOUND AND old_claim.status = 'completed' THEN
    RAISE EXCEPTION 'PATIENT_ALREADY_LINKED';
  ELSIF FOUND THEN
    UPDATE private.patient_invitation_claims AS c
       SET pro_id = p_actor_id, request_id = p_request_id,
           email = pg_catalog.lower(pg_catalog.btrim(p_email)),
           auth_user_id = NULL, status = 'reserved',
           lease_until = pg_catalog.now() + interval '5 minutes',
           updated_at = pg_catalog.now()
     WHERE c.patient_id = p_patient_id;
  ELSE
    INSERT INTO private.patient_invitation_claims
      (patient_id, pro_id, request_id, email, lease_until)
    VALUES (p_patient_id, p_actor_id, p_request_id,
            pg_catalog.lower(pg_catalog.btrim(p_email)),
            pg_catalog.now() + interval '5 minutes');
  END IF;
  RETURN QUERY SELECT p_request_id, NULL::uuid, 'reserved'::text, true;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_patient_invitation(uuid, uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_patient_invitation(uuid, uuid, text, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.recover_patient_invitation_user(
  p_actor_id uuid, p_patient_id uuid, p_request_id uuid
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  claim_row private.patient_invitation_claims%ROWTYPE;
  recovered_id uuid;
  match_count bigint;
BEGIN
  SELECT c.* INTO claim_row FROM private.patient_invitation_claims AS c
   WHERE c.patient_id = p_patient_id AND c.pro_id = p_actor_id
     AND c.request_id = p_request_id AND c.status = 'reserved'
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVITATION_CLAIM_NOT_FOUND'; END IF;
  IF claim_row.auth_user_id IS NOT NULL THEN RETURN claim_row.auth_user_id; END IF;
  SELECT pg_catalog.count(*), (pg_catalog.array_agg(u.id))[1]
    INTO match_count, recovered_id
    FROM auth.users AS u
   WHERE pg_catalog.lower(u.email) = claim_row.email
     AND u.raw_user_meta_data->>'invitation_request_id' = p_request_id::text;
  IF match_count = 0 THEN RETURN NULL; END IF;
  IF match_count <> 1 THEN RAISE EXCEPTION 'AMBIGUOUS_INVITATION_RECOVERY'; END IF;
  UPDATE private.patient_invitation_claims AS c
     SET auth_user_id = recovered_id, lease_until = NULL, updated_at = pg_catalog.now()
   WHERE c.patient_id = p_patient_id;
  RETURN recovered_id;
END;
$$;
REVOKE ALL ON FUNCTION public.recover_patient_invitation_user(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recover_patient_invitation_user(uuid, uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.record_patient_invitation_user(
  p_actor_id uuid, p_patient_id uuid, p_request_id uuid, p_auth_user_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE claim_email text; auth_email text; existing_auth_user uuid;
BEGIN
  SELECT c.email, c.auth_user_id INTO claim_email, existing_auth_user
    FROM private.patient_invitation_claims AS c
   WHERE c.patient_id = p_patient_id AND c.pro_id = p_actor_id
     AND c.request_id = p_request_id AND c.status = 'reserved'
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVITATION_CLAIM_NOT_FOUND'; END IF;
  SELECT pg_catalog.lower(u.email) INTO auth_email
    FROM auth.users AS u WHERE u.id = p_auth_user_id;
  IF auth_email IS DISTINCT FROM claim_email THEN RAISE EXCEPTION 'INVITED_EMAIL_MISMATCH'; END IF;
  IF existing_auth_user IS NOT NULL AND existing_auth_user IS DISTINCT FROM p_auth_user_id THEN
    RAISE EXCEPTION 'INVITATION_USER_MISMATCH';
  END IF;
  UPDATE private.patient_invitation_claims AS c
     SET auth_user_id = p_auth_user_id, lease_until = NULL, updated_at = pg_catalog.now()
   WHERE c.patient_id = p_patient_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_patient_invitation_user(uuid, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_patient_invitation_user(uuid, uuid, uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.complete_patient_invitation(
  p_actor_id uuid, p_patient_id uuid, p_request_id uuid, p_auth_user_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  claim_row private.patient_invitation_claims%ROWTYPE;
  patient_owner uuid;
  linked_user uuid;
  account_email text;
  patient_email text;
  account_role public.app_role;
  account_pro_id uuid;
BEGIN
  SELECT c.* INTO claim_row FROM private.patient_invitation_claims AS c
   WHERE c.patient_id = p_patient_id AND c.pro_id = p_actor_id
     AND c.request_id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVITATION_CLAIM_NOT_FOUND'; END IF;
  IF claim_row.status = 'completed' AND claim_row.auth_user_id = p_auth_user_id THEN RETURN; END IF;
  IF claim_row.status <> 'reserved' OR claim_row.auth_user_id IS DISTINCT FROM p_auth_user_id THEN
    RAISE EXCEPTION 'INVITATION_CLAIM_MISMATCH';
  END IF;
  SELECT pg_catalog.lower(u.email) INTO account_email
    FROM auth.users AS u WHERE u.id = p_auth_user_id;
  IF account_email IS DISTINCT FROM claim_row.email THEN
    RAISE EXCEPTION 'INVITED_EMAIL_MISMATCH';
  END IF;
  SELECT p.pro_id, p.user_id, p.email INTO patient_owner, linked_user, patient_email
    FROM public.patients AS p WHERE p.id = p_patient_id FOR UPDATE;
  IF patient_owner IS DISTINCT FROM p_actor_id
     OR (linked_user IS NOT NULL AND linked_user IS DISTINCT FROM p_auth_user_id) THEN
    RAISE EXCEPTION 'PATIENT_LINK_CONFLICT';
  END IF;
  IF pg_catalog.lower(pg_catalog.btrim(patient_email)) IS DISTINCT FROM claim_row.email THEN
    RAISE EXCEPTION 'PATIENT_EMAIL_CHANGED_DURING_INVITATION';
  END IF;
  SELECT p.role, p.pro_id INTO account_role, account_pro_id
    FROM public.profiles AS p WHERE p.id = p_auth_user_id FOR UPDATE;
  IF account_role IS DISTINCT FROM 'subscriber'::public.app_role
     OR (account_pro_id IS NOT NULL AND account_pro_id IS DISTINCT FROM p_actor_id) THEN
    RAISE EXCEPTION 'INVITED_PROFILE_NOT_ELIGIBLE';
  END IF;
  PERFORM pg_catalog.set_config('app.allow_trusted_profile_write', 'true', true);
  UPDATE public.profiles AS p
     SET role = 'patient'::public.app_role, pro_id = p_actor_id, updated_at = pg_catalog.now()
   WHERE p.id = p_auth_user_id;
  UPDATE public.patients AS p SET user_id = p_auth_user_id, updated_at = pg_catalog.now()
   WHERE p.id = p_patient_id AND p.pro_id = p_actor_id
     AND (p.user_id IS NULL OR p.user_id = p_auth_user_id);
  UPDATE private.patient_invitation_claims AS c
     SET status = 'completed', updated_at = pg_catalog.now()
   WHERE c.patient_id = p_patient_id;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_patient_invitation(uuid, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_patient_invitation(uuid, uuid, uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_patient_invitation(
  p_actor_id uuid, p_patient_id uuid, p_request_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE private.patient_invitation_claims AS c
     SET status = 'cancelled', lease_until = NULL, updated_at = pg_catalog.now()
   WHERE c.patient_id = p_patient_id AND c.pro_id = p_actor_id
     AND c.request_id = p_request_id AND c.status = 'reserved'
     AND c.auth_user_id IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_patient_invitation(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_patient_invitation(uuid, uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.patient_invitation_status(
  p_actor_id uuid, p_patient_id uuid
)
RETURNS TABLE (has_account boolean, activated boolean, pending boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  patient_owner uuid;
  linked_user uuid;
  claimed_user uuid;
  claim_state text;
  confirmed timestamptz;
BEGIN
  SELECT p.pro_id, p.user_id INTO patient_owner, linked_user
    FROM public.patients AS p WHERE p.id = p_patient_id;
  IF patient_owner IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'PATIENT_OUTSIDE_PRO_SCOPE'; END IF;
  SELECT c.auth_user_id, c.status INTO claimed_user, claim_state
    FROM private.patient_invitation_claims AS c
   WHERE c.patient_id = p_patient_id AND c.pro_id = p_actor_id;
  IF linked_user IS NULL THEN linked_user := claimed_user; END IF;
  IF linked_user IS NOT NULL THEN
    SELECT u.confirmed_at INTO confirmed FROM auth.users AS u WHERE u.id = linked_user;
  END IF;
  RETURN QUERY SELECT
    linked_user IS NOT NULL OR claim_state = 'reserved',
    confirmed IS NOT NULL,
    claim_state = 'reserved' AND confirmed IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.patient_invitation_status(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.patient_invitation_status(uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.complete_subscriber_invitation(
  p_actor_id uuid, p_auth_user_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_role public.app_role; target_role public.app_role; target_pro_id uuid;
BEGIN
  SELECT p.role INTO actor_role FROM public.profiles AS p WHERE p.id = p_actor_id;
  IF actor_role IS DISTINCT FROM 'pro'::public.app_role THEN
    RAISE EXCEPTION 'PROFESSIONAL_REQUIRED';
  END IF;
  SELECT p.role, p.pro_id INTO target_role, target_pro_id
    FROM public.profiles AS p WHERE p.id = p_auth_user_id FOR UPDATE;
  IF target_role IS DISTINCT FROM 'subscriber'::public.app_role
     OR (target_pro_id IS NOT NULL AND target_pro_id IS DISTINCT FROM p_actor_id) THEN
    RAISE EXCEPTION 'INVITED_PROFILE_NOT_ELIGIBLE';
  END IF;
  PERFORM pg_catalog.set_config('app.allow_trusted_profile_write', 'true', true);
  UPDATE public.profiles AS p SET pro_id = p_actor_id, updated_at = pg_catalog.now()
   WHERE p.id = p_auth_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_subscriber_invitation(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_subscriber_invitation(uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.is_super_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM private.user_roles AS ur
    JOIN auth.users AS u ON u.id = ur.user_id
    WHERE ur.user_id = p_user_id
      AND ur.role = 'super_admin'
      AND (u.banned_until IS NULL OR u.banned_until < pg_catalog.now())
  );
$$;

REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.is_current_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
      FROM private.user_roles AS ur
      JOIN auth.users AS u ON u.id = ur.user_id
     WHERE ur.user_id = auth.uid()
       AND ur.role = 'super_admin'
       AND (u.banned_until IS NULL OR u.banned_until < pg_catalog.now())
  );
$$;
REVOKE ALL ON FUNCTION public.is_current_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_current_super_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.active_super_admin_count()
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT count(*)
    FROM private.user_roles AS ur
    JOIN auth.users AS u ON u.id = ur.user_id
   WHERE ur.role = 'super_admin'
     AND (u.banned_until IS NULL OR u.banned_until < pg_catalog.now());
$$;
REVOKE ALL ON FUNCTION public.active_super_admin_count() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.active_super_admin_count() TO service_role;

CREATE OR REPLACE FUNCTION public.set_super_admin(
  p_actor_id uuid, p_target_id uuid, p_enabled boolean
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE admins_left bigint;
BEGIN
  IF NOT public.is_super_admin(p_actor_id) THEN RAISE EXCEPTION 'SUPER_ADMIN_REQUIRED'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.users AS u
     WHERE u.id = p_target_id
       AND (u.banned_until IS NULL OR u.banned_until < pg_catalog.now())
  ) THEN
    RAISE EXCEPTION 'ACTIVE_TARGET_AUTH_USER_REQUIRED';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(739184220011::bigint);
  IF p_enabled THEN
    INSERT INTO private.user_roles (user_id, role, granted_by)
    VALUES (p_target_id, 'super_admin', p_actor_id)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    SELECT count(*) INTO admins_left
      FROM private.user_roles AS ur
      JOIN auth.users AS u ON u.id = ur.user_id
     WHERE ur.role = 'super_admin'
       AND ur.user_id <> p_target_id
       AND (u.banned_until IS NULL OR u.banned_until < pg_catalog.now());
    IF admins_left < 1 AND EXISTS (SELECT 1 FROM private.user_roles AS ur
      WHERE ur.user_id = p_target_id AND ur.role = 'super_admin') THEN
      RAISE EXCEPTION 'LAST_SUPER_ADMIN';
    END IF;
    DELETE FROM private.user_roles WHERE user_id = p_target_id AND role = 'super_admin';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_super_admin(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_super_admin(uuid, uuid, boolean) TO service_role;

-- Initial bootstrap is deliberately not executable by API roles, including
-- service_role. A database owner must call it only after confirming the UUID
-- in Supabase Auth and receiving the separate deployment authorization.
CREATE OR REPLACE FUNCTION public.bootstrap_first_super_admin(
  p_confirmed_user_id uuid,
  p_typed_confirmation uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_confirmed_user_id IS NULL
     OR p_typed_confirmation IS DISTINCT FROM p_confirmed_user_id THEN
    RAISE EXCEPTION 'UUID_CONFIRMATION_MISMATCH';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(739184220011::bigint);
  IF public.active_super_admin_count() > 0 THEN
    RAISE EXCEPTION 'SUPER_ADMIN_ALREADY_BOOTSTRAPPED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.users AS u
     WHERE u.id = p_confirmed_user_id
       AND (u.banned_until IS NULL OR u.banned_until < pg_catalog.now())
  ) THEN
    RAISE EXCEPTION 'ACTIVE_AUTH_USER_NOT_FOUND';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
     WHERE p.id = p_confirmed_user_id AND p.role = 'pro'::public.app_role
  ) THEN
    RAISE EXCEPTION 'CONFIRMED_OWNER_PROFILE_REQUIRED';
  END IF;
  INSERT INTO private.user_roles (user_id, role, granted_by)
  VALUES (p_confirmed_user_id, 'super_admin', p_confirmed_user_id)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.bootstrap_first_super_admin(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_account_active(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users AS u WHERE u.id = p_user_id)
     AND NOT EXISTS (
       SELECT 1
       FROM public.account_deletion_jobs AS j
       WHERE j.target_user_id = p_user_id
         AND j.status IN ('processing', 'failed', 'completed')
     );
$$;

REVOKE ALL ON FUNCTION public.is_account_active(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_active(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.is_current_account_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM auth.users AS u WHERE u.id = auth.uid())
     AND NOT EXISTS (
       SELECT 1
       FROM public.account_deletion_jobs AS j
       WHERE j.target_user_id = auth.uid()
         AND j.status IN ('processing', 'failed', 'completed')
     );
$$;

REVOKE ALL ON FUNCTION public.is_current_account_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_current_account_active() TO authenticated;

CREATE OR REPLACE FUNCTION private.guard_last_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  remaining_admins bigint;
BEGIN
  IF OLD.role = 'super_admin' THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(739184220011::bigint);

    SELECT count(*)
      INTO remaining_admins
      FROM private.user_roles AS ur
      JOIN auth.users AS u ON u.id = ur.user_id
     WHERE ur.role = 'super_admin'
       AND ur.user_id <> OLD.user_id
       AND (u.banned_until IS NULL OR u.banned_until < pg_catalog.now());

    IF remaining_admins < 1 THEN
      RAISE EXCEPTION 'LAST_SUPER_ADMIN: transfer the role before removing this account';
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS guard_last_super_admin_delete ON private.user_roles;
CREATE TRIGGER guard_last_super_admin_delete
  BEFORE DELETE ON private.user_roles
  FOR EACH ROW EXECUTE FUNCTION private.guard_last_super_admin();

CREATE OR REPLACE FUNCTION public.begin_account_deletion(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_confirmation text,
  p_request_id uuid
)
RETURNS TABLE (job_id uuid, job_status text, authorization_scope text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  existing_job public.account_deletion_jobs%ROWTYPE;
  actor_role public.app_role;
  target_role public.app_role;
  target_pro_id uuid;
  is_admin boolean;
  target_is_admin boolean;
  linked_patient_count bigint;
  scope_name text;
BEGIN
  IF p_actor_id IS NULL OR p_target_user_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_REQUEST';
  END IF;

  IF p_confirmation <> 'DELETE ' || p_target_user_id::text THEN
    RAISE EXCEPTION 'CONFIRMATION_REQUIRED';
  END IF;

  -- Replays with the same request id return the existing job; another target
  -- cannot be substituted for an idempotency key already in use.
  SELECT j.* INTO existing_job
    FROM public.account_deletion_jobs AS j
   WHERE j.requested_by = p_actor_id
     AND j.request_id = p_request_id
   FOR UPDATE;

  IF FOUND THEN
    IF existing_job.target_user_id <> p_target_user_id THEN
      RAISE EXCEPTION 'REQUEST_ID_REUSED';
    END IF;

    IF existing_job.status = 'completed' THEN
      RETURN QUERY SELECT existing_job.id, existing_job.status,
                          existing_job.authorization_scope;
      RETURN;
    END IF;

    IF existing_job.status = 'processing'
       AND existing_job.lock_until > now() THEN
      RAISE EXCEPTION 'DELETION_IN_PROGRESS';
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users AS u WHERE u.id = p_actor_id) THEN
    RAISE EXCEPTION 'CALLER_NOT_FOUND';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users AS u WHERE u.id = p_target_user_id) THEN
    RAISE EXCEPTION 'TARGET_NOT_FOUND';
  END IF;

  SELECT p.role INTO actor_role
    FROM public.profiles AS p WHERE p.id = p_actor_id;
  SELECT p.role, p.pro_id INTO target_role, target_pro_id
    FROM public.profiles AS p WHERE p.id = p_target_user_id;

  is_admin := public.is_super_admin(p_actor_id);
  target_is_admin := public.is_super_admin(p_target_user_id);

  SELECT count(*) INTO linked_patient_count
    FROM public.patients AS p
   WHERE p.pro_id = p_target_user_id;

  IF is_admin THEN
    IF target_is_admin THEN
      PERFORM pg_catalog.pg_advisory_xact_lock(739184220011::bigint);
      IF public.active_super_admin_count() <= 1 THEN
        RAISE EXCEPTION 'LAST_SUPER_ADMIN';
      END IF;
    END IF;

    IF target_role = 'pro' AND linked_patient_count > 0 THEN
      RAISE EXCEPTION 'PRO_HAS_PATIENTS: reassign or remove patient records first';
    END IF;
    scope_name := 'global';
  ELSIF p_actor_id = p_target_user_id
        AND actor_role IN ('patient', 'subscriber') THEN
    scope_name := 'own-account';
  ELSIF actor_role = 'pro'
        AND target_role IN ('patient', 'subscriber')
        AND (
          target_pro_id = p_actor_id
          OR EXISTS (
            SELECT 1 FROM public.patients AS p
             WHERE p.user_id = p_target_user_id AND p.pro_id = p_actor_id
          )
        ) THEN
    scope_name := 'own-patient';
  ELSE
    RAISE EXCEPTION 'DELETE_NOT_AUTHORIZED';
  END IF;

  IF existing_job.id IS NULL THEN
    INSERT INTO public.account_deletion_jobs (
      requested_by, target_user_id, request_id, authorization_scope,
      status, step, lock_until
    ) VALUES (
      p_actor_id, p_target_user_id, p_request_id, scope_name,
      'processing', 'preflight', now() + interval '10 minutes'
    ) RETURNING id INTO job_id;
    job_status := 'processing';
    authorization_scope := scope_name;
  ELSE
    UPDATE public.account_deletion_jobs AS j
       SET status = 'processing',
           step = 'preflight',
           attempt_count = j.attempt_count + 1,
           lock_until = now() + interval '10 minutes',
           error_code = NULL,
           updated_at = now(),
           authorization_scope = scope_name
     WHERE j.id = existing_job.id
     RETURNING j.id, j.status, j.authorization_scope
          INTO job_id, job_status, authorization_scope;
  END IF;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_account_deletion(uuid, uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_account_deletion(uuid, uuid, text, uuid)
  TO service_role;

-- Freeze role, ownership and Stripe-authored fields for every browser caller.
-- The existing professional plan workflow remains available through its
-- server-validated RPC, but it does not write a Stripe payment status.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM pg_catalog.set_config('app.allow_trusted_profile_write', 'true', true);
  INSERT INTO public.profiles (id, email, full_name, role, plan, pro_id, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'subscriber'::public.app_role,
    'basic'::public.subscription_plan,
    NULL,
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

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

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'PROFILE_ROLE_SERVER_ONLY';
  END IF;
  IF NEW.pro_id IS DISTINCT FROM OLD.pro_id THEN
    RAISE EXCEPTION 'PROFILE_LINK_SERVER_ONLY';
  END IF;
  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id THEN
    RAISE EXCEPTION 'STRIPE_STATE_SERVER_ONLY';
  END IF;
  IF NEW.plan IS DISTINCT FROM OLD.plan
     AND pg_catalog.current_setting('app.allow_patient_plan_update', true)
           IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'COMMERCIAL_PLAN_REQUIRES_AUTHORIZED_RPC';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_profile_insert()
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
  IF NEW.id IS DISTINCT FROM auth.uid()
     OR NEW.role IS DISTINCT FROM 'subscriber'::public.app_role
     OR NEW.plan IS DISTINCT FROM 'basic'::public.subscription_plan
     OR NEW.pro_id IS NOT NULL
     OR NEW.subscription_status IS DISTINCT FROM 'none'::public.subscription_status
     OR NEW.stripe_customer_id IS NOT NULL
     OR NEW.stripe_subscription_id IS NOT NULL THEN
    RAISE EXCEPTION 'PROFILE_INSERT_SERVER_ONLY_FIELDS';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_insert_trg ON public.profiles;
CREATE TRIGGER guard_profile_insert_trg
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_insert();

DROP TRIGGER IF EXISTS protect_sensitive_profile_fields_trg ON public.profiles;
CREATE TRIGGER protect_sensitive_profile_fields_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_sensitive_profile_fields();

CREATE OR REPLACE FUNCTION public.protect_stripe_billing_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  old_financial_fields jsonb;
  new_financial_fields jsonb;
  caller_role public.app_role;
  target_role public.app_role;
  target_pro_id uuid;
  target_user_id uuid;
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;

  IF TG_OP = 'INSERT' THEN
    target_user_id := (pg_catalog.to_jsonb(NEW)->>'user_id')::uuid;
    SELECT p.role INTO caller_role FROM public.profiles AS p WHERE p.id = auth.uid();
    SELECT p.role, p.pro_id INTO target_role, target_pro_id
      FROM public.profiles AS p WHERE p.id = target_user_id;
    IF pg_catalog.current_setting('app.allow_patient_plan_update', true) IS DISTINCT FROM 'true'
       OR caller_role IS DISTINCT FROM 'pro'::public.app_role
       OR target_role IS DISTINCT FROM 'subscriber'::public.app_role
       OR target_pro_id IS DISTINCT FROM auth.uid()
       OR pg_catalog.to_jsonb(NEW)->>'status' IS DISTINCT FROM 'none'
       OR pg_catalog.to_jsonb(NEW)->>'managed_by_pro' IS DISTINCT FROM 'true'
       OR pg_catalog.to_jsonb(NEW)->>'stripe_customer_id' IS NOT NULL
       OR pg_catalog.to_jsonb(NEW)->>'stripe_subscription_id' IS NOT NULL THEN
      RAISE EXCEPTION 'BILLING_INSERT_SERVER_ONLY';
    END IF;
    RETURN NEW;
  END IF;

  old_financial_fields := pg_catalog.to_jsonb(OLD) - 'managed_by_pro' - 'updated_at';
  new_financial_fields := pg_catalog.to_jsonb(NEW) - 'managed_by_pro' - 'updated_at';
  IF new_financial_fields IS DISTINCT FROM old_financial_fields THEN
    RAISE EXCEPTION 'STRIPE_BILLING_FIELDS_SERVER_ONLY';
  END IF;

  IF NEW.managed_by_pro IS DISTINCT FROM OLD.managed_by_pro THEN
    target_user_id := (pg_catalog.to_jsonb(NEW)->>'user_id')::uuid;
    SELECT p.role INTO caller_role FROM public.profiles AS p WHERE p.id = auth.uid();
    SELECT p.role, p.pro_id INTO target_role, target_pro_id
      FROM public.profiles AS p WHERE p.id = target_user_id;
    IF caller_role IS DISTINCT FROM 'pro'::public.app_role
       OR target_role IS DISTINCT FROM 'subscriber'::public.app_role
       OR target_pro_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'BILLING_MODE_OUTSIDE_PRO_SCOPE';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_stripe_billing_fields_trg ON public.subscriber_billing;
CREATE TRIGGER protect_stripe_billing_fields_trg
  BEFORE INSERT OR UPDATE ON public.subscriber_billing
  FOR EACH ROW EXECUTE FUNCTION public.protect_stripe_billing_fields();

-- Remove direct API write paths, including permissive ALL policies. Reads are
-- recreated for the account itself, its assigned professional, or super_admin.
ALTER TABLE public.subscriber_billing ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname FROM pg_catalog.pg_policies
     WHERE schemaname = 'public' AND tablename = 'subscriber_billing'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.subscriber_billing', policy_row.policyname);
  END LOOP;
END;
$$;
CREATE POLICY subscriber_billing_read_own_assigned_or_admin
  ON public.subscriber_billing FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_current_super_admin()
    OR (
      public.has_role(auth.uid(), 'pro'::public.app_role)
      AND (
        EXISTS (
          SELECT 1 FROM public.profiles AS p
           WHERE p.id = subscriber_billing.user_id AND p.pro_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.patients AS pt
           WHERE pt.user_id = subscriber_billing.user_id AND pt.pro_id = auth.uid()
        )
      )
    )
  );

-- Keep the existing manual-management workflows available. The row policy
-- limits professionals to their own subscribers; the trigger above limits the
-- changed fields to managed_by_pro and updated_at.
CREATE POLICY subscriber_billing_update_assigned_pro
  ON public.subscriber_billing FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'pro'::public.app_role)
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles AS p
         WHERE p.id = subscriber_billing.user_id AND p.pro_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.patients AS pt
         WHERE pt.user_id = subscriber_billing.user_id AND pt.pro_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'pro'::public.app_role)
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles AS p
         WHERE p.id = subscriber_billing.user_id AND p.pro_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.patients AS pt
         WHERE pt.user_id = subscriber_billing.user_id AND pt.pro_id = auth.uid()
      )
    )
  );

-- Replace existing profile SELECT/UPDATE policies so permissive policies
-- cannot combine to restore broader access. Preserve INSERT policies; the
-- profile INSERT trigger above enforces the safe signup defaults.
DO $$
DECLARE policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname
      FROM pg_catalog.pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'profiles'
       AND cmd IN ('SELECT', 'UPDATE', 'ALL')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.profiles', policy_row.policyname);
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS profiles_select_self_or_pro ON public.profiles;
CREATE POLICY profiles_select_self_or_assigned_pro
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_current_super_admin()
    OR pro_id = auth.uid()
  );

CREATE POLICY profiles_update_self_or_assigned_pro
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    public.is_current_super_admin()
    OR id = auth.uid()
    OR (
      pro_id = auth.uid()
      AND role IN ('patient'::public.app_role, 'subscriber'::public.app_role)
      AND public.has_role(auth.uid(), 'pro'::public.app_role)
    )
  )
  WITH CHECK (
    public.is_current_super_admin()
    OR id = auth.uid()
    OR (
      pro_id = auth.uid()
      AND role IN ('patient'::public.app_role, 'subscriber'::public.app_role)
      AND public.has_role(auth.uid(), 'pro'::public.app_role)
    )
  );

-- Commercial entitlement remains editable through the ownership-checked RPC.
-- Stripe status and customer/subscription identifiers remain untouched.
CREATE OR REPLACE FUNCTION public.set_patient_plan(
  p_patient_user_id uuid,
  p_plan text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_role public.app_role;
  target_role public.app_role;
  target_pro_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;
  IF p_plan IS NULL OR p_plan NOT IN ('basic', 'premium') THEN
    RAISE EXCEPTION 'INVALID_COMMERCIAL_PLAN';
  END IF;

  SELECT p.role INTO caller_role
    FROM public.profiles AS p WHERE p.id = auth.uid();
  IF caller_role IS DISTINCT FROM 'pro'::public.app_role THEN
    RAISE EXCEPTION 'PROFESSIONAL_REQUIRED';
  END IF;

  SELECT p.role, p.pro_id INTO target_role, target_pro_id
    FROM public.profiles AS p WHERE p.id = p_patient_user_id;
  IF target_role IS NULL THEN
    RAISE EXCEPTION 'TARGET_NOT_FOUND';
  END IF;
  IF target_role NOT IN ('patient'::public.app_role, 'subscriber'::public.app_role)
     OR target_pro_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'TARGET_OUTSIDE_PRO_SCOPE';
  END IF;

  PERFORM pg_catalog.set_config('app.allow_patient_plan_update', 'true', true);
  UPDATE public.profiles
     SET plan = p_plan::public.subscription_plan,
         updated_at = now()
   WHERE id = p_patient_user_id;

  IF target_role = 'subscriber'::public.app_role THEN
    INSERT INTO public.subscriber_billing (
      user_id, status, managed_by_pro, updated_at
    ) VALUES (
      p_patient_user_id, 'none', true, now()
    )
    ON CONFLICT (user_id) DO UPDATE
      SET managed_by_pro = true,
          updated_at = now();
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_patient_plan(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_patient_plan(uuid, text) TO authenticated, service_role;

-- Restrictive policies make a pending/deleted account's existing access token
-- ineffective for Data API and Storage requests while the deletion job runs.
DO $$
DECLARE table_row record;
BEGIN
  FOR table_row IN
    SELECT c.relname
      FROM pg_catalog.pg_class AS c
      JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p')
       AND c.relname <> 'account_deletion_jobs'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS account_deletion_active_guard ON public.%I',
      table_row.relname
    );
    EXECUTE format(
      'CREATE POLICY account_deletion_active_guard ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_current_account_active()) WITH CHECK (public.is_current_account_active())',
      table_row.relname
    );
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS account_deletion_active_guard ON storage.objects;
CREATE POLICY account_deletion_active_guard
  ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_current_account_active())
  WITH CHECK (public.is_current_account_active());

-- No privileged role is assigned by this migration. After the owner UUID is
-- independently confirmed, a database owner may call
-- public.bootstrap_first_super_admin(<confirmed UUID>, <same UUID>).

COMMIT;

