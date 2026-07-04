-- P1.7 Slice 2 — pre-meeting opt-out email + per-attendee record.
--
-- One row per (session, email) pair. The orchestrator inserts rows when
-- the launch handler is given participantEmails; the email service
-- updates email_status + email_sent_at on send; the public opt-out
-- endpoint updates opted_out_at + opt_out_reason + opt_out_ip when a
-- recipient clicks the link.
--
-- Token model: opt_out_token_hash = sha256(rawToken). Raw token only
-- exists in the email body and the user's URL bar. Storing only the
-- hash means a stolen DB dump can't be used to mass-unsubscribe.

create table if not exists public.bot_session_attendees (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.bot_sessions(id) on delete cascade,
  org_id uuid not null references public.tenant_organizations(id) on delete cascade,
  email text not null,
  -- sha256(rawToken) — see header. text not bytea to keep RLS expressions
  -- and PostgREST shape simple; 64-char hex.
  opt_out_token_hash text not null unique,
  email_sent_at timestamptz,
  email_status text not null default 'pending'
    check (email_status in ('pending', 'sent', 'failed', 'bounced', 'skipped')),
  email_error text,
  email_provider_message_id text,
  opted_out_at timestamptz,
  opt_out_reason text,
  opt_out_ip inet,
  created_at timestamptz not null default now(),
  unique (session_id, email)
);

create index if not exists idx_bsa_session
  on public.bot_session_attendees(session_id);

create index if not exists idx_bsa_org_optouts
  on public.bot_session_attendees(org_id, opted_out_at)
  where opted_out_at is not null;

create index if not exists idx_bsa_token_hash
  on public.bot_session_attendees(opt_out_token_hash);

alter table public.bot_session_attendees enable row level security;

-- Org members can read their org's attendee records (incl. opt-out state).
-- Mutations all go through the service role: orchestrator inserts rows on
-- launch, emailService updates send status, public opt-out endpoint
-- updates opt-out columns. No end-user policies needed beyond SELECT.
drop policy if exists bsa_select on public.bot_session_attendees;
create policy bsa_select on public.bot_session_attendees
  for select
  using (
    exists (
      select 1 from public.org_members om
      where om.org_id = bot_session_attendees.org_id
        and om.user_id = auth.uid()
    )
  );

comment on table public.bot_session_attendees is
  'Per-meeting attendee records used for the pre-meeting opt-out email flow (P1.7 Slice 2).';
comment on column public.bot_session_attendees.opt_out_token_hash is
  'sha256 hex of the raw opt-out token. Raw token never persisted; lives only in the email link.';
comment on column public.bot_session_attendees.email_status is
  'pending: row created, email not yet attempted. sent: Resend accepted. failed: Resend rejected or threw. bounced: future webhook integration. skipped: RESEND_API_KEY unset (gated dev/missing-config path).';
