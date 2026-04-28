/**
 * Consent Email Service — Resend HTTP API client.
 *
 * Slim wrapper used by the bot orchestrator (P1.7 Slice 2) to fire the
 * pre-meeting opt-out email to attendees and the organizer-notification
 * follow-up when an attendee clicks the opt-out link.
 *
 * Kept separate from the existing nodemailer-backed `emailService.js`
 * (which handles weekly summaries / meeting recaps over SMTP) so the
 * two transport mechanisms don't entangle and so adding Resend doesn't
 * change anything about the legacy flows.
 *
 * Env:
 *   RESEND_API_KEY  — Bearer token from resend.com dashboard. If unset,
 *                     all sends return {skipped: true} and the caller
 *                     records 'skipped' on the attendee row. This means
 *                     deploys can land before Resend setup is finished
 *                     without breaking the bot launch path.
 *   RESEND_FROM     — Sender, e.g. 'Meet Mate <notifications@qntmecos.com>'.
 *                     Defaults to a sandbox sender that will fail on real
 *                     recipients in prod — must be set before live use.
 *   OPT_OUT_BASE_URL — Base URL that opt-out links point to. Default
 *                     https://entomate.onrender.com (the SPA fallback in
 *                     server.js routes /opt-out/:token to the React app).
 */

'use strict';

const log = require('../utils/log');

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Meet Mate <onboarding@resend.dev>'; // sandbox; override via RESEND_FROM
const OPT_OUT_BASE_URL = process.env.OPT_OUT_BASE_URL || 'https://entomate.onrender.com';

function isConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

async function resendSend({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { skipped: true, reason: 'RESEND_API_KEY unset' };
  }

  const from = process.env.RESEND_FROM || DEFAULT_FROM;
  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to, subject, html, text })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.json();
}

function buildOptOutUrl(rawToken) {
  return `${OPT_OUT_BASE_URL}/opt-out/${encodeURIComponent(rawToken)}`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function attendeeOptOutHtml({ organizerName, optOutUrl }) {
  const safeOrg = escapeHtml(organizerName || 'your meeting host');
  const safeUrl = escapeHtml(optOutUrl);
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f5f7;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff;">
    <h1 style="font-size:20px;line-height:1.4;color:#0f172a;margin:0 0 16px;">
      Heads up — ${safeOrg} is using Meet Mate in your upcoming meeting
    </h1>
    <p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 16px;">
      Meet Mate is an AI notetaker. It will join your meeting as a visible
      participant, record audio, and produce a transcript with speaker
      labels.
    </p>
    <p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 16px;">
      The recording and transcript go to ${safeOrg}'s workspace at Entomate.
      They are not shared elsewhere and are not used to train AI models.
    </p>
    <p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 24px;">
      If you'd rather not be recorded, you can opt out:
    </p>
    <p style="margin:0 0 24px;">
      <a href="${safeUrl}"
         style="display:inline-block;padding:12px 24px;background:#FF2D6B;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
        Opt out of recording
      </a>
    </p>
    <p style="font-size:14px;line-height:1.5;color:#64748b;margin:0 0 16px;">
      When you opt out, ${safeOrg} is notified and can decide whether to
      continue. You can also raise it directly in the meeting itself.
    </p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
    <p style="font-size:12px;line-height:1.5;color:#94a3b8;margin:0;">
      Sent by Entomate on behalf of ${safeOrg}.
      &nbsp;·&nbsp;
      <a href="https://entomate.onrender.com/privacy" style="color:#94a3b8;">Privacy policy</a>
    </p>
  </div>
</body></html>`;
}

function attendeeOptOutText({ organizerName, optOutUrl }) {
  const org = organizerName || 'your meeting host';
  return `Heads up — ${org} is using Meet Mate in your upcoming meeting.

Meet Mate is an AI notetaker. It will join your meeting as a visible participant, record audio, and produce a transcript with speaker labels.

The recording and transcript go to ${org}'s workspace at Entomate. They are not shared elsewhere and are not used to train AI models.

If you'd rather not be recorded, opt out here:
${optOutUrl}

When you opt out, ${org} is notified and can decide whether to continue. You can also raise it directly in the meeting itself.

—
Sent by Entomate on behalf of ${org}.
Privacy: https://entomate.onrender.com/privacy
`;
}

/**
 * Send the pre-meeting opt-out email to a single attendee.
 *
 * Returns:
 *   { skipped: true, reason }       — RESEND_API_KEY unset
 *   { id: '<resend-id>' }           — Resend accepted (not yet delivered)
 * Throws on Resend non-2xx or fetch failure.
 */
async function sendAttendeeOptOutEmail({ to, organizerName, rawToken }) {
  const optOutUrl = buildOptOutUrl(rawToken);
  return resendSend({
    to,
    subject: `Heads up — ${organizerName || 'a meeting host'}'s Meet Mate notetaker will be in your meeting`,
    html: attendeeOptOutHtml({ organizerName, optOutUrl }),
    text: attendeeOptOutText({ organizerName, optOutUrl })
  });
}

function organizerOptOutNotificationHtml({ organizerName, attendeeEmail, reason }) {
  const safeOrg = escapeHtml(organizerName || 'there');
  const safeEmail = escapeHtml(attendeeEmail);
  const reasonBlock = reason
    ? `<p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 16px;">
         <strong>Reason given:</strong> ${escapeHtml(reason)}
       </p>`
    : '';
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f5f7;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff;">
    <h1 style="font-size:20px;line-height:1.4;color:#0f172a;margin:0 0 16px;">
      An attendee opted out of recording
    </h1>
    <p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 16px;">
      Hi ${safeOrg},
    </p>
    <p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 16px;">
      <strong>${safeEmail}</strong> just opted out of being recorded in
      your upcoming meeting where you launched Meet Mate.
    </p>
    ${reasonBlock}
    <p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 16px;">
      You decide what to do next — continue with the bot, ask the
      attendee in person, or stop the bot. Per the consent disclosure
      in the launch flow, the legal obligation to honor the opt-out
      rests with you.
    </p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
    <p style="font-size:12px;line-height:1.5;color:#94a3b8;margin:0;">
      Entomate · <a href="https://entomate.onrender.com/privacy" style="color:#94a3b8;">Privacy</a>
    </p>
  </div>
</body></html>`;
}

function organizerOptOutNotificationText({ organizerName, attendeeEmail, reason }) {
  const lines = [
    `Hi ${organizerName || 'there'},`,
    '',
    `${attendeeEmail} just opted out of being recorded in your upcoming meeting where you launched Meet Mate.`
  ];
  if (reason) {
    lines.push('', `Reason given: ${reason}`);
  }
  lines.push(
    '',
    'You decide what to do next — continue with the bot, ask the attendee in person, or stop the bot. Per the consent disclosure in the launch flow, the legal obligation to honor the opt-out rests with you.',
    '',
    '—',
    'Entomate · https://entomate.onrender.com/privacy'
  );
  return lines.join('\n');
}

/**
 * Notify the organizer that an attendee opted out. Best-effort; a failure
 * here never throws back to the public opt-out endpoint — the recipient
 * should always see "ok, you're opted out" regardless of notification
 * delivery.
 */
async function sendOrganizerOptOutNotification({ to, organizerName, attendeeEmail, reason }) {
  try {
    return await resendSend({
      to,
      subject: `Heads up — ${attendeeEmail} opted out of recording`,
      html: organizerOptOutNotificationHtml({ organizerName, attendeeEmail, reason }),
      text: organizerOptOutNotificationText({ organizerName, attendeeEmail, reason })
    });
  } catch (err) {
    log.warn('Organizer opt-out notification failed', {
      to, attendeeEmail, error: err.message
    });
    return { error: err.message };
  }
}

function deletionRequestNotificationHtml({ requestId, requesterEmail, reason }) {
  const safeEmail = escapeHtml(requesterEmail);
  const safeId = escapeHtml(requestId);
  const reasonBlock = reason
    ? `<p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 16px;">
         <strong>Reason given:</strong> ${escapeHtml(reason)}
       </p>`
    : '';
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f5f7;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff;">
    <h1 style="font-size:20px;line-height:1.4;color:#0f172a;margin:0 0 16px;">
      New GDPR data-deletion request
    </h1>
    <p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 16px;">
      <strong>${safeEmail}</strong> has submitted a right-to-delete request.
    </p>
    ${reasonBlock}
    <p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 16px;">
      <strong>Request ID:</strong> <code>${safeId}</code>
    </p>
    <p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 16px;">
      Action via the admin endpoints (curl with your access token):
    </p>
    <pre style="background:#f1f5f9;padding:12px;border-radius:8px;font-size:12px;line-height:1.5;color:#0f172a;overflow:auto;margin:0 0 16px;">POST /api/consent/data-deletion/admin/${safeId}/fulfill
POST /api/consent/data-deletion/admin/${safeId}/deny  (body: { reason })</pre>
    <p style="font-size:14px;line-height:1.5;color:#64748b;margin:0 0 16px;">
      Per GDPR Art. 17, fulfill within 1 month (Entomate target: 72 hours).
      Denial requires a documented reason from Art. 17(3) — e.g. legal
      obligation to retain.
    </p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
    <p style="font-size:12px;line-height:1.5;color:#94a3b8;margin:0;">
      Entomate · platform admin notification
    </p>
  </div>
</body></html>`;
}

function deletionRequestNotificationText({ requestId, requesterEmail, reason }) {
  const lines = [
    'New GDPR data-deletion request',
    '',
    `${requesterEmail} has submitted a right-to-delete request.`
  ];
  if (reason) lines.push('', `Reason given: ${reason}`);
  lines.push(
    '',
    `Request ID: ${requestId}`,
    '',
    'Action via:',
    `  POST /api/consent/data-deletion/admin/${requestId}/fulfill`,
    `  POST /api/consent/data-deletion/admin/${requestId}/deny  (body: { reason })`,
    '',
    'Per GDPR Art. 17, fulfill within 1 month (Entomate target: 72 hours). Denial requires a documented reason from Art. 17(3).',
    '',
    '—',
    'Entomate · platform admin notification'
  );
  return lines.join('\n');
}

/**
 * Notify a platform admin that a new GDPR deletion request has landed.
 * Best-effort; failures are logged. Submission still succeeds even if
 * the notification fails — admins can poll the pending list.
 */
async function sendDeletionRequestNotification({ to, requestId, requesterEmail, reason }) {
  try {
    return await resendSend({
      to,
      subject: `GDPR deletion request from ${requesterEmail}`,
      html: deletionRequestNotificationHtml({ requestId, requesterEmail, reason }),
      text: deletionRequestNotificationText({ requestId, requesterEmail, reason })
    });
  } catch (err) {
    log.warn('Deletion request notification failed', { to, requestId, error: err.message });
    return { error: err.message };
  }
}

module.exports = {
  isConfigured,
  buildOptOutUrl,
  sendAttendeeOptOutEmail,
  sendOrganizerOptOutNotification,
  sendDeletionRequestNotification,
  _internal: {
    resendSend,
    attendeeOptOutHtml,
    attendeeOptOutText,
    organizerOptOutNotificationHtml,
    organizerOptOutNotificationText,
    deletionRequestNotificationHtml,
    deletionRequestNotificationText,
    escapeHtml
  }
};
