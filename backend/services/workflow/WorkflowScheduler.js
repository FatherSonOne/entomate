/**
 * WorkflowScheduler - Cron-based workflow scheduling
 *
 * Manages scheduled workflow execution using node-cron
 */

const cron = require('node-cron');
const { supabase } = require('../../config/supabase');
const WorkflowExecutor = require('./WorkflowExecutor');
const log = require('../../utils/log');

class WorkflowScheduler {
  constructor() {
    this.jobs = new Map();
    this.executor = new WorkflowExecutor();
    this.isInitialized = false;
  }

  /**
   * Initialize the scheduler
   * Loads all active schedules from database
   */
  async initialize() {
    if (this.isInitialized) {
      log.info('[WorkflowScheduler] Already initialized');
      return;
    }

    log.info('[WorkflowScheduler] Initializing...');

    try {
      // Load all enabled schedules
      const { data: schedules, error } = await supabase
        .from('workflow_schedules')
        .select(`
          *,
          workflows(*)
        `)
        .eq('enabled', true);

      if (error) {
        throw error;
      }

      log.info(`[WorkflowScheduler] Found ${schedules?.length || 0} active schedules`);

      // Start each schedule
      for (const schedule of schedules || []) {
        if (schedule.workflows?.active) {
          await this.startSchedule(schedule);
        }
      }

      this.isInitialized = true;
      log.info('[WorkflowScheduler] Initialization complete');

    } catch (error) {
      log.error('[WorkflowScheduler] Initialization error:', { error: error.message || error });
    }
  }

  /**
   * Start a schedule
   */
  async startSchedule(schedule) {
    const scheduleId = schedule.id;
    const { cron_expression, timezone, workflow_id, node_id } = schedule;
    const workflow = schedule.workflows;

    // Validate cron expression
    if (!cron.validate(cron_expression)) {
      log.error(`[WorkflowScheduler] Invalid cron expression: ${cron_expression}`);
      await this.updateScheduleError(scheduleId, `Invalid cron expression: ${cron_expression}`);
      return;
    }

    // Stop existing job if any
    if (this.jobs.has(scheduleId)) {
      this.jobs.get(scheduleId).stop();
    }

    log.info(`[WorkflowScheduler] Starting schedule ${scheduleId}: "${cron_expression}" (${timezone})`);

    // Create cron job
    const job = cron.schedule(cron_expression, async () => {
      log.info(`[WorkflowScheduler] Executing scheduled workflow: ${workflow.name}`);

      try {
        // Execute workflow
        const result = await this.executor.execute(workflow, {
          scheduledTime: new Date().toISOString(),
          scheduleId,
          cronExpression: cron_expression
        }, {
          mode: 'production',
          triggeredBy: 'schedule'
        });

        // Update schedule stats
        await supabase
          .from('workflow_schedules')
          .update({
            last_run_at: new Date().toISOString(),
            run_count: schedule.run_count + 1,
            consecutive_failures: result.success ? 0 : schedule.consecutive_failures + 1,
            last_error: result.success ? null : result.error,
            next_run_at: this.getNextRunTime(cron_expression, timezone)
          })
          .eq('id', scheduleId);

        // Update workflow stats
        await supabase
          .from('workflows')
          .update({
            execution_count: workflow.execution_count + 1,
            last_executed_at: new Date().toISOString()
          })
          .eq('id', workflow_id);

        log.info(`[WorkflowScheduler] Scheduled execution ${result.success ? 'succeeded' : 'failed'}: ${workflow.name}`);

      } catch (error) {
        log.error(`[WorkflowScheduler] Scheduled execution error:`, { error: error.message || error });

        await supabase
          .from('workflow_schedules')
          .update({
            consecutive_failures: schedule.consecutive_failures + 1,
            last_error: error.message
          })
          .eq('id', scheduleId);
      }
    }, {
      timezone: timezone || 'UTC',
      scheduled: true
    });

    this.jobs.set(scheduleId, job);

    // Update next run time
    const nextRun = this.getNextRunTime(cron_expression, timezone);
    await supabase
      .from('workflow_schedules')
      .update({ next_run_at: nextRun })
      .eq('id', scheduleId);

    log.info(`[WorkflowScheduler] Schedule ${scheduleId} started. Next run: ${nextRun}`);
  }

  /**
   * Stop a schedule
   */
  stopSchedule(scheduleId) {
    const job = this.jobs.get(scheduleId);
    if (job) {
      job.stop();
      this.jobs.delete(scheduleId);
      log.info(`[WorkflowScheduler] Schedule ${scheduleId} stopped`);
      return true;
    }
    return false;
  }

  /**
   * Restart a schedule (reload from database)
   */
  async restartSchedule(scheduleId) {
    this.stopSchedule(scheduleId);

    const { data: schedule, error } = await supabase
      .from('workflow_schedules')
      .select('*, workflows(*)')
      .eq('id', scheduleId)
      .single();

    if (error || !schedule) {
      log.error(`[WorkflowScheduler] Schedule ${scheduleId} not found`);
      return false;
    }

    if (schedule.enabled && schedule.workflows?.active) {
      await this.startSchedule(schedule);
      return true;
    }

    return false;
  }

  /**
   * Add a new schedule
   */
  async addSchedule(workflowId, nodeId, cronExpression, timezone = 'UTC') {
    // Validate cron
    if (!cron.validate(cronExpression)) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }

    // Get workflow
    const { data: workflow, error: workflowError } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (workflowError || !workflow) {
      throw new Error('Workflow not found');
    }

    // Create schedule record
    const { data: schedule, error } = await supabase
      .from('workflow_schedules')
      .insert({
        workflow_id: workflowId,
        node_id: nodeId,
        cron_expression: cronExpression,
        timezone,
        enabled: workflow.active,
        next_run_at: this.getNextRunTime(cronExpression, timezone)
      })
      .select('*, workflows(*)')
      .single();

    if (error) {
      throw error;
    }

    // Start if enabled
    if (schedule.enabled) {
      await this.startSchedule(schedule);
    }

    return schedule;
  }

  /**
   * Remove a schedule
   */
  async removeSchedule(scheduleId) {
    this.stopSchedule(scheduleId);

    const { error } = await supabase
      .from('workflow_schedules')
      .delete()
      .eq('id', scheduleId);

    if (error) {
      throw error;
    }

    return true;
  }

  /**
   * Enable/disable a schedule
   */
  async toggleSchedule(scheduleId, enabled) {
    const { data: schedule, error } = await supabase
      .from('workflow_schedules')
      .update({
        enabled,
        updated_at: new Date().toISOString()
      })
      .eq('id', scheduleId)
      .select('*, workflows(*)')
      .single();

    if (error) {
      throw error;
    }

    if (enabled && schedule.workflows?.active) {
      await this.startSchedule(schedule);
    } else {
      this.stopSchedule(scheduleId);
    }

    return schedule;
  }

  /**
   * Get all active schedules
   */
  getActiveSchedules() {
    const schedules = [];
    for (const [id, job] of this.jobs.entries()) {
      schedules.push({
        id,
        running: true
      });
    }
    return schedules;
  }

  /**
   * Get scheduler status
   */
  async getStatus() {
    const { data: schedules, error } = await supabase
      .from('workflow_schedules')
      .select(`
        id,
        cron_expression,
        timezone,
        enabled,
        next_run_at,
        last_run_at,
        run_count,
        consecutive_failures,
        last_error,
        workflows(id, name, active)
      `)
      .order('next_run_at', { ascending: true });

    if (error) {
      throw error;
    }

    return {
      initialized: this.isInitialized,
      activeJobs: this.jobs.size,
      schedules: schedules?.map(s => ({
        ...s,
        isRunning: this.jobs.has(s.id)
      })) || []
    };
  }

  /**
   * Calculate next run time for a cron expression
   */
  getNextRunTime(cronExpression, timezone = 'UTC') {
    try {
      // Use cron-parser for accurate next run calculation
      const parser = require('cron-parser');
      const interval = parser.parseExpression(cronExpression, {
        currentDate: new Date(),
        tz: timezone
      });
      return interval.next().toISOString();
    } catch {
      // Fallback: estimate based on cron pattern
      return new Date(Date.now() + 60000).toISOString(); // 1 minute from now
    }
  }

  /**
   * Update schedule error
   */
  async updateScheduleError(scheduleId, errorMessage) {
    await supabase
      .from('workflow_schedules')
      .update({
        last_error: errorMessage,
        consecutive_failures: 1
      })
      .eq('id', scheduleId);
  }

  /**
   * Stop all schedules (for graceful shutdown)
   */
  stopAll() {
    log.info('[WorkflowScheduler] Stopping all schedules...');
    for (const [id, job] of this.jobs.entries()) {
      job.stop();
    }
    this.jobs.clear();
    this.isInitialized = false;
    log.info('[WorkflowScheduler] All schedules stopped');
  }

  /**
   * Validate a cron expression
   */
  validateCron(expression) {
    return cron.validate(expression);
  }

  /**
   * Get cron presets
   */
  getCronPresets() {
    return [
      { label: 'Every minute', value: '* * * * *' },
      { label: 'Every 5 minutes', value: '*/5 * * * *' },
      { label: 'Every 15 minutes', value: '*/15 * * * *' },
      { label: 'Every 30 minutes', value: '*/30 * * * *' },
      { label: 'Every hour', value: '0 * * * *' },
      { label: 'Every 2 hours', value: '0 */2 * * *' },
      { label: 'Every day at midnight', value: '0 0 * * *' },
      { label: 'Every day at 9 AM', value: '0 9 * * *' },
      { label: 'Every day at 6 PM', value: '0 18 * * *' },
      { label: 'Weekdays at 9 AM', value: '0 9 * * 1-5' },
      { label: 'Every Monday at 9 AM', value: '0 9 * * 1' },
      { label: 'First day of month at 9 AM', value: '0 9 1 * *' }
    ];
  }

  /**
   * Parse cron expression to human-readable format
   */
  describeCron(expression) {
    // Simple descriptions for common patterns
    const patterns = {
      '* * * * *': 'Every minute',
      '*/5 * * * *': 'Every 5 minutes',
      '*/15 * * * *': 'Every 15 minutes',
      '*/30 * * * *': 'Every 30 minutes',
      '0 * * * *': 'Every hour',
      '0 */2 * * *': 'Every 2 hours',
      '0 0 * * *': 'Every day at midnight',
      '0 9 * * *': 'Every day at 9 AM',
      '0 9 * * 1-5': 'Weekdays at 9 AM',
      '0 9 * * 1': 'Every Monday at 9 AM',
      '0 9 1 * *': 'First day of month at 9 AM'
    };

    return patterns[expression] || expression;
  }
}

// Singleton instance
const workflowScheduler = new WorkflowScheduler();

module.exports = workflowScheduler;
