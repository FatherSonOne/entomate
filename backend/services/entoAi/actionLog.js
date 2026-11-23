/**
 * Entomate AI write spine (EAI-05, D6): propose → confirm → execute → undo.
 *
 * Every function takes the request's ctx ({ db, orgIds, userId, userName }),
 * where db is the caller's user-JWT client (D2). ento_ai_action_log's RLS
 * (owner AND org member) decides which rows a caller can see or resolve, and
 * its trigger enforces the lifecycle (migration 20261122200000), so a skipped
 * or repeated step fails in the database, not only here.
 *
 * Confirm re-runs the verb's prepare() on the stored payload before it
 * executes: the row is the caller's own, so a payload changed through a direct
 * PostgREST call is validated again, and must still land in the row's org.
 */

const { VERBS, findRow } = require('./writeTools');
const { ToolInputError, uuidArg } = require('./tools');

const COLUMNS = 'id, org_id, tool_name, risk_class, status, summary, payload, result, undo, proposed_at, executed_at, undone_at';
const PROPOSAL_NOTE = 'Not done yet. The user must press Confirm on the card in the panel. Tell them what you proposed; never say it is done.';

class ActionError extends Error {
  constructor(status, message, proposal) {
    super(message);
    this.status = status;
    this.proposal = proposal;
  }
}

/** Case, outer spaces and inner runs of spaces do not count (same rule as Logos AI). */
function tokensMatch(expected, typed) {
  const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
  return !!expected && norm(expected) === norm(typed);
}

const now = () => new Date().toISOString();

/** The card's view of a row. undo data stays on the server. */
function toProposal(row) {
  const verb = VERBS[row.tool_name];
  return {
    id: row.id,
    toolName: row.tool_name,
    riskClass: row.risk_class,
    status: row.status,
    summary: row.summary,
    payload: row.payload,
    result: row.result || null,
    editable: verb?.editable || [],
    confirmToken: verb?.risk === 'sensitive' && verb.confirmToken ? verb.confirmToken(row.payload) : null,
    view: row.status === 'executed' && verb?.view ? verb.view(row.result) : null,
  };
}

async function loadRow(ctx, id) {
  uuidArg(id, 'action id');
  const { data, error } = await ctx.db.from('ento_ai_action_log').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ActionError(404, 'Proposal not found');
  if (!ctx.orgIds.includes(data.org_id)) throw new ActionError(404, 'Proposal not found');
  return data;
}

/** One conditional UPDATE. Returns the new row, or null when the row was no longer in `from`. */
async function moveRow(ctx, id, from, set) {
  const { data, error } = await ctx.db.from('ento_ai_action_log')
    .update(set)
    .eq('id', id)
    .eq('status', from)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

/** prepare() again on a payload, and refuse a result in another org than the row's. */
async function reprepare(verb, payload, ctx, orgId) {
  const prepared = await verb.prepare(payload || {}, ctx);
  if (prepared.orgId !== orgId) throw new ToolInputError('That record is in a different workspace than this proposal');
  return prepared;
}

/**
 * Called by the agent loop for a write declaration. Never throws: like runTool,
 * a refusal is a failed step the model can read and explain.
 */
async function propose(name, args, ctx) {
  const verb = VERBS[name];
  if (!verb) return { name, ok: false, count: 0, response: { error: `Unknown tool ${name}` } };
  try {
    const prepared = await verb.prepare(args || {}, ctx);
    if (!prepared.orgId) throw new ToolInputError('You are not in a workspace yet');
    const { data, error } = await ctx.db.from('ento_ai_action_log').insert({
      org_id: prepared.orgId,
      user_id: ctx.userId,
      tool_name: name,
      risk_class: verb.risk,
      summary: prepared.summary,
      payload: prepared.payload,
    }).select(COLUMNS).maybeSingle();
    if (error || !data) throw new Error(error?.message || 'the proposal was not saved');
    const proposal = toProposal(data);
    return { name, ok: true, count: 0, proposal, response: { proposed: true, summary: proposal.summary, note: PROPOSAL_NOTE } };
  } catch (e) {
    const message = e instanceof ToolInputError ? e.message : `Could not prepare the change: ${e.message}`;
    return { name, ok: false, count: 0, response: { error: message } };
  }
}

async function confirm(ctx, id, { confirmationText } = {}) {
  const row = await loadRow(ctx, id);
  const verb = VERBS[row.tool_name];
  if (!verb) throw new ActionError(422, 'This kind of action can no longer run');
  if (row.status !== 'proposed') throw new ActionError(409, `This proposal is already ${row.status}`, toProposal(row));

  let prepared;
  try {
    prepared = await reprepare(verb, row.payload, ctx, row.org_id);
  } catch (e) {
    if (e instanceof ToolInputError) throw new ActionError(422, e.message, toProposal(row));
    throw e;
  }
  // Typed confirm (D6). The card's disabled button is the affordance; this is the guard.
  if (verb.risk === 'sensitive' && !tokensMatch(verb.confirmToken(prepared.payload), confirmationText)) {
    throw new ActionError(400, `Type "${verb.confirmToken(prepared.payload)}" exactly to confirm.`, toProposal(row));
  }

  // The claim: a second click, a second tab or a retry matches 0 rows here.
  const claimed = await moveRow(ctx, id, 'proposed', { status: 'confirmed', resolved_at: now() });
  if (!claimed) throw new ActionError(409, 'This proposal was already resolved', toProposal(await loadRow(ctx, id)));

  let outcome;
  try {
    outcome = await verb.execute(prepared.payload, { ...ctx, orgId: row.org_id });
  } catch (e) {
    const message = e instanceof ToolInputError ? e.message : `It could not be done: ${e.message}`;
    const failed = await moveRow(ctx, id, 'confirmed', { status: 'failed', result: { error: message } });
    return { ok: false, error: message, proposal: toProposal(failed || { ...claimed, status: 'confirmed' }) };
  }
  const done = await moveRow(ctx, id, 'confirmed', {
    status: 'executed', result: outcome.result, undo: outcome.undo, executed_at: now(),
  }).catch(() => null);
  // The write happened but its record did not: the card says "needs review", never "failed",
  // so nobody repeats a write that already landed.
  if (!done) return { ok: false, reviewRequired: true, error: 'The change was made, but its record was not saved', proposal: toProposal({ ...claimed, status: 'confirmed' }) };
  return { ok: true, proposal: toProposal(done) };
}

async function reject(ctx, id) {
  const row = await loadRow(ctx, id);
  if (row.status !== 'proposed') throw new ActionError(409, `This proposal is already ${row.status}`, toProposal(row));
  const moved = await moveRow(ctx, id, 'proposed', { status: 'rejected', resolved_at: now() });
  if (!moved) throw new ActionError(409, 'This proposal was already resolved', toProposal(await loadRow(ctx, id)));
  return { ok: true, proposal: toProposal(moved) };
}

/** Inline edit before confirm: only the verb's editable keys, validated by prepare(). */
async function edit(ctx, id, patch) {
  const row = await loadRow(ctx, id);
  const verb = VERBS[row.tool_name];
  if (!verb) throw new ActionError(422, 'This kind of action can no longer run');
  if (row.status !== 'proposed') throw new ActionError(409, `This proposal is already ${row.status}`, toProposal(row));
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new ActionError(400, 'Send the changed fields as an object');
  const allowed = new Set(verb.editable.map((f) => f.key));
  const bad = Object.keys(patch).filter((k) => !allowed.has(k));
  if (bad.length) throw new ActionError(400, `These fields cannot be edited: ${bad.join(', ')}`);

  let prepared;
  try {
    prepared = await reprepare(verb, { ...row.payload, ...patch }, ctx, row.org_id);
  } catch (e) {
    if (e instanceof ToolInputError) throw new ActionError(400, e.message);
    throw e;
  }
  const moved = await moveRow(ctx, id, 'proposed', { payload: prepared.payload, summary: prepared.summary });
  if (!moved) throw new ActionError(409, 'This proposal was already resolved', toProposal(await loadRow(ctx, id)));
  return { ok: true, proposal: toProposal(moved) };
}

/** A refused undo leaves the row executed and records why, so the card can say it. */
async function refuseUndo(ctx, row, message) {
  const kept = await moveRow(ctx, row.id, 'executed', { result: { ...(row.result || {}), undoError: message } }).catch(() => null);
  return { ok: false, error: message, proposal: toProposal(kept || row) };
}

/**
 * The record moved since this action, but only because a LATER action of the caller's
 * changed it and was then undone: that undo put back exactly the state this action left.
 * Chains work one link at a time (undo C, then B, then A).
 */
async function restoredByLaterUndo(ctx, u, currentAt) {
  if (!currentAt) return false;
  const { data, error } = await ctx.db.from('ento_ai_action_log').select('id')
    .eq('user_id', ctx.userId).eq('status', 'undone')
    .eq('undo->>id', u.id).eq('undo->>prevUpdatedAt', u.updatedAt).eq('result->>restoredAt', currentAt)
    .limit(1);
  if (error) throw new Error(error.message);
  return !!(data && data.length);
}

async function undo(ctx, id) {
  const row = await loadRow(ctx, id);
  const verb = VERBS[row.tool_name];
  if (!verb) throw new ActionError(422, 'This kind of action can no longer be undone');
  if (row.status !== 'executed') throw new ActionError(409, `Only a done action can be undone; this one is ${row.status}`, toProposal(row));

  const u = row.undo || {};
  uuidArg(u.id, 'undo id');
  if (typeof u.updatedAt !== 'string') throw new ActionError(422, 'This action has no undo record');
  const octx = { ...ctx, orgId: row.org_id };

  let current;
  try {
    current = await findRow(ctx, verb.table, u.id, 'id, updated_at', verb.noun);
  } catch (e) {
    if (!(e instanceof ToolInputError)) throw e;
    if (verb.undo !== 'delete') return refuseUndo(ctx, row, `The ${verb.noun} was removed, so there is nothing to put back.`);
    // Created, then removed by someone: the undo has nothing left to do.
    const gone = await moveRow(ctx, id, 'executed', { status: 'undone', undone_at: now(), result: { ...(row.result || {}), undoNote: 'It was already removed.' } });
    return { ok: true, proposal: toProposal(gone || row) };
  }
  let guardAt = u.updatedAt;
  if (current.updated_at !== u.updatedAt) {
    if (!(await restoredByLaterUndo(ctx, u, current.updated_at))) {
      return refuseUndo(ctx, row, `The ${verb.noun} changed after Entomate AI made this change, so undo was not run. Change it by hand if needed.`);
    }
    guardAt = current.updated_at;
  }

  let res;
  if (verb.undo === 'delete') {
    const blocked = verb.beforeDelete ? await verb.beforeDelete(u.id, octx) : null;
    if (blocked) return refuseUndo(ctx, row, blocked);
    res = await ctx.db.from(verb.table).delete()
      .eq('id', u.id).eq('org_id', row.org_id).eq('updated_at', guardAt)
      .select('id');
  } else {
    // Only the verb's own columns: undo data is never trusted to name what to write.
    const previous = {};
    for (const c of verb.columns) {
      if (u.previous && Object.prototype.hasOwnProperty.call(u.previous, c)) previous[c] = u.previous[c];
    }
    if (!Object.keys(previous).length) throw new ActionError(422, 'This action has no undo record');
    res = await ctx.db.from(verb.table).update({ ...previous, updated_at: now() })
      .eq('id', u.id).eq('org_id', row.org_id).eq('updated_at', guardAt)
      .select('id, updated_at');
  }
  if (res.error) throw new Error(res.error.message);
  if (!res.data || !res.data.length) {
    return refuseUndo(ctx, row, `The ${verb.noun} changed while undo ran, so it was not undone.`);
  }
  const kept = { ...(row.result || {}) };
  delete kept.undoError;
  // restoredAt: the record's updated_at after this undo, so the action before it can still be undone.
  const result = verb.undo === 'delete' ? kept : { ...kept, restoredAt: res.data[0].updated_at };
  const moved = await moveRow(ctx, id, 'executed', { status: 'undone', undone_at: now(), result });
  return { ok: true, proposal: toProposal(moved || { ...row, status: 'undone' }) };
}

/** Current state of the caller's proposals by id (the panel refreshes a reloaded thread). */
async function list(ctx, ids) {
  const valid = (Array.isArray(ids) ? ids : []).filter((v) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)).slice(0, 100);
  if (!valid.length) return [];
  const { data, error } = await ctx.db.from('ento_ai_action_log').select(COLUMNS)
    .in('id', valid)
    .in('org_id', ctx.orgIds);
  if (error) throw new Error(error.message);
  return (data || []).map(toProposal);
}

module.exports = { propose, confirm, reject, edit, undo, list, toProposal, tokensMatch, ActionError };
