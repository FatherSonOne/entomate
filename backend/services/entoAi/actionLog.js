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

const crypto = require('crypto');
const { VERBS, findRow, MAX_PLAN_STEPS } = require('./writeTools');
const { ToolInputError, uuidArg } = require('./tools');

const COLUMNS = 'id, org_id, tool_name, risk_class, status, summary, payload, result, undo, plan_id, step_order, arg_bindings, proposed_at, executed_at, undone_at';
const PROPOSAL_NOTE = 'Not done yet. The user must press Confirm on the card in the panel. Tell them what you proposed; never say it is done.';
const PLAN_NOTE = 'Not done yet. The user must press Confirm plan on the card in the panel; the steps then run in order. Tell them what the plan does; never say it is done.';

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
    ...(verb && !verb.undo ? { canUndo: false } : {}),
    view: row.status === 'executed' && verb?.view ? verb.view(row.result) : null,
    planId: row.plan_id || null,
    stepOrder: row.plan_id ? row.step_order : null,
  };
}

/** A plan step is resolved only through its plan: confirming one alone would skip its bindings. */
function notAPlanStep(row) {
  if (row.plan_id) throw new ActionError(409, 'This step belongs to a plan. Confirm, dismiss or undo the whole plan.', toProposal(row));
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
  notAPlanStep(row);
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
  notAPlanStep(row);
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
  notAPlanStep(row);
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
  notAPlanStep(row);
  return undoRow(ctx, row);
}

async function undoRow(ctx, row) {
  const id = row.id;
  const verb = VERBS[row.tool_name];
  if (!verb?.undo) throw new ActionError(422, 'Manage this change in Settings.', toProposal(row));
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

// -- EAI-06 plans -------------------------------------------------------
// A plan is the rows sharing one plan_id, run in step_order and confirmed once (ported from
// Logos AI's confirmPlan / undoPlan). The new mechanic is the binding: at propose time a later
// step cannot hold an id an earlier step has not made yet, so it carries
// "{{stepN.result.key}}" in arg_bindings and the token is resolved as the plan runs.

/** Whole-value token only, as Logos AI: the verbs take flat scalar args. */
const BINDING_RE = /^\{\{\s*step(\d+)\.result\.([A-Za-z0-9_]+)\s*\}\}$/;

/** A step's bindings, checked against the verb's `bindable` map and the earlier steps' tools. */
function planBindings(raw, verb, tools, i) {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new ToolInputError(`Step ${i + 1}: arg_bindings must be an object`);
  const out = {};
  for (const [key, token] of Object.entries(raw)) {
    if (token == null || token === '') continue;
    const rule = verb.bindable?.[key];
    if (!rule) throw new ToolInputError(`Step ${i + 1}: ${key} cannot come from an earlier step`);
    const m = typeof token === 'string' ? token.match(BINDING_RE) : null;
    if (!m) throw new ToolInputError(`Step ${i + 1}: ${key} must look like "{{step0.result.${rule.key}}}"`);
    const from = Number(m[1]);
    if (from >= i) throw new ToolInputError(`Step ${i + 1}: ${key} can only use a step that runs before it`);
    if (tools[from] !== rule.from || m[2] !== rule.key) {
      throw new ToolInputError(`Step ${i + 1}: ${key} must come from a ${rule.from} step's ${rule.key}`);
    }
    out[key] = token;
  }
  return Object.keys(out).length ? out : null;
}

/** Literal payload with each binding filled from the results so far (results[stepOrder]). */
function resolveBindings(payload, bindings, results) {
  const resolved = { ...(payload || {}) };
  for (const [key, token] of Object.entries(bindings || {})) {
    const m = typeof token === 'string' ? token.match(BINDING_RE) : null;
    if (!m) throw new ToolInputError(`The binding for ${key} is not valid`);
    const value = results[Number(m[1])]?.[m[2]];
    if (value == null) throw new ToolInputError(`Step ${Number(m[1]) + 1} did not produce a ${m[2]}`);
    resolved[key] = value;
  }
  return resolved;
}

/**
 * The loop's handler for propose_plan. Every step is prepared (bound args left out until the
 * plan runs), then ONE insert writes all rows, so a plan is recorded whole or not at all.
 * Never throws, like propose().
 */
async function proposePlan(args, ctx) {
  const name = 'propose_plan';
  try {
    const steps = Array.isArray(args?.steps) ? args.steps : [];
    if (steps.length < 2) throw new ToolInputError('A plan needs at least 2 steps. For one change, call that tool directly');
    if (steps.length > MAX_PLAN_STEPS) throw new ToolInputError(`A plan can have at most ${MAX_PLAN_STEPS} steps`);
    const tools = steps.map((s) => (s && typeof s === 'object' ? String(s.tool || '') : ''));
    const planId = crypto.randomUUID();
    const rows = [];
    for (let i = 0; i < steps.length; i += 1) {
      const verb = VERBS[tools[i]];
      if (!verb) throw new ToolInputError(`Step ${i + 1} uses an unknown tool "${tools[i]}"`);
      if (verb.risk === 'sensitive') throw new ToolInputError(`Step ${i + 1} needs its own typed confirmation; propose it alone`);
      const { tool: _tool, arg_bindings: rawBindings, ...stepArgs } = steps[i];
      const bindings = planBindings(rawBindings, verb, tools, i);
      for (const key of Object.keys(bindings || {})) delete stepArgs[key];
      let prepared;
      try {
        prepared = await verb.prepare(stepArgs, ctx);
      } catch (e) {
        if (e instanceof ToolInputError) throw new ToolInputError(`Step ${i + 1}: ${e.message}`);
        throw e;
      }
      if (!prepared.orgId) throw new ToolInputError('You are not in a workspace yet');
      if (rows.length && prepared.orgId !== rows[0].org_id) throw new ToolInputError('Every step of a plan must be in the same workspace');
      const summary = bindings?.projectId ? `${prepared.summary} · in the new project` : prepared.summary;
      rows.push({
        org_id: prepared.orgId,
        user_id: ctx.userId,
        tool_name: tools[i],
        risk_class: verb.risk,
        summary,
        payload: prepared.payload,
        plan_id: planId,
        step_order: i,
        arg_bindings: bindings,
      });
    }
    const { data, error } = await ctx.db.from('ento_ai_action_log').insert(rows).select(COLUMNS);
    if (error || !data || data.length !== rows.length) throw new Error(error?.message || 'the plan was not saved');
    const proposals = data.map(toProposal).sort((a, b) => a.stepOrder - b.stepOrder);
    return {
      name,
      ok: true,
      count: 0,
      proposals,
      response: { proposed: true, steps: proposals.map((p) => p.summary), note: PLAN_NOTE },
    };
  } catch (e) {
    const message = e instanceof ToolInputError ? e.message : `Could not prepare the plan: ${e.message}`;
    return { name, ok: false, count: 0, response: { error: message } };
  }
}

async function loadPlan(ctx, planId) {
  uuidArg(planId, 'plan id');
  const { data, error } = await ctx.db.from('ento_ai_action_log').select(COLUMNS)
    .eq('plan_id', planId)
    .in('org_id', ctx.orgIds)
    .order('step_order', { ascending: true });
  if (error) throw new Error(error.message);
  if (!data || !data.length) throw new ActionError(404, 'Plan not found');
  return data;
}

/** Every step's current state, in order, after a plan call. */
async function planResult(ctx, planId, extra) {
  return { ...extra, proposals: (await loadPlan(ctx, planId)).map(toProposal) };
}

/**
 * Runs the plan in order under the caller's client. Every step is validated before step 1
 * runs; a bound step is validated again once its binding is filled. Each step is claimed with
 * the same conditional update as a single confirm, so a second tab stops at the first claim.
 * The plan stops at the first failure; the steps already done stay done, for Undo plan.
 */
async function confirmPlan(ctx, planId) {
  const rows = await loadPlan(ctx, planId);
  const notProposed = rows.find((r) => r.status !== 'proposed');
  if (notProposed) throw new ActionError(409, `Step ${notProposed.step_order + 1} is already ${notProposed.status}, so this plan cannot run again`);
  for (const r of rows) {
    const verb = VERBS[r.tool_name];
    if (!verb) throw new ActionError(422, `Step ${r.step_order + 1} can no longer run`);
    try {
      await reprepare(verb, r.payload, ctx, r.org_id);
    } catch (e) {
      if (e instanceof ToolInputError) throw new ActionError(422, `Step ${r.step_order + 1}: ${e.message}`);
      throw e;
    }
  }

  const results = {};
  for (const r of rows) {
    const verb = VERBS[r.tool_name];
    const step = r.step_order + 1;
    const claimed = await moveRow(ctx, r.id, 'proposed', { status: 'confirmed', resolved_at: now() });
    if (!claimed) return planResult(ctx, planId, { ok: false, failedStep: step, error: 'This plan is already running somewhere else' });

    let outcome;
    try {
      const payload = resolveBindings(r.payload, r.arg_bindings, results);
      const prepared = await reprepare(verb, payload, ctx, r.org_id);
      outcome = await verb.execute(prepared.payload, { ...ctx, orgId: r.org_id });
    } catch (e) {
      const message = e instanceof ToolInputError ? e.message : `It could not be done: ${e.message}`;
      await moveRow(ctx, r.id, 'confirmed', { status: 'failed', result: { error: message } }).catch(() => null);
      return planResult(ctx, planId, { ok: false, failedStep: step, error: `Step ${step} stopped the plan: ${message}` });
    }
    const done = await moveRow(ctx, r.id, 'confirmed', {
      status: 'executed', result: outcome.result, undo: outcome.undo, executed_at: now(),
    }).catch(() => null);
    if (!done) {
      return planResult(ctx, planId, {
        ok: false, reviewRequired: true, failedStep: step,
        error: `Step ${step} was done, but its record was not saved. Check it before you repeat or undo this plan.`,
      });
    }
    results[r.step_order] = outcome.result;
  }
  return planResult(ctx, planId, { ok: true });
}

async function rejectPlan(ctx, planId) {
  const rows = await loadPlan(ctx, planId);
  const notProposed = rows.find((r) => r.status !== 'proposed');
  if (notProposed) throw new ActionError(409, `Step ${notProposed.step_order + 1} is already ${notProposed.status}`);
  for (const r of rows) await moveRow(ctx, r.id, 'proposed', { status: 'rejected', resolved_at: now() });
  return planResult(ctx, planId, { ok: true });
}

/**
 * Undoes the done steps last-first, since a later step can depend on an earlier one (a task
 * in the plan's new project). Each step uses the single undo, with all its guards. A refused
 * step is reported and the rest still run, as Logos AI's undoPlan.
 */
async function undoPlan(ctx, planId) {
  const rows = await loadPlan(ctx, planId);
  if (rows.some((r) => r.status === 'confirmed')) {
    throw new ActionError(409, 'A step of this plan needs review. Check its records before you undo it.');
  }
  const done = rows.filter((r) => r.status === 'executed').reverse();
  if (!done.length) throw new ActionError(409, 'No step of this plan is done, so there is nothing to undo');
  const errors = [];
  for (const r of done) {
    const out = await undoRow(ctx, r);
    if (!out.ok) errors.push(`Step ${r.step_order + 1}: ${out.error}`);
  }
  return planResult(ctx, planId, errors.length ? { ok: false, error: errors.join(' ') } : { ok: true });
}

module.exports = {
  propose, confirm, reject, edit, undo, list, toProposal, tokensMatch, ActionError,
  proposePlan, confirmPlan, rejectPlan, undoPlan, resolveBindings,
};
