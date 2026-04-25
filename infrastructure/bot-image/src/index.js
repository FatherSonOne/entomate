/**
 * Entomate meeting bot — session entrypoint.
 *
 * Reads session config from env, launches headless Chromium with the stealth
 * plugin, dispatches to the platform driver (drivers/<platform>.js), and
 * exits. Fly Machines auto-destroy on exit, so there is no reuse across
 * sessions.
 *
 * P1.2 Pass 2a (current): drivers/meet.js logs the bot in as the Meet Mate
 * Google account, then dwells briefly. Pass 2b adds the actual Meet join.
 */

'use strict';

const fs = require('fs');
const puppeteerCore = require('puppeteer-core');
const { addExtra } = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

const { slog } = require('./log');
const { reportStatus } = require('./callback');
const { runMeetDriver } = require('./drivers/meet');

// Wrap puppeteer-core with the puppeteer-extra plugin system and enable
// stealth — defeats the basic automation fingerprints Google checks for
// (navigator.webdriver, missing chrome.runtime, suspicious UA, etc.).
const puppeteer = addExtra(puppeteerCore);
puppeteer.use(StealthPlugin());

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'stopped', 'timeout']);

const DRIVERS = {
  meet: runMeetDriver
  // zoom + teams land in P1.5
};

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

    // Meet Mate identity — consumed by drivers/<platform>.js to authenticate
    // the headless Chromium session before joining the meeting.
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

async function runSession(config) {
  slog('info', 'session_start', {
    session_id: config.sessionId,
    platform: config.platform,
    meeting_id: config.meetingId,
    has_identity: Boolean(config.identity.email && config.identity.totpSecret)
  });
  await reportStatus(config, 'starting');

  if (!fs.existsSync(config.audioDir)) {
    fs.mkdirSync(config.audioDir, { recursive: true });
  }

  const driver = DRIVERS[config.platform];
  if (!driver) {
    throw new Error(`No driver implemented for platform: ${config.platform}`);
  }

  await reportStatus(config, 'joining');
  const browser = await launchBrowser(config);
  try {
    await driver(browser, config);
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
