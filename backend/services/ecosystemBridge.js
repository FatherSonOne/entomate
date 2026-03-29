/* global fetch, AbortSignal */
/**
 * Ecosystem Bridge — Cross-app communication service
 *
 * Replaces the hub-based pattern (hubEventPublisher + hubClient) with
 * direct HTTP calls between apps. Each app has an inbound endpoint that
 * validates service tokens and routes events to local handlers.
 *
 * Key design principles:
 * - Feature detection: always check isConnected() before sending
 * - Error resilience: cross-app failures never crash local operations
 * - Audit trail: all events logged to ecosystem_events table
 * - Retry support: failed events can be retried via API
 */

const { v4: uuidv4 } = require('uuid');
const { supabaseAdmin } = require('../config/supabase');
const log = require('../utils/log');

const SOURCE_APP = 'entomate';

// Supabase edge functions require an anon key to pass the API gateway.
// The key is stored in ecosystem_config.features.gateway_key for each app.

class EcosystemBridge {
  constructor() {
    this._config = new Map();   // app_name -> config row
    this._initialized = false;
  }

  // ── Initialization ──

  async initialize() {
    if (!supabaseAdmin) {
      log.warn('[EcosystemBridge] Supabase admin not configured, bridge disabled');
      return;
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('ecosystem_config')
        .select('*');

      if (error) throw error;

      this._config.clear();
      for (const row of (data || [])) {
        this._config.set(row.app_name, row);
      }

      this._initialized = true;
      log.info(`[EcosystemBridge] Initialized with ${this._config.size} connected app(s)`);
    } catch (err) {
      log.error('[EcosystemBridge] Failed to initialize:', err.message);
    }
  }

  /**
   * Reload config from DB (call after settings change)
   */
  async reload() {
    this._initialized = false;
    await this.initialize();
  }

  // ── Status & Feature Detection ──

  isConnected(appName) {
    const cfg = this._config.get(appName);
    return !!(cfg && cfg.enabled && cfg.api_url
      && cfg.service_token && !cfg.service_token.startsWith('PLACEHOLDER'));
  }

  getStatus() {
    return {
      initialized: this._initialized,
      pulse: this.isConnected('pulse'),
      logosVision: this.isConnected('logos_vision'),
      connectedApps: Array.from(this._config.entries())
        .filter(([, cfg]) => cfg.enabled)
        .map(([name, cfg]) => ({
          name,
          displayName: cfg.display_name,
          lastHeartbeat: cfg.last_heartbeat,
          features: cfg.features || {}
        }))
    };
  }

  hasFeature(appName, feature) {
    const cfg = this._config.get(appName);
    return !!(cfg && cfg.enabled && cfg.features && cfg.features[feature]);
  }

  getConfig(appName) {
    return this._config.get(appName) || null;
  }

  // ── Core Event Sending ──

  /**
   * Send an event to a specific app via HTTP
   * @returns {Promise<{success: boolean, eventLogId?: string, error?: string}>}
   */
  async sendEvent(targetApp, event) {
    if (!this.isConnected(targetApp)) {
      return { success: false, error: `${targetApp} is not connected` };
    }

    const cfg = this._config.get(targetApp);
    const eventId = event.id || uuidv4();
    const startTime = Date.now();

    const ecosystemEvent = {
      id: eventId,
      source: SOURCE_APP,
      timestamp: new Date().toISOString(),
      eventType: event.eventType,
      entityType: event.entityType || null,
      entityId: event.entityId || null,
      data: event.data || {},
      targetApp
    };

    // Log the outbound attempt
    let eventLogId = null;
    try {
      const { data: logEntry } = await supabaseAdmin
        .from('ecosystem_events')
        .insert({
          event_id: eventId,
          source: SOURCE_APP,
          target_app: targetApp,
          event_type: event.eventType,
          entity_type: event.entityType || null,
          entity_id: event.entityId || null,
          direction: 'outbound',
          status: 'pending',
          payload: ecosystemEvent
        })
        .select('id')
        .single();

      eventLogId = logEntry?.id;
    } catch (logErr) {
      log.warn('[EcosystemBridge] Failed to log outbound event:', logErr.message);
    }

    // Send HTTP request
    try {
      // Supabase edge functions need an anon key in Authorization header
      const anonKey = cfg.features?.gateway_key;

      const headers = {
        'Content-Type': 'application/json',
        'X-Ecosystem-Token': cfg.service_token,
        'X-Ecosystem-Source': SOURCE_APP,
        'X-Ecosystem-Event-Id': eventId
      };
      if (anonKey) {
        headers['Authorization'] = `Bearer ${anonKey}`;
      }

      const response = await fetch(cfg.api_url, {
        method: 'POST',
        headers,
        body: JSON.stringify(ecosystemEvent),
        signal: AbortSignal.timeout(15000)  // 15s timeout
      });

      const processingTime = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No response body');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const responseData = await response.json().catch(() => ({}));

      // Update event log to delivered
      if (eventLogId) {
        await supabaseAdmin
          .from('ecosystem_events')
          .update({
            status: 'delivered',
            response_data: responseData,
            processing_time_ms: processingTime
          })
          .eq('id', eventLogId);
      }

      // Update heartbeat
      await supabaseAdmin
        .from('ecosystem_config')
        .update({ last_heartbeat: new Date().toISOString() })
        .eq('app_name', targetApp);

      log.info(`[EcosystemBridge] ${event.eventType} → ${targetApp} (${processingTime}ms)`);
      return { success: true, eventLogId };

    } catch (err) {
      const processingTime = Date.now() - startTime;

      // Update event log to failed
      if (eventLogId) {
        try {
          await supabaseAdmin
            .from('ecosystem_events')
            .update({
              status: 'failed',
              error_message: err.message,
              processing_time_ms: processingTime,
              next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()  // retry in 5 min
            })
            .eq('id', eventLogId);
        } catch {
          // Swallow — logging failure shouldn't mask the original error
        }
      }

      log.error(`[EcosystemBridge] Failed ${event.eventType} → ${targetApp}:`, err.message);
      return { success: false, error: err.message, eventLogId };
    }
  }

  /**
   * Broadcast an event to all connected apps
   */
  async broadcast(event) {
    const results = {};
    for (const [appName] of this._config) {
      if (this.isConnected(appName)) {
        results[appName] = await this.sendEvent(appName, event);
      }
    }
    return results;
  }

  /**
   * Retry a previously failed event
   */
  async retryEvent(eventLogId) {
    if (!supabaseAdmin) return { success: false, error: 'Database not configured' };

    const { data: event, error } = await supabaseAdmin
      .from('ecosystem_events')
      .select('*')
      .eq('id', eventLogId)
      .single();

    if (error || !event) {
      return { success: false, error: 'Event not found' };
    }

    if (event.status !== 'failed') {
      return { success: false, error: `Event status is '${event.status}', not 'failed'` };
    }

    // Increment retry count
    await supabaseAdmin
      .from('ecosystem_events')
      .update({ retry_count: (event.retry_count || 0) + 1, status: 'pending' })
      .eq('id', eventLogId);

    // Re-send
    const result = await this.sendEvent(event.target_app, {
      id: event.event_id,
      eventType: event.event_type,
      entityType: event.entity_type,
      entityId: event.entity_id,
      data: event.payload?.data || {}
    });

    return result;
  }

  // ── Convenience: Pulse ──

  /**
   * Post a bot message to Pulse
   */
  async postToPulse({ channel, message, title, urgency = 'normal', metadata = {} }) {
    return this.sendEvent('pulse', {
      eventType: 'message.bot_post',
      entityType: 'message',
      data: {
        channel: channel || 'entomate-meetings',
        title,
        message,
        urgency,
        senderName: 'Entomate Bot',
        senderType: 'bot',
        metadata
      }
    });
  }

  /**
   * Send a notification through Pulse
   */
  async notifyViaPulse({ title, body, urgency = 'normal', recipientIds = [] }) {
    return this.sendEvent('pulse', {
      eventType: 'notification.send',
      entityType: 'notification',
      data: { title, body, urgency, recipientIds }
    });
  }

  // ── Convenience: Logos Vision ──

  /**
   * Sync a processed meeting to Logos Vision (activity + tasks)
   */
  async syncMeetingToLogosVision({ meeting, actionItems = [] }) {
    const results = { activity: null, tasks: [] };

    // 1. Create activity in LV
    results.activity = await this.sendEvent('logos_vision', {
      eventType: 'meeting.processed',
      entityType: 'meeting',
      entityId: meeting.id,
      data: {
        meetingId: meeting.id,
        title: meeting.title,
        summary: meeting.summary,
        sentiment: meeting.sentiment_label,
        keyPoints: meeting.key_points || [],
        decisions: meeting.decisions || [],
        attendees: meeting.attendees || [],
        duration: meeting.duration_minutes,
        actionItemCount: actionItems.length,
        createdAt: meeting.created_at
      }
    });

    // 2. Sync each action item as a task
    for (const item of actionItems) {
      const taskResult = await this.sendEvent('logos_vision', {
        eventType: 'task.created',
        entityType: 'action_item',
        entityId: item.id,
        data: {
          actionItemId: item.id,
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          task: item.task_description,
          assignedTo: item.assigned_to_name,
          assignedEmail: item.assigned_to_email,
          dueDate: item.due_date,
          priority: item.priority,
          context: item.context
        }
      });

      results.tasks.push(taskResult);

      // If LV returns a remote task ID, store the mapping
      if (taskResult.success && supabaseAdmin) {
        try {
          const eventLog = await supabaseAdmin
            .from('ecosystem_events')
            .select('response_data')
            .eq('id', taskResult.eventLogId)
            .single();

          const remoteTaskId = eventLog?.data?.response_data?.taskId;
          if (remoteTaskId) {
            await supabaseAdmin
              .from('ecosystem_entity_map')
              .upsert({
                local_entity_type: 'action_item',
                local_entity_id: item.id,
                remote_app: 'logos_vision',
                remote_entity_type: 'task',
                remote_entity_id: remoteTaskId
              }, { onConflict: 'local_entity_type,local_entity_id,remote_app' });
          }
        } catch (mapErr) {
          log.warn('[EcosystemBridge] Entity mapping failed:', mapErr.message);
        }
      }
    }

    return results;
  }

  /**
   * Notify LV about a completed task
   */
  async syncTaskCompleted(taskId, crmTaskId) {
    return this.sendEvent('logos_vision', {
      eventType: 'task.completed',
      entityType: 'action_item',
      entityId: taskId,
      data: { taskId, crmTaskId, completedAt: new Date().toISOString() }
    });
  }

  /**
   * Discover a contact from a meeting attendee
   */
  async syncContactToLogosVision({ email, name, company, meetingId }) {
    return this.sendEvent('logos_vision', {
      eventType: 'contact.discovered',
      entityType: 'contact',
      data: { email, name, company, meetingId, source: 'meeting_attendee' }
    });
  }

  // ── Event Log Queries ──

  async getRecentEvents({ limit = 20, direction, status } = {}) {
    if (!supabaseAdmin) return [];

    let query = supabaseAdmin
      .from('ecosystem_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (direction) query = query.eq('direction', direction);
    if (status) query = query.eq('status', status);

    const { data } = await query;
    return data || [];
  }

  async getEventStats() {
    if (!supabaseAdmin) return null;

    const { data: events } = await supabaseAdmin
      .from('ecosystem_events')
      .select('status, direction')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (!events) return null;

    return {
      total: events.length,
      delivered: events.filter(e => e.status === 'delivered').length,
      failed: events.filter(e => e.status === 'failed').length,
      pending: events.filter(e => e.status === 'pending').length,
      inbound: events.filter(e => e.direction === 'inbound').length,
      outbound: events.filter(e => e.direction === 'outbound').length
    };
  }

  // ── Health Check ──

  async testConnection(appName) {
    if (!this._config.has(appName)) {
      return { success: false, error: `${appName} is not configured` };
    }

    const result = await this.sendEvent(appName, {
      eventType: 'heartbeat',
      data: { timestamp: new Date().toISOString() }
    });

    return {
      success: result.success,
      latencyMs: result.success ? undefined : undefined,
      error: result.error
    };
  }
}

// Singleton — lazy-initialized on first use
const bridge = new EcosystemBridge();

async function getEcosystemBridge() {
  if (!bridge._initialized) {
    await bridge.initialize();
  }
  return bridge;
}

module.exports = { EcosystemBridge, getEcosystemBridge, ecosystemBridge: bridge };
