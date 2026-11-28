begin;

create table public.meeting_recording_clips (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  start_ms integer not null check (start_ms >= 0),
  end_ms integer not null check (end_ms > start_ms),
  created_at timestamptz not null default now()
);

create index meeting_recording_clips_meeting_created_idx
  on public.meeting_recording_clips (meeting_id, created_at desc, id desc);

-- The recordings API checks the same meeting access as audio playback on every call.
alter table public.meeting_recording_clips enable row level security;
revoke all on public.meeting_recording_clips from public, anon, authenticated, service_role;
grant select, insert on public.meeting_recording_clips to service_role;

commit;
