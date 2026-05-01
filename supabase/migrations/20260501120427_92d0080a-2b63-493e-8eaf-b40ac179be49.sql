CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any prior schedule with the same name (idempotent)
DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'expiry-reminders-hourly';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'expiry-reminders-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--c2a9322d-986e-452a-9a85-efae84e7928d.lovable.app/api/public/expiry-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5a3p3bWhleWx5enp4YmJjaHJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MjEzMTcsImV4cCI6MjA5MzE5NzMxN30.QA0Wx6yCMg-jbyTERbw9yjykgj8DM5hVPGV4EFxaShI'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
