/**
 * Auth for the internal job routes when the caller is Supabase pg_cron.
 *
 * pg_cron (migration 20261122000019) posts with X-Cron-Token, a random token
 * kept in private.cron_secrets. The backend reads it through the
 * service-role-only function public.internal_cron_token() and caches it for
 * five minutes. X-API-Key = INTERNAL_API_KEY still works (GitHub Actions).
 */
const crypto = require('crypto');
const { apiKeyAuth } = require('./auth');
const log = require('../utils/log');

const TTL_MS = 5 * 60 * 1000;
let cache = { token: null, at: 0 };

async function loadToken() {
  if (cache.token && Date.now() - cache.at < TTL_MS) return cache.token;
  const { supabaseAdmin } = require('../config/supabase');
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.rpc('internal_cron_token', { p_name: 'jobs' });
  if (error) {
    log.warn('[cronTokenAuth] could not read cron token', { error: error.message });
    return cache.token; // keep the last good value through a blip
  }
  cache = { token: typeof data === 'string' && data ? data : null, at: Date.now() };
  return cache.token;
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

async function internalJobAuth(req, res, next) {
  const given = req.headers['x-cron-token'];
  if (!given) return apiKeyAuth(req, res, next);
  try {
    const token = await loadToken();
    if (token && safeEqual(given, token)) {
      req.isServiceRequest = true;
      req.jobCaller = 'pg_cron';
      return next();
    }
  } catch (err) {
    log.error('[cronTokenAuth] check failed', { error: err.message });
  }
  return res.status(401).json({ error: 'Unauthorized', message: 'Invalid cron token' });
}

internalJobAuth._reset = () => { cache = { token: null, at: 0 }; };

module.exports = { internalJobAuth };
