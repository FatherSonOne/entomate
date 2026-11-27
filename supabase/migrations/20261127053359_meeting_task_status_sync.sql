-- Commit status deliveries with the action item. Only destinations that
-- already received this item are eligible for an update.
create or replace function public.enqueue_meeting_task_status(
  item public.action_items, version_at timestamptz, pulse_only boolean default false
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  event_name constant text := 'action_item.status_changed';
  status_version text;
  event_id uuid;
  destination record;
begin
  status_version := to_char(version_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');

  for destination in
    select 'logos_vision'::text as app, null::text as workspace_id
    where not pulse_only and (exists (
      select 1 from public.ecosystem_entity_map
      where local_entity_type = 'action_item' and local_entity_id = item.id and remote_app = 'logos_vision'
    ) or exists (
      select 1 from public.ecosystem_events
      where source = 'entomate' and direction = 'outbound' and target_app = 'logos_vision'
        and event_type = 'action_item.created' and entity_id = item.id::text and status = 'delivered'
    ))
    union all
    select 'pulse', pulse.workspace_id
    from (
      select distinct payload #>> '{data,workspaceId}' as workspace_id
      from public.ecosystem_events
      where source = 'entomate' and direction = 'outbound' and target_app = 'pulse'
        and event_type = 'meeting.action_items_extracted' and entity_id = item.meeting_id::text
        and status = 'delivered'
        and payload #> '{data,actionItems}' @> jsonb_build_array(jsonb_build_object('id', item.id))
    ) as pulse
    where pulse.workspace_id is not null
  loop
    event_id := gen_random_uuid();
    insert into public.ecosystem_events
      (id, event_id, source, target_app, event_type, entity_type, entity_id, direction, status, next_retry_at, payload)
    values
      (event_id, event_id::text, 'entomate', destination.app, event_name, 'action_item', item.id::text, 'outbound',
       'pending', now(), jsonb_build_object('data', jsonb_strip_nulls(jsonb_build_object(
         'actionItemId', item.id, 'meetingId', item.meeting_id, 'workspaceId', destination.workspace_id,
         'status', case item.status when 'complete' then 'done' when 'completed' then 'done' else item.status end,
         'statusVersion', status_version, 'completedAt', item.completed_at,
         'task', case when destination.app = 'pulse' then jsonb_build_object(
           'title', item.task_description, 'assigneeEmail', item.assigned_to_email,
           'assigneeName', item.assigned_to_name, 'priority', item.priority, 'dueDate', item.due_date
         ) end
       ))));
  end loop;
end;
$$;

revoke execute on function public.enqueue_meeting_task_status(public.action_items, timestamptz, boolean)
  from public, anon, authenticated;

create or replace function public.queue_meeting_task_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The row lock serializes versions even when multiple clients make changes.
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  perform public.enqueue_meeting_task_status(new, new.updated_at);
  return new;
end;
$$;

revoke execute on function public.queue_meeting_task_status() from public, anon, authenticated;

create trigger queue_meeting_task_status
before update of status on public.action_items
for each row
when (
  new.meeting_id is not null and new.status is distinct from old.status
  and new.status in ('open', 'pending', 'in_progress', 'review', 'blocked', 'done')
)
execute function public.queue_meeting_task_status();

-- A successful Pulse export is the cue to create its native task. Lock the
-- action item so a status write during export cannot leave the copy stale.
create or replace function public.queue_pulse_meeting_tasks_on_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item public.action_items;
begin
  if tg_op = 'UPDATE' and old.status = 'delivered' then
    return new;
  end if;
  for item in
    select a.* from public.action_items as a
    where a.meeting_id::text = new.entity_id
      and a.status in ('open', 'pending', 'in_progress', 'review', 'blocked', 'done', 'complete', 'completed')
      and new.payload #> '{data,actionItems}' @> jsonb_build_array(jsonb_build_object('id', a.id))
    order by a.id
    for update
  loop
    perform public.enqueue_meeting_task_status(item, coalesce(item.updated_at, item.created_at, now()), true);
  end loop;
  return new;
end;
$$;

revoke execute on function public.queue_pulse_meeting_tasks_on_delivery() from public, anon, authenticated;

create trigger queue_pulse_meeting_tasks_on_delivery
after insert or update of status on public.ecosystem_events
for each row
when (
  new.source = 'entomate' and new.direction = 'outbound' and new.target_app = 'pulse'
  and new.event_type = 'meeting.action_items_extracted' and new.status = 'delivered'
)
execute function public.queue_pulse_meeting_tasks_on_delivery();

create index idx_ecosystem_meeting_task_status_delivery
on public.ecosystem_events (next_retry_at)
where event_type = 'action_item.status_changed' and direction = 'outbound'
  and status in ('pending', 'failed') and next_retry_at is not null;

-- Existing Pulse assignments get their native task with the current status.
-- Use the existing update time so a new completion or Undo takes precedence.
select public.enqueue_meeting_task_status(item, coalesce(item.updated_at, item.created_at, now()), true)
from public.action_items as item
where item.status in ('open', 'pending', 'in_progress', 'review', 'blocked', 'done', 'complete', 'completed')
  and exists (
    select 1 from public.ecosystem_events
    where source = 'entomate' and direction = 'outbound' and target_app = 'pulse'
      and event_type = 'meeting.action_items_extracted' and entity_id = item.meeting_id::text
      and status = 'delivered'
      and payload #> '{data,actionItems}' @> jsonb_build_array(jsonb_build_object('id', item.id))
  );
