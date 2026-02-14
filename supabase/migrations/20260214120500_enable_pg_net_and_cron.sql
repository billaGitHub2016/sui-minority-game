create extension if not exists pg_net;
create extension if not exists pg_cron;

select
  cron.schedule(
    'generate-topics-hourly',
    '0 * * * *', -- Every hour at minute 0
    $$
    select
      net.http_get(
        url := 'https://sui-minority-game.vercel.app/api/cron/generate-topics',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}'
      ) as request_id;
    $$
  );
