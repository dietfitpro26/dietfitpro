-- Migration 012 : Sécurisation de body_measurements
-- Objectif :
--   1. Aligner le schéma réel (patient_id existe déjà en base mais pas dans l'historique)
--   2. Ajouter created_by pour savoir qui a vraiment saisi chaque mesure
--   3. Remplacer la policy unique trop permissive par des policies précises
--      (le patient peut supprimer SEULEMENT ses propres mesures,
--       le pro peut gérer SEULEMENT les mesures de SES patients)

-- a. Aligner patient_id (ne fait rien si la colonne existe déjà)
ALTER TABLE public.body_measurements
ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL;

-- b. Ajouter created_by (auteur réel de la mesure)
ALTER TABLE public.body_measurements
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- c. Remplir created_by pour les mesures déjà existantes
-- (par défaut on suppose que c'est le patient lui-même, faute de mieux)
UPDATE public.body_measurements
SET created_by = user_id
WHERE created_by IS NULL AND user_id IS NOT NULL;

-- d. Supprimer l'ancienne policy trop permissive
DROP POLICY IF EXISTS "measurements_self_or_pro" ON public.body_measurements;

-- e. SELECT : le patient voit ses mesures, le pro voit celles de SES patients
CREATE POLICY "measurements_select" ON public.body_measurements
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = body_measurements.patient_id
      AND p.pro_id = auth.uid()
    )
  );

-- f. INSERT : le patient crée pour lui-même, le pro crée pour SES patients
CREATE POLICY "measurements_insert" ON public.body_measurements
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = body_measurements.patient_id
      AND p.pro_id = auth.uid()
    )
  );

-- g. UPDATE/DELETE : le patient gère UNIQUEMENT ses propres mesures (created_by),
--    le pro gère les mesures de SES patients.
--    WITH CHECK empêche un patient de "voler" une mesure en changeant created_by/patient_id.
CREATE POLICY "measurements_modify" ON public.body_measurements
  FOR ALL TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = body_measurements.patient_id
      AND p.pro_id = auth.uid()
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = body_measurements.patient_id
      AND p.pro_id = auth.uid()
    )
  );