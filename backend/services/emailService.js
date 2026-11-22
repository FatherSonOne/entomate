/**
 * Email Service
 * Week 6: Scheduled email summaries
 */

const nodemailer = require('nodemailer');
const reportService = require('./reportService');
const log = require('../utils/log');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
  }

  /**
   * Initialize the email transporter
   */
  initialize() {
    if (this.initialized) return;

    // Check for email configuration
    const emailHost = process.env.EMAIL_HOST || process.env.SMTP_HOST;
    const emailPort = process.env.EMAIL_PORT || process.env.SMTP_PORT || 587;
    const emailUser = process.env.EMAIL_USER || process.env.SMTP_USER;
    const emailPass = process.env.EMAIL_PASS || process.env.SMTP_PASS;

    if (!emailHost || !emailUser || !emailPass) {
      log.info('Email service not configured - missing SMTP credentials');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: emailHost,
      port: parseInt(emailPort),
      secure: parseInt(emailPort) === 465,
      auth: {
        user: emailUser,
        pass: emailPass
      }
    });

    this.initialized = true;
    log.info('Email service initialized');
  }

  /**
   * Check if email service is configured
   */
  isConfigured() {
    return this.initialized && this.transporter !== null;
  }

  /**
   * Send a basic email
   */
  async sendEmail({ to, subject, html, text, attachments = [] }) {
    if (!this.isConfigured()) {
      throw new Error('Email service not configured');
    }

    const fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@entomate.app';
    const fromName = process.env.EMAIL_FROM_NAME || 'Entomate';

    try {
      const result = await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        html,
        text,
        attachments
      });

      log.info(`Email sent to ${to}: ${result.messageId}`);
      return result;
    } catch (error) {
      log.error('Failed to send email:', { error: error.message || error });
      throw error;
    }
  }

  /**
   * Send weekly summary email
   */
  async sendWeeklySummary(to, data) {
    const { meetings, actionItems, period } = data;

    // Calculate stats
    const completedTasks = actionItems?.filter(i => i.status === 'done').length || 0;
    const pendingTasks = actionItems?.filter(i => i.status !== 'done').length || 0;
    const overdueTasks = actionItems?.filter(i =>
      i.due_date && new Date(i.due_date) < new Date() && i.status !== 'done'
    ).length || 0;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6, #1e40af); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
          .stats { display: flex; gap: 15px; margin: 20px 0; }
          .stat-card { background: #f9fafb; padding: 15px; border-radius: 8px; text-align: center; flex: 1; }
          .stat-value { font-size: 24px; font-weight: bold; color: #1e40af; }
          .stat-label { font-size: 12px; color: #6b7280; }
          .section { margin: 25px 0; }
          .section-title { font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 10px; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; }
          .meeting-item { padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
          .meeting-title { font-weight: 500; color: #111827; }
          .meeting-date { font-size: 12px; color: #6b7280; }
          .task-item { padding: 8px 12px; background: #f9fafb; margin: 5px 0; border-radius: 6px; border-left: 3px solid #3b82f6; }
          .overdue { border-left-color: #ef4444; }
          .footer { text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; }
          .btn { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">Weekly Summary</h1>
            <p style="margin: 10px 0 0; opacity: 0.9;">${period || 'This Week'}</p>
          </div>

          <div class="content">
            <div class="stats">
              <div class="stat-card">
                <div class="stat-value">${meetings?.length || 0}</div>
                <div class="stat-label">Meetings</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${completedTasks}</div>
                <div class="stat-label">Completed</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${pendingTasks}</div>
                <div class="stat-label">Pending</div>
              </div>
              <div class="stat-card">
                <div class="stat-value" style="color: ${overdueTasks > 0 ? '#ef4444' : '#10b981'}">${overdueTasks}</div>
                <div class="stat-label">Overdue</div>
              </div>
            </div>

            ${meetings && meetings.length > 0 ? `
              <div class="section">
                <div class="section-title">Recent Meetings</div>
                ${meetings.slice(0, 5).map(m => `
                  <div class="meeting-item">
                    <div class="meeting-title">${m.title || 'Untitled Meeting'}</div>
                    <div class="meeting-date">${new Date(m.created_at).toLocaleDateString()}</div>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            ${overdueTasks > 0 ? `
              <div class="section">
                <div class="section-title" style="color: #ef4444;">Overdue Items</div>
                ${actionItems
                  .filter(i => i.due_date && new Date(i.due_date) < new Date() && i.status !== 'done')
                  .slice(0, 5)
                  .map(item => `
                    <div class="task-item overdue">
                      ${item.task_description}
                    </div>
                  `).join('')}
              </div>
            ` : ''}


            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" class="btn">
                View Dashboard
              </a>
            </div>
          </div>

          <div class="footer">
            <p>This is an automated summary from Entomate.</p>
            <p>You can manage email preferences in your settings.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Weekly Summary - ${period || 'This Week'}

Quick Stats:
- Meetings: ${meetings?.length || 0}
- Completed Tasks: ${completedTasks}
- Pending Tasks: ${pendingTasks}
- Overdue Items: ${overdueTasks}

${meetings && meetings.length > 0 ? `
Recent Meetings:
${meetings.slice(0, 5).map(m => `- ${m.title || 'Untitled'} (${new Date(m.created_at).toLocaleDateString()})`).join('\n')}
` : ''}

View your dashboard: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard
    `;

    return this.sendEmail({
      to,
      subject: `Your Weekly Summary - ${period || 'This Week'}`,
      html,
      text
    });
  }

  /**
   * Send meeting recap email
   */
  async sendMeetingRecap(to, meeting, actionItems = []) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6, #1e40af); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; }
          .section { margin: 20px 0; }
          .section-title { font-size: 14px; font-weight: 600; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
          .action-item { padding: 10px 15px; background: #f9fafb; margin: 8px 0; border-radius: 6px; border-left: 3px solid #3b82f6; }
          .priority-high { border-left-color: #ef4444; }
          .priority-medium { border-left-color: #f59e0b; }
          .priority-low { border-left-color: #10b981; }
          .footer { text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 20px;">Meeting Recap</h1>
            <h2 style="margin: 10px 0 0; font-size: 16px; font-weight: normal; opacity: 0.9;">${meeting.title || 'Untitled Meeting'}</h2>
            <p style="margin: 10px 0 0; font-size: 14px; opacity: 0.8;">${new Date(meeting.created_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          <div class="content">
            ${meeting.summary ? `
              <div class="section">
                <div class="section-title">Summary</div>
                <p>${meeting.summary}</p>
              </div>
            ` : ''}

            ${meeting.key_points && meeting.key_points.length > 0 ? `
              <div class="section">
                <div class="section-title">Key Points</div>
                <ul style="margin: 0; padding-left: 20px;">
                  ${meeting.key_points.map(point => `<li>${point}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            ${meeting.decisions && meeting.decisions.length > 0 ? `
              <div class="section">
                <div class="section-title">Decisions</div>
                <ul style="margin: 0; padding-left: 20px;">
                  ${meeting.decisions.map(d => `<li>${d}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            ${actionItems.length > 0 ? `
              <div class="section">
                <div class="section-title">Action Items (${actionItems.length})</div>
                ${actionItems.map(item => `
                  <div class="action-item priority-${item.priority || 'medium'}">
                    <div style="font-weight: 500;">${item.task_description}</div>
                    <div style="font-size: 12px; color: #6b7280; margin-top: 5px;">
                      ${item.assigned_to_name ? `Assigned to: ${item.assigned_to_name}` : ''}
                      ${item.due_date ? ` | Due: ${new Date(item.due_date).toLocaleDateString()}` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>

          <div class="footer">
            <p>View this meeting in Entomate for more details.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject: `Meeting Recap: ${meeting.title || 'Untitled Meeting'}`,
      html
    });
  }

}

module.exports = new EmailService();
