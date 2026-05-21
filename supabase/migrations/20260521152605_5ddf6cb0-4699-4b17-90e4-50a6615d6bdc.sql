
CREATE TABLE public.api_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  function_name text NOT NULL,
  usage_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  call_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (identifier, function_name, usage_date)
);

ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages api usage"
  ON public.api_usage
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_api_usage_lookup ON public.api_usage (identifier, function_name, usage_date);

CREATE OR REPLACE FUNCTION public.increment_api_usage(
  p_identifier text,
  p_function_name text,
  p_limit integer
)
RETURNS TABLE (allowed boolean, current_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'utc')::date;
  v_count integer;
BEGIN
  INSERT INTO public.api_usage (identifier, function_name, usage_date, call_count)
  VALUES (p_identifier, p_function_name, v_today, 0)
  ON CONFLICT (identifier, function_name, usage_date) DO NOTHING;

  SELECT call_count INTO v_count
    FROM public.api_usage
    WHERE identifier = p_identifier
      AND function_name = p_function_name
      AND usage_date = v_today
    FOR UPDATE;

  IF v_count >= p_limit THEN
    RETURN QUERY SELECT false, v_count;
    RETURN;
  END IF;

  UPDATE public.api_usage
    SET call_count = call_count + 1,
        updated_at = now()
    WHERE identifier = p_identifier
      AND function_name = p_function_name
      AND usage_date = v_today
    RETURNING call_count INTO v_count;

  RETURN QUERY SELECT true, v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_api_usage(text, text, integer) FROM anon, authenticated, public;
