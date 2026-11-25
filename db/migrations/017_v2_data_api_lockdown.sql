-- Fail-closed local preparation: V2 recipes and consultation data remain stored,
-- but authenticated and anonymous Data API access is denied during the BETA.
-- Depends on 015_feature_entitlements.sql and local schema objects.
-- The restrictive policies preserve the existing business policies and grants;
-- rollback removes only these new deny-all policies.
BEGIN;

DO $$
DECLARE
  target_table text;
  policy_name text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'recipes', 'patient_recipes', 'appointments', 'visio_consultations'
  ] LOOP
    IF pg_catalog.to_regclass('public.' || target_table) IS NULL THEN
      CONTINUE;
    END IF;

    policy_name := 'beta_v2_disabled_restrictive';
    EXECUTE pg_catalog.format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE pg_catalog.format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, target_table);
    EXECUTE pg_catalog.format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      policy_name, target_table
    );
  END LOOP;
END;
$$;

COMMIT;
