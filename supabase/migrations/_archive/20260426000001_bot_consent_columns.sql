-- P1.7 Slice 1 — organizer-side consent gate.
--
-- Records who acknowledged that consent was obtained from all meeting
-- participants, and when. The /api/admin/bots/launch endpoint requires
-- consentAcknowledged: true in the request body and writes these
-- columns from req.user.id at insert time.
--
-- Intentionally nullable: this migration backfills nothing for existing
-- rows (pre-P1.7 launches predate the contract) and the orchestrator
-- only writes the fields when the launch came through the gated route.

alter table public.bot_sessions
    add column if not exists consent_acknowledged_at timestamptz,
    add column if not exists consent_acknowledged_by uuid references auth.users(id);

comment on column public.bot_sessions.consent_acknowledged_at is
    'Timestamp the launching user affirmed they have consent from all participants. Required for new launches per P1.7.';
comment on column public.bot_sessions.consent_acknowledged_by is
    'auth.users.id of the user who acknowledged consent at launch (the organizer/admin who clicked the consent checkbox).';
