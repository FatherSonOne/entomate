/**
 * Slack Notifier Service
 * Dedicated service for Slack notifications with rich Block Kit formatting
 * Integrates with shared-hub events system for automated notifications
 */

const axios = require('axios');

class SlackNotifier {
  constructor() {
    this.token = process.env.SLACK_BOT_TOKEN;
    this.defaultChannel = process.env.SLACK_DEFAULT_CHANNEL || 'general';
    this.configured = !!this.token;
    this.baseUrl = 'https://slack.com/api';

    // Notification settings (can be overridden by user preferences)
    this.settings = {
      meetingCompleted: true,
      dealWon: true,
      overdueReminder: true,
      actionItemCreated: false
    };

    if (this.configured) {
      console.log('[SlackNotifier] Initialized with bot token');
    } else {
      console.log('[SlackNotifier] Not configured - SLACK_BOT_TOKEN missing');
    }
  }

  // ========================================
  // CONNECTION & VALIDATION
  // ========================================

  /**
   * Test the Slack connection
   */
  async testConnection() {
    if (!this.configured) {
      return {
        success: false,
        error: 'Slack not configured. Set SLACK_BOT_TOKEN in environment.'
      };
    }

    try {
      const response = await axios.get(`${this.baseUrl}/auth.test`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      if (response.data.ok) {
        return {
          success: true,
          team: response.data.team,
          teamId: response.data.team_id,
          user: response.data.user,
          userId: response.data.user_id,
          botId: response.data.bot_id
        };
      }

      return {
        success: false,
        error: response.data.error || 'Unknown error'
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  /**
   * List available Slack channels
   */
  async listChannels(options = {}) {
    if (!this.configured) {
      return { success: false, channels: [], error: 'Not configured' };
    }

    try {
      const response = await axios.get(`${this.baseUrl}/conversations.list`, {
        headers: { 'Authorization': `Bearer ${this.token}` },
        params: {
          types: options.types || 'public_channel,private_channel',
          exclude_archived: true,
          limit: options.limit || 200
        }
      });

      if (!response.data.ok) {
        return { success: false, channels: [], error: response.data.error };
      }

      const channels = response.data.channels.map(ch => ({
        id: ch.id,
        name: ch.name,
        displayName: `#${ch.name}`,
        isPrivate: ch.is_private,
        memberCount: ch.num_members,
        topic: ch.topic?.value || '',
        purpose: ch.purpose?.value || ''
      }));

      return {
        success: true,
        channels,
        hasMore: !!response.data.response_metadata?.next_cursor
      };
    } catch (error) {
      return {
        success: false,
        channels: [],
        error: error.response?.data?.error || error.message
      };
    }
  }

  // ========================================
  // CORE MESSAGING
  // ========================================

  /**
   * Send a message to a Slack channel
   */
  async sendMessage(channel, text, blocks = null, options = {}) {
    if (!this.configured) {
      console.log('[SlackNotifier] Not configured, skipping message');
      return { success: false, error: 'Not configured' };
    }

    const channelId = channel || this.defaultChannel;

    try {
      const payload = {
        channel: channelId,
        text: text, // Fallback text for notifications
        unfurl_links: false,
        unfurl_media: false
      };

      if (blocks) {
        payload.blocks = blocks;
      }

      if (options.threadTs) {
        payload.thread_ts = options.threadTs;
      }

      if (options.replyBroadcast) {
        payload.reply_broadcast = true;
      }

      const response = await axios.post(`${this.baseUrl}/chat.postMessage`, payload, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.data.ok) {
        console.error('[SlackNotifier] Send failed:', response.data.error);
        return { success: false, error: response.data.error };
      }

      return {
        success: true,
        messageTs: response.data.ts,
        channel: response.data.channel
      };
    } catch (error) {
      console.error('[SlackNotifier] Send error:', error.message);
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  // ========================================
  // MEETING COMPLETED NOTIFICATION
  // ========================================

  /**
   * Send meeting summary notification
   */
  async sendMeetingSummary(meeting, actionItems = [], channel = null) {
    if (!this.settings.meetingCompleted && !channel) {
      return { success: false, skipped: true, reason: 'Notification disabled' };
    }

    const sentimentEmoji = this._getSentimentEmoji(meeting.sentiment_label);
    const sentimentColor = this._getSentimentColor(meeting.sentiment_label);

    const blocks = [
      // Header
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${sentimentEmoji} Meeting Completed: ${meeting.title}`,
          emoji: true
        }
      },
      // Divider
      { type: 'divider' },
      // Summary section
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Summary*\n${meeting.summary || 'No summary available'}`
        }
      }
    ];

    // Key points
    if (meeting.key_points?.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Key Points*\n${meeting.key_points.slice(0, 5).map(p => `- ${p}`).join('\n')}`
        }
      });
    }

    // Decisions
    if (meeting.decisions?.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Decisions Made*\n${meeting.decisions.slice(0, 5).map(d => `- ${d}`).join('\n')}`
        }
      });
    }

    // Action Items
    if (actionItems.length > 0) {
      blocks.push({ type: 'divider' });
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Action Items* (${actionItems.length} total)`
        }
      });

      // Show top 5 action items
      const itemsToShow = actionItems.slice(0, 5);
      for (const item of itemsToShow) {
        const priorityEmoji = this._getPriorityEmoji(item.priority);
        let itemText = `${priorityEmoji} ${item.task_description}`;

        if (item.assigned_to_name) {
          itemText += ` - _assigned to ${item.assigned_to_name}_`;
        }
        if (item.due_date) {
          itemText += ` | Due: ${this._formatDate(item.due_date)}`;
        }

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: itemText
          }
        });
      }

      if (actionItems.length > 5) {
        blocks.push({
          type: 'context',
          elements: [{
            type: 'mrkdwn',
            text: `_...and ${actionItems.length - 5} more action items_`
          }]
        });
      }
    }

    // Context footer
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Meeting ID: \`${meeting.id?.substring(0, 8) || 'N/A'}\` | ${this._formatDateTime(meeting.created_at)} | Powered by *Entomate*`
        }
      ]
    });

    // Add view details button if we have a meeting ID
    if (meeting.id) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Full Recap',
              emoji: true
            },
            url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/meetings/${meeting.id}`,
            action_id: 'view_meeting'
          }
        ]
      });
    }

    const fallbackText = `Meeting Completed: ${meeting.title}\n${meeting.summary || 'No summary'}\nAction Items: ${actionItems.length}`;

    return this.sendMessage(channel, fallbackText, blocks);
  }

  // ========================================
  // DEAL WON NOTIFICATION
  // ========================================

  /**
   * Send deal won celebration notification
   */
  async sendDealAlert(deal, channel = null) {
    if (!this.settings.dealWon && !channel) {
      return { success: false, skipped: true, reason: 'Notification disabled' };
    }

    const dealValue = deal.value
      ? `$${Number(deal.value).toLocaleString()}`
      : 'Value TBD';

    const blocks = [
      // Header with celebration
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🎉 Deal Won!',
          emoji: true
        }
      },
      // Deal name section
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${deal.name || 'New Deal'}*`
        }
      },
      // Deal details
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Value*\n${dealValue}`
          },
          {
            type: 'mrkdwn',
            text: `*Company*\n${deal.company_name || deal.contact_name || 'N/A'}`
          }
        ]
      }
    ];

    // Add owner if available
    if (deal.owner_name || deal.owner_email) {
      blocks.push({
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Owner*\n${deal.owner_name || deal.owner_email}`
          },
          {
            type: 'mrkdwn',
            text: `*Closed Date*\n${this._formatDate(deal.closed_at || new Date())}`
          }
        ]
      });
    }

    // Notes if available
    if (deal.notes) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Notes*\n${deal.notes}`
        }
      });
    }

    // Context footer
    blocks.push({
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: `Deal ID: \`${deal.id?.substring(0, 8) || 'N/A'}\` | via *Entomate*`
      }]
    });

    const fallbackText = `Deal Won! ${deal.name} - ${dealValue}`;

    return this.sendMessage(channel, fallbackText, blocks);
  }

  // ========================================
  // OVERDUE ACTION ITEMS REMINDER
  // ========================================

  /**
   * Send overdue action items reminder
   */
  async sendOverdueReminder(overdueItems, channel = null) {
    if (!this.settings.overdueReminder && !channel) {
      return { success: false, skipped: true, reason: 'Notification disabled' };
    }

    if (!overdueItems || overdueItems.length === 0) {
      return { success: false, skipped: true, reason: 'No overdue items' };
    }

    const blocks = [
      // Warning header
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `⚠️ ${overdueItems.length} Overdue Action Item${overdueItems.length > 1 ? 's' : ''}`,
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'The following action items are past their due date:'
        }
      },
      { type: 'divider' }
    ];

    // Group by assignee for better organization
    const byAssignee = {};
    for (const item of overdueItems) {
      const assignee = item.assigned_to_name || item.assigned_to_email || 'Unassigned';
      if (!byAssignee[assignee]) {
        byAssignee[assignee] = [];
      }
      byAssignee[assignee].push(item);
    }

    // Add items grouped by assignee
    for (const [assignee, items] of Object.entries(byAssignee)) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${assignee}* (${items.length} item${items.length > 1 ? 's' : ''})`
        }
      });

      for (const item of items.slice(0, 3)) {
        const daysOverdue = this._getDaysOverdue(item.due_date);
        const priorityEmoji = this._getPriorityEmoji(item.priority);

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${priorityEmoji} ${item.task_description}\n_Overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}_`
          }
        });
      }

      if (items.length > 3) {
        blocks.push({
          type: 'context',
          elements: [{
            type: 'mrkdwn',
            text: `_...and ${items.length - 3} more items for ${assignee}_`
          }]
        });
      }
    }

    // Action button
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View All Tasks',
            emoji: true
          },
          url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/tasks?filter=overdue`,
          action_id: 'view_overdue'
        }
      ]
    });

    // Footer
    blocks.push({
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: `${new Date().toLocaleDateString()} | Powered by *Entomate*`
      }]
    });

    const fallbackText = `${overdueItems.length} action items are overdue. Please review and update.`;

    return this.sendMessage(channel, fallbackText, blocks);
  }

  // ========================================
  // ACTION ITEM CREATED NOTIFICATION
  // ========================================

  /**
   * Send notification when a new action item is created
   */
  async sendActionItemCreated(actionItem, meeting = null, channel = null) {
    if (!this.settings.actionItemCreated && !channel) {
      return { success: false, skipped: true, reason: 'Notification disabled' };
    }

    const priorityEmoji = this._getPriorityEmoji(actionItem.priority);

    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${priorityEmoji} *New Action Item*\n${actionItem.task_description}`
        }
      },
      {
        type: 'section',
        fields: []
      }
    ];

    const fields = blocks[1].fields;

    if (actionItem.assigned_to_name || actionItem.assigned_to_email) {
      fields.push({
        type: 'mrkdwn',
        text: `*Assigned to*\n${actionItem.assigned_to_name || actionItem.assigned_to_email}`
      });
    }

    if (actionItem.due_date) {
      fields.push({
        type: 'mrkdwn',
        text: `*Due Date*\n${this._formatDate(actionItem.due_date)}`
      });
    }

    if (actionItem.priority) {
      fields.push({
        type: 'mrkdwn',
        text: `*Priority*\n${actionItem.priority.charAt(0).toUpperCase() + actionItem.priority.slice(1)}`
      });
    }

    if (meeting?.title) {
      fields.push({
        type: 'mrkdwn',
        text: `*From Meeting*\n${meeting.title}`
      });
    }

    // Remove fields block if empty
    if (fields.length === 0) {
      blocks.pop();
    }

    // Context
    blocks.push({
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: `Created ${this._formatDateTime(actionItem.created_at)} | via *Entomate*`
      }]
    });

    const fallbackText = `New Action Item: ${actionItem.task_description}`;

    return this.sendMessage(channel, fallbackText, blocks);
  }

  // ========================================
  // GENERIC NOTIFICATION
  // ========================================

  /**
   * Send a generic notification with custom content
   */
  async sendNotification(title, message, options = {}) {
    const { channel, color, fields, buttons } = options;

    const emoji = options.emoji || 'bell';
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `:${emoji}: ${title}`,
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: message
        }
      }
    ];

    // Add custom fields
    if (fields && fields.length > 0) {
      blocks.push({
        type: 'section',
        fields: fields.map(f => ({
          type: 'mrkdwn',
          text: `*${f.label}*\n${f.value}`
        }))
      });
    }

    // Add action buttons
    if (buttons && buttons.length > 0) {
      blocks.push({
        type: 'actions',
        elements: buttons.map((btn, idx) => ({
          type: 'button',
          text: {
            type: 'plain_text',
            text: btn.text,
            emoji: true
          },
          url: btn.url,
          action_id: btn.actionId || `action_${idx}`,
          ...(btn.style && { style: btn.style })
        }))
      });
    }

    // Footer
    blocks.push({
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: `${this._formatDateTime(new Date())} | via *Entomate*`
      }]
    });

    return this.sendMessage(channel, `${title}: ${message}`, blocks);
  }

  // ========================================
  // SETTINGS MANAGEMENT
  // ========================================

  /**
   * Update notification settings
   */
  updateSettings(newSettings) {
    this.settings = {
      ...this.settings,
      ...newSettings
    };
    return this.settings;
  }

  /**
   * Get current settings
   */
  getSettings() {
    return {
      ...this.settings,
      configured: this.configured,
      defaultChannel: this.defaultChannel
    };
  }

  /**
   * Set default channel
   */
  setDefaultChannel(channelId) {
    this.defaultChannel = channelId;
    return this.defaultChannel;
  }

  // ========================================
  // HELPER METHODS
  // ========================================

  _getSentimentEmoji(sentiment) {
    const map = {
      'Positive': '😊',
      'Neutral': '😐',
      'Negative': '😟',
      'Mixed': '🤔'
    };
    return map[sentiment] || '📝';
  }

  _getSentimentColor(sentiment) {
    const map = {
      'Positive': '#36a64f',
      'Neutral': '#4a90d9',
      'Negative': '#d93636',
      'Mixed': '#f5a623'
    };
    return map[sentiment] || '#4a90d9';
  }

  _getPriorityEmoji(priority) {
    const map = {
      'high': '🔴',
      'medium': '🟡',
      'low': '🟢'
    };
    return map[priority?.toLowerCase()] || '⚪';
  }

  _formatDate(date) {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return String(date);
    }
  }

  _formatDateTime(date) {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return String(date);
    }
  }

  _getDaysOverdue(dueDate) {
    if (!dueDate) return 0;
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = now.getTime() - due.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

module.exports = new SlackNotifier();
