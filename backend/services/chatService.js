/**
 * Chat Integration Service
 * Supports Slack, Microsoft Teams, Discord
 * Configure CHAT_PROVIDER in .env to select provider
 */

const axios = require('axios');

class ChatService {
  constructor() {
    this.provider = process.env.CHAT_PROVIDER || 'slack';
    this.configured = false;
    this.client = null;

    this.initializeProvider();
  }

  initializeProvider() {
    switch (this.provider) {
      case 'slack':
        this.token = process.env.SLACK_BOT_TOKEN;
        this.webhookUrl = process.env.SLACK_WEBHOOK_URL;
        this.configured = !!(this.token || this.webhookUrl);
        break;

      case 'teams':
        this.webhookUrl = process.env.TEAMS_WEBHOOK_URL;
        this.configured = !!this.webhookUrl;
        break;

      case 'discord':
        this.webhookUrl = process.env.DISCORD_WEBHOOK_URL;
        this.token = process.env.DISCORD_BOT_TOKEN;
        this.configured = !!(this.token || this.webhookUrl);
        break;

      default:
        console.log(`⚠️ Unknown chat provider: ${this.provider}`);
    }
  }

  /**
   * Check if chat integration is connected
   */
  async checkConnection() {
    if (!this.configured) {
      return { connected: false, message: 'Chat not configured' };
    }

    try {
      switch (this.provider) {
        case 'slack':
          if (this.token) {
            const response = await axios.get('https://slack.com/api/auth.test', {
              headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.data.ok) {
              return {
                connected: true,
                provider: this.provider,
                team: response.data.team,
                user: response.data.user
              };
            }
            return { connected: false, message: response.data.error };
          }
          // Webhook-only mode - can't test connection
          return { connected: true, provider: this.provider, mode: 'webhook' };

        case 'teams':
          // Teams webhooks can't be tested without sending a message
          return { connected: true, provider: this.provider, mode: 'webhook' };

        case 'discord':
          if (this.token) {
            const response = await axios.get('https://discord.com/api/v10/users/@me', {
              headers: { 'Authorization': `Bot ${this.token}` }
            });
            return {
              connected: true,
              provider: this.provider,
              user: response.data.username
            };
          }
          return { connected: true, provider: this.provider, mode: 'webhook' };
      }
    } catch (error) {
      return {
        connected: false,
        message: error.response?.data?.error || error.message,
        provider: this.provider
      };
    }
  }

  /**
   * Get available channels
   */
  async getChannels() {
    if (!this.configured || !this.token) {
      return { success: false, channels: [], message: 'Bot token required for channel list' };
    }

    try {
      switch (this.provider) {
        case 'slack':
          return await this.getSlackChannels();

        case 'discord':
          return await this.getDiscordChannels();

        case 'teams':
          // Teams requires Graph API with specific permissions
          return { success: false, channels: [], message: 'Teams channel listing requires Graph API' };

        default:
          return { success: false, channels: [] };
      }
    } catch (error) {
      return {
        success: false,
        channels: [],
        error: error.response?.data?.error || error.message
      };
    }
  }

  /**
   * Get Slack channels
   */
  async getSlackChannels() {
    const response = await axios.get('https://slack.com/api/conversations.list', {
      headers: { 'Authorization': `Bearer ${this.token}` },
      params: {
        types: 'public_channel,private_channel',
        exclude_archived: true,
        limit: 100
      }
    });

    if (!response.data.ok) {
      throw new Error(response.data.error);
    }

    const channels = response.data.channels.map(ch => ({
      id: ch.id,
      name: `#${ch.name}`,
      type: ch.is_private ? 'private' : 'public',
      memberCount: ch.num_members
    }));

    return { success: true, channels, provider: 'slack' };
  }

  /**
   * Get Discord channels (from guilds the bot is in)
   */
  async getDiscordChannels() {
    // Get guilds
    const guildsResponse = await axios.get('https://discord.com/api/v10/users/@me/guilds', {
      headers: { 'Authorization': `Bot ${this.token}` }
    });

    const allChannels = [];

    for (const guild of guildsResponse.data.slice(0, 5)) { // Limit to 5 guilds
      try {
        const channelsResponse = await axios.get(
          `https://discord.com/api/v10/guilds/${guild.id}/channels`,
          { headers: { 'Authorization': `Bot ${this.token}` } }
        );

        const textChannels = channelsResponse.data
          .filter(ch => ch.type === 0) // Text channels only
          .map(ch => ({
            id: ch.id,
            name: `#${ch.name}`,
            type: 'text',
            guild: guild.name,
            guildId: guild.id
          }));

        allChannels.push(...textChannels);
      } catch (err) {
        console.error(`Failed to get channels for guild ${guild.name}:`, err.message);
      }
    }

    return { success: true, channels: allChannels, provider: 'discord' };
  }

  /**
   * Post a message to a channel
   */
  async postMessage(channelId, message, options = {}) {
    if (!this.configured) {
      console.log('⚠️ Chat not configured, skipping message post');
      return { success: false, message: 'Chat not configured' };
    }

    try {
      let result;

      switch (this.provider) {
        case 'slack':
          result = await this.postSlackMessage(channelId, message, options);
          break;

        case 'teams':
          result = await this.postTeamsMessage(message, options);
          break;

        case 'discord':
          result = await this.postDiscordMessage(channelId, message, options);
          break;

        default:
          throw new Error(`Unsupported chat provider: ${this.provider}`);
      }

      return { success: true, ...result };
    } catch (error) {
      console.error(`Chat post failed:`, error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
        provider: this.provider
      };
    }
  }

  /**
   * Post message to Slack
   */
  async postSlackMessage(channelId, message, options = {}) {
    // Use webhook if no token or if webhook is preferred
    if (this.webhookUrl && (!this.token || options.useWebhook)) {
      const payload = {
        text: message,
        ...(options.blocks && { blocks: options.blocks })
      };

      await axios.post(this.webhookUrl, payload);
      return { messageId: null, channel: 'webhook' };
    }

    // Use Bot API
    const response = await axios.post('https://slack.com/api/chat.postMessage', {
      channel: channelId,
      text: message,
      unfurl_links: false,
      ...(options.blocks && { blocks: options.blocks }),
      ...(options.attachments && { attachments: options.attachments })
    }, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.data.ok) {
      throw new Error(response.data.error);
    }

    return {
      messageId: response.data.ts,
      channel: response.data.channel
    };
  }

  /**
   * Post message to Microsoft Teams
   */
  async postTeamsMessage(message, options = {}) {
    // Teams uses Adaptive Cards for rich formatting
    const payload = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      summary: options.title || 'Entomate Notification',
      themeColor: options.color || '0076D7',
      title: options.title || '',
      text: message,
      sections: options.sections || []
    };

    await axios.post(this.webhookUrl, payload);
    return { messageId: null, channel: 'webhook' };
  }

  /**
   * Post message to Discord
   */
  async postDiscordMessage(channelId, message, options = {}) {
    // Use webhook if available
    if (this.webhookUrl && !channelId) {
      const payload = {
        content: message,
        ...(options.embeds && { embeds: options.embeds })
      };

      await axios.post(this.webhookUrl, payload);
      return { messageId: null, channel: 'webhook' };
    }

    // Use Bot API
    const response = await axios.post(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        content: message,
        ...(options.embeds && { embeds: options.embeds })
      },
      {
        headers: {
          'Authorization': `Bot ${this.token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      messageId: response.data.id,
      channel: channelId
    };
  }

  /**
   * Format a meeting recap for chat
   */
  formatMeetingRecap(meeting, actionItems = []) {
    switch (this.provider) {
      case 'slack':
        return this.formatSlackRecap(meeting, actionItems);
      case 'teams':
        return this.formatTeamsRecap(meeting, actionItems);
      case 'discord':
        return this.formatDiscordRecap(meeting, actionItems);
      default:
        return this.formatPlainRecap(meeting, actionItems);
    }
  }

  /**
   * Slack Block Kit formatted recap
   */
  formatSlackRecap(meeting, actionItems) {
    const sentimentEmoji = {
      'Positive': '😊',
      'Neutral': '😐',
      'Negative': '😟'
    }[meeting.sentiment_label] || '📝';

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${sentimentEmoji} Meeting Recap: ${meeting.title}`,
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Summary:*\n${meeting.summary || 'No summary available'}`
        }
      }
    ];

    // Key points
    if (meeting.key_points?.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Key Points:*\n${meeting.key_points.map(p => `• ${p}`).join('\n')}`
        }
      });
    }

    // Decisions
    if (meeting.decisions?.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Decisions Made:*\n${meeting.decisions.map(d => `✓ ${d}`).join('\n')}`
        }
      });
    }

    // Action items
    if (actionItems.length > 0) {
      blocks.push({ type: 'divider' });
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Action Items (${actionItems.length}):*`
        }
      });

      actionItems.slice(0, 10).forEach(item => {
        const priorityEmoji = { 'high': '🔴', 'medium': '🟡', 'low': '🟢' }[item.priority] || '';
        let text = `${priorityEmoji} ${item.task_description}`;
        if (item.assigned_to_name) text += ` → *${item.assigned_to_name}*`;
        if (item.due_date) text += ` _(due ${item.due_date})_`;

        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text }
        });
      });
    }

    // Footer
    blocks.push({
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: `📅 ${new Date(meeting.created_at).toLocaleDateString()} | Powered by Entomate`
      }]
    });

    return {
      text: `Meeting Recap: ${meeting.title}`,
      blocks
    };
  }

  /**
   * Teams Adaptive Card formatted recap
   */
  formatTeamsRecap(meeting, actionItems) {
    const sentimentEmoji = {
      'Positive': '😊',
      'Neutral': '😐',
      'Negative': '😟'
    }[meeting.sentiment_label] || '📝';

    const sections = [
      {
        activityTitle: `${sentimentEmoji} ${meeting.title}`,
        facts: [
          { name: 'Date', value: new Date(meeting.created_at).toLocaleDateString() },
          { name: 'Sentiment', value: meeting.sentiment_label || 'Neutral' }
        ],
        text: meeting.summary || 'No summary available'
      }
    ];

    if (meeting.key_points?.length > 0) {
      sections.push({
        title: 'Key Points',
        text: meeting.key_points.map(p => `• ${p}`).join('\n\n')
      });
    }

    if (actionItems.length > 0) {
      sections.push({
        title: `Action Items (${actionItems.length})`,
        text: actionItems.slice(0, 10).map(item => {
          let text = `☐ ${item.task_description}`;
          if (item.assigned_to_name) text += ` → ${item.assigned_to_name}`;
          return text;
        }).join('\n\n')
      });
    }

    return {
      title: `Meeting Recap: ${meeting.title}`,
      color: '0076D7',
      sections
    };
  }

  /**
   * Discord embed formatted recap
   */
  formatDiscordRecap(meeting, actionItems) {
    const sentimentEmoji = {
      'Positive': '😊',
      'Neutral': '😐',
      'Negative': '😟'
    }[meeting.sentiment_label] || '📝';

    const fields = [];

    if (meeting.key_points?.length > 0) {
      fields.push({
        name: '📌 Key Points',
        value: meeting.key_points.slice(0, 5).map(p => `• ${p}`).join('\n'),
        inline: false
      });
    }

    if (meeting.decisions?.length > 0) {
      fields.push({
        name: '✅ Decisions',
        value: meeting.decisions.slice(0, 5).map(d => `• ${d}`).join('\n'),
        inline: false
      });
    }

    if (actionItems.length > 0) {
      fields.push({
        name: `📋 Action Items (${actionItems.length})`,
        value: actionItems.slice(0, 5).map(item => {
          const priorityEmoji = { 'high': '🔴', 'medium': '🟡', 'low': '🟢' }[item.priority] || '';
          let text = `${priorityEmoji} ${item.task_description}`;
          if (item.assigned_to_name) text += ` → ${item.assigned_to_name}`;
          return text;
        }).join('\n'),
        inline: false
      });
    }

    const embeds = [{
      title: `${sentimentEmoji} Meeting Recap: ${meeting.title}`,
      description: meeting.summary || 'No summary available',
      color: 0x5865F2, // Discord blurple
      fields,
      footer: {
        text: `Powered by Entomate • ${new Date(meeting.created_at).toLocaleDateString()}`
      }
    }];

    return {
      content: `**New Meeting Recap Available!**`,
      embeds
    };
  }

  /**
   * Plain text formatted recap
   */
  formatPlainRecap(meeting, actionItems) {
    const sentimentEmoji = {
      'Positive': '😊',
      'Neutral': '😐',
      'Negative': '😟'
    }[meeting.sentiment_label] || '📝';

    let message = `${sentimentEmoji} **Meeting Recap: ${meeting.title}**\n\n`;
    message += `**Summary:** ${meeting.summary || 'No summary available'}\n\n`;

    if (meeting.key_points?.length > 0) {
      message += `**Key Points:**\n`;
      meeting.key_points.forEach(point => {
        message += `• ${point}\n`;
      });
      message += '\n';
    }

    if (meeting.decisions?.length > 0) {
      message += `**Decisions:**\n`;
      meeting.decisions.forEach(decision => {
        message += `✓ ${decision}\n`;
      });
      message += '\n';
    }

    if (actionItems.length > 0) {
      message += `**Action Items (${actionItems.length}):**\n`;
      actionItems.forEach(item => {
        const priorityEmoji = { 'high': '🔴', 'medium': '🟡', 'low': '🟢' }[item.priority] || '';
        message += `${priorityEmoji} ${item.task_description}`;
        if (item.assigned_to_name) message += ` → ${item.assigned_to_name}`;
        if (item.due_date) message += ` (due ${item.due_date})`;
        message += '\n';
      });
    }

    return { text: message };
  }
}

module.exports = new ChatService();
