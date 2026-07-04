-- P1.7 Slice 3 — retention enforcement + GDPR right-to-delete.
--
-- 1. bot_sessions: track whether the row's Recall-hosted media has been
--    deleted by the retention sweep, and any error from the last attempt.
-- 2. data_deletion_requests: log of GDPR Art. 17 requests. Notify-only
--    fulfillment — a platform admin actions the request via a backend
--    endpoint that fans the delete out across attendees + sessions.
-- 3. platform_admins: privileged users who can fulfill GDPR requests.
--    Bootstrap by inserting your own user_id via SQL; no UI for this.
--
-- Per-workspace retention_days lives in the existing
-- workspace_settings.data_controls_json JSONB column — no schema change
-- needed for that part. App code validates retention_days in {30,90,365}.

-- ────────────────────────────────────────────────────────────
-- 1. bot_sessions retention tracking
-- ────────────────────────────────────────────────────────────
alter table public.bot_sessions
    add column if not exists retention_deleted_at timestamptz,
    add column if not exists retention_delete_error text;

-- Find sessions that still have media and are old enough to sweep.
-- The cron picks rows from this index and joins to workspace_settings
-- to get the per-workspace retention_days threshold.
create index if not exists idx_bot_sessions_retention_pending
    on public.bot_sessions(created_at)
    where retention_deleted_at is null
      and (recording_url is not null or transcript_url is not null);

comment on column public.bot_sessions.retention_deleted_at is
    'Timestamp the retention sweep deleted Recall-hosted media for this row. URLs are NULLed at the same time. The row itself is preserved for audit.';
comment on column public.bot_sessions.retention_delete_error is
    'Last error from a failed retention attempt. Cleared on successful sweep. Surfaces stuck rows in the cron logs.';

-- ────────────────────────────────────────────────────────────
-- 2. data_deletion_requests
-- ────────────────────────────────────────────────────────────
create table if not exists public.data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  reason text,
  source_ip inet,
  user_agent text,
  requested_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  fulfilled_by uuid references auth.users(id),
  fulfillment_status text not null default 'pending'
    check (fulfillment_status in ('pending', 'fulfilled', 'denied')),
  fulfillment_summary jsonb,
  denial_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ddr_email
  on public.data_deletion_requests(email);

create index if not exists idx_ddr_pending
  on public.data_deletion_requests(requested_at)
  where fulfillment_status = 'pending';

alter table public.data_deletion_requests enable row level security;

-- Platform admins can read all requests. No public read policy — data
-- subjects are tracked by email, which we don't trust as identity for
-- read-back (an attacker could enumerate). They get a confirmation
-- response from the submission endpoint and that's it.
drop policy if exists ddr_select_platform_admin on public.data_deletion_requests;
create policy ddr_select_platform_admin on public.data_deletion_requests
  for select using (
    exists (
      select 1 from public.platform_admins pa
      where pa.user_id = auth.uid()
    )
  );

comment on table public.data_deletion_requests is
    'GDPR Art. 17 / right-to-delete request log. Notify-only — platform admin fulfills manually via /api/consent/data-deletion/admin/:id/fulfill.';
comment on column public.data_deletion_requests.fulfillment_summary is
    'JSONB: { attendees_deleted: int, sessions_redacted: int, recall_media_deleted: int, errors: [...] } — populated on fulfill.';

-- ────────────────────────────────────────────────────────────
-- 3. platform_admins
-- ────────────────────────────────────────────────────────────
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  notes text
);

alter table public.platform_admins enable row level security;

-- Platform admins can see other platform admins. No other reads.
-- Mutations are service-role-only; bootstrap your first row via SQL.
drop policy if exists pa_select_self on public.platform_admins;
create policy pa_select_self on public.platform_admins
  for select using (
    exists (
      select 1 from public.platform_admins inner_pa
      where inner_pa.user_id = auth.uid()
    )
  );

comment on table public.platform_admins is
    'Cross-workspace privileged users. Used to gate the GDPR fulfillment endpoints (and future platform-wide ops). No UI; bootstrap by SQL insert from a service-role context.';
