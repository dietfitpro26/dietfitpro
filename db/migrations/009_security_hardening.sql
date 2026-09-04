-- ============================================================
-- Migration 009 : Verrouillage des rôles / plans (anti auto-promotion)
-- Correctifs B + C du rapport de sécurité (phase-4-stabilisation)
-- Statut : deja applique et verifie actif dans Supabase (03/09/2026)
-- ============================================================

-- ------------------------------------------------------------
-- CORRECTIF B : whitelist côté trigger d'inscription
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    plan,
    pro_id,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'subscriber',
    'basic',
    NULLIF(NEW.raw_user_meta_data->>'pro_id', '')::uuid,
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ------------------------------------------------------------
-- CORRECTIF C : verrouillage RLS + trigger BEFORE UPDATE
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
BEGIN
  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF caller_role = 'pro' THEN
    RETURN NEW;
  END IF;

  NEW.role := OLD.role;
  NEW.plan := OLD.plan;
  NEW.subscription_status := OLD.subscription_status;
  NEW.pro_id := OLD.pro_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_sensitive_profile_fields_trg ON public.profiles;
CREATE TRIGGER protect_sensitive_profile_fields_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_sensitive_profile_fields();

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id OR auth.uid() = pro_id)
  WITH CHECK (auth.uid() = id OR auth.uid() = pro_id);


-- ------------------------------------------------------------
-- CORRECTIF D : cohérence subscriber_overrides (vérification)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'subscriber_overrides'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS subscriber_overrides_no_self_write ON public.subscriber_overrides';
    EXECUTE $policy$
      CREATE POLICY subscriber_overrides_no_self_write
        ON public.subscriber_overrides
        FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'pro'
          )
        )
    $policy$;
  END IF;
END $$;