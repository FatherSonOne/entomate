alter table public.live_meeting_rooms add column if not exists insights jsonb;
alter table public.meetings add column if not exists action_items_require_approval boolean not null default false;

-- Publish one reviewed draft as a normal meeting action. Lock the room so retrying
-- approval, regenerating drafts, and finishing the transcript agree on its state.
create function public.approve_live_meeting_action(p_room uuid, p_host uuid, p_draft uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare
  r public.live_meeting_rooms;
  draft jsonb;
  source_line jsonb;
  action_list jsonb;
begin
  select * into r from public.live_meeting_rooms where id = p_room and host_id = p_host and with_notes for update;
  if not found then return null; end if;

  select item into draft from jsonb_array_elements(r.insights->'actions') as entries(item)
    where item->>'id' = p_draft::text;
  if draft is null then return null; end if;
  if draft->>'taskId' is not null then
    return jsonb_build_object('taskId', draft->>'taskId', 'insights', r.insights);
  end if;
  if r.ending_at is not null and r.ended_at is null then
    return jsonb_build_object('roomEnding', true);
  end if;
  if r.ended_at is not null and r.meeting_id is null then return null; end if;

  -- Create the meeting record early only when a reviewed task needs it.
  insert into public.meetings (id, org_id, created_by, title, start_time, action_items_require_approval)
    values (r.id, r.org_id, r.host_id::text, r.title, r.created_at, true)
    on conflict (id) do nothing;
  perform 1 from public.meetings where id = r.id and org_id = r.org_id
    and created_by = r.host_id::text and action_items_require_approval;
  if not found then raise exception 'Could not link the task to this room'; end if;

  source_line := draft->'source';
  insert into public.action_items (id, meeting_id, org_id, task_description, context, assigned_to_name,
    transcript_at_ms, manually_created)
    values (p_draft, r.id, r.org_id, draft->>'text',
      left(concat_ws(': ', source_line->>'speaker', source_line->>'text'), 2000),
      nullif(draft->>'owner', ''), (source_line->>'atMs')::integer, true);

  select jsonb_agg(case when item->>'id' = p_draft::text
    then item || jsonb_build_object('taskId', p_draft) else item end order by position)
    into action_list from jsonb_array_elements(r.insights->'actions') with ordinality as entries(item, position);
  r.insights := r.insights || jsonb_build_object('actions', action_list, 'revision', gen_random_uuid());
  update public.live_meeting_rooms set insights = r.insights, meeting_id = r.id where id = r.id;
  return jsonb_build_object('taskId', p_draft, 'insights', r.insights);
end;
$$;
revoke all on function public.approve_live_meeting_action(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.approve_live_meeting_action(uuid, uuid, uuid) to service_role;

create or replace function public.finish_live_meeting(p_room uuid, p_host uuid)
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

  select jsonb_agg(jsonb_build_object('eventId', event_id, 'atMs', at_ms, 'speaker', speaker, 'text', text) order by at_ms, event_id),
         string_agg(speaker || ': ' || text, chr(10) order by at_ms, event_id),
         jsonb_agg(distinct speaker)
    into lines, words, names from public.live_meeting_lines where room_id = r.id;

  if r.with_notes and words is not null then
    insert into public.meetings (id, org_id, created_by, title, transcript, transcript_segments, attendees,
      start_time, end_time, duration_minutes, action_items_require_approval)
    values (r.id, r.org_id, r.host_id::text, r.title, words, lines, names,
      r.created_at, r.ending_at, greatest(1, round(extract(epoch from (r.ending_at - r.created_at)) / 60)::integer), true)
    on conflict (id) do update set transcript = excluded.transcript, transcript_segments = excluded.transcript_segments,
      attendees = excluded.attendees, end_time = excluded.end_time, duration_minutes = excluded.duration_minutes,
      updated_at = now()
    where meetings.org_id = r.org_id and meetings.created_by = r.host_id::text and meetings.action_items_require_approval
    returning id into r.meeting_id;
    if r.meeting_id is null then raise exception 'Could not link the transcript to this room'; end if;
  end if;

  update public.live_meeting_rooms set ended_at = now(), meeting_id = r.meeting_id where id = r.id;
  delete from public.live_meeting_lines where room_id = r.id;
  return r.meeting_id;
end;
$$;
