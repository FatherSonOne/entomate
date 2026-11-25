alter table public.meetings
  add column meeting_at timestamptz generated always as (coalesce(start_time, created_at)) stored;

create index meetings_org_meeting_at_idx on public.meetings (org_id, meeting_at desc, id desc);

alter table public.action_items add column manually_created boolean not null default false;

create function public.meeting_workspace_months(p_org_ids uuid[], p_timezone text)
returns table(month text) language sql stable set search_path = '' as $$
  select distinct to_char(meeting_at at time zone p_timezone, 'YYYY-MM') as month
  from public.meetings
  where org_id = any(p_org_ids) and meeting_at is not null
  order by month desc;
$$;
revoke all on function public.meeting_workspace_months(uuid[], text) from public, anon, authenticated;
grant execute on function public.meeting_workspace_months(uuid[], text) to service_role;

create table public.live_meeting_rooms (
  id uuid primary key,
  org_id uuid not null references public.tenant_organizations(id) on delete cascade,
  host_id uuid not null references auth.users(id) on delete cascade,
  invite_key uuid not null unique default gen_random_uuid(),
  provider_name text not null unique default ('entomate-' || replace(gen_random_uuid()::text, '-', '')),
  url text,
  title text not null,
  with_notes boolean not null default false,
  audio_only boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '4 hours'),
  ending_at timestamptz,
  ended_at timestamptz,
  meeting_id uuid references public.meetings(id) on delete set null
);
create index live_meeting_rooms_host_idx on public.live_meeting_rooms (host_id, expires_at desc) where ended_at is null;

create table public.live_meeting_lines (
  room_id uuid not null references public.live_meeting_rooms(id) on delete cascade,
  event_id uuid not null,
  at_ms integer not null,
  speaker text not null,
  text text not null,
  primary key (room_id, event_id)
);
alter table public.live_meeting_rooms enable row level security;
alter table public.live_meeting_lines enable row level security;
revoke all on public.live_meeting_rooms, public.live_meeting_lines from public, anon, authenticated;
grant select, insert, update, delete on public.live_meeting_rooms, public.live_meeting_lines to service_role;

create function public.checkpoint_live_meeting(p_room uuid, p_host uuid, p_lines jsonb)
returns boolean language plpgsql set search_path = '' as $$
begin
  perform 1 from public.live_meeting_rooms where id = p_room and host_id = p_host
    and with_notes and ending_at is null and ended_at is null for update;
  if not found then return false; end if;
  insert into public.live_meeting_lines (room_id, event_id, at_ms, speaker, text)
    select p_room, id, "atMs", speaker, text
    from jsonb_to_recordset(p_lines) as line(id uuid, "atMs" integer, speaker text, text text)
    on conflict (room_id, event_id) do nothing;
  return true;
end;
$$;
revoke all on function public.checkpoint_live_meeting(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.checkpoint_live_meeting(uuid, uuid, jsonb) to service_role;

create function public.finish_live_meeting(p_room uuid, p_host uuid)
returns uuid language plpgsql set search_path = '' as $$
declare
  r public.live_meeting_rooms;
  lines jsonb;
  words text;
  names jsonb;
begin
  select * into r from public.live_meeting_rooms where id = p_room and host_id = p_host for update;
  if not found or r.ending_at is null then return null; end if;
  if r.ended_at is not null then return r.meeting_id; end if;

  select jsonb_agg(jsonb_build_object('atMs', at_ms, 'speaker', speaker, 'text', text) order by at_ms, event_id),
         string_agg(speaker || ': ' || text, chr(10) order by at_ms, event_id),
         jsonb_agg(distinct speaker)
    into lines, words, names from public.live_meeting_lines where room_id = r.id;

  if r.with_notes and words is not null then
    insert into public.meetings (id, org_id, created_by, title, transcript, transcript_segments, attendees,
      start_time, end_time, duration_minutes)
    values (r.id, r.org_id, r.host_id::text, r.title, words, lines, names,
      r.created_at, r.ending_at, greatest(1, round(extract(epoch from (r.ending_at - r.created_at)) / 60)::integer));
    r.meeting_id := r.id;
  end if;

  update public.live_meeting_rooms set ended_at = now(), meeting_id = r.meeting_id where id = r.id;
  delete from public.live_meeting_lines where room_id = r.id;
  return r.meeting_id;
end;
$$;
revoke all on function public.finish_live_meeting(uuid, uuid) from public, anon, authenticated;
grant execute on function public.finish_live_meeting(uuid, uuid) to service_role;
