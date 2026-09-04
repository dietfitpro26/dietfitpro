-- =====================================================================
-- DietFitPro — Migration 011 : Simplification flux invitation
-- Date : 04/09/2026
-- Contexte : Suppression du système de codes d'invitation (cassé),
--            on garde uniquement invite-patient (Edge Function sécurisée)
-- =====================================================================

-- 1. Supprimer la fonction RPC orpheline (cassée depuis migration 009)
DROP FUNCTION IF EXISTS public.activate_invitation_code(text);

-- 2. Simplifier le trigger protect_sensitive_profile_fields
--    (plus besoin de vérifier app.allow_invitation_activation)
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

-- 3. Note : la table invitation_codes est conservée (rollback éventuel)
--    Elle n'est simplement plus utilisée par le frontend ni le backend.