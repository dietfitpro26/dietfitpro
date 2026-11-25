-- DietFit Pro: auditable per-user feature entitlements.
-- PREPARED LOCALLY ONLY. Depends on 013_privileged_roles_and_account_deletion.sql.
-- No V2 capability is enabled by this migration.

BEGIN;

CREATE TABLE IF NOT EXISTS private.feature_catalog (
  feature_key text PRIMARY KEY
    CHECK (feature_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  release_channel text NOT NULL CHECK (release_channel IN ('v1', 'v2')),
  globally_enabled boolean NOT NULL DEFAULT false,
  basic_included boolean NOT NULL DEFAULT false,
  premium_included boolean NOT NULL DEFAULT false,
  professional_included boolean NOT NULL DEFAULT false,
  patient_basic_included boolean NOT NULL DEFAULT false,
  patient_premium_included boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CHECK (release_channel = 'v1' OR globally_enabled = false)
);

-- The availability gate is separate from both subscriptions and user grants.
-- A V2 row cannot be enabled through the per-user grant RPC.
-- Patient visio access remains care-plan-specific and is intentionally not
-- inferred here; V2 stays unavailable until that rule is implemented later.
INSERT INTO private.feature_catalog
  (feature_key, release_channel, globally_enabled, basic_included, premium_included,
   professional_included, patient_basic_included, patient_premium_included)
VALUES
  ('access_sport_programs', 'v1', true, true, true, true, true, true),
  ('access_nutrition_programs', 'v1', true, true, true, true, true, true),
  ('access_messaging', 'v1', true, false, true, true, true, true),
  ('access_premium_content', 'v1', true, false, true, true, false, true),
  ('sport_sessions_unlimited', 'v1', true, false, true, true, false, true),
  ('access_recipes', 'v2', false, false, true, false, false, true),
  ('visio', 'v2', false, false, true, false, false, false),
  ('ai_coach', 'v2', false, false, true, false, false, true)
ON CONFLICT (feature_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS private.user_feature_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- UUIDs remain as audit references if either account is later deleted.
  user_id uuid NOT NULL,
  feature_key text NOT NULL REFERENCES private.feature_catalog(feature_key) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('grant', 'revoke')),
  starts_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  expires_at timestamptz,
  reason text NOT NULL CHECK (char_length(pg_catalog.btrim(reason)) BETWEEN 3 AND 500),
  changed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CHECK (expires_at IS NULL OR expires_at > starts_at)
);

CREATE INDEX IF NOT EXISTS user_feature_overrides_latest_idx
  ON private.user_feature_overrides (user_id, feature_key, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS private.feature_availability_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text NOT NULL REFERENCES private.feature_catalog(feature_key) ON DELETE RESTRICT,
  globally_enabled boolean NOT NULL,
  reason text NOT NULL CHECK (char_length(pg_catalog.btrim(reason)) BETWEEN 3 AND 500),
  changed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

ALTER TABLE private.feature_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.user_feature_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.feature_availability_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.feature_catalog
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE private.user_feature_overrides
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE private.feature_availability_events
  FROM PUBLIC, anon, authenticated, service_role;

-- Retire the older client-writable override table when it exists. Existing
-- rows are preserved for audit, but no role can continue changing entitlements
-- through its legacy policies or table grants.
DO $$
DECLARE policy_row record;
BEGIN
  IF pg_catalog.to_regclass('public.subscriber_overrides') IS NOT NULL THEN
    FOR policy_row IN
      SELECT policyname FROM pg_catalog.pg_policies
       WHERE schemaname = 'public' AND tablename = 'subscriber_overrides'
    LOOP
      EXECUTE pg_catalog.format(
        'DROP POLICY %I ON public.subscriber_overrides', policy_row.policyname
      );
    END LOOP;
    EXECUTE 'ALTER TABLE public.subscriber_overrides ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.subscriber_overrides FROM PUBLIC, anon, authenticated';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_feature_access(
  p_feature_key text,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  feature_row private.feature_catalog%ROWTYPE;
  user_role text;
  user_plan text;
  billing_status text;
  billing_plan text;
  billing_managed boolean;
  latest_action text;
  grant_starts_at timestamptz;
  grant_expires_at timestamptz;
  base_access boolean := false;
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS NULL
     OR (p_user_id <> auth.uid() AND NOT public.is_current_super_admin()) THEN
    RETURN false;
  END IF;

  SELECT * INTO feature_row FROM private.feature_catalog AS fc
   WHERE fc.feature_key = p_feature_key;
  IF NOT FOUND OR feature_row.release_channel <> 'v1'
     OR NOT feature_row.globally_enabled THEN RETURN false; END IF;

  SELECT p.role::text, p.plan::text INTO user_role, user_plan
    FROM public.profiles AS p WHERE p.id = p_user_id;
  IF user_role IS NULL THEN RETURN false; END IF;

  IF user_role = 'subscriber' THEN
    SELECT b.status, b.billing_plan, b.managed_by_pro
      INTO billing_status, billing_plan, billing_managed
      FROM public.subscriber_billing AS b WHERE b.user_id = p_user_id;
    IF NOT FOUND THEN RETURN false; END IF;
    IF billing_managed IS DISTINCT FROM true THEN
      IF billing_status IS NULL OR billing_status NOT IN ('active', 'trialing', 'past_due')
         OR billing_plan IS NULL OR billing_plan NOT IN ('basic', 'premium') THEN RETURN false; END IF;
      user_plan := billing_plan;
    END IF;
  END IF;

  IF user_role = 'pro' THEN
    base_access := feature_row.professional_included;
  ELSIF user_role = 'subscriber' AND user_plan = 'basic' THEN
    base_access := feature_row.basic_included;
  ELSIF user_role = 'subscriber' AND user_plan = 'premium' THEN
    base_access := feature_row.premium_included;
  ELSIF user_role = 'patient' AND user_plan = 'premium' THEN
    base_access := feature_row.patient_premium_included;
  ELSIF user_role = 'patient' THEN
    base_access := feature_row.patient_basic_included;
  END IF;

  SELECT o.action, o.starts_at, o.expires_at
    INTO latest_action, grant_starts_at, grant_expires_at
    FROM private.user_feature_overrides AS o
   WHERE o.user_id = p_user_id AND o.feature_key = p_feature_key
   ORDER BY o.created_at DESC, o.id DESC LIMIT 1;

  RETURN base_access OR coalesce((latest_action = 'grant'
    AND grant_starts_at <= pg_catalog.now()
    AND (grant_expires_at IS NULL OR grant_expires_at > pg_catalog.now())), false);
END;
$$;
REVOKE ALL ON FUNCTION public.has_feature_access(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_feature_access(text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_access_rights()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  user_role text;
  profile_plan text;
  effective_plan text;
  billing_status text;
  billing_plan text;
  billing_managed boolean;
  plan_label text;
  suspended boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  SELECT p.role::text, p.plan::text INTO user_role, profile_plan
    FROM public.profiles AS p WHERE p.id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;
  effective_plan := profile_plan;

  IF user_role = 'subscriber' THEN
    SELECT b.status, b.billing_plan, b.managed_by_pro
      INTO billing_status, billing_plan, billing_managed
      FROM public.subscriber_billing AS b WHERE b.user_id = auth.uid();
    IF NOT FOUND THEN
      suspended := true;
    ELSIF billing_managed IS DISTINCT FROM true THEN
      IF billing_plan IS NULL OR billing_plan NOT IN ('basic', 'premium') THEN
        RAISE EXCEPTION 'INVALID_BILLING_PLAN';
      END IF;
      effective_plan := billing_plan;
      suspended := billing_status IS NULL OR billing_status NOT IN ('active', 'trialing', 'past_due');
    END IF;
  END IF;

  IF user_role = 'pro' THEN
    plan_label := 'patient';
  ELSIF user_role IN ('patient', 'subscriber') AND effective_plan = 'premium' THEN
    plan_label := 'premium';
  ELSE
    plan_label := 'basic';
  END IF;

  IF suspended THEN
    RETURN pg_catalog.jsonb_build_object(
      'plan_label', 'basic', 'access_recipes', false,
      'access_sport_programs', false, 'access_nutrition_programs', false,
      'access_messaging', false, 'access_visio', false,
      'access_ai_coach', false, 'access_premium_content', false,
      'sport_session_limit', NULL
    );
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'plan_label', plan_label,
    'access_recipes', public.has_feature_access('access_recipes', auth.uid()),
    'access_sport_programs', public.has_feature_access('access_sport_programs', auth.uid()),
    'access_nutrition_programs', public.has_feature_access('access_nutrition_programs', auth.uid()),
    'access_messaging', public.has_feature_access('access_messaging', auth.uid()),
    'access_visio', public.has_feature_access('visio', auth.uid()),
    'access_ai_coach', public.has_feature_access('ai_coach', auth.uid()),
    'access_premium_content', public.has_feature_access('access_premium_content', auth.uid()),
    'sport_session_limit', CASE
      WHEN public.has_feature_access('sport_sessions_unlimited', auth.uid()) THEN NULL
      ELSE 3
    END
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_access_rights() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_access_rights() TO authenticated;

CREATE OR REPLACE FUNCTION public.grant_user_feature(
  p_user_id uuid,
  p_feature_key text,
  p_reason text,
  p_starts_at timestamptz DEFAULT pg_catalog.now(),
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  event_id uuid;
  target_role text;
  profile_plan text;
  billing_plan text;
  billing_status text;
  billing_managed boolean;
  effective_plan text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_current_super_admin() THEN
    RAISE EXCEPTION 'SUPER_ADMIN_REQUIRED';
  END IF;
  IF p_user_id IS NULL OR p_reason IS NULL
     OR char_length(pg_catalog.btrim(p_reason)) NOT BETWEEN 3 AND 500
     OR p_starts_at IS NULL
     OR (p_expires_at IS NOT NULL AND p_expires_at <= p_starts_at) THEN
    RAISE EXCEPTION 'INVALID_FEATURE_GRANT';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private.feature_catalog AS fc
     WHERE fc.feature_key = p_feature_key
       AND fc.release_channel = 'v1'
       AND fc.globally_enabled
       AND fc.basic_included = false
       AND fc.premium_included = true
  ) THEN
    RAISE EXCEPTION 'FEATURE_NOT_AVAILABLE_IN_V1';
  END IF;
  SELECT p.role::text, p.plan::text INTO target_role, profile_plan
    FROM public.profiles AS p WHERE p.id = p_user_id;
  IF target_role IS DISTINCT FROM 'subscriber' THEN
    RAISE EXCEPTION 'BASIC_SUBSCRIBER_REQUIRED';
  END IF;
  SELECT b.status, b.billing_plan, b.managed_by_pro
    INTO billing_status, billing_plan, billing_managed
    FROM public.subscriber_billing AS b WHERE b.user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_SUBSCRIBER_BILLING_REQUIRED'; END IF;
  IF billing_managed IS DISTINCT FROM true THEN
    IF billing_status IS NULL OR billing_status NOT IN ('active', 'trialing', 'past_due')
       OR billing_plan IS NULL OR billing_plan NOT IN ('basic', 'premium') THEN
      RAISE EXCEPTION 'ACTIVE_SUBSCRIBER_BILLING_REQUIRED';
    END IF;
    effective_plan := billing_plan;
  ELSE
    effective_plan := profile_plan;
  END IF;
  IF effective_plan IS DISTINCT FROM 'basic' THEN
    RAISE EXCEPTION 'BASIC_SUBSCRIBER_REQUIRED';
  END IF;

  INSERT INTO private.user_feature_overrides
    (user_id, feature_key, action, starts_at, expires_at, reason, changed_by)
  VALUES
    (p_user_id, p_feature_key, 'grant', p_starts_at, p_expires_at,
     pg_catalog.btrim(p_reason), auth.uid())
  RETURNING id INTO event_id;
  RETURN event_id;
END;
$$;
REVOKE ALL ON FUNCTION public.grant_user_feature(uuid, text, text, timestamptz, timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_user_feature(uuid, text, text, timestamptz, timestamptz)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_user_feature(
  p_user_id uuid,
  p_feature_key text,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE event_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_current_super_admin() THEN
    RAISE EXCEPTION 'SUPER_ADMIN_REQUIRED';
  END IF;
  IF p_user_id IS NULL OR p_reason IS NULL
     OR char_length(pg_catalog.btrim(p_reason)) NOT BETWEEN 3 AND 500
     OR NOT EXISTS (SELECT 1 FROM private.feature_catalog AS fc
                     WHERE fc.feature_key = p_feature_key) THEN
    RAISE EXCEPTION 'INVALID_FEATURE_REVOCATION';
  END IF;

  INSERT INTO private.user_feature_overrides
    (user_id, feature_key, action, starts_at, reason, changed_by)
  VALUES
    (p_user_id, p_feature_key, 'revoke', pg_catalog.now(),
     pg_catalog.btrim(p_reason), auth.uid())
  RETURNING id INTO event_id;
  RETURN event_id;
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_user_feature(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_user_feature(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_v1_feature_availability(
  p_feature_key text,
  p_enabled boolean,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE event_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_current_super_admin() THEN
    RAISE EXCEPTION 'SUPER_ADMIN_REQUIRED';
  END IF;
  IF p_reason IS NULL OR char_length(pg_catalog.btrim(p_reason)) NOT BETWEEN 3 AND 500 THEN
    RAISE EXCEPTION 'INVALID_FEATURE_AVAILABILITY_REASON';
  END IF;

  UPDATE private.feature_catalog AS fc
     SET globally_enabled = p_enabled
   WHERE fc.feature_key = p_feature_key AND fc.release_channel = 'v1';
  IF NOT FOUND THEN RAISE EXCEPTION 'V1_FEATURE_NOT_FOUND'; END IF;

  INSERT INTO private.feature_availability_events
    (feature_key, globally_enabled, reason, changed_by)
  VALUES (p_feature_key, p_enabled, pg_catalog.btrim(p_reason), auth.uid())
  RETURNING id INTO event_id;
  RETURN event_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_v1_feature_availability(text, boolean, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_v1_feature_availability(text, boolean, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_user_feature_history(p_user_id uuid)
RETURNS TABLE (
  event_id uuid,
  feature_key text,
  action text,
  starts_at timestamptz,
  expires_at timestamptz,
  reason text,
  changed_by uuid,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT o.id, o.feature_key, o.action, o.starts_at, o.expires_at,
         o.reason, o.changed_by, o.created_at
    FROM private.user_feature_overrides AS o
   WHERE o.user_id = p_user_id
     AND auth.uid() IS NOT NULL
     AND public.is_current_super_admin()
   ORDER BY o.created_at DESC, o.id DESC;
$$;
REVOKE ALL ON FUNCTION public.get_user_feature_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_feature_history(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_feature_catalog()
RETURNS TABLE (
  feature_key text,
  release_channel text,
  globally_enabled boolean,
  basic_included boolean,
  premium_included boolean,
  professional_included boolean,
  patient_basic_included boolean,
  patient_premium_included boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT fc.feature_key, fc.release_channel, fc.globally_enabled,
         fc.basic_included, fc.premium_included, fc.professional_included,
         fc.patient_basic_included, fc.patient_premium_included
    FROM private.feature_catalog AS fc
   WHERE auth.uid() IS NOT NULL AND public.is_current_super_admin()
   ORDER BY fc.feature_key;
$$;
REVOKE ALL ON FUNCTION public.list_feature_catalog() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_feature_catalog() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_feature_availability_history(p_feature_key text)
RETURNS TABLE (
  event_id uuid,
  globally_enabled boolean,
  reason text,
  changed_by uuid,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT e.id, e.globally_enabled, e.reason, e.changed_by, e.created_at
    FROM private.feature_availability_events AS e
   WHERE e.feature_key = p_feature_key
     AND auth.uid() IS NOT NULL
     AND public.is_current_super_admin()
   ORDER BY e.created_at DESC, e.id DESC;
$$;
REVOKE ALL ON FUNCTION public.get_feature_availability_history(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_feature_availability_history(text) TO authenticated;

COMMIT;





