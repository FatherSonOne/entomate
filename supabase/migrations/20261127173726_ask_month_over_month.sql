-- Use the same meeting_at date and organization index as the Meetings library.
create function public.get_ask_recap_period(
  p_org_id uuid, p_time_zone text, p_meeting_ids uuid[], p_as_of timestamptz, p_previous boolean
)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with clock as (
    select date_trunc('month', p_as_of at time zone p_time_zone) as current_month,
      (p_as_of at time zone p_time_zone)::date as today
  ), month as (
    select case when p_previous then current_month - interval '1 month' else current_month end as local_start,
      case when p_previous then current_month::date - 1 else today end as local_end,
      case when p_previous then current_month at time zone p_time_zone else p_as_of end as end_before
    from clock
  ), meetings as materialized (
    select m.id, m.title, m.meeting_at, m.transcript, m.transcript_segments, i.revision,
      exists(select 1 from public.meeting_passages p where p.meeting_id = m.id and p.org_id = p_org_id) as indexed
    from public.meetings m cross join month
    left join public.meeting_passage_index i on i.meeting_id = m.id
    where m.org_id = p_org_id
      and m.meeting_at >= (month.local_start at time zone p_time_zone)
      and m.meeting_at < month.end_before
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
      'startDate', month.local_start::date, 'endDate', month.local_end, 'timeZone', p_time_zone,
      'totalMeetings', coverage.total, 'reviewedMeetings', (select count(*) from selected),
      'meetingsWithoutTranscripts', coverage.without_transcript,
      'unindexedMeetings', coverage.total - coverage.without_transcript - coverage.indexed,
      'unsampledMeetings', coverage.indexed - (select count(*) from selected)
    ),
    'passages', (select coalesce(jsonb_agg(passages order by meeting_at, meeting_id, source_line, chunk_start), '[]'::jsonb) from passages)
  )
  from month cross join coverage;
$$;

-- Preserve the single-month RPC and its existing response shape.
create or replace function public.get_ask_monthly_recap(
  p_org_id uuid, p_time_zone text, p_meeting_ids uuid[] default null, p_as_of timestamptz default now()
)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select public.get_ask_recap_period(p_org_id, p_time_zone, p_meeting_ids, p_as_of, false);
$$;

-- Both periods use one snapshot and the same as-of instant. Each has its own
-- meeting limit and coverage counts, including periods with no passages.
create function public.get_ask_monthly_comparison(
  p_org_id uuid, p_time_zone text, p_meeting_ids uuid[] default null, p_as_of timestamptz default now()
)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with periods as materialized (
    select public.get_ask_recap_period(p_org_id, p_time_zone, p_meeting_ids, p_as_of, true) as previous_period,
      public.get_ask_recap_period(p_org_id, p_time_zone, p_meeting_ids, p_as_of, false) as current_period
  )
  select jsonb_build_object(
    'comparison', jsonb_build_object('previous', previous_period->'recap', 'current', current_period->'recap'),
    'previousPassages', previous_period->'passages', 'currentPassages', current_period->'passages'
  )
  from periods;
$$;

revoke all on function public.get_ask_recap_period(uuid, text, uuid[], timestamptz, boolean),
  public.get_ask_monthly_comparison(uuid, text, uuid[], timestamptz) from public, anon, authenticated;
grant execute on function public.get_ask_recap_period(uuid, text, uuid[], timestamptz, boolean),
  public.get_ask_monthly_comparison(uuid, text, uuid[], timestamptz) to service_role;
