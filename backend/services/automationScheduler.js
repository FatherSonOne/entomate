/**
 * Automation Scheduler Service
 * Handles scheduled automations using node-cron
 * Week 7: Automations & Basic Agents - Optional Enhancement
 */

const cron = require('node-cron');
const { supabase } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

class AutomationScheduler {
  constructor() {
    this.scheduledJobs = new Map(); // automationId -> cronJob
    this.initialized = false;
  }

  /**
   * Initialize the scheduler - load and start all scheduled automations
   */
  async initialize() {
    if (this.initialized) return;

    console.log('⏰ Initializing automation scheduler...');

    try {
      await this.loadScheduledAutomations();
      this.initialized = true;
      console.log('✅ Automation scheduler initialized');
    } catch (error) {
      console.error('❌ Failed to initialize scheduler:', error);
    }
  }

  /**
   * Load all enabled scheduled automations from database
   */
  async loadScheduledAutomations() {
    if (!supabase) {
      console.warn('⚠️ Supabase not configured, skipping scheduled automations');
      return;
    }

    const { data: automations, error } = await supabase
      .from('automations')
      .select('*')
      .eq('trigger_type', 'scheduled')
      .eq('enabled', true);

    if (error) {
      console.error('❌ Error loading scheduled automations:', error);
      return;
    }

    console.log(`📅 Found ${automations?.length || 0} scheduled automations`);

    for (const automation of automations || []) {
      this.scheduleAutomation(automation);
    }
  }

  /**
   * Schedule a single automation
   */
  scheduleAutomation(automation) {
    const cronExpression = automation.trigger_config?.cron;

    if (!cronExpression) {
      console.warn(`⚠️ Automation ${automation.id} has no cron expression`);
      return false;
    }

    // Validate cron expression
    if (!cron.validate(cronExpression)) {
      console.error(`❌ Invalid cron expression for automation ${automation.id}: ${cronExpression}`);
      return false;
    }

    // Cancel existing job if any
    this.cancelAutomation(automation.id);

    // Schedule new job
    const job = cron.schedule(cronExpression, async () => {
      await this.executeScheduledAutomation(automation);
    }, {
      scheduled: true,
      timezone: automation.trigger_config?.timezone || 'UTC'
    });

    this.scheduledJobs.set(automation.id, {
      job,
      automation,
      cronExpression,
      nextRun: this.getNextRunTime(cronExpression)
    });

    console.log(`⏰ Scheduled automation: ${automation.name} (${cronExpression})`);
    return true;
  }

  /**
   * Cancel a scheduled automation
   */
  cancelAutomation(automationId) {
    const scheduled = this.scheduledJobs.get(automationId);
    if (scheduled) {
      scheduled.job.stop();
      this.scheduledJobs.delete(automationId);
      console.log(`🛑 Cancelled scheduled automation: ${automationId}`);
      return true;
    }
    return false;
  }

  /**
   * Execute a scheduled automation
   */
  async executeScheduledAutomation(automation) {
    const startTime = Date.now();
    console.log(`⚡ Executing scheduled automation: ${automation.name}`);

    const triggerData = {
      triggeredBy: 'scheduler',
      scheduledTime: new Date().toISOString(),
      cronExpression: automation.trigger_config?.cron
    };

    const results = [];
    let success = true;
    let errorMessage = null;

    try {
      // Execute each action
      for (const action of automation.actions || []) {
        try {
          const result = await this.executeAction(action, triggerData, automation);
          results.push({ type: action.type, status: 'success', result });
        } catch (actionError) {
          results.push({ type: action.type, status: 'failed', error: actionError.message });
          success = false;
          errorMessage = actionError.message;
        }
      }
    } catch (error) {
      success = false;
      errorMessage = error.message;
    }

    const duration = Date.now() - startTime;

    // Log execution
    if (supabase) {
      await supabase.from('automation_logs').insert({
        id: uuidv4(),
        automation_id: automation.id,
        triggered_at: new Date().toISOString(),
        trigger_data: triggerData,
        actions_executed: results,
        success,
        error_message: errorMessage,
        duration_ms: duration,
        created_at: new Date().toISOString()
      }).catch(err => console.error('Failed to log execution:', err));

      // Update automation stats
      await supabase
        .from('automations')
        .update({
          execution_count: (automation.execution_count || 0) + 1,
          last_executed_at: new Date().toISOString()
        })
        .eq('id', automation.id)
        .catch(err => console.error('Failed to update automation stats:', err));
    }

    // Update next run time in our map
    const scheduled = this.scheduledJobs.get(automation.id);
    if (scheduled) {
      scheduled.nextRun = this.getNextRunTime(scheduled.cronExpression);
    }

    console.log(`${success ? '✅' : '❌'} Scheduled automation completed: ${automation.name} (${duration}ms)`);

    return { success, results, duration };
  }

  /**
   * Execute an action (placeholder - actual implementation in actionExecutor)
   */
  async executeAction(action, triggerData, automation) {
    // This would call the actual action executor
    // For now, return success with placeholder
    console.log(`  ⚡ Executing action: ${action.type}`);
    return { message: `Action ${action.type} executed`, triggerData };
  }

  /**
   * Get next run time for a cron expression
   */
  getNextRunTime(cronExpression) {
    try {
      // Parse cron to get next run
      // This is a simplified version - real implementation would use a cron parser
      return new Date(Date.now() + 60000).toISOString(); // Placeholder
    } catch (error) {
      return null;
    }
  }

  /**
   * Handle automation update (called when automation is created/updated)
   */
  async handleAutomationUpdate(automation) {
    if (automation.trigger_type !== 'scheduled') {
      // Not a scheduled automation, cancel if it was scheduled before
      this.cancelAutomation(automation.id);
      return;
    }

    if (automation.enabled) {
      this.scheduleAutomation(automation);
    } else {
      this.cancelAutomation(automation.id);
    }
  }

  /**
   * Handle automation deletion
   */
  handleAutomationDelete(automationId) {
    this.cancelAutomation(automationId);
  }

  /**
   * Get status of all scheduled automations
   */
  getScheduledStatus() {
    const status = [];
    for (const [id, scheduled] of this.scheduledJobs) {
      status.push({
        id,
        name: scheduled.automation.name,
        cronExpression: scheduled.cronExpression,
        nextRun: scheduled.nextRun,
        enabled: true
      });
    }
    return status;
  }

  /**
   * Get status of a specific scheduled automation
   */
  getAutomationStatus(automationId) {
    const scheduled = this.scheduledJobs.get(automationId);
    if (!scheduled) return null;

    return {
      id: automationId,
      name: scheduled.automation.name,
      cronExpression: scheduled.cronExpression,
      nextRun: scheduled.nextRun,
      enabled: true
    };
  }

  /**
   * Shutdown scheduler
   */
  shutdown() {
    console.log('⏹️ Shutting down automation scheduler...');
    for (const [id, scheduled] of this.scheduledJobs) {
      scheduled.job.stop();
    }
    this.scheduledJobs.clear();
    this.initialized = false;
    console.log('✅ Automation scheduler stopped');
  }
}

// Export singleton instance
module.exports = new AutomationScheduler();
