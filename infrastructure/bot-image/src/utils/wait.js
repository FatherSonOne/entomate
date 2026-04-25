/**
 * Small Puppeteer helpers used by the auth + driver code.
 *
 * Every helper logs at info level when it succeeds and at warn when it
 * times out — so a failed selector wait shows up in `fly logs` with full
 * context (URL, title) without us writing the same boilerplate everywhere.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { slog } = require('../log');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait until the page URL matches the predicate or contains the substring.
 * Returns the matched URL on success, throws on timeout.
 */
async function waitForUrl(page, predicate, { timeoutMs = 20000, pollMs = 250 } = {}) {
  const test =
    typeof predicate === 'function'
      ? predicate
      : (url) => url.includes(predicate);

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const url = page.url();
    if (test(url)) return url;
    await sleep(pollMs);
  }
  throw new Error(`waitForUrl timed out after ${timeoutMs}ms; final URL: ${page.url()}`);
}

/**
 * Read an element's innerText via the DOM (no script injection).
 */
async function readInnerText(handle) {
  const prop = await handle.getProperty('innerText');
  const value = await prop.jsonValue();
  return typeof value === 'string' ? value : '';
}

/**
 * Click the first element matching `selector` whose innerText contains
 * (or, if `exact: true`, equals) `text`. Case-insensitive. Returns true
 * if a click happened, false otherwise.
 */
async function clickByText(page, selector, text, { exact = false } = {}) {
  const target = String(text).toLowerCase();
  const handles = await page.$$(selector);
  for (const handle of handles) {
    const txt = (await readInnerText(handle)).trim().toLowerCase();
    const match = exact ? txt === target : txt.includes(target);
    if (match) {
      await handle.click();
      return true;
    }
  }
  return false;
}

/**
 * Take a debug screenshot to the bot's audio dir (which is volume-mounted
 * during local Docker testing). No-op if the dir doesn't exist.
 */
async function screenshot(page, dir, name) {
  if (!dir) return null;
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `${Date.now()}-${name.replace(/[^a-z0-9-]/gi, '_')}.png`;
    const fullPath = path.join(dir, filename);
    await page.screenshot({ path: fullPath, fullPage: false });
    slog('info', 'screenshot', { name, path: fullPath });
    return fullPath;
  } catch (err) {
    slog('warn', 'screenshot_failed', { name, error: err.message });
    return null;
  }
}

module.exports = { sleep, waitForUrl, clickByText, readInnerText, screenshot };
