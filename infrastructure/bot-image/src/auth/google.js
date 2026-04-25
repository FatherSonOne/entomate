/**
 * Google account login flow for the Meet Mate bot.
 *
 * Drives Chromium through the standard accounts.google.com sign-in:
 *   email → password → 2-Step Verification (TOTP) → myaccount.google.com
 *
 * On a fresh container there are no cookies, so every session starts at the
 * email screen. If Google presents a non-TOTP challenge first (push, SMS,
 * security key) we click through "Try another way" and pick Authenticator.
 *
 * Failure modes are logged with the final URL + title so misbehavior shows
 * up clearly in `fly logs`.
 */

'use strict';

const { authenticator } = require('otplib');
const { slog } = require('../log');
const { sleep, waitForUrl, clickByText, readInnerText, screenshot } = require('../utils/wait');

const SIGNIN_URL =
  'https://accounts.google.com/signin/v2/identifier' +
  '?service=accountsettings' +
  '&continue=https%3A%2F%2Fmyaccount.google.com%2F' +
  '&hl=en';

// Google may present any of these post-password URLs; all signal "logged in"
// when we get redirected away from /signin and /challenge.
const LOGGED_IN_HOSTS = ['myaccount.google.com', 'accounts.google.com/AccountChooser'];

/**
 * Run the full Google sign-in. Throws on any failure with a descriptive
 * message; never returns "false" — caller catches the throw.
 */
async function logPageState(page, label) {
  try {
    const url = page.url();
    const title = await page.title().catch(() => '(no title)');
    slog('info', 'page_state', { label, url, title });
  } catch (err) {
    slog('warn', 'page_state_failed', { label, error: err.message });
  }
}

async function loginToGoogle(page, identity, { audioDir } = {}) {
  if (!identity?.email || !identity?.password || !identity?.totpSecret) {
    throw new Error('Google login requires email, password, totpSecret');
  }

  slog('info', 'google_login_start', { email: maskEmail(identity.email) });

  try {
    await page.goto(SIGNIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await logPageState(page, 'after_signin_goto');
    await screenshot(page, audioDir, 'google-01-signin-loaded');

    await submitEmail(page, identity.email);
    await logPageState(page, 'after_email_submit');
    await screenshot(page, audioDir, 'google-02-email-submitted');

    await submitPassword(page, identity.password);
    await logPageState(page, 'after_password_submit');
    await screenshot(page, audioDir, 'google-03-password-submitted');

    await handle2SV(page, identity.totpSecret, audioDir);
    await logPageState(page, 'after_2sv');
    await screenshot(page, audioDir, 'google-04-after-2sv');

    await waitForLoggedIn(page);
    await logPageState(page, 'logged_in');
    await screenshot(page, audioDir, 'google-05-logged-in');

    slog('info', 'google_login_success', { url: page.url() });
  } catch (err) {
    // Log page state at failure so we can see exactly where Google left us
    await logPageState(page, 'login_failed').catch(() => {});
    await screenshot(page, audioDir, 'google-error-state').catch(() => {});
    throw err;
  }
}

async function submitEmail(page, email) {
  const emailSelector = 'input[type="email"], #identifierId';
  await page.waitForSelector(emailSelector, { visible: true, timeout: 15000 });
  // Clear in case Google pre-filled (cached account)
  await page.click(emailSelector, { clickCount: 3 });
  await page.type(emailSelector, email, { delay: 40 });

  // Click Next; sometimes there's a navigation, sometimes just a SPA transition
  const navP = page
    .waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 })
    .catch(() => null);
  await page.click('#identifierNext button, #identifierNext, button[jsname][type="button"]');
  await navP;
  // Belt-and-suspenders — wait for password input to appear (or a body-text
  // change that signals an error)
  await page
    .waitForSelector('input[type="password"]', { visible: true, timeout: 15000 })
    .catch(() => null);

  const errorText = await bodyMatches(page, /couldn'?t find your Google Account/i);
  if (errorText) {
    throw new Error(`Email rejected by Google: ${errorText}`);
  }
}

async function submitPassword(page, password) {
  const pwSelector = 'input[type="password"]';
  await page.waitForSelector(pwSelector, { visible: true, timeout: 15000 });
  await page.type(pwSelector, password, { delay: 40 });

  const navP = page
    .waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 })
    .catch(() => null);
  await page.click('#passwordNext button, #passwordNext, button[jsname][type="button"]');
  await navP;

  // Wait for either a 2SV screen or a logged-in redirect; ignore timeout —
  // handle2SV / waitForLoggedIn will surface the real state.
  await Promise.race([
    page.waitForSelector('input[name="totpPin"], input[type="tel"][maxlength="6"]', {
      visible: true,
      timeout: 20000
    }),
    waitForUrl(page, 'myaccount.google.com', { timeoutMs: 20000 })
  ]).catch(() => null);

  const wrongPw = await bodyMatches(page, /Wrong password|incorrect password/i);
  if (wrongPw) {
    throw new Error(`Password rejected by Google: ${wrongPw}`);
  }
}

async function handle2SV(page, totpSecret, audioDir) {
  // If we've already landed on myaccount, no 2SV needed
  if (/myaccount\.google\.com/.test(page.url())) {
    slog('info', '2sv_skipped_already_signed_in');
    return;
  }

  let totpInput = await page.$('input[name="totpPin"], input[type="tel"][maxlength="6"]');
  if (!totpInput) {
    slog('info', '2sv_picking_totp_method', { url: page.url() });
    await screenshot(page, audioDir, 'google-2sv-method-chooser');

    // Try to switch challenge methods until we land on TOTP
    const tryAnotherClicked = await clickByText(page, 'button, a, div[role="link"]', 'try another way');
    if (tryAnotherClicked) {
      await sleep(1500);
      await screenshot(page, audioDir, 'google-2sv-other-methods');
    }

    const authClicked = await clickByText(
      page,
      'div[role="link"], li, button',
      'google authenticator'
    );
    if (!authClicked) {
      // Fall back: any item mentioning "verification code" or "authenticator"
      await clickByText(page, 'div[role="link"], li, button', 'verification code');
    }

    await sleep(1500);
    totpInput = await page.waitForSelector('input[name="totpPin"], input[type="tel"][maxlength="6"]', {
      visible: true,
      timeout: 15000
    });
  }

  const code = authenticator.generate(totpSecret);
  slog('info', '2sv_totp_submit');
  await page.type('input[name="totpPin"], input[type="tel"][maxlength="6"]', code, { delay: 40 });

  const navP = page
    .waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 })
    .catch(() => null);
  // Either dedicated Next button or just press Enter
  const nextClicked = await clickByText(page, 'button', 'next');
  if (!nextClicked) await page.keyboard.press('Enter');
  await navP;

  const codeRejected = await bodyMatches(page, /wrong code|incorrect code|try again/i);
  if (codeRejected) {
    throw new Error(`TOTP code rejected by Google: ${codeRejected}`);
  }
}

async function waitForLoggedIn(page) {
  await waitForUrl(
    page,
    (url) =>
      LOGGED_IN_HOSTS.some((h) => url.includes(h)) &&
      !url.includes('/signin') &&
      !url.includes('/challenge'),
    { timeoutMs: 25000 }
  );

  // Best-effort: dismiss "Save password?" / "Stay signed in?" type prompts
  await sleep(1500);
  await clickByText(page, 'button', 'not now').catch(() => {});
  await clickByText(page, 'button', 'no thanks').catch(() => {});
}

async function bodyMatches(page, regex) {
  try {
    const body = await page.$('body');
    if (!body) return null;
    const text = await readInnerText(body);
    const m = text.match(regex);
    return m ? m[0] : null;
  } catch {
    return null;
  }
}

function maskEmail(email) {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`;
}

module.exports = { loginToGoogle };
