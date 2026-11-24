/**
 * AI usage per org (EAI-07): counts each question, its tokens and its cost into
 * org_ai_usage_monthly, and refuses a question once the org has used its month.
 *
 * Counted on the backend only: the browser cannot be trusted to report its own
 * usage. The service client writes through record_ai_usage (service-role only).
 *
 * meterAi (route middleware) checks the quota, then opens a scope for the
 * request. Each Gemini call made inside it reports its usageMetadata through
 * addUsage, which records that call at once: the first call of a question adds
 * 1 to request_count, later agent rounds add tokens only. Recording per call
 * means a user who drops the connection mid-answer is still counted.
 */

'use strict';

const { AsyncLocalStorage } = require('async_hooks');
const { supabase } = require('../config/supabase');
const { getOrgIdsForUser } = require('../utils/orgContext');
const log = require('../utils/log');

// Gemini 2.5 Flash, paid tier, standard, USD per 1M tokens; output includes
// thinking tokens. Source: https://ai.google.dev/gemini-api/docs/pricing
// (read 2026-11-23). Change with the model in config/gemini.js and routes/entoAi.js.
// From 2026-12-01 Google routes gemini-2.5-flash requests to gemini-3.5-flash-lite,
// billed at its rates, which were the same $0.30 / $2.50 on 2026-11-23
// (https://ai.google.dev/gemini-api/docs/deprecations). Recheck both if that changes.
const PRICE_PER_MILLION = { input: 0.30, output: 2.50 };

// Monthly AI questions per plan. An org's ai_monthly_limit can only raise this:
// Stripe changes `plan` and never the column, so the plan must set the floor.
const PLAN_AI_LIMITS = { free: 100, solo: 1000, team: 5000, ecosystem: 10000 };

const scope = new AsyncLocalStorage();

/** First day of the current UTC month, as record_ai_usage stores it. */
function monthStart(now = new Date()) {
  return `${now.toISOString().slice(0, 7)}-01`;
}

function limitFor(org) {
  return Math.max(Number(org?.ai_monthly_limit) || 0, PLAN_AI_LIMITS[org?.plan] || PLAN_AI_LIMITS.free);
}

async function quotaFor(orgId) {
  const [org, usage] = await Promise.all([
    supabase.from('tenant_organizations').select('plan, ai_monthly_limit').eq('id', orgId).maybeSingle(),
    supabase.from('org_ai_usage_monthly').select('request_count').eq('org_id', orgId).eq('month', monthStart()).maybeSingle(),
  ]);
  if (org.error) throw new Error(org.error.message);
  if (usage.error) throw new Error(usage.error.message);
  return { used: Number(usage.data?.request_count) || 0, limit: limitFor(org.data) };
}

/** Gemini usageMetadata → tokens and USD. Output includes thinking tokens (billed as output). */
function usageOf(meta) {
  const input = Number(meta?.promptTokenCount) || 0;
  const output = (Number(meta?.candidatesTokenCount) || 0) + (Number(meta?.thoughtsTokenCount) || 0);
  const cost = (input * PRICE_PER_MILLION.input + output * PRICE_PER_MILLION.output) / 1e6;
  return { input, output, cost: Math.round(cost * 1e6) / 1e6 };
}

/**
 * Records one finished model call for the current request. A no-op outside
 * meterAi (background jobs) or when the org is unknown. Never throws.
 * shortcut: only Gemini calls report here; the OpenAI provider and embeddings are not counted.
 */
function addUsage(meta) {
  const s = scope.getStore();
  if (!s?.orgId || !supabase) return Promise.resolve();
  const { input, output, cost } = usageOf(meta);
  const requests = s.counted ? 0 : 1;
  s.counted = true;
  return Promise.resolve(supabase.rpc('record_ai_usage', {
    p_org_id: s.orgId, p_requests: requests, p_tokens_input: input, p_tokens_output: output, p_cost: cost,
  })).then(({ error } = {}) => {
    if (error) log.warn(`[aiUsage] Could not record usage: ${error.message}`);
  }).catch((err) => log.warn(`[aiUsage] Could not record usage: ${err.message || err}`));
}

/**
 * Route middleware, after authenticate. 429 { code: 'ai_quota' } once the org's
 * questions this month reach its limit. A failed quota read lets the question
 * through: a broken counter must not take Ask Entomate down.
 * shortcut: the org is the user's first (as the thread uses); concurrent questions
 * can pass the limit by a few. Upgrade when users belong to several orgs.
 */
async function meterAi(req, res, next) {
  let orgId = null;
  try {
    if (supabase) orgId = (await getOrgIdsForUser(req.user?.id))[0] || null;
  } catch (err) {
    log.warn('[aiUsage] Could not resolve workspace:', err.message || err);
  }
  return meterAiForOrg(orgId, res, next);
}

async function meterAiForOrg(orgId, res, next) {
  if (orgId && supabase) {
    try {
      const { used, limit } = await quotaFor(orgId);
      if (used >= limit) {
        return res.status(429).json({
          code: 'ai_quota',
          used,
          limit,
          error: `Your workspace has used all ${limit} AI questions for this month. The count starts again on the 1st.`,
        });
      }
    } catch (err) {
      log.warn('[aiUsage] Quota check skipped:', err.message || err);
    }
  }
  return scope.run({ orgId, counted: false }, next);
}

module.exports = { meterAi, meterAiForOrg, addUsage, usageOf, limitFor, monthStart, PLAN_AI_LIMITS, PRICE_PER_MILLION };
