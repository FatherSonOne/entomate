/**
 * Google Meet driver.
 *
 * P1.2 Pass 2a (this file's current scope):
 *   - Log into the Meet Mate Google account
 *   - Take a "logged in" screenshot
 *   - Report `logged_in` status, dwell briefly, exit cleanly
 *
 * P1.2 Pass 2b will extend with:
 *   - Navigate to BOT_MEETING_URL
 *   - Set display name + mic/cam off
 *   - Submit Ask-to-Join, handle waiting room
 *   - Dwell in meeting until host ends or timeout
 *   - Detect kick / meeting-end signals
 */

'use strict';

const { slog } = require('../log');
const { reportStatus } = require('../callback');
const { loginToGoogle } = require('../auth/google');
const { sleep, screenshot } = require('../utils/wait');

async function runMeetDriver(browser, config) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.setUserAgent(
    // Pin a plausible desktop UA — stealth plugin already covers most
    // automation fingerprints, but a stable UA helps with selector regressions
    // when Google A/B-tests its sign-in flow on rare UAs.
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
  );

  try {
    await reportStatus(config, 'authenticating');
    await loginToGoogle(page, config.identity, { audioDir: config.audioDir });
    await reportStatus(config, 'authenticated');

    // ===== Pass 2a stops here =====
    // Pass 2b replaces this dwell with the actual Meet join.
    slog('info', 'pass_2a_login_dwell', {
      meetingUrl: config.meetingUrl,
      note: 'P1.2 Pass 2b replaces this with real Meet join logic'
    });
    await screenshot(page, config.audioDir, 'meet-pass2a-dwell');
    await sleep(5000);
    // ============================
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { runMeetDriver };
