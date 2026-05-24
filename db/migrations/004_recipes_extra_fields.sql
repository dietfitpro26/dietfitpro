-- Add cook time + fiber to recipes
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS cook_time_min int,
  ADD COLUMN IF NOT EXISTS fiber_g numeric(6,2);
