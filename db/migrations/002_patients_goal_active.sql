-- Add goal + is_active columns to patients
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS goal text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Migrate existing data from preferences->>'goal' (mapping old EN keys to new FR keys)
UPDATE public.patients
SET goal = CASE preferences->>'goal'
  WHEN 'weight_loss'  THEN 'perte_de_poids'
  WHEN 'muscle_gain'  THEN 'prise_de_masse'
  WHEN 'maintenance'  THEN 'maintien'
  WHEN 'other'        THEN 'autre'
  WHEN 'perte_de_poids' THEN 'perte_de_poids'
  WHEN 'prise_de_masse' THEN 'prise_de_masse'
  WHEN 'maintien'       THEN 'maintien'
  WHEN 'autre'          THEN 'autre'
  ELSE NULL
END
WHERE preferences->>'goal' IS NOT NULL;

-- Constraint after migration so legacy bad values don't block
ALTER TABLE public.patients
  DROP CONSTRAINT IF EXISTS patients_goal_check;
ALTER TABLE public.patients
  ADD CONSTRAINT patients_goal_check
  CHECK (goal IS NULL OR goal IN ('perte_de_poids','prise_de_masse','maintien','autre'));
