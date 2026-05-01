
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Food items
CREATE TABLE public.food_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT NOT NULL DEFAULT 'Other',
  location TEXT NOT NULL DEFAULT 'fridge',
  expiry_date DATE NOT NULL,
  price NUMERIC(10,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active', -- active | used | wasted
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.food_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "food_select_own" ON public.food_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "food_insert_own" ON public.food_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "food_update_own" ON public.food_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "food_delete_own" ON public.food_items FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_food_items_user ON public.food_items(user_id);
CREATE INDEX idx_food_items_expiry ON public.food_items(user_id, expiry_date);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;$$;

CREATE TRIGGER trg_food_items_updated
BEFORE UPDATE ON public.food_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
