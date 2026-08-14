-- Migration 009: Ajout des champs profile_complete et subscription_tier
-- Date: 2026-08-14
-- Objectif: Phase 2 - Authentification et rôles

-- Ajouter les nouveaux champs à la table profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'basic' CHECK (subscription_tier IN ('basic', 'premium'));

-- Mettre à jour les profils existants (optionnel: tous en basic + incomplet)
UPDATE profiles
SET 
  profile_complete = COALESCE(profile_complete, FALSE),
  subscription_tier = COALESCE(subscription_tier, 'basic');

-- Index pour performance (optionnel)
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_profiles_profile_complete ON profiles(profile_complete);

-- Commentaire
COMMENT ON COLUMN profiles.profile_complete IS 'Indique si le profil utilisateur est complet (after onboarding)';
COMMENT ON COLUMN profiles.subscription_tier IS 'Niveau d\'abonnement: basic ou premium';
