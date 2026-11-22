/**
 * Signed OAuth `state` for the Google Calendar connect flow.
 *
 * The frontend (Vercel) and backend (Render) are on different sites and the
 * API client sends no cookies, so the OAuth callback cannot rely on the
 * session to know who connected. The authenticated /auth request puts the
 * user id and return path in `state`, signed with SESSION_SECRET and valid
 * for 15 minutes; the callback trusts only a state that verifies.
 */
'use strict';

const crypto = require('crypto');

const TTL_MS = 15 * 60 * 1000;
const SAFE_PATH = /^\/(?!\/)[A-Za-z0-9/_\-?=&.]*$/;

function secret() {
  return process.env.SESSION_SECRET || 'entomate-dev-session-secret';
}

const b64 = (buf) => Buffer.from(buf).toString('base64url');
const sign = (body) => b64(crypto.createHmac('sha256', secret()).update(body).digest());

/** @returns {string} */
function createState({ userId, returnUrl }, now = Date.now()) {
  const r = typeof returnUrl === 'string' && SAFE_PATH.test(returnUrl) ? returnUrl : '/calendar';
  const body = b64(JSON.stringify({ u: userId, r, e: now + TTL_MS }));
  return `${body}.${sign(body)}`;
}

/** @returns {{ userId: string, returnUrl: string } | null} */
function verifyState(state, now = Date.now()) {
  if (typeof state !== 'string' || !state.includes('.')) return null;
  const [body, mac] = state.split('.');
  const expected = sign(body);
  if (!mac || mac.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const { u, r, e } = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof u !== 'string' || !u || typeof e !== 'number' || e < now) return null;
    return { userId: u, returnUrl: SAFE_PATH.test(r) ? r : '/calendar' };
  } catch {
    return null;
  }
}

module.exports = { createState, verifyState, TTL_MS };
