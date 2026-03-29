/**
 * Slack Integration Routes
 * API endpoints for Slack notifications and configuration
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const slackNotifier = require('../services/slackNotifier');
const { supabase } = require('../config/supabase');
const logger = require('../services/logger');
const { validate } = require('../middleware/validate');
const schemas = require('../schemas/slack');

// ========================================
// CONNECTION & STATUS
// ========================================

/**
 * POST /api/slack/test
 * Test Slack connection
 */
router.post('/test', authenticate, async (req, res) => {
  try {
    const result = await slackNotifier.testConnection();

    if (result.success) {
      logger.info('[Slack] Connection test successful', {
        team: result.team,
        user: result.user
      });
    } else {
      logger.warn('[Slack] Connection test failed', { error: result.error });
    }

    res.json(result);
  } catch (error) {
    logger.error('[Slack] Test connection error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/slack/status
 * Get Slack integration status and settings
 */
router.get('/status', async (req, res) => {
  try {
    const settings = slackNotifier.getSettings();
    let connectionStatus = null;

    if (settings.configured) {
      connectionStatus = await slackNotifier.testConnection();
    }

    res.json({
      configured: settings.configured,
      connected: connectionStatus?.success || false,
      team: connectionStatus?.team || null,
      defaultChannel: settings.defaultChannel,
      notifications: {
        meetingCompleted: settings.meetingCompleted,
        dealWon: settings.dealWon,
        overdueReminder: settings.overdueReminder,
        actionItemCreated: settings.actionItemCreated
      }
    });
  } catch (error) {
    logger.error('[Slack] Status check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// CHANNELS
// ========================================

/**
 * GET /api/slack/channels
 * List available Slack channels
 */
router.get('/channels', authenticate, async (req, res) => {
  try {
    const { types, limit } = req.query;

    const result = await slackNotifier.listChannels({
      types: types || 'public_channel,private_channel',
      limit: limit ? parseInt(limit) : 200
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        channels: [],
        error: result.error
      });
    }

    res.json({
      success: true,
      channels: result.channels,
      count: result.channels.length,
      hasMore: result.hasMore
    });
  } catch (error) {
    logger.error('[Slack] List channels error:', error);
    res.status(500).json({
      success: false,
      channels: [],
      error: error.message
    });
  }
});

// ========================================
// NOTIFICATIONS
// ========================================

/**
 * POST /api/slack/notify
 * Send a manual notification
 */
router.post('/notify', authenticate, validate(schemas.notify), async (req, res) => {
  try {
    const { type, channel, data } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'Notification type is required' });
    }

    let result;

    switch (type) {
      case 'meeting_summary':
        if (!data.meeting) {
          return res.status(400).json({ error: 'Meeting data is required' });
        }
        result = await slackNotifier.sendMeetingSummary(
          data.meeting,
          data.actionItems || [],
          channel
        );
        break;

      case 'deal_won':
        if (!data.deal) {
          return res.status(400).json({ error: 'Deal data is required' });
        }
        result = await slackNotifier.sendDealAlert(data.deal, channel);
        break;

      case 'overdue_reminder':
        if (!data.items || !Array.isArray(data.items)) {
          return res.status(400).json({ error: 'Overdue items array is required' });
        }
        result = await slackNotifier.sendOverdueReminder(data.items, channel);
        break;

      case 'action_item':
        if (!data.actionItem) {
          return res.status(400).json({ error: 'Action item data is required' });
        }
        result = await slackNotifier.sendActionItemCreated(
          data.actionItem,
          data.meeting,
          channel
        );
        break;

      case 'custom':
        if (!data.title || !data.message) {
          return res.status(400).json({ error: 'Title and message are required' });
        }
        result = await slackNotifier.sendNotification(
          data.title,
          data.message,
          {
            channel,
            emoji: data.emoji,
            fields: data.fields,
            buttons: data.buttons
          }
        );
        break;

      default:
        return res.status(400).json({ error: `Unknown notification type: ${type}` });
    }

    // Log the notification
    if (result.success && supabase) {
      try {
        await supabase.from('integration_logs').insert({
          id: require('uuid').v4(),
          source_type: 'slack_notification',
          source_id: data.meeting?.id || data.deal?.id || null,
          destination_type: 'slack',
          destination_id: result.channel || channel || 'default',
          status: 'synced',
          metadata: { type, messageTs: result.messageTs },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      } catch (logError) {
        logger.warn('[Slack] Failed to log notification:', logError.message);
      }
    }

    res.json(result);
  } catch (error) {
    logger.error('[Slack] Send notification error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/slack/notify/meeting/:meetingId
 * Send meeting summary notification for a specific meeting
 */
router.post('/notify/meeting/:meetingId', authenticate, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { channel } = req.body;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Fetch meeting
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Fetch action items
    const { data: actionItems } = await supabase
      .from('action_items')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('priority', { ascending: true });

    // Send notification
    const result = await slackNotifier.sendMeetingSummary(
      meeting,
      actionItems || [],
      channel
    );

    if (result.success) {
      // Update meeting record
      await supabase
        .from('meetings')
        .update({
          slack_notified: true,
          slack_notified_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', meetingId);

      logger.info('[Slack] Meeting summary sent', {
        meetingId,
        channel: result.channel
      });
    }

    res.json(result);
  } catch (error) {
    logger.error('[Slack] Meeting notification error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/slack/notify/overdue
 * Send overdue items reminder
 */
router.post('/notify/overdue', authenticate, async (req, res) => {
  try {
    const { channel, assignee } = req.body;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Fetch overdue action items
    let query = supabase
      .from('action_items')
      .select('*')
      .lt('due_date', new Date().toISOString().split('T')[0])
      .neq('status', 'done')
      .neq('status', 'completed');

    if (assignee) {
      query = query.or(`assigned_to_email.eq.${assignee},assigned_to_name.eq.${assignee}`);
    }

    const { data: overdueItems, error: fetchError } = await query
      .order('due_date', { ascending: true })
      .limit(50);

    if (fetchError) {
      throw fetchError;
    }

    if (!overdueItems || overdueItems.length === 0) {
      return res.json({
        success: true,
        skipped: true,
        reason: 'No overdue items found'
      });
    }

    const result = await slackNotifier.sendOverdueReminder(overdueItems, channel);

    if (result.success) {
      logger.info('[Slack] Overdue reminder sent', {
        itemCount: overdueItems.length,
        channel: result.channel
      });
    }

    res.json({
      ...result,
      itemCount: overdueItems.length
    });
  } catch (error) {
    logger.error('[Slack] Overdue notification error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// SETTINGS
// ========================================

/**
 * GET /api/slack/settings
 * Get Slack notification settings
 */
router.get('/settings', authenticate, async (req, res) => {
  try {
    const settings = slackNotifier.getSettings();
    res.json(settings);
  } catch (error) {
    logger.error('[Slack] Get settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/slack/settings
 * Update Slack notification settings
 */
router.put('/settings', authenticate, validate(schemas.settings), async (req, res) => {
  try {
    const {
      defaultChannel,
      meetingCompleted,
      dealWon,
      overdueReminder,
      actionItemCreated
    } = req.body;

    // Update default channel if provided
    if (defaultChannel !== undefined) {
      slackNotifier.setDefaultChannel(defaultChannel);
    }

    // Update notification settings
    const newSettings = slackNotifier.updateSettings({
      meetingCompleted: meetingCompleted !== undefined ? meetingCompleted : undefined,
      dealWon: dealWon !== undefined ? dealWon : undefined,
      overdueReminder: overdueReminder !== undefined ? overdueReminder : undefined,
      actionItemCreated: actionItemCreated !== undefined ? actionItemCreated : undefined
    });

    // Persist settings to database if available
    if (supabase && req.user?.id) {
      try {
        await supabase
          .from('user_settings')
          .upsert({
            user_id: req.user.id,
            setting_key: 'slack_notifications',
            setting_value: newSettings,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,setting_key' });
      } catch (dbError) {
        logger.warn('[Slack] Failed to persist settings:', dbError.message);
      }
    }

    logger.info('[Slack] Settings updated', newSettings);

    res.json({
      success: true,
      settings: newSettings
    });
  } catch (error) {
    logger.error('[Slack] Update settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/slack/settings/test-notification
 * Send a test notification to verify settings
 */
router.post('/settings/test-notification', authenticate, async (req, res) => {
  try {
    const { channel } = req.body;

    const result = await slackNotifier.sendNotification(
      'Test Notification',
      'This is a test notification from Entomate. If you see this, your Slack integration is working correctly!',
      {
        channel,
        emoji: 'white_check_mark',
        fields: [
          { label: 'Status', value: 'Connected' },
          { label: 'Sent at', value: new Date().toLocaleString() }
        ],
        buttons: [
          {
            text: 'Open Entomate',
            url: process.env.FRONTEND_URL || 'http://localhost:5173',
            style: 'primary'
          }
        ]
      }
    );

    res.json(result);
  } catch (error) {
    logger.error('[Slack] Test notification error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
