/**
 * Internal job triggers (audit finding 11).
 *
 * On Render's free plan the web process sleeps when idle, so the in-process
 * 03:00 UTC retention timer can be missed. An external scheduler (the
 * GitHub Actions workflow .github/workflows/nightly-jobs.yml) calls this
 * endpoint daily. Service-to-service only: X-API-Key = INTERNAL_API_KEY.
 * Jobs are idempotent, so the in-process timer firing as well is harmless.
 */
const express = require('express');
const { apiKeyAuth } = require('../middleware/auth');
const log = require('../utils/log');

const router = express.Router();
router.use(apiKeyAuth);

const JOBS = {
  retention: () => require('../services/retentionService').runRetentionSweep(),
};

const running = new Set();

/**
 * POST /api/internal/jobs/:job
 * Starts the job in the background and answers 202 at once, so the caller
 * does not time out on a long sweep. 409 if that job is already running.
 */
router.post('/jobs/:job', (req, res) => {
  const { job } = req.params;
  const run = JOBS[job];
  if (!run) return res.status(404).json({ error: 'Unknown job', jobs: Object.keys(JOBS) });
  if (running.has(job)) return res.status(409).json({ status: 'already_running', job });

  running.add(job);
  const startedAt = new Date().toISOString();
  Promise.resolve()
    .then(run)
    .then((result) => log.info('[InternalJobs] finished', { job, result }))
    .catch((err) => log.error('[InternalJobs] failed', { job, error: err.message }))
    .finally(() => running.delete(job));

  return res.status(202).json({ status: 'started', job, startedAt });
});

module.exports = router;
