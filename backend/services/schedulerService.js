/**
 * Scheduler Service
 * Week 6: Automated scheduled tasks
 */

const cron = require('node-cron');
const { supabase } = require('../config/supabase');
const emailService = require('./emailService');
const log = require('../utils/log');

class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the scheduler
   */
  initialize() {
    if (this.initialized) return;

    // Initialize email service
    emailService.initialize();

    // Schedule weekly summary (Mondays at 9 AM)
    if (process.env.ENABLE_WEEKLY_SUMMARY === 'true') {
      this.scheduleWeeklySummary();
    }

    // Schedule daily overdue check (Every day at 8 AM)
    if (process.env.ENABLE_OVERDUE_ALERTS === 'true') {
      this.scheduleOverdueCheck();
    }

    this.initialized = true;
    log.info('Scheduler service initialized');
  }

  /**
   * Schedule weekly summary emails
   */
  scheduleWeeklySummary() {
    // Every Monday at 9:00 AM
    const job = cron.schedule('0 9 * * 1', async () => {
      log.info('Running weekly summary job...');
      await this.sendWeeklySummaries();
    }, {
      timezone: process.env.TIMEZONE || 'America/New_York'
    });

    this.jobs.set('weekly-summary', job);
    log.info('Scheduled weekly summary for Mondays at 9 AM');
  }

  /**
   * Schedule daily overdue check
   */
  scheduleOverdueCheck() {
    // Every day at 8:00 AM
    const job = cron.schedule('0 8 * * *', async () => {
      log.info('Running overdue check job...');
      await this.checkOverdueItems();
    }, {
      timezone: process.env.TIMEZONE || 'America/New_York'
    });

    this.jobs.set('overdue-check', job);
    log.info('Scheduled overdue check for daily at 8 AM');
  }

  /**
   * Send weekly summaries to all subscribed users
   */
  async sendWeeklySummaries() {
    if (!supabase) {
      log.info('Database not configured, skipping weekly summary');
      return;
    }

    if (!emailService.isConfigured()) {
      log.info('Email service not configured, skipping weekly summary');
      return;
    }

    try {
      // Get data from the past week
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoISO = weekAgo.toISOString();

      const [meetingsRes, actionItemsRes, goalsRes] = await Promise.all([
        supabase.from('meetings').select('*').gte('created_at', weekAgoISO),
        supabase.from('action_items').select('*'),
        supabase.from('goals').select('*').eq('status', 'active')
      ]);

      const period = `${weekAgo.toLocaleDateString()} - ${new Date().toLocaleDateString()}`;

      // Get users to send to (you would typically have a users/subscriptions table)
      const summaryRecipients = process.env.WEEKLY_SUMMARY_RECIPIENTS;
      if (!summaryRecipients) {
        log.info('No weekly summary recipients configured');
        return;
      }

      const recipients = summaryRecipients.split(',').map(e => e.trim());

      for (const email of recipients) {
        try {
          await emailService.sendWeeklySummary(email, {
            meetings: meetingsRes.data || [],
            actionItems: actionItemsRes.data || [],
            goals: goalsRes.data || [],
            period
          });
          log.info(`Weekly summary sent to ${email}`);
        } catch (error) {
          log.error(`Failed to send weekly summary to ${email}:`, { error: error.message || error });
        }
      }
    } catch (error) {
      log.error('Failed to run weekly summary job:', { error: error.message || error });
    }
  }

  /**
   * Check for overdue items and send alerts
   */
  async checkOverdueItems() {
    if (!supabase) {
      log.info('Database not configured, skipping overdue check');
      return;
    }

    if (!emailService.isConfigured()) {
      log.info('Email service not configured, skipping overdue check');
      return;
    }

    try {
      const now = new Date().toISOString();

      // Get overdue items
      const { data: overdueItems } = await supabase
        .from('action_items')
        .select('*')
        .lt('due_date', now)
        .not('status', 'in', '("done","complete")')
        .order('due_date', { ascending: true });

      if (!overdueItems || overdueItems.length === 0) {
        log.info('No overdue items found');
        return;
      }

      log.info(`Found ${overdueItems.length} overdue items`);

      // Group by assignee email
      const byAssignee = new Map();
      overdueItems.forEach(item => {
        const email = item.assigned_to_email;
        if (email) {
          if (!byAssignee.has(email)) {
            byAssignee.set(email, []);
          }
          byAssignee.get(email).push(item);
        }
      });

      // Send alerts to assignees
      for (const [email, items] of byAssignee) {
        try {
          await this.sendOverdueAlert(email, items);
          log.info(`Overdue alert sent to ${email} for ${items.length} items`);
        } catch (error) {
          log.error(`Failed to send overdue alert to ${email}:`, { error: error.message || error });
        }
      }
    } catch (error) {
      log.error('Failed to run overdue check job:', { error: error.message || error });
    }
  }

  /**
   * Send overdue alert email
   */
  async sendOverdueAlert(to, items) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 25px; border-radius: 12px 12px 0 0; text-align: center; }
          .content { background: #ffffff; padding: 25px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; }
          .item { padding: 12px 15px; background: #fef2f2; margin: 8px 0; border-radius: 6px; border-left: 3px solid #ef4444; }
          .item-task { font-weight: 500; color: #111827; }
          .item-meta { font-size: 12px; color: #6b7280; margin-top: 5px; }
          .btn { display: inline-block; padding: 12px 24px; background: #ef4444; color: white; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 20px;">Overdue Action Items</h1>
            <p style="margin: 10px 0 0; opacity: 0.9;">You have ${items.length} overdue item${items.length === 1 ? '' : 's'}</p>
          </div>

          <div class="content">
            ${items.map(item => {
              const daysOverdue = Math.floor((new Date() - new Date(item.due_date)) / (1000 * 60 * 60 * 24));
              return `
                <div class="item">
                  <div class="item-task">${item.task_description}</div>
                  <div class="item-meta">
                    Due: ${new Date(item.due_date).toLocaleDateString()} (${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue)
                  </div>
                </div>
              `;
            }).join('')}

            <div style="text-align: center; margin-top: 25px;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/tasks" class="btn">
                View Tasks
              </a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return emailService.sendEmail({
      to,
      subject: `Action Required: ${items.length} Overdue Item${items.length === 1 ? '' : 's'}`,
      html
    });
  }

  /**
   * Manually trigger weekly summary (for testing)
   */
  async triggerWeeklySummary() {
    return this.sendWeeklySummaries();
  }

  /**
   * Manually trigger overdue check (for testing)
   */
  async triggerOverdueCheck() {
    return this.checkOverdueItems();
  }

  /**
   * Stop all scheduled jobs
   */
  stopAll() {
    for (const [name, job] of this.jobs) {
      job.stop();
      log.info(`Stopped job: ${name}`);
    }
    this.jobs.clear();
  }

  /**
   * Get status of all jobs
   */
  getStatus() {
    const status = {};
    for (const [name, job] of this.jobs) {
      status[name] = {
        running: job.running || false
      };
    }
    return {
      initialized: this.initialized,
      emailConfigured: emailService.isConfigured(),
      jobs: status
    };
  }
}

module.exports = new SchedulerService();
