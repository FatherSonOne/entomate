/**
 * Slack Event Listener
 * Subscribes to shared-hub events and triggers Slack notifications
 */

const slackNotifier = require('./slackNotifier');
const logger = require('./logger');

// Track subscription status
let isSubscribed = false;
let unsubscribeFunctions = [];

// ========================================
// EVENT HANDLERS
// ========================================

/**
 * Handle meeting.completed events
 */
async function handleMeetingCompleted(event) {
  try {
    const { meeting, actionItems } = event.payload || {};

    if (!meeting) {
      logger.warn('[SlackEventListener] Meeting data missing in event payload');
      return;
    }

    logger.info('[SlackEventListener] Processing meeting.completed event', {
      meetingId: meeting.id,
      title: meeting.title
    });

    const result = await slackNotifier.sendMeetingSummary(
      meeting,
      actionItems || []
    );

    if (result.success) {
      logger.info('[SlackEventListener] Meeting notification sent', {
        meetingId: meeting.id,
        channel: result.channel
      });
    } else if (result.skipped) {
      logger.debug('[SlackEventListener] Meeting notification skipped', {
        reason: result.reason
      });
    } else {
      logger.warn('[SlackEventListener] Meeting notification failed', {
        error: result.error
      });
    }
  } catch (error) {
    logger.error('[SlackEventListener] Error handling meeting.completed:', error);
  }
}

/**
 * Handle deal.won events
 */
async function handleDealWon(event) {
  try {
    const { deal } = event.payload || {};

    if (!deal) {
      logger.warn('[SlackEventListener] Deal data missing in event payload');
      return;
    }

    logger.info('[SlackEventListener] Processing deal.won event', {
      dealId: deal.id,
      name: deal.name
    });

    const result = await slackNotifier.sendDealAlert(deal);

    if (result.success) {
      logger.info('[SlackEventListener] Deal notification sent', {
        dealId: deal.id,
        channel: result.channel
      });
    } else if (result.skipped) {
      logger.debug('[SlackEventListener] Deal notification skipped', {
        reason: result.reason
      });
    } else {
      logger.warn('[SlackEventListener] Deal notification failed', {
        error: result.error
      });
    }
  } catch (error) {
    logger.error('[SlackEventListener] Error handling deal.won:', error);
  }
}

/**
 * Handle meeting.action_item_created events
 */
async function handleActionItemCreated(event) {
  try {
    const { actionItem, meetingId } = event.payload || {};

    if (!actionItem) {
      logger.warn('[SlackEventListener] Action item data missing in event payload');
      return;
    }

    logger.info('[SlackEventListener] Processing action_item_created event', {
      actionItemId: actionItem.id,
      meetingId
    });

    // Optionally fetch meeting details
    let meeting = null;
    if (meetingId) {
      try {
        const { supabase } = require('../config/supabase');
        if (supabase) {
          const { data } = await supabase
            .from('meetings')
            .select('id, title')
            .eq('id', meetingId)
            .single();
          meeting = data;
        }
      } catch (e) {
        // Ignore - meeting lookup is optional
      }
    }

    const result = await slackNotifier.sendActionItemCreated(actionItem, meeting);

    if (result.success) {
      logger.info('[SlackEventListener] Action item notification sent', {
        actionItemId: actionItem.id,
        channel: result.channel
      });
    } else if (result.skipped) {
      logger.debug('[SlackEventListener] Action item notification skipped', {
        reason: result.reason
      });
    }
  } catch (error) {
    logger.error('[SlackEventListener] Error handling action_item_created:', error);
  }
}

// ========================================
// SUBSCRIPTION MANAGEMENT
// ========================================

/**
 * Initialize event subscriptions using shared-hub
 */
async function initialize() {
  if (isSubscribed) {
    logger.warn('[SlackEventListener] Already subscribed to events');
    return;
  }

  // Check if slack is configured
  if (!slackNotifier.configured) {
    logger.info('[SlackEventListener] Slack not configured, skipping event subscriptions');
    return;
  }

  try {
    // Try to import shared-hub events module
    let sharedHub;
    try {
      // Try local shared-hub in project
      sharedHub = require('../../shared-hub/dist/events');
    } catch (e1) {
      try {
        // Try external shared-hub package
        sharedHub = require('@entomate/shared-hub/events');
      } catch (e2) {
        try {
          // Try from parent directory (monorepo structure)
          sharedHub = require('../../../shared-hub/dist/events');
        } catch (e3) {
          logger.info('[SlackEventListener] shared-hub not available, using local event emitter fallback');
          return initializeLocalFallback();
        }
      }
    }

    const { onEvent } = sharedHub;

    // Subscribe to meeting.completed events
    const unsubMeeting = onEvent(
      'entomate',
      'meeting.completed',
      handleMeetingCompleted
    );
    unsubscribeFunctions.push(unsubMeeting);

    // Subscribe to deal.won events (from Logos CRM)
    const unsubDeal = onEvent(
      'entomate',
      'deal.won',
      handleDealWon
    );
    unsubscribeFunctions.push(unsubDeal);

    // Subscribe to action item created events
    const unsubActionItem = onEvent(
      'entomate',
      'meeting.action_item_created',
      handleActionItemCreated
    );
    unsubscribeFunctions.push(unsubActionItem);

    isSubscribed = true;
    logger.info('[SlackEventListener] Subscribed to shared-hub events');

  } catch (error) {
    logger.error('[SlackEventListener] Failed to subscribe to events:', error);
    // Fall back to local event emitter
    return initializeLocalFallback();
  }
}

/**
 * Local event emitter fallback when shared-hub is not available
 */
function initializeLocalFallback() {
  const EventEmitter = require('events');

  // Create a global event emitter if it doesn't exist
  if (!global.entomateEventEmitter) {
    global.entomateEventEmitter = new EventEmitter();
    global.entomateEventEmitter.setMaxListeners(50);
  }

  const emitter = global.entomateEventEmitter;

  // Subscribe to local events
  emitter.on('meeting.completed', handleMeetingCompleted);
  emitter.on('deal.won', handleDealWon);
  emitter.on('meeting.action_item_created', handleActionItemCreated);

  // Store cleanup functions
  unsubscribeFunctions.push(() => {
    emitter.removeListener('meeting.completed', handleMeetingCompleted);
    emitter.removeListener('deal.won', handleDealWon);
    emitter.removeListener('meeting.action_item_created', handleActionItemCreated);
  });

  isSubscribed = true;
  logger.info('[SlackEventListener] Using local event emitter fallback');

  return emitter;
}

/**
 * Emit an event (works with both shared-hub and local fallback)
 */
async function emitEvent(eventType, payload) {
  try {
    // Try shared-hub first
    let sharedHub;
    try {
      sharedHub = require('../../shared-hub/dist/events');
    } catch (e1) {
      try {
        sharedHub = require('@entomate/shared-hub/events');
      } catch (e2) {
        try {
          sharedHub = require('../../../shared-hub/dist/events');
        } catch (e3) {
          // Use local fallback
          if (global.entomateEventEmitter) {
            global.entomateEventEmitter.emit(eventType, { payload });
            return { success: true, method: 'local' };
          }
          return { success: false, error: 'No event system available' };
        }
      }
    }

    // Use shared-hub
    const eventTypeMap = {
      'meeting.completed': () => sharedHub.meetingEvents.completed(
        payload.meeting,
        payload.actionItems || [],
        payload.userId
      ),
      'deal.won': () => sharedHub.dealEvents.won(payload.deal, payload.userId),
      'meeting.action_item_created': () => sharedHub.meetingEvents.actionItemCreated(
        payload.actionItem,
        payload.meetingId,
        payload.userId
      )
    };

    if (eventTypeMap[eventType]) {
      await eventTypeMap[eventType]();
      return { success: true, method: 'shared-hub' };
    }

    return { success: false, error: `Unknown event type: ${eventType}` };

  } catch (error) {
    logger.error('[SlackEventListener] Failed to emit event:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Unsubscribe from all events
 */
function shutdown() {
  if (!isSubscribed) {
    return;
  }

  // Call all unsubscribe functions
  for (const unsub of unsubscribeFunctions) {
    try {
      if (typeof unsub === 'function') {
        unsub();
      }
    } catch (error) {
      logger.warn('[SlackEventListener] Error during unsubscribe:', error.message);
    }
  }

  unsubscribeFunctions = [];
  isSubscribed = false;
  logger.info('[SlackEventListener] Unsubscribed from all events');
}

/**
 * Get subscription status
 */
function getStatus() {
  return {
    subscribed: isSubscribed,
    slackConfigured: slackNotifier.configured,
    subscriptionCount: unsubscribeFunctions.length,
    settings: slackNotifier.getSettings()
  };
}

module.exports = {
  initialize,
  shutdown,
  emitEvent,
  getStatus,
  // Export handlers for direct use
  handleMeetingCompleted,
  handleDealWon,
  handleActionItemCreated
};
