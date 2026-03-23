const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../config/supabase');
const ai = require('../config/ai');
const crmService = require('../services/crmService');
const chatService = require('../services/chatService');
const logosVisionService = require('../services/logosVisionService');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../schemas/integrations');
const log = require('../utils/log');

const router = express.Router();

// ========================================
// CRM INTEGRATION ENDPOINTS
// ========================================

/**
 * POST /api/integrations/crm/sync-action-items
 * Sync action items to CRM as tasks
 */
router.post('/crm/sync-action-items', authenticate, validate(schemas.syncActionItems), async (req, res) => {
  try {
    const { actionItemIds, syncAll = false } = req.body;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Get action items to sync
    let query = supabase
      .from('action_items')
      .select('*')
      .eq('crm_sync_status', 'pending');

    if (!syncAll && actionItemIds && actionItemIds.length > 0) {
      query = query.in('id', actionItemIds);
    }

    query = query.limit(100);

    const { data: actionItems, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    const results = {
      synced: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      syncedItems: []
    };

    for (const item of actionItems || []) {
      try {
        // Check if already synced (has crm_task_id)
        if (item.crm_task_id && item.crm_sync_status === 'synced') {
          results.skipped++;
          continue;
        }

        // Create task in CRM using the CRM service
        let crmTaskId;
        if (crmService.configured) {
          const crmResult = await crmService.createTask({
            title: item.task_description,
            task_description: item.task_description,
            description: item.context,
            context: item.context,
            assigned_to_email: item.assigned_to_email,
            due_date: item.due_date,
            priority: item.priority
          });

          if (!crmResult.success) {
            throw new Error(crmResult.error || 'CRM task creation failed');
          }
          crmTaskId = crmResult.taskId;
        } else {
          // Fallback: simulate CRM task creation if not configured
          log.info('CRM not configured, simulating task creation');
          crmTaskId = `simulated-${uuidv4().substring(0, 8)}`;
        }

        // Update action item with sync status
        await supabase
          .from('action_items')
          .update({
            crm_sync_status: 'synced',
            crm_task_id: crmTaskId,
            last_sync_attempt: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);

        // Log the sync
        await supabase.from('integration_logs').insert({
          id: uuidv4(),
          source_type: 'action_item',
          source_id: item.id,
          destination_type: 'crm',
          destination_id: crmTaskId,
          status: 'synced',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        results.synced++;
        results.syncedItems.push({
          id: item.id,
          task: item.task_description,
          crmTaskId
        });

      } catch (itemError) {
        // Mark as failed
        await supabase
          .from('action_items')
          .update({
            crm_sync_status: 'failed',
            last_sync_attempt: new Date().toISOString(),
            last_sync_error: itemError.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);

        results.failed++;
        results.errors.push({
          itemId: item.id,
          error: itemError.message
        });
      }
    }

    res.json(results);

  } catch (error) {
    log.error('Error syncing to CRM:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/integrations/crm/create-deal
 * Create a deal in CRM
 */
router.post('/crm/create-deal', authenticate, validate(schemas.createDeal), async (req, res) => {
  try {
    const { name, value, contactEmail, contactName, stage, notes } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Deal name is required' });
    }

    let crmDealId;

    // Use actual CRM service if configured
    if (crmService.configured) {
      // CRM service creates the deal as a task with deal context
      const dealResult = await crmService.createTask({
        title: `Deal: ${name}`,
        description: notes || `Deal value: ${value || 'TBD'}\nContact: ${contactName || contactEmail || 'Unknown'}\nStage: ${stage || 'New'}`,
        context: `New deal creation for ${contactName || 'customer'}`,
        priority: 'high'
      });

      if (!dealResult.success) {
        throw new Error(dealResult.error || 'Failed to create deal in CRM');
      }
      crmDealId = dealResult.taskId;
    } else {
      // Fallback to simulated ID if CRM not configured
      log.info('CRM not configured, simulating deal creation');
      crmDealId = `deal-${uuidv4().substring(0, 8)}`;
    }

    // Log the creation
    if (supabase) {
      await supabase.from('integration_logs').insert({
        id: uuidv4(),
        source_type: 'entomate',
        source_id: null,
        destination_type: 'crm',
        destination_id: crmDealId,
        status: 'synced',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      dealId: crmDealId,
      provider: crmService.provider,
      message: 'Deal created in CRM'
    });

  } catch (error) {
    log.error('Error creating CRM deal:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/integrations/crm/deals
 * Get deals from CRM (for linking to projects)
 */
router.get('/crm/deals', async (req, res) => {
  try {
    const { limit = 50, search } = req.query;

    // Use actual CRM service if configured
    if (crmService.configured) {
      const result = await crmService.getDeals(parseInt(limit));

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch deals from CRM');
      }

      let deals = result.deals;

      // Filter by search if provided
      if (search) {
        const lowerSearch = search.toLowerCase();
        deals = deals.filter(d => d.name.toLowerCase().includes(lowerSearch));
      }

      res.json({
        deals,
        count: deals.length,
        provider: crmService.provider
      });
    } else {
      // Fallback to mock data if CRM not configured
      log.info('CRM not configured, returning sample deals');
      const mockDeals = [
        { id: 'deal-001', name: 'Acme Corp - Enterprise License', value: 50000, stage: 'negotiation' },
        { id: 'deal-002', name: 'TechStart - Pilot Program', value: 15000, stage: 'proposal' },
        { id: 'deal-003', name: 'BigCo - Annual Renewal', value: 120000, stage: 'closed-won' }
      ];

      let filtered = mockDeals;
      if (search) {
        const lowerSearch = search.toLowerCase();
        filtered = mockDeals.filter(d => d.name.toLowerCase().includes(lowerSearch));
      }

      res.json({
        deals: filtered.slice(0, parseInt(limit)),
        count: filtered.length,
        provider: 'mock',
        warning: 'CRM not configured, returning sample data'
      });
    }

  } catch (error) {
    log.error('Error fetching CRM deals:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// CHAT INTEGRATION ENDPOINTS
// ========================================

/**
 * POST /api/integrations/chat/post-recap
 * Post meeting recap to chat channel
 */
router.post('/chat/post-recap', authenticate, validate(schemas.postRecap), async (req, res) => {
  try {
    const { meetingId, channelId, customMessage } = req.body;

    if (!meetingId) {
      return res.status(400).json({ error: 'Meeting ID is required' });
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Get meeting with action items
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .single();

    if (meetingError) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const { data: actionItems } = await supabase
      .from('action_items')
      .select('*')
      .eq('meeting_id', meetingId);

    // Format message using chatService
    let formattedMessage;
    let messageText;
    let postOptions = {};

    if (customMessage) {
      messageText = customMessage;
    } else {
      // Use chatService to format the recap with rich formatting
      formattedMessage = chatService.formatMeetingRecap(meeting, actionItems || []);
      messageText = formattedMessage.text || formattedMessage.content || '';

      // Pass blocks/embeds for rich formatting
      if (formattedMessage.blocks) {
        postOptions.blocks = formattedMessage.blocks;
      }
      if (formattedMessage.embeds) {
        postOptions.embeds = formattedMessage.embeds;
      }
      if (formattedMessage.sections) {
        postOptions.sections = formattedMessage.sections;
        postOptions.title = formattedMessage.title;
        postOptions.color = formattedMessage.color;
      }
    }

    // Post to chat using chatService
    let postResult;
    if (chatService.configured) {
      postResult = await chatService.postMessage(channelId, messageText, postOptions);

      if (!postResult.success) {
        throw new Error(postResult.error || 'Failed to post to chat');
      }
    } else {
      log.info('Chat not configured, simulating post');
      postResult = { success: true, messageId: `simulated-${uuidv4().substring(0, 8)}`, channel: 'simulated' };
    }

    // Log the post
    await supabase.from('integration_logs').insert({
      id: uuidv4(),
      source_type: 'meeting',
      source_id: meetingId,
      destination_type: 'chat',
      destination_id: postResult.channel || channelId || 'default',
      status: 'synced',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Update meeting
    const existingChannels = meeting.posted_to_channels || [];
    const newChannel = postResult.channel || channelId || 'default';
    const updatedChannels = existingChannels.includes(newChannel)
      ? existingChannels
      : [...existingChannels, newChannel];

    await supabase
      .from('meetings')
      .update({
        chat_posted: true,
        posted_to_channels: updatedChannels,
        updated_at: new Date().toISOString()
      })
      .eq('id', meetingId);

    res.json({
      success: true,
      message: 'Meeting recap posted to chat',
      messagePreview: messageText.substring(0, 500),
      channelId: postResult.channel || channelId || 'default',
      messageId: postResult.messageId,
      provider: chatService.provider
    });

  } catch (error) {
    log.error('Error posting to chat:', { error: error.message || error });

    // Log the failure
    if (supabase && req.body.meetingId) {
      await supabase.from('integration_logs').insert({
        id: uuidv4(),
        source_type: 'meeting',
        source_id: req.body.meetingId,
        destination_type: 'chat',
        destination_id: req.body.channelId || 'default',
        status: 'failed',
        error_message: error.message,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/integrations/chat/send-message
 * Send a custom message to chat
 */
router.post('/chat/send-message', authenticate, validate(schemas.sendMessage), async (req, res) => {
  try {
    const { channelId, message, attachments } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Post using chatService
    let result;
    if (chatService.configured) {
      result = await chatService.postMessage(channelId, message, { attachments });

      if (!result.success) {
        throw new Error(result.error || 'Failed to send message');
      }
    } else {
      log.info('Chat not configured, simulating send');
      result = { success: true, messageId: `simulated-${uuidv4().substring(0, 8)}`, channel: 'simulated' };
    }

    res.json({
      success: true,
      message: 'Message sent to chat',
      channelId: result.channel || channelId || 'default',
      messageId: result.messageId,
      provider: chatService.provider
    });

  } catch (error) {
    log.error('Error sending chat message:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/integrations/chat/channels
 * Get available chat channels
 */
router.get('/chat/channels', async (req, res) => {
  try {
    // Use chatService to get real channels
    if (chatService.configured && chatService.token) {
      const result = await chatService.getChannels();

      if (result.success) {
        return res.json({
          channels: result.channels,
          provider: result.provider,
          count: result.channels.length
        });
      }

      // If channel listing failed but chat is configured, return empty with message
      return res.json({
        channels: [],
        provider: chatService.provider,
        message: result.message || result.error || 'Could not fetch channels'
      });
    }

    // Fallback: return mock data if not configured or webhook-only mode
    const channels = [
      { id: 'general', name: '#general', type: 'public' },
      { id: 'team-updates', name: '#team-updates', type: 'public' },
      { id: 'sales', name: '#sales', type: 'private' },
      { id: 'engineering', name: '#engineering', type: 'private' }
    ];

    res.json({
      channels,
      provider: chatService.provider,
      mode: chatService.configured ? 'webhook' : 'mock',
      message: chatService.configured
        ? 'Using webhook mode - channel selection not available'
        : 'Chat not configured - showing mock channels'
    });

  } catch (error) {
    log.error('Error fetching channels:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/integrations/chat/test
 * Test chat connection
 */
router.post('/chat/test', authenticate, async (req, res) => {
  try {
    if (!chatService.configured) {
      return res.status(400).json({
        success: false,
        error: 'Chat not configured. Set SLACK_BOT_TOKEN or SLACK_WEBHOOK_URL in .env'
      });
    }

    const result = await chatService.checkConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/integrations/chat/status
 * Get chat integration status
 */
router.get('/chat/status', async (req, res) => {
  try {
    const status = {
      configured: chatService.configured,
      provider: chatService.provider,
      mode: chatService.token ? 'bot' : (chatService.webhookUrl ? 'webhook' : 'none')
    };

    if (chatService.configured) {
      const connectionCheck = await chatService.checkConnection();
      status.connected = connectionCheck.connected;
      if (connectionCheck.team) status.team = connectionCheck.team;
      if (connectionCheck.user) status.user = connectionCheck.user;
      if (connectionCheck.message) status.message = connectionCheck.message;
    } else {
      status.connected = false;
    }

    res.json(status);
  } catch (error) {
    res.status(500).json({
      configured: chatService.configured,
      connected: false,
      error: error.message
    });
  }
});

// ========================================
// WEBHOOK ENDPOINTS
// ========================================

/**
 * POST /api/integrations/webhooks/crm
 * Receive webhooks from CRM
 */
router.post('/webhooks/crm', async (req, res) => {
  try {
    const { event, data } = req.body;

    log.info(`Received CRM webhook: ${event}`);

    // Handle different event types
    switch (event) {
      case 'deal.created':
        // Trigger automation for new deals
        if (supabase) {
          await triggerAutomation('deal_created', data);
        }
        break;

      case 'deal.updated':
        // Update linked project
        break;

      case 'task.completed':
        // Update linked action item
        if (data.externalId && supabase) {
          await supabase
            .from('action_items')
            .update({ status: 'done', updated_at: new Date().toISOString() })
            .eq('crm_task_id', data.externalId);
        }
        break;
    }

    res.json({ received: true, event });

  } catch (error) {
    log.error('Error processing CRM webhook:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/integrations/webhooks/chat
 * Receive webhooks from chat (e.g., slash commands)
 */
router.post('/webhooks/chat', async (req, res) => {
  try {
    const { command, text, userId, channelId } = req.body;

    log.info(`Received chat webhook: ${command}`);

    // Handle slash commands
    switch (command) {
      case '/entomate-recap':
        // Send recent meeting recap
        break;

      case '/entomate-tasks':
        // List open tasks
        break;

      case '/entomate-ask':
        // Answer question about meetings
        break;
    }

    res.json({ received: true, command });

  } catch (error) {
    log.error('Error processing chat webhook:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// STATUS AND LOGS
// ========================================

/**
 * GET /api/integrations/status
 * Get status of all integrations
 */
router.get('/status', authenticate, async (req, res) => {
  const status = {
    gemini: {
      configured: ai.isConfigured(),
      provider: ai.getProviderName(),
      status: ai.isConfigured() ? 'connected' : 'not configured'
    },
    supabase: {
      configured: !!supabase,
      status: supabase ? 'connected' : 'not configured'
    },
    crm: {
      configured: crmService.configured,
      provider: crmService.provider,
      status: crmService.configured ? 'connected' : 'not configured'
    },
    chat: {
      configured: chatService.configured,
      provider: chatService.provider,
      mode: chatService.token ? 'bot' : (chatService.webhookUrl ? 'webhook' : 'none'),
      status: chatService.configured ? 'connected' : 'not configured'
    }
  };

  res.json({ integrations: status });
});

/**
 * POST /api/integrations/crm/test
 * Test CRM connection
 */
router.post('/crm/test', authenticate, async (req, res) => {
  try {
    if (!crmService.configured) {
      return res.status(400).json({
        success: false,
        error: 'CRM not configured. Set CRM_API_KEY in .env'
      });
    }

    const result = await crmService.checkConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/integrations/crm/status
 * Get CRM sync status summary
 */
router.get('/crm/status', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({
        connected: crmService.configured,
        provider: crmService.provider,
        stats: { totalSynced: 0, totalFailed: 0, totalPending: 0 }
      });
    }

    const { data: items } = await supabase
      .from('action_items')
      .select('crm_sync_status');

    const synced = items?.filter(i => i.crm_sync_status === 'synced').length || 0;
    const failed = items?.filter(i => i.crm_sync_status === 'failed').length || 0;
    const pending = items?.filter(i => i.crm_sync_status === 'pending').length || 0;

    res.json({
      connected: crmService.configured,
      provider: crmService.provider,
      stats: {
        totalSynced: synced,
        totalFailed: failed,
        totalPending: pending
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/integrations/crm/sync-logs
 * Get recent CRM sync logs
 */
router.get('/crm/sync-logs', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    if (!supabase) {
      return res.json({ logs: [], count: 0 });
    }

    const { data: logs } = await supabase
      .from('action_items')
      .select('id, task_description, crm_sync_status, last_sync_attempt, last_sync_error, crm_task_id')
      .not('last_sync_attempt', 'is', null)
      .order('last_sync_attempt', { ascending: false })
      .limit(parseInt(limit));

    res.json({
      logs: logs || [],
      count: logs?.length || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/integrations/logs
 * Get integration sync logs
 */
router.get('/logs', async (req, res) => {
  try {
    const { limit = 50, offset = 0, status, sourceType, destinationType } = req.query;

    if (!supabase) {
      return res.json({ logs: [], count: 0 });
    }

    let query = supabase
      .from('integration_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (sourceType) {
      query = query.eq('source_type', sourceType);
    }

    if (destinationType) {
      query = query.eq('destination_type', destinationType);
    }

    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: logs, error, count } = await query;

    if (error) throw error;

    res.json({
      logs: logs || [],
      count: count || 0
    });

  } catch (error) {
    log.error('Error fetching logs:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/integrations/retry
 * Retry failed integrations
 */
router.post('/retry', authenticate, validate(schemas.retry), async (req, res) => {
  try {
    const { logIds } = req.body;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Get failed logs
    let query = supabase
      .from('integration_logs')
      .select('*')
      .eq('status', 'failed');

    if (logIds && logIds.length > 0) {
      query = query.in('id', logIds);
    }

    query = query.limit(50);

    const { data: logs } = await query;

    const results = { retried: 0, failed: 0 };

    for (const log of logs || []) {
      try {
        // Retry based on destination type
        if (log.destination_type === 'crm' && log.source_type === 'action_item') {
          // Re-sync action item
          await supabase
            .from('action_items')
            .update({ crm_sync_status: 'pending' })
            .eq('id', log.source_id);
        }

        // Update log status
        await supabase
          .from('integration_logs')
          .update({
            status: 'retrying',
            retry_count: (log.retry_count || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', log.id);

        results.retried++;
      } catch {
        results.failed++;
      }
    }

    res.json(results);

  } catch (error) {
    log.error('Error retrying integrations:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// HELPER FUNCTIONS
// ========================================

function formatChatRecapFallback(meeting, actionItems) {
  const sentimentEmoji = {
    'Positive': '😊',
    'Neutral': '😐',
    'Negative': '😟'
  }[meeting.sentiment_label] || '📝';

  let message = `${sentimentEmoji} *Meeting Recap: ${meeting.title}*\n\n`;
  message += `*Summary:* ${meeting.summary}\n\n`;

  if (meeting.key_points?.length > 0) {
    message += `*Key Points:*\n`;
    meeting.key_points.forEach(point => {
      message += `• ${point}\n`;
    });
    message += '\n';
  }

  if (meeting.decisions?.length > 0) {
    message += `*Decisions:*\n`;
    meeting.decisions.forEach(decision => {
      message += `✓ ${decision}\n`;
    });
    message += '\n';
  }

  if (actionItems?.length > 0) {
    message += `*Action Items (${actionItems.length}):*\n`;
    actionItems.forEach(item => {
      const priorityEmoji = { 'high': '🔴', 'medium': '🟡', 'low': '🟢' }[item.priority] || '';
      message += `${priorityEmoji} ${item.task_description}`;
      if (item.assigned_to_name) message += ` → ${item.assigned_to_name}`;
      if (item.due_date) message += ` (due ${item.due_date})`;
      message += '\n';
    });
  }

  return message;
}

// ========================================
// LOGOS VISION (SHARED HUB) ENDPOINTS
// ========================================

/**
 * GET /api/integrations/logos/status
 * Check Logos Vision (Hub) connection status
 */
router.get('/logos/status', async (req, res) => {
  try {
    const status = await logosVisionService.checkConnection()
    res.json({ provider: 'logos_vision', ...status })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/integrations/logos/contacts
 * Get recent contacts from the shared hub
 */
router.get('/logos/contacts', async (req, res) => {
  try {
    const { limit = 10 } = req.query
    const contacts = await logosVisionService.getRecentContacts({ limit: parseInt(limit) })
    res.json({ contacts, count: contacts.length, source: 'logos_vision' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/integrations/logos/lookup
 * Look up a contact by email
 */
router.post('/logos/lookup', authenticate, validate(schemas.lookup), async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email required' })
    const contact = await logosVisionService.lookupContact(email)
    res.json({ contact, found: !!contact })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/integrations/logos/deals
 * Get deal events from Logos Vision through the hub
 */
router.get('/logos/deals', async (req, res) => {
  try {
    const { limit = 20 } = req.query
    const deals = await logosVisionService.getDeals({ limit: parseInt(limit) })
    res.json({ deals, count: deals.length, source: 'logos_vision' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ========================================
// HELPER FUNCTIONS
// ========================================

async function triggerAutomation(triggerType, data) {
  // Call the automations trigger endpoint internally
  try {
    const axios = require('axios');
    await axios.post(`http://localhost:${process.env.PORT || 3000}/api/automations/trigger`, {
      triggerType,
      triggerData: data
    });
  } catch (error) {
    log.error('Failed to trigger automation:', error.message);
  }
}

module.exports = router;
