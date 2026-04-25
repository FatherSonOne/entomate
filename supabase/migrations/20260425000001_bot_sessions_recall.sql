-- Recall.ai pivot — extend bot_sessions for Recall-managed bots.
-- See backend/services/botOrchestrator.js header for the pivot rationale.
-- Original schema: supabase/migrations/20260423000001_bot_sessions.sql

alter table public.bot_sessions
    add column if not exists recall_bot_id text,
    add column if not exists recording_url text,
    add column if not exists transcript_url text;

-- callback_token_hash was used by the in-house bot to authenticate its
-- status callbacks. Recall path uses a single shared webhook token in env,
-- so the per-session hash is no longer load-bearing. Drop the NOT NULL
-- so legacy rows still validate but new Recall rows can leave it 'recall'
-- or null without RLS noise.
alter table public.bot_sessions
    alter column callback_token_hash drop not null;

-- machine_id was the Fly Machine ID. We keep the column so historical
-- rows remain readable, but new Recall rows leave it null.
comment on column public.bot_sessions.machine_id is
    'Legacy Fly Machine ID (pre-Recall pivot, see migration 20260425000001). Null for Recall-managed sessions.';
comment on column public.bot_sessions.recall_bot_id is
    'Recall.ai bot ID. Primary identifier for Recall-managed sessions.';
comment on column public.bot_sessions.recording_url is
    'Recall-hosted recording URL, populated on bot.recording.done webhook.';
comment on column public.bot_sessions.transcript_url is
    'Recall-hosted transcript URL, populated on bot.done webhook.';

create index if not exists idx_bot_sessions_recall_bot_id
    on public.bot_sessions (recall_bot_id)
    where recall_bot_id is not null;
