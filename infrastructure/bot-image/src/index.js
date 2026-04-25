/**
 * Entomate meeting bot — session entrypoint.
 *
 * Reads session config from env, launches headless Chromium, runs the
 * platform driver for the session's duration, and exits. The container is
 * launched per-meeting by the orchestrator; Fly Machines auto-destroy on
 * exit, so there is no reuse across sessions.
 *
 * P1.1 scope: skeleton that boots Chromium, reports status via callback, and
 * exits cleanly. P1.2 replaces `runPlatformDriver` with real Meet/Zoom/Teams
 * join logic + loopback audio capture.
 */

'use strict';

const fs = require('fs');
const puppeteerCore = require('puppeteer-core');
const { addExtra } = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Wrap puppeteer-core with the puppeteer-extra plugin system and enable
// stealth — defeats the basic automation fingerprints Google Meet checks for
// (navigator.webdriver, missing chrome.runtime, suspicious UA, etc.).
const puppeteer = addExtra(puppeteerCore);
puppeteer.use(StealthPlugin());

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'stopped', 'timeout']);

function readEnv() {
  const config = {
    // Per-session config (set by orchestrator at Machine launch)
    sessionId: process.env.BOT_SESSION_ID,
    workspaceId: process.env.BOT_WORKSPACE_ID,
    meetingId: process.env.BOT_MEETING_ID,
    meetingUrl: process.env.BOT_MEETING_URL,
    platform: process.env.BOT_PLATFORM || 'meet',
    maxDurationMs: parseInt(process.env.BOT_MAX_DURATION_MS || `${3 * 60 * 60 * 1000}`, 10),
    callbackUrl: process.env.BOT_CALLBACK_URL || '',
    callbackToken: process.env.BOT_CALLBACK_TOKEN || '',

    // Runtime
    audioDir: process.env.BOT_AUDIO_DIR || '/tmp/bot-audio',
    chromiumPath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    headless: process.env.BOT_HEADLESS !== 'false',

    // Meet Mate identity — used by drivers/<platform>.js to authenticate the
    // headless Chromium session before joining the meeting. P1.2 Pass 2 adds
    // the actual login flow that consumes these.
    identity: {
      email: process.env.MEET_MATE_EMAIL || '',
      password: process.env.MEET_MATE_PASSWORD || '',
      totpSecret: process.env.MEET_MATE_TOTP_SECRET || '',
      displayName: process.env.MEET_MATE_DISPLAY_NAME || 'Meet Mate'
    }
  };

  const required = ['sessionId', 'workspaceId', 'meetingId', 'meetingUrl'];
  const missing = required.filter((k) => !config[k]);
  if (missing.length) {
    slog('error', 'missing_env', { missing });
    process.exit(2);
  }
  return config;
}

function slog(level, msg, extra = {}) {
  process.stdout.write(
    JSON.stringify({ ts: new Date().toISOString(), level, msg, ...extra }) + '\n'
  );
}

async function reportStatus(config, status, extra = {}) {
  if (!config.callbackUrl || !config.callbackToken) return;
  try {
    await fetch(config.callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.callbackToken}`
      },
      body: JSON.stringify({
        session_id: config.sessionId,
        status,
        ts: new Date().toISOString(),
        ...extra
      })
    });
  } catch (err) {
    slog('warn', 'callback_failed', { status, error: err.message });
  }
}

async function launchBrowser(config) {
  return puppeteer.launch({
    executablePath: config.chromiumPath,
    headless: config.headless ? 'new' : false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
      '--enable-usermedia-screen-capturing',
      '--allow-http-screen-capture',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,720'
    ],
    defaultViewport: { width: 1280, height: 720 }
  });
}

/**
 * P1.1 placeholder. P1.2 Pass 2 replaces this with a real platform driver
 * dispatched from src/drivers/<platform>.js that:
 *   1. Logs the bot in as the Meet Mate Google account using config.identity
 *      (email + password + TOTP via otplib)
 *   2. Navigates to the meeting URL
 *   3. Sets display name + microphone off + camera off
 *   4. Submits join request, handles waiting room
 *   5. Announces in chat
 *   6. Starts loopback audio capture → streams to Deepgram
 *   7. Monitors meeting-ended signals
 */
async function runPlatformDriver(browser, config) {
  const page = await browser.newPage();
  try {
    slog('info', 'navigate', {
      url: config.meetingUrl,
      platform: config.platform,
      hasIdentity: Boolean(config.identity.email && config.identity.totpSecret)
    });
    await page.goto(config.meetingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await reportStatus(config, 'in_call', { placeholder: true });
    slog('info', 'placeholder_dwell', { note: 'P1.2 Pass 2 replaces this with real driver' });
    await new Promise((resolve) => setTimeout(resolve, 5000));
  } finally {
    await page.close().catch(() => {});
  }
}

async function runSession(config) {
  slog('info', 'session_start', {
    session_id: config.sessionId,
    platform: config.platform,
    meeting_id: config.meetingId
  });
  await reportStatus(config, 'starting');

  if (!fs.existsSync(config.audioDir)) {
    fs.mkdirSync(config.audioDir, { recursive: true });
  }

  await reportStatus(config, 'joining');
  const browser = await launchBrowser(config);
  try {
    await runPlatformDriver(browser, config);
  } finally {
    await browser.close().catch(() => {});
  }

  await reportStatus(config, 'completed');
  slog('info', 'session_end', { session_id: config.sessionId });
}

async function main() {
  const config = readEnv();
  const startTs = Date.now();

  let timedOut = false;
  const timer = setTimeout(async () => {
    timedOut = true;
    slog('error', 'session_max_duration_exceeded', {
      session_id: config.sessionId,
      max_duration_ms: config.maxDurationMs
    });
    await reportStatus(config, 'timeout').catch(() => {});
    process.exit(3);
  }, config.maxDurationMs);
  timer.unref();

  try {
    await runSession(config);
    slog('info', 'session_elapsed_ms', { elapsed: Date.now() - startTs });
    process.exit(0);
  } catch (err) {
    if (timedOut) return;
    slog('error', 'session_failed', { error: err.message, stack: err.stack });
    await reportStatus(config, 'failed', { error: err.message }).catch(() => {});
    process.exit(1);
  }
}

['SIGTERM', 'SIGINT'].forEach((sig) => {
  process.on(sig, () => {
    slog('warn', 'signal_received', { signal: sig });
    process.exit(0);
  });
});

main();

module.exports = { TERMINAL_STATUSES };
