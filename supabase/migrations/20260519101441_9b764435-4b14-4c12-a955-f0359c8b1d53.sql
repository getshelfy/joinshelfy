
CREATE TABLE public.saved_recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  recipe_key TEXT NOT NULL,
  recipe JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, recipe_key)
);

ALTER TABLE public.saved_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_recipes_select_own" ON public.saved_recipes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "saved_recipes_insert_own" ON public.saved_recipes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_recipes_delete_own" ON public.saved_recipes
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_saved_recipes_user ON public.saved_recipes(user_id, created_at DESC);
