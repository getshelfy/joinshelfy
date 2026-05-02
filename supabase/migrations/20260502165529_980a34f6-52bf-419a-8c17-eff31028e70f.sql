ALTER TABLE public.food_items ADD COLUMN IF NOT EXISTS is_pantry_staple boolean NOT NULL DEFAULT false;
ALTER TABLE public.food_items ADD COLUMN IF NOT EXISTS include_in_recipes boolean NOT NULL DEFAULT true;
ALTER TABLE public.food_items ALTER COLUMN expiry_date DROP NOT NULL;