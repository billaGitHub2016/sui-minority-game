
-- Schedule reveal-votes job
select
  cron.schedule(
    'reveal-votes-hourly',
    '5 * * * *', -- Every hour at minute 5
    $$
    select
      net.http_get(
        url := 'https://your-domain.com/api/cron/reveal-votes',
        headers := ('{"Content-Type": "application/json", "Authorization": "Bearer ' || (select value from private.keys where key = 'service_role_key') || '"}')::jsonb
      ) as request_id;
    $$
  );
