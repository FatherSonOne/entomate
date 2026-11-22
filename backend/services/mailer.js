/**
 * One way to send a product email.
 *
 * Resend (RESEND_API_KEY) is the transport the consent emails already use in
 * production; SMTP (emailService) is the older path and is only tried when
 * Resend is not set. Nothing configured → { skipped: true }, never a throw, so
 * a missing mail setup cannot break the job that wanted to send.
 */

'use strict';

const log = require('../utils/log');

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Entomate <onboarding@resend.dev>'; // Resend sandbox; set RESEND_FROM in production

/** Base URL of the web app, for links in emails. */
function appUrl() {
  return (process.env.FRONTEND_URL || 'https://entomate.app').replace(/\/+$/, '');
}

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function isConfigured() {
  if (process.env.RESEND_API_KEY) return true;
  try {
    const smtp = require('./emailService');
    smtp.initialize();
    return smtp.isConfigured();
  } catch {
    return false;
  }
}

/**
 * @param {{ to: string|string[], subject: string, html: string, text?: string, replyTo?: string|null }} msg
 * @returns {Promise<{ id?: string, transport?: string, skipped?: boolean, reason?: string }>}
 */
async function send({ to, subject, html, text, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const body = { from: process.env.RESEND_FROM || DEFAULT_FROM, to, subject, html, text };
    if (replyTo) body.reply_to = replyTo;
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Resend ${res.status}: ${detail.slice(0, 300)}`);
    }
    const json = await res.json().catch(() => ({}));
    return { id: json.id, transport: 'resend' };
  }

  const smtp = require('./emailService');
  smtp.initialize();
  if (smtp.isConfigured()) {
    const result = await smtp.sendEmail({ to, subject, html, text });
    return { id: result?.messageId, transport: 'smtp' };
  }

  log.info('[mailer] no email transport configured; skipped', { subject });
  return { skipped: true, reason: 'no email transport (set RESEND_API_KEY)' };
}

module.exports = { send, isConfigured, appUrl, escapeHtml };
