/**
 * Ecosystem Scheduler
 * Periodically checks for new Pulse recordings and auto-imports them.
 * Enabled via ENABLE_ECOSYSTEM_AUTO_SYNC=true environment variable.
 */

const cron = require('node-cron');
const { getEcosystemBridge } = require('./ecosystemBridge');
const log = require('../utils/log');

class EcosystemScheduler {
  constructor() {
    this.job = null;
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

    this.initialized = true;
    log.info(`[EcosystemScheduler] Auto-sync scheduled: ${cronExpr}`);
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
      log.info('[EcosystemScheduler] Stopped');
    }
  }

  getStatus() {
    return {
      initialized: this.initialized,
      running: !!this.job,
      cron: process.env.ECOSYSTEM_SYNC_CRON || '0 */6 * * *',
    };
  }
}

module.exports = new EcosystemScheduler();
