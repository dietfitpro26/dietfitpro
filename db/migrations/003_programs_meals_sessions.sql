-- Add JSONB meals to nutrition_programs
ALTER TABLE public.nutrition_programs
  ADD COLUMN IF NOT EXISTS meals jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Add level + sessions to sport_programs
ALTER TABLE public.sport_programs
  ADD COLUMN IF NOT EXISTS level text,
  ADD COLUMN IF NOT EXISTS goal text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS sessions jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.sport_programs
  DROP CONSTRAINT IF EXISTS sport_programs_level_check;
ALTER TABLE public.sport_programs
  ADD CONSTRAINT sport_programs_level_check
  CHECK (level IS NULL OR level IN ('debutant','intermediaire','avance'));
