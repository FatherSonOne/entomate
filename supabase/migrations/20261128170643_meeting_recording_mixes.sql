begin;

create table public.meeting_recording_mixes (
  meeting_id uuid primary key references public.meetings(id) on delete cascade,
  gains jsonb not null check (jsonb_typeof(gains) = 'object')
);

-- The recordings API authorizes access before reading or saving a mix.
alter table public.meeting_recording_mixes enable row level security;
revoke all on public.meeting_recording_mixes from public, anon, authenticated, service_role;
grant select, insert, update on public.meeting_recording_mixes to service_role;

commit;
