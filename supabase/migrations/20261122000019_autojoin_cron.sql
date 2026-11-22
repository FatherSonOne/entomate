-- ========================================
-- Migration: Auto-join scheduler on Supabase pg_cron
-- Date: 2026-11-22
-- ========================================
-- GitHub Actions' */15 schedule fired twice in 16 hours, so booked bots were
-- missed while Render slept. pg_cron now posts to the backend every 10
-- minutes through pg_net. That also keeps the Render free instance awake.
-- The GitHub workflow stays as a backup.
--
-- Auth: a random token in private.cron_secrets, sent as X-Cron-Token. The
-- backend reads it through public.internal_cron_token(), which only
-- service_role may execute (middleware/cronTokenAuth.js). No env var change.

create extension if not exists pg_net;
create extension if not exists pg_cron;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.cron_secrets (
  name text primary key,
  token text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  created_at timestamptz not null default now()
);
revoke all on private.cron_secrets from public, anon, authenticated;

insert into private.cron_secrets (name) values ('jobs') on conflict (name) do nothing;

create or replace function public.internal_cron_token(p_name text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select token from private.cron_secrets where name = p_name
$$;
revoke all on function public.internal_cron_token(text) from public, anon, authenticated;
grant execute on function public.internal_cron_token(text) to service_role;

-- Re-runnable: drop the old schedule if this migration ran before.
select cron.unschedule(jobid) from cron.job where jobname = 'entomate-autojoin';

select cron.schedule(
  'entomate-autojoin',
  '*/10 * * * *',
  $cron$
  select net.http_post(
    url := 'https://entomate.onrender.com/api/internal/jobs/autojoin',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Token', (select token from private.cron_secrets where name = 'jobs')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 90000
  );
  $cron$
);
