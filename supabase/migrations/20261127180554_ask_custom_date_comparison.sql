-- Use inclusive local calendar dates and the same coverage and evidence selection for every Ask period.
create function public.get_ask_period(
  p_org_id uuid, p_time_zone text, p_meeting_ids uuid[], p_as_of timestamptz, p_start date, p_end date
)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with meetings as materialized (
    select m.id, m.title, m.meeting_at, m.transcript, m.transcript_segments, i.revision,
      exists(select 1 from public.meeting_passages p where p.meeting_id = m.id and p.org_id = p_org_id) as indexed
    from public.meetings m
    left join public.meeting_passage_index i on i.meeting_id = m.id
    where m.org_id = p_org_id
      and m.meeting_at >= (p_start::timestamp at time zone p_time_zone)
      and m.meeting_at < least((p_end + 1)::timestamp at time zone p_time_zone, p_as_of)
      and (p_meeting_ids is null or m.id = any(p_meeting_ids))
  ), coverage as (
    select count(*) as total, count(*) filter (where not indexed and not (
      coalesce(transcript, '') ~ '[^[:space:]]' or exists(
        select 1 from jsonb_array_elements(case when jsonb_typeof(transcript_segments) = 'array'
          then transcript_segments else '[]'::jsonb end) as line(value)
        where jsonb_typeof(line.value->'text') = 'string' and line.value->>'text' ~ '[^[:space:]]'
      )
    )) as without_transcript, count(*) filter (where indexed) as indexed
    from meetings
  ), dated as (
    select id, meeting_at, ntile(20) over (order by meeting_at, id) as bucket from meetings where indexed
  ), selected as (
    -- Bound the work while spreading coverage throughout the period.
    select distinct on (bucket) id from dated order by bucket, meeting_at desc, id desc
  ), candidates as (
    select m.id as meeting_id, m.title, m.meeting_at, m.revision, p.source_line, p.chunk_start, p.at_ms, p.speaker, p.body,
      ts_rank_cd(p.lexemes, to_tsquery('simple'::regconfig,
        'decid:* | decision:* | mov:* | delay:* | reschedul:* | chang:* | approv:* | revers:* | own:* | assign:* | deadline:* | due | block:* | resolv:* | instead | now | previously | cancel:* | switch:* | agre:*'
      ), 32) as change_rank
    from selected s join meetings m on m.id = s.id
    join public.meeting_passages p on p.meeting_id = s.id and p.org_id = p_org_id
  ), lines as (
    -- Keep the best chunk per timed line and independent chunks for untimed text.
    select distinct on (meeting_id, source_line, case when source_line = 0 then chunk_start else 0 end) *
    from candidates
    order by meeting_id, source_line, case when source_line = 0 then chunk_start else 0 end, change_rank desc, chunk_start
  ), ranked as (
    select lines.*, row_number() over (
      partition by meeting_id order by change_rank desc, source_line, chunk_start
    ) as meeting_rank from lines
  ), passages as (
    select meeting_id, title, meeting_at, revision, source_line, chunk_start, at_ms, speaker, body
    from ranked where meeting_rank <= 5
  )
  select jsonb_build_object(
    'recap', jsonb_build_object(
      'startDate', p_start, 'endDate', p_end, 'timeZone', p_time_zone,
      'totalMeetings', coverage.total, 'reviewedMeetings', (select count(*) from selected),
      'meetingsWithoutTranscripts', coverage.without_transcript,
      'unindexedMeetings', coverage.total - coverage.without_transcript - coverage.indexed,
      'unsampledMeetings', coverage.indexed - (select count(*) from selected)
    ),
    'passages', (select coalesce(jsonb_agg(passages order by meeting_at, meeting_id, source_line, chunk_start), '[]'::jsonb) from passages)
  )
  from coverage;
$$;

-- Preserve both monthly RPCs and their existing response shapes.
create or replace function public.get_ask_recap_period(
  p_org_id uuid, p_time_zone text, p_meeting_ids uuid[], p_as_of timestamptz, p_previous boolean
)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with clock as (
    select date_trunc('month', p_as_of at time zone p_time_zone) as current_month,
      (p_as_of at time zone p_time_zone)::date as today
  )
  select public.get_ask_period(p_org_id, p_time_zone, p_meeting_ids, p_as_of,
    case when p_previous then (current_month - interval '1 month')::date else current_month::date end,
    case when p_previous then current_month::date - 1 else today end)
  from clock;
$$;

create function public.get_ask_date_comparison(
  p_org_id uuid, p_time_zone text, p_previous_start date, p_previous_end date, p_current_start date, p_current_end date,
  p_meeting_ids uuid[] default null, p_as_of timestamptz default now()
)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with periods as materialized (
    select public.get_ask_period(p_org_id, p_time_zone, p_meeting_ids, p_as_of, p_previous_start, p_previous_end) as previous_period,
      public.get_ask_period(p_org_id, p_time_zone, p_meeting_ids, p_as_of, p_current_start, p_current_end) as current_period
    where p_previous_start <= p_previous_end and p_previous_end < p_current_start and p_current_start <= p_current_end
  )
  select jsonb_build_object(
    'comparison', jsonb_build_object('previous', previous_period->'recap', 'current', current_period->'recap'),
    'previousPassages', previous_period->'passages', 'currentPassages', current_period->'passages'
  )
  from periods;
$$;

revoke all on function public.get_ask_period(uuid, text, uuid[], timestamptz, date, date),
  public.get_ask_date_comparison(uuid, text, date, date, date, date, uuid[], timestamptz) from public, anon, authenticated;
grant execute on function public.get_ask_period(uuid, text, uuid[], timestamptz, date, date),
  public.get_ask_date_comparison(uuid, text, date, date, date, date, uuid[], timestamptz) to service_role;
