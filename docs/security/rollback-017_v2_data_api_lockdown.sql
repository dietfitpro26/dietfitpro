-- Rollback for 017_v2_data_api_lockdown.sql. Removes only the restrictive
-- deny-all policies and leaves the original V1/V2 policies and grants intact.
BEGIN;
DO $$
DECLARE target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'recipes', 'patient_recipes', 'appointments', 'visio_consultations'
  ] LOOP
    IF pg_catalog.to_regclass('public.' || target_table) IS NOT NULL THEN
      EXECUTE pg_catalog.format(
        'DROP POLICY IF EXISTS beta_v2_disabled_restrictive ON public.%I', target_table
      );
    END IF;
  END LOOP;
END;
$$;
COMMIT;
