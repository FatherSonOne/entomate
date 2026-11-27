const ai = require('../config/ai');
const { supabase } = require('../config/supabase');
const log = require('../utils/log');

const PASSAGE_LIMIT = 14;
const PER_MEETING = 4;
const EMBEDDING_DIMENSIONS = 768;
const EMBEDDING_BATCH_SIZE = 24;
const MAX_BATCHES = 12;

async function embed(texts, kind, signal) {
  const vectors = await ai.generatePassageEmbeddings(texts, kind, signal);
  if (vectors?.length !== texts.length || !vectors.every((vector) =>
    Array.isArray(vector) && vector.length === EMBEDDING_DIMENSIONS &&
    vector.every(Number.isFinite) && vector.some((value) => value !== 0)
  )) throw new Error('Unexpected passage embeddings');
  return vectors;
}

async function semanticMatches(scope, query) {
  const model = ai.getPassageEmbeddingModel();
  if (!model) return [];

  try {
    const signal = AbortSignal.timeout(3000);
    // Skip the embedding request while this workspace or meeting backfills.
    let available = supabase.from('meeting_passages').select('meeting_id')
      .in('org_id', scope.p_org_ids)
      .eq('semantic_model', model)
      .not('semantic_embedding', 'is', null);
    if (scope.p_meeting_ids) available = available.in('meeting_id', scope.p_meeting_ids);
    const coverage = await available.limit(1).abortSignal(signal);
    if (coverage.error) throw coverage.error;
    if (!coverage.data?.length) return [];

    const [embedding] = await embed([query], 'query', signal);
    const { data, error } = await supabase.rpc('find_semantic_meeting_passages', {
      ...scope, p_model: model, p_embedding: JSON.stringify(embedding),
    }).abortSignal(signal);
    if (error) throw error;
    return data || [];
  } catch (error) {
    // Keyword retrieval is available during migration, provider outages and timeouts.
    if (!['42703', 'PGRST202', 'PGRST204'].includes(error?.code)) {
      log.warn('[Ask] Semantic passage lookup unavailable', { reason: error?.code || error?.name || 'error' });
    }
    return [];
  }
}

async function findAskPassages({ orgIds, meetingIds, words, query }) {
  const scope = {
    p_org_ids: orgIds,
    p_limit: PASSAGE_LIMIT,
    p_per_meeting: PER_MEETING,
    p_meeting_ids: meetingIds?.length ? meetingIds : null,
  };
  const [lexical, semantic] = await Promise.all([
    supabase.rpc('find_meeting_passages', { ...scope, p_terms: words }),
    semanticMatches(scope, query),
  ]);
  if (lexical.error) throw new Error('Could not retrieve indexed transcript passages', { cause: lexical.error });
  if (!semantic.length) return lexical.data || [];

  // The two scores use different scales. Fuse their rank positions so a
  // passage found by both gets a boost while either lane can supply evidence.
  const candidates = new Map();
  for (const lane of [lexical.data || [], semantic]) {
    lane.forEach((row, index) => {
      const key = [row.meeting_id, row.revision, row.source_line, row.chunk_start].join(':');
      const candidate = candidates.get(key) || { row, score: 0 };
      candidate.score += 1 / (60 + index + 1);
      candidates.set(key, candidate);
    });
  }

  const result = [];
  const meetingCounts = new Map();
  for (const { row } of [...candidates.values()].sort((a, b) => b.score - a.score)) {
    const count = meetingCounts.get(row.meeting_id) || 0;
    if (count >= PER_MEETING) continue;
    meetingCounts.set(row.meeting_id, count + 1);
    result.push(row);
    if (result.length >= PASSAGE_LIMIT) break;
  }
  return result;
}

async function backfillPassageEmbeddings() {
  const model = ai.getPassageEmbeddingModel();
  if (!model || !supabase) return { indexed: 0 };
  let indexed = 0;

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const { data: rows, error } = await supabase.rpc('next_meeting_passage_embeddings', {
      p_model: model, p_limit: EMBEDDING_BATCH_SIZE,
    });
    if (error) throw new Error('Could not read pending passage embeddings', { cause: error });
    if (!rows?.length) break;

    const vectors = await embed(rows.map((row) => row.body), 'document', AbortSignal.timeout(20000));
    const { data: count, error: saveError } = await supabase.rpc('save_meeting_passage_embeddings', {
      p_model: model,
      p_updates: rows.map(({ meeting_id, source_line, chunk_start, revision }, index) => ({
        meeting_id, source_line, chunk_start, revision, embedding: vectors[index],
      })),
    });
    if (saveError) throw new Error('Could not save passage embeddings', { cause: saveError });
    indexed += count || 0;
    if (rows.length < EMBEDDING_BATCH_SIZE) break;
  }
  return { indexed };
}

module.exports = { findAskPassages, backfillPassageEmbeddings };
