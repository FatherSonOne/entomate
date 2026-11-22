/**
 * Search notes — the Notes column on the Search page.
 *
 * Clips (a result, a decision, an answer, a transcript line) and typed notes a
 * person collects from search, the palette and other modules. Private to the
 * person who wrote them: every query here is scoped by user_id AND org, because
 * the backend runs on the service-role key and bypasses RLS. This file is the gate.
 */

const { supabase } = require('../config/supabase');

const MAX_BODY = 8000;
const COLUMNS = 'id, kind, body, source_type, source_id, source_label, at_ms, query, origin, created_at, updated_at';
const KINDS = ['note', 'meeting', 'decision', 'action_item', 'task', 'project', 'transcript', 'answer', 'meeting_note'];
const ORIGINS = ['search', 'palette', 'meeting', 'ask', 'tasks', 'other'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class SearchNotesError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/** Validate and normalise a clip from the client. Throws SearchNotesError(400). */
function cleanInput(input) {
  const body = str(input && input.body, MAX_BODY);
  if (!body) throw new SearchNotesError(400, 'A note needs some text');
  const kind = KINDS.includes(input.kind) ? input.kind : 'note';
  const origin = ORIGINS.includes(input.origin) ? input.origin : 'other';
  const atMs = Number.isFinite(Number(input.atMs)) && Number(input.atMs) >= 0 && input.atMs !== null && input.atMs !== ''
    ? Math.round(Number(input.atMs)) : null;
  return {
    kind,
    body,
    source_type: str(input.sourceType, 40),
    source_id: str(input.sourceId, 120),
    source_label: str(input.sourceLabel, 200),
    at_ms: atMs,
    query: str(input.query, 300),
    origin,
  };
}

function mapRow(r) {
  return {
    id: r.id,
    kind: r.kind,
    body: r.body,
    sourceType: r.source_type,
    sourceId: r.source_id,
    sourceLabel: r.source_label,
    atMs: r.at_ms,
    query: r.query,
    origin: r.origin,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function requireDb() {
  if (!supabase) throw new SearchNotesError(503, 'Database not configured');
}

async function list(userId, orgIds, limit = 100) {
  requireDb();
  const { data, error } = await supabase
    .from('search_notes')
    .select(COLUMNS)
    .eq('user_id', userId)
    .in('org_id', orgIds)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(1, limit), 200));
  if (error) throw error;
  return (data || []).map(mapRow);
}

async function create(userId, orgId, input) {
  requireDb();
  if (!orgId) throw new SearchNotesError(403, 'No workspace for this user');
  const row = { ...cleanInput(input), user_id: userId, org_id: orgId };
  const { data, error } = await supabase.from('search_notes').insert(row).select(COLUMNS).single();
  if (error) throw error;
  return mapRow(data);
}

async function update(userId, orgIds, id, input) {
  requireDb();
  if (!UUID_RE.test(String(id))) throw new SearchNotesError(404, 'Note not found');
  const body = str(input && input.body, MAX_BODY);
  if (!body) throw new SearchNotesError(400, 'A note needs some text');
  const { data, error } = await supabase
    .from('search_notes')
    .update({ body })
    .eq('id', id)
    .eq('user_id', userId)
    .in('org_id', orgIds)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new SearchNotesError(404, 'Note not found');
  return mapRow(data);
}

async function remove(userId, orgIds, id) {
  requireDb();
  if (!UUID_RE.test(String(id))) throw new SearchNotesError(404, 'Note not found');
  const { data, error } = await supabase
    .from('search_notes')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .in('org_id', orgIds)
    .select('id');
  if (error) throw error;
  if (!data || !data.length) throw new SearchNotesError(404, 'Note not found');
}

module.exports = { list, create, update, remove, cleanInput, SearchNotesError, KINDS, ORIGINS, MAX_BODY };
