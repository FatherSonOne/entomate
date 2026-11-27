create function public.find_meeting_passages(
  p_org_ids uuid[], p_terms text[], p_limit integer, p_per_meeting integer, p_meeting_ids uuid[] default null
)
returns table (
  meeting_id uuid, source_line integer, chunk_start integer, at_ms bigint, speaker text, body text,
  rank real, revision uuid, title text, created_at timestamptz
)
language sql stable security invoker set search_path = '' as $$
  with query as (
    select to_tsquery('simple'::regconfig, string_agg(quote_literal(word) || ':*', ' | ')) as any_word,
      plainto_tsquery('simple'::regconfig, array_to_string(p_terms, ' ')) as all_words
    from unnest(tsvector_to_array(to_tsvector('simple'::regconfig, array_to_string(p_terms, ' ')))) as words(word)
  ), matches as (
    select p.meeting_id, p.source_line, p.chunk_start, p.at_ms, p.speaker, p.body,
      ts_rank_cd(p.lexemes, any_word, 32) + (p.lexemes @@ all_words)::integer as rank
    from public.meeting_passages p cross join query
    where p.org_id = any(p_org_ids) and p.lexemes @@ any_word
      and (p_meeting_ids is null or p.meeting_id = any(p_meeting_ids))
  ), ranked as (
    select matches.*, row_number() over (
      partition by matches.meeting_id order by matches.rank desc, matches.source_line, matches.chunk_start
    ) as meeting_rank
    from matches
  )
  select r.meeting_id, r.source_line, r.chunk_start, r.at_ms, r.speaker, r.body, r.rank,
    i.revision, m.title::text, m.created_at
  from ranked r join public.meeting_passage_index i on i.meeting_id = r.meeting_id
  join public.meetings m on m.id = r.meeting_id and m.org_id = any(p_org_ids)
  where r.meeting_rank <= greatest(1, least(coalesce(p_per_meeting, 1), 8))
  order by r.rank desc, m.created_at desc nulls last, r.meeting_id, r.source_line, r.chunk_start
  limit greatest(1, least(coalesce(p_limit, 25), 75));
$$;
revoke all on function public.find_meeting_passages(uuid[], text[], integer, integer, uuid[]) from public, anon;
grant execute on function public.find_meeting_passages(uuid[], text[], integer, integer, uuid[]) to authenticated, service_role;

create or replace function public.search_meeting_history(p_org_ids uuid[], p_terms text[], p_limit integer, p_find_passages boolean)
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
  )
  select jsonb_build_object(
    'records', (select coalesce(jsonb_agg(records order by rank desc, created_at desc nulls last, id), '[]'::jsonb) from records),
    'passages', case when p_find_passages then (
      select coalesce(jsonb_agg(p order by p.rank desc, p.created_at desc nulls last, p.meeting_id), '[]'::jsonb)
      from public.find_meeting_passages(p_org_ids, p_terms, p_limit, 1) p
    ) else '[]'::jsonb end
  );
$$;
