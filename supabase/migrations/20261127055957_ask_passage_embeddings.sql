alter table public.meeting_passages
  add column semantic_model text,
  add column semantic_embedding public.vector(768),
  add constraint meeting_passages_embedding_pair check (
    (semantic_model is null) = (semantic_embedding is null)
  );

create index meeting_passages_embedded_scope_idx on public.meeting_passages (org_id, semantic_model, meeting_id)
  where semantic_embedding is not null;

-- The embedding worker reads current passages in bounded batches. A new
-- transcript revision replaces these rows, including any stored embeddings.
create function public.next_meeting_passage_embeddings(p_model text, p_limit integer)
returns table (meeting_id uuid, source_line integer, chunk_start integer, revision uuid, body text)
language sql stable security invoker set search_path = '' as $$
  select p.meeting_id, p.source_line, p.chunk_start, i.revision, p.body
  from public.meeting_passages p
  join public.meeting_passage_index i on i.meeting_id = p.meeting_id
  where p.semantic_model is distinct from p_model
  order by p.meeting_id, p.source_line, p.chunk_start
  limit greatest(1, least(coalesce(p_limit, 24), 64));
$$;

create function public.save_meeting_passage_embeddings(p_model text, p_updates jsonb)
returns integer language sql security invoker set search_path = '' as $$
  with saved as (
    update public.meeting_passages p
    set semantic_model = p_model, semantic_embedding = (entry.embedding::text)::public.vector(768)
    from jsonb_to_recordset(p_updates) as entry(
      meeting_id uuid, revision uuid, source_line integer, chunk_start integer, embedding jsonb
    )
    join public.meeting_passage_index i on i.meeting_id = entry.meeting_id and i.revision = entry.revision
    where p.meeting_id = entry.meeting_id and p.source_line = entry.source_line and p.chunk_start = entry.chunk_start
      and p.semantic_model is distinct from p_model
    returning 1
  )
  select count(*)::integer from saved;
$$;

create function public.find_semantic_meeting_passages(
  p_org_ids uuid[], p_embedding public.vector, p_model text, p_limit integer,
  p_per_meeting integer, p_meeting_ids uuid[] default null
)
returns table (
  meeting_id uuid, source_line integer, chunk_start integer, at_ms bigint, speaker text, body text,
  rank double precision, revision uuid, title text, created_at timestamptz
)
language sql stable security invoker set search_path = '' as $$
  -- Exact cosine search over only the caller's current, selected passages.
  with scoped as materialized (
    select p.meeting_id, p.source_line, p.chunk_start, p.at_ms, p.speaker, p.body, p.semantic_embedding,
      i.revision, m.title::text, m.created_at
    from public.meeting_passages p
    join public.meeting_passage_index i on i.meeting_id = p.meeting_id
    join public.meetings m on m.id = p.meeting_id and m.org_id = p.org_id
    where p.org_id = any(p_org_ids) and p.semantic_model = p_model and p.semantic_embedding is not null
      and (p_meeting_ids is null or p.meeting_id = any(p_meeting_ids))
  ), matches as (
    select scoped.*, 1 - (scoped.semantic_embedding operator(public.<=>) p_embedding) as rank from scoped
  ), ranked as (
    select matches.*, row_number() over (
      partition by matches.meeting_id order by matches.rank desc, matches.source_line, matches.chunk_start
    ) as meeting_rank
    from matches where matches.rank >= 0.5
  )
  select r.meeting_id, r.source_line, r.chunk_start, r.at_ms, r.speaker, r.body, r.rank,
    r.revision, r.title, r.created_at
  from ranked r
  where r.meeting_rank <= greatest(1, least(coalesce(p_per_meeting, 4), 8))
  order by r.rank desc, r.created_at desc nulls last, r.meeting_id, r.source_line, r.chunk_start
  limit greatest(1, least(coalesce(p_limit, 14), 75));
$$;

revoke all on function public.next_meeting_passage_embeddings(text, integer),
  public.save_meeting_passage_embeddings(text, jsonb),
  public.find_semantic_meeting_passages(uuid[], public.vector, text, integer, integer, uuid[])
  from public, anon, authenticated;
grant execute on function public.next_meeting_passage_embeddings(text, integer),
  public.save_meeting_passage_embeddings(text, jsonb),
  public.find_semantic_meeting_passages(uuid[], public.vector, text, integer, integer, uuid[])
  to service_role;
grant update (semantic_model, semantic_embedding) on public.meeting_passages to service_role;

-- Use the same authenticated backend job mechanism as calendar auto-join.
select cron.schedule(
  'entomate-passage-embeddings', '3-59/10 * * * *',
  $job$
  select net.http_post(
    url := 'https://entomate.onrender.com/api/internal/jobs/passage-embeddings',
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Cron-Token', token),
    body := '{}'::jsonb,
    timeout_milliseconds := 90000
  ) from private.cron_secrets where name = 'jobs';
  $job$
);
