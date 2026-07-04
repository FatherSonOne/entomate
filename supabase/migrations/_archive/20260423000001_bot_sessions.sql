-- Bot sessions — per-meeting bot lifecycle across Fly.io Machines.
-- Populated by backend/services/botOrchestrator.js and the bot callback.
-- See P1.1 in docs/plans/ENTOMATE_GAP_CLOSING_PLAN.md.

create table if not exists public.bot_sessions (
    id uuid primary key,
    org_id uuid not null references public.tenant_organizations(id) on delete cascade,
    meeting_id uuid not null,
    platform text not null check (platform in ('meet', 'zoom', 'teams')),
    status text not null default 'pending' check (status in (
        'pending', 'launching', 'joining', 'in_call',
        'completed', 'failed', 'stopped', 'timeout'
    )),
    machine_id text,
    meeting_url text,
    failure_reason text,
    callback_token_hash text not null,
    created_at timestamptz not null default now(),
    started_at timestamptz,
    last_callback_at timestamptz,
    ended_at timestamptz
);

create index if not exists idx_bot_sessions_org_created
    on public.bot_sessions (org_id, created_at desc);

create index if not exists idx_bot_sessions_meeting
    on public.bot_sessions (meeting_id);

create index if not exists idx_bot_sessions_active
    on public.bot_sessions (status)
    where status not in ('completed', 'failed', 'stopped', 'timeout');

alter table public.bot_sessions enable row level security;

-- Org members can read their own sessions. Service role bypasses RLS, so all
-- mutations go through botOrchestrator.js using the service key; no end-user
-- INSERT/UPDATE/DELETE policies needed.
drop policy if exists bot_sessions_select on public.bot_sessions;
create policy bot_sessions_select on public.bot_sessions
    for select
    using (
        exists (
            select 1
            from public.org_members om
            where om.org_id = bot_sessions.org_id
              and om.user_id = auth.uid()
        )
    );

comment on table public.bot_sessions is
    'Per-meeting bot session state. See P1.1 in docs/plans/ENTOMATE_GAP_CLOSING_PLAN.md.';
comment on column public.bot_sessions.callback_token_hash is
    'SHA-256 of the callback bearer token passed to the bot Machine. Raw token is never persisted.';
comment on column public.bot_sessions.machine_id is
    'Fly.io Machine ID; null until the Machines API call returns.';
