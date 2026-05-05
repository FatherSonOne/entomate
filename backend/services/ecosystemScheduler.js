/**
 * Ecosystem Scheduler
 * Periodically checks for new Pulse recordings and auto-imports them.
 * Enabled via ENABLE_ECOSYSTEM_AUTO_SYNC=true environment variable.
 */

const cron = require('node-cron');
const { getEcosystemBridge } = require('./ecosystemBridge');
const { supabaseAdmin } = require('../config/supabase');
const log = require('../utils/log');

const RETRY_BACKOFF_MINUTES = [5, 15, 60, 240, 720];

class EcosystemScheduler {
  constructor() {
    this.job = null;
    this.retryJob = null;
    this.initialized = false;
  }

  /**
   * Initialize the scheduler.
   * Only starts if ENABLE_ECOSYSTEM_AUTO_SYNC is set to 'true'.
   */
  initialize() {
    if (this.initialized) return;

    if (process.env.ENABLE_ECOSYSTEM_AUTO_SYNC !== 'true') {
      log.info('[EcosystemScheduler] Auto-sync disabled (set ENABLE_ECOSYSTEM_AUTO_SYNC=true to enable)');
      return;
    }

    const cronExpr = process.env.ECOSYSTEM_SYNC_CRON || '0 */6 * * *'; // default: every 6 hours

    this.job = cron.schedule(cronExpr, () => this.pullRecordings(), {
      timezone: process.env.TIMEZONE || 'America/New_York',
    });

    // Independent cadence for the dead-letter retry tick. Cheap to run
    // frequently — exits early when nothing is due.
    const retryCron = process.env.ECOSYSTEM_RETRY_CRON || '*/5 * * * *';
    this.retryJob = cron.schedule(retryCron, () => this.runRetries(), {
      timezone: process.env.TIMEZONE || 'America/New_York',
    });

    this.initialized = true;
    log.info(`[EcosystemScheduler] Auto-sync scheduled: ${cronExpr}; retry tick: ${retryCron}`);
  }

  /**
   * Pending outbound rows older than the cutoff are presumed orphaned —
   * the bridge writes status='pending' *before* the HTTP call, so a backend
   * crash mid-send leaves the row stuck. Flip them to 'failed' so the
   * alert trigger fires and the normal retry pipeline picks them up.
   */
  async sweepStuckPending() {
    if (!supabaseAdmin) return;

    try {
      const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: stuck, error } = await supabaseAdmin
        .from('ecosystem_events')
        .update({
          status: 'failed',
          error_message: 'stuck in pending state for >10min — backend likely crashed mid-send',
          next_retry_at: new Date(Date.now() + 60 * 1000).toISOString(),
        })
        .eq('direction', 'outbound')
        .eq('status', 'pending')
        .lt('created_at', cutoff)
        .select('id');

      if (error) {
        log.warn('[EcosystemScheduler] stuck-pending sweep failed:', error.message);
        return;
      }
      if (stuck?.length) {
        log.info(`[EcosystemScheduler] swept ${stuck.length} stuck-pending row(s) into failed state`);
      }
    } catch (err) {
      log.error('[EcosystemScheduler] stuck-pending sweep threw:', err.message);
    }
  }

  /**
   * Replay failed outbound events whose next_retry_at is due.
   * Uses the bridge's existing retryEvent() method so backoff and event
   * mutation logic stay in one place.
   */
  async runRetries() {
    if (!supabaseAdmin) return;

    // First, rescue anything stuck in 'pending' so it enters the retry pipeline.
    await this.sweepStuckPending();

    try {
      const { data: candidates, error } = await supabaseAdmin
        .from('ecosystem_events')
        .select('id, retry_count, event_type, target_app')
        .eq('direction', 'outbound')
        .eq('status', 'failed')
        .not('next_retry_at', 'is', null)
        .lte('next_retry_at', new Date().toISOString())
        .order('next_retry_at', { ascending: true })
        .limit(50);

      if (error) {
        log.warn('[EcosystemScheduler] retry candidates query failed:', error.message);
        return;
      }
      if (!candidates || candidates.length === 0) return;

      const bridge = await getEcosystemBridge();
      let succeeded = 0;
      let exhausted = 0;

      for (const event of candidates) {
        const attempt = (event.retry_count || 0) + 1;
        const maxRetries = parseInt(process.env.ECOSYSTEM_MAX_RETRIES, 10) || 5;

        if (attempt > maxRetries) {
          await supabaseAdmin
            .from('ecosystem_events')
            .update({ status: 'exhausted', next_retry_at: null })
            .eq('id', event.id);
          exhausted++;
          continue;
        }

        const result = await bridge.retryEvent(event.id);
        if (result?.success) {
          succeeded++;
          continue;
        }

        // Reschedule with backoff. retryEvent already incremented retry_count,
        // but did not set next_retry_at on its own re-failure path — push it out.
        const backoffIdx = Math.min(attempt - 1, RETRY_BACKOFF_MINUTES.length - 1);
        const nextRetryAt = new Date(Date.now() + RETRY_BACKOFF_MINUTES[backoffIdx] * 60 * 1000).toISOString();
        await supabaseAdmin
          .from('ecosystem_events')
          .update({ next_retry_at: nextRetryAt })
          .eq('id', event.id);
      }

      log.info(`[EcosystemScheduler] retry tick: checked=${candidates.length} succeeded=${succeeded} exhausted=${exhausted}`);
    } catch (err) {
      log.error('[EcosystemScheduler] retry tick failed:', err.message);
    }
  }

  /**
   * Request recordings list from Pulse.
   * Pulse will post the list to the #entomate-meetings bot channel.
   */
  async pullRecordings() {
    try {
      const bridge = await getEcosystemBridge();

      if (!bridge.isConnected('pulse')) {
        log.info('[EcosystemScheduler] Pulse not connected, skipping pull');
        return;
      }

      // Check if auto_sync_recordings feature is enabled in config
      if (!bridge.hasFeature('pulse', 'auto_sync_recordings')) {
        log.info('[EcosystemScheduler] auto_sync_recordings feature not enabled for Pulse');
        return;
      }

      const workspaceId = process.env.ECOSYSTEM_PULSE_WORKSPACE_ID;
      if (!workspaceId) {
        log.warn('[EcosystemScheduler] ECOSYSTEM_PULSE_WORKSPACE_ID not set, skipping pull');
        return;
      }

      await bridge.sendEvent('pulse', {
        eventType: 'meeting.recordings_list',
        data: {
          workspaceId,
          since: new Date(Date.now() - 7 * 86400000).toISOString(),
          limit: 20,
        },
      });

      log.info('[EcosystemScheduler] Requested Pulse recordings list');
    } catch (err) {
      log.error('[EcosystemScheduler] Pull recordings failed:', err.message);
    }
  }

  /**
   * Manually trigger a pull (for testing or on-demand use).
   */
  async triggerNow() {
    return this.pullRecordings();
  }

  /**
   * Stop the scheduler.
   */
  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
    }
    if (this.retryJob) {
      this.retryJob.stop();
      this.retryJob = null;
    }
    log.info('[EcosystemScheduler] Stopped');
  }

  getStatus() {
    return {
      initialized: this.initialized,
      running: !!this.job,
      retryRunning: !!this.retryJob,
      cron: process.env.ECOSYSTEM_SYNC_CRON || '0 */6 * * *',
      retryCron: process.env.ECOSYSTEM_RETRY_CRON || '*/5 * * * *',
    };
  }
}

module.exports = new EcosystemScheduler();
