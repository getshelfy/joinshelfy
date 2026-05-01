CREATE TABLE public.expiry_reminder_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  food_item_id UUID NOT NULL,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('3day', '1day')),
  expiry_date DATE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (food_item_id, reminder_type)
);

CREATE INDEX idx_expiry_reminder_log_user ON public.expiry_reminder_log(user_id, sent_at DESC);

ALTER TABLE public.expiry_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages reminder log"
ON public.expiry_reminder_log
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users read their own reminder log"
ON public.expiry_reminder_log
FOR SELECT
USING (auth.uid() = user_id);
