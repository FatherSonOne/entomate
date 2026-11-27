-- Transcript excerpts are derived data. Keep their revision separate from the
-- meeting so backfill never changes meeting timestamps or emits meeting updates.
create table public.meeting_passage_index (
  meeting_id uuid primary key references public.meetings(id) on delete cascade,
  revision uuid not null default gen_random_uuid()
);

create table public.meeting_passages (
  meeting_id uuid not null references public.meeting_passage_index(meeting_id) on delete cascade,
  org_id uuid not null,
  source_line integer not null check (source_line >= 0), -- 0 denotes a flat transcript
  chunk_start integer not null check (chunk_start > 0), -- Unicode character offset, one-based
  at_ms bigint,
  speaker text,
  body text not null,
  lexemes tsvector generated always as (to_tsvector('simple'::regconfig, body)) stored,
  primary key (meeting_id, source_line, chunk_start)
);

create index meeting_passages_lexemes_idx on public.meeting_passages using gin (lexemes);
create index meeting_passages_org_idx on public.meeting_passages (org_id);
create index meetings_search_metadata_idx on public.meetings using gin (
  to_tsvector('simple'::regconfig, coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(decisions::text, ''))
);

alter table public.meeting_passage_index enable row level security;
alter table public.meeting_passages enable row level security;
revoke all on public.meeting_passage_index, public.meeting_passages from public, anon, authenticated;
grant select on public.meeting_passage_index, public.meeting_passages to authenticated, service_role;

create policy meeting_passage_index_read on public.meeting_passage_index for select to authenticated
  using (exists (select 1 from public.meetings m where m.id = meeting_passage_index.meeting_id));
create policy meeting_passages_read on public.meeting_passages for select to authenticated
  using (org_id in (select public.get_my_org_ids()) and exists (
    select 1 from public.meetings m where m.id = meeting_passages.meeting_id and m.org_id = meeting_passages.org_id
  ));

-- Both callers hold the meeting row lock. Replace the revision and all of its
-- excerpts in the same transaction as the source write (including retention).
create function private.replace_meeting_passages(p_id uuid, p_org uuid, p_transcript text, p_segments jsonb)
returns void language plpgsql set search_path = '' as $$
begin
  delete from public.meeting_passage_index where meeting_id = p_id;
  if p_org is null or (p_transcript is null and p_segments is null) then return; end if;

  insert into public.meeting_passage_index(meeting_id) values (p_id);

  with lines as (
    select ordinality::integer as source_line, segment->>'text' as body, segment->>'speaker' as speaker,
      case when jsonb_typeof(segment->'atMs') = 'number' then
        case when (segment->>'atMs')::numeric between 0 and 9007199254740991
          then round((segment->>'atMs')::numeric)::bigint end
      end as at_ms
    from jsonb_array_elements(case when jsonb_typeof(p_segments) = 'array' then p_segments else '[]'::jsonb end)
      with ordinality as segments(segment, ordinality)
    where jsonb_typeof(segment->'text') = 'string' and segment->>'text' ~ '[^[:space:]]'
  ), sources as (
    select source_line, body, speaker, at_ms from lines
    union all
    select 0, p_transcript, null, null
    where p_transcript ~ '[^[:space:]]' and not exists (select 1 from lines)
  )
  insert into public.meeting_passages(meeting_id, org_id, source_line, chunk_start, at_ms, speaker, body)
  select p_id, p_org, source_line, chunk_start, at_ms, speaker, excerpt
  from sources
  -- Overlap long turns and plain text so phrases near a boundary stay searchable.
  cross join lateral generate_series(1, greatest(1, char_length(body) - 200), 1000) as chunks(chunk_start)
  cross join lateral (values (substring(body from chunk_start for 1200))) as passage(excerpt)
  where excerpt ~ '[^[:space:]]';
end;
$$;
revoke all on function private.replace_meeting_passages(uuid, uuid, text, jsonb) from public, anon, authenticated;

create function private.sync_meeting_passages()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.org_id is not distinct from old.org_id
    and new.transcript is not distinct from old.transcript
    and new.transcript_segments is not distinct from old.transcript_segments then
    return new;
  end if;
  perform private.replace_meeting_passages(new.id, new.org_id, new.transcript, new.transcript_segments);
  return new;
end;
$$;
revoke all on function private.sync_meeting_passages() from public, anon, authenticated;

create trigger meeting_passages_sync
after insert or update of org_id, transcript, transcript_segments on public.meetings
for each row execute function private.sync_meeting_passages();

-- One committed batch at a time. The revision row is the durable checkpoint.
-- Skip locked meetings and keep the job scheduled while there is any work left.
create function private.backfill_meeting_passages(p_batch integer default 100)
returns integer language plpgsql set search_path = '' as $$
declare
  meeting record;
  processed integer := 0;
begin
  for meeting in
    select m.id, m.org_id, m.transcript, m.transcript_segments from public.meetings m
    where m.org_id is not null and (m.transcript is not null or m.transcript_segments is not null)
      and not exists (select 1 from public.meeting_passage_index i where i.meeting_id = m.id)
    order by m.id limit greatest(1, least(coalesce(p_batch, 100), 200)) for update of m skip locked
  loop
    if not exists (select 1 from public.meeting_passage_index i where i.meeting_id = meeting.id) then
      perform private.replace_meeting_passages(meeting.id, meeting.org_id, meeting.transcript, meeting.transcript_segments);
      processed := processed + 1;
    end if;
  end loop;

  if processed = 0 and not exists (
    select 1 from public.meetings m
    where m.org_id is not null and (m.transcript is not null or m.transcript_segments is not null)
      and not exists (select 1 from public.meeting_passage_index i where i.meeting_id = m.id)
  ) then
    perform cron.unschedule(jobid) from cron.job where jobname = 'entomate-meeting-passages';
  end if;
  return processed;
end;
$$;
revoke all on function private.backfill_meeting_passages(integer) from public, anon, authenticated;

select cron.schedule('entomate-meeting-passages', '* * * * *', $job$select private.backfill_meeting_passages(100)$job$);

-- Restrict candidates to authorized workspaces before ranking. The limit is
-- applied after matching the archive and choosing the best excerpt per meeting.
create function public.search_meeting_history(p_org_ids uuid[], p_terms text[], p_limit integer, p_find_passages boolean)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with query as (
    select to_tsquery('simple'::regconfig, string_agg(quote_literal(word) || ':*', ' | ')) as any_word,
      plainto_tsquery('simple'::regconfig, array_to_string(p_terms, ' ')) as all_words
    from unnest(tsvector_to_array(to_tsvector('simple'::regconfig, array_to_string(p_terms, ' ')))) as words(word)
  ), records as (
    select m.id, m.title, m.summary, m.decisions, m.summary_moments, m.created_at,
      ts_rank_cd(doc, any_word, 32) + (doc @@ all_words)::integer as rank
    from public.meetings m cross join query
    cross join lateral (values (
      to_tsvector('simple'::regconfig, coalesce(m.title, '') || ' ' || coalesce(m.summary, '') || ' ' || coalesce(m.decisions::text, ''))
    )) as document(doc)
    where m.org_id = any(p_org_ids) and doc @@ any_word
    order by rank desc, m.created_at desc nulls last, m.id limit greatest(1, least(coalesce(p_limit, 25), 75))
  ), ranked as (
    select distinct on (p.meeting_id) p.meeting_id, p.source_line, p.chunk_start, p.at_ms, p.speaker, p.body,
      ts_rank_cd(p.lexemes, any_word, 32) + (p.lexemes @@ all_words)::integer as rank
    from public.meeting_passages p cross join query
    where p_find_passages and p.org_id = any(p_org_ids) and p.lexemes @@ any_word
    order by p.meeting_id, rank desc, p.source_line, p.chunk_start
  ), passages as (
    select r.*, i.revision, m.title, m.created_at
    from ranked r join public.meeting_passage_index i on i.meeting_id = r.meeting_id
    join public.meetings m on m.id = r.meeting_id and m.org_id = any(p_org_ids)
    order by r.rank desc, m.created_at desc nulls last, m.id
    limit greatest(1, least(coalesce(p_limit, 25), 75))
  )
  select jsonb_build_object(
    'records', (select coalesce(jsonb_agg(records order by rank desc, created_at desc nulls last, id), '[]'::jsonb) from records),
    'passages', (select coalesce(jsonb_agg(passages order by rank desc, created_at desc nulls last, meeting_id), '[]'::jsonb) from passages)
  );
$$;
revoke all on function public.search_meeting_history(uuid[], text[], integer, boolean) from public, anon, authenticated;
grant execute on function public.search_meeting_history(uuid[], text[], integer, boolean) to authenticated, service_role;
