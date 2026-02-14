create extension if not exists pg_net;
create extension if not exists pg_cron;

select
  cron.schedule(
    'generate-topics-hourly',
    '0 * * * *', -- Every hour at minute 0
    $$
    select
      net.http_get(
        url := 'https://your-domain.com/api/cron/generate-topics',
        headers := ('{"Content-Type": "application/json", "Authorization": "Bearer ' || (select value from private.keys where key = 'service_role_key') || '"}')::jsonb
      ) as request_id;
    $$
  );
