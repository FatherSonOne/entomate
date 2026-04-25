/**
 * Structured logging — one JSON line per event, written to stdout. Fly
 * captures stdout and surfaces it via `fly logs`, so this is also our
 * primary debugging channel during Pass 2 iteration.
 */

'use strict';

function slog(level, msg, extra = {}) {
  process.stdout.write(
    JSON.stringify({ ts: new Date().toISOString(), level, msg, ...extra }) + '\n'
  );
}

module.exports = { slog };
