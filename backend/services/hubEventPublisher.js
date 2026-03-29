/**
 * Hub Event Publisher — Publishes cross-app events to the shared hub
 *
 * Events flow through the cross_app_events table, which acts as
 * a lightweight event bus between Entomate, Logos Vision, Pulse, etc.
 */

const { getHubClient } = require('./hubClient')
const log = require('../utils/log');

const SOURCE_APP = 'entomate'

class HubEventPublisher {
  /**
   * Publish an event to the hub
   * @param {Object} event
   * @param {string} event.type - e.g. 'meeting.completed', 'action_item.created'
   * @param {string} event.category - 'meeting', 'contact', 'deal', 'agent', 'workflow'
   * @param {Object} event.payload - Event data
   * @param {string} [event.targetApp] - Specific target app, or null for broadcast
   * @param {string} [event.userId] - Hub user ID
   * @param {string} [event.organizationId] - Hub org ID
   * @param {string} [event.correlationId] - For linking related events
   */
  async publish({ type, category, payload, targetApp = null, userId = null, organizationId = null, correlationId = null }) {
    const hub = getHubClient()
    if (!hub) {
      log.info('[HubEventPublisher] Hub not configured, skipping event:', type)
      return null
    }

    try {
      const { data, error } = await hub
        .from('cross_app_events')
        .insert({
          source_app: SOURCE_APP,
          target_app: targetApp,
          event_type: type,
          event_category: category,
          payload,
          user_id: userId,
          organization_id: organizationId,
          correlation_id: correlationId
        })
        .select('id')
        .single()

      if (error) throw error
      log.info(`[HubEventPublisher] Published ${type} → ${targetApp || 'broadcast'} (${data.id})`)
      return data.id
    } catch (err) {
      log.error(`[HubEventPublisher] Failed to publish ${type}:`, err.message)
      return null
    }
  }

  // ── Convenience methods ──

  async meetingCompleted(meeting) {
    return this.publish({
      type: 'meeting.completed',
      category: 'meeting',
      payload: {
        meetingId: meeting.id,
        title: meeting.title,
        summary: meeting.summary,
        sentiment: meeting.sentiment_label,
        keyPoints: meeting.key_points,
        decisions: meeting.decisions,
        attendees: meeting.attendees,
        duration: meeting.duration_minutes,
        actionItemCount: meeting.action_items?.length || 0,
        createdAt: meeting.created_at
      }
    })
  }

  async actionItemCreated(item, meetingId) {
    return this.publish({
      type: 'action_item.created',
      category: 'meeting',
      targetApp: 'logos_crm',
      payload: {
        itemId: item.id,
        meetingId,
        task: item.task_description,
        assignedTo: item.assigned_to_name,
        assignedEmail: item.assigned_to_email,
        dueDate: item.due_date,
        priority: item.priority,
        context: item.context
      }
    })
  }

  async actionItemCompleted(itemId, task) {
    return this.publish({
      type: 'action_item.completed',
      category: 'meeting',
      payload: { itemId, task }
    })
  }

  async contactDiscovered(contact, meetingId) {
    return this.publish({
      type: 'contact.discovered',
      category: 'contact',
      targetApp: 'logos_crm',
      payload: {
        email: contact.email,
        name: contact.name,
        company: contact.company,
        meetingId,
        source: 'meeting_attendee'
      }
    })
  }

  async notifyPulse({ title, body, channel, urgency = 'normal' }) {
    return this.publish({
      type: 'notification.send',
      category: 'workflow',
      targetApp: 'pulse',
      payload: { title, body, channel, urgency }
    })
  }
}

module.exports = new HubEventPublisher()
