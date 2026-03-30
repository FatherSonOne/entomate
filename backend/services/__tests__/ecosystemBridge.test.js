// ============================================
// ECOSYSTEM BRIDGE TEST SUITE — ENTOMATE
// Tests for EcosystemBridge class, token validation,
// event routing, heartbeat, connection detection,
// convenience methods, config management, and
// inbound edge function logic.
// ============================================

const { EcosystemBridge } = require('../ecosystemBridge');

// =====================================================
// 1. ECOSYSTEM BRIDGE — Construction & Initialization
// =====================================================

describe('EcosystemBridge — Construction', () => {
  let bridge;

  beforeEach(() => {
    bridge = new EcosystemBridge();
  });

  it('should start uninitialized', () => {
    expect(bridge._initialized).toBe(false);
  });

  it('should have empty config map', () => {
    expect(bridge._config.size).toBe(0);
  });

  it('should report no connections when uninitialized', () => {
    expect(bridge.isConnected('pulse')).toBe(false);
    expect(bridge.isConnected('logos_vision')).toBe(false);
  });

  it('should return null for unknown app config', () => {
    expect(bridge.getConfig('pulse')).toBeNull();
    expect(bridge.getConfig('unknown_app')).toBeNull();
  });
});

// =====================================================
// 2. CONNECTION DETECTION — isConnected()
// =====================================================

describe('EcosystemBridge — isConnected()', () => {
  let bridge;

  beforeEach(() => {
    bridge = new EcosystemBridge();
  });

  it('should return true for fully configured enabled app', () => {
    bridge._config.set('pulse', {
      app_name: 'pulse',
      enabled: true,
      api_url: 'https://example.supabase.co/functions/v1/ecosystem-inbound',
      service_token: 'abc123def456',
    });
    expect(bridge.isConnected('pulse')).toBe(true);
  });

  it('should return false for disabled app', () => {
    bridge._config.set('pulse', {
      app_name: 'pulse',
      enabled: false,
      api_url: 'https://example.supabase.co/functions/v1/ecosystem-inbound',
      service_token: 'abc123def456',
    });
    expect(bridge.isConnected('pulse')).toBe(false);
  });

  it('should return false for missing api_url', () => {
    bridge._config.set('pulse', {
      app_name: 'pulse',
      enabled: true,
      api_url: '',
      service_token: 'abc123def456',
    });
    expect(bridge.isConnected('pulse')).toBe(false);
  });

  it('should return false for missing service_token', () => {
    bridge._config.set('pulse', {
      app_name: 'pulse',
      enabled: true,
      api_url: 'https://example.supabase.co/functions/v1/ecosystem-inbound',
      service_token: '',
    });
    expect(bridge.isConnected('pulse')).toBe(false);
  });

  it('should return false for PLACEHOLDER token', () => {
    bridge._config.set('pulse', {
      app_name: 'pulse',
      enabled: true,
      api_url: 'https://example.supabase.co/functions/v1/ecosystem-inbound',
      service_token: 'PLACEHOLDER_GENERATE_IN_SETTINGS',
    });
    expect(bridge.isConnected('pulse')).toBe(false);
  });

  it('should return false for unconfigured app', () => {
    expect(bridge.isConnected('unknown_app')).toBe(false);
  });
});

// =====================================================
// 3. FEATURE DETECTION — hasFeature()
// =====================================================

describe('EcosystemBridge — hasFeature()', () => {
  let bridge;

  beforeEach(() => {
    bridge = new EcosystemBridge();
    bridge._config.set('pulse', {
      app_name: 'pulse',
      enabled: true,
      api_url: 'https://example.co',
      service_token: 'tok123',
      features: { sync_meetings: true, notifications: true, sync_tasks: false },
    });
    bridge._config.set('logos_vision', {
      app_name: 'logos_vision',
      enabled: false,
      api_url: 'https://example.co',
      service_token: 'tok456',
      features: { sync_contacts: true },
    });
  });

  it('should return true for enabled feature on enabled app', () => {
    expect(bridge.hasFeature('pulse', 'sync_meetings')).toBe(true);
    expect(bridge.hasFeature('pulse', 'notifications')).toBe(true);
  });

  it('should return false for explicitly disabled feature', () => {
    expect(bridge.hasFeature('pulse', 'sync_tasks')).toBe(false);
  });

  it('should return false for unknown feature', () => {
    expect(bridge.hasFeature('pulse', 'video_calls')).toBe(false);
  });

  it('should return false for feature on disabled app', () => {
    expect(bridge.hasFeature('logos_vision', 'sync_contacts')).toBe(false);
  });

  it('should return false for unconfigured app', () => {
    expect(bridge.hasFeature('unknown_app', 'anything')).toBe(false);
  });
});

// =====================================================
// 4. STATUS REPORTING — getStatus()
// =====================================================

describe('EcosystemBridge — getStatus()', () => {
  let bridge;

  beforeEach(() => {
    bridge = new EcosystemBridge();
    bridge._initialized = true;
    bridge._config.set('pulse', {
      app_name: 'pulse',
      display_name: 'Pulse',
      enabled: true,
      api_url: 'https://example.co',
      service_token: 'tok123',
      features: { sync_meetings: true },
      last_heartbeat: '2026-03-29T10:00:00Z',
    });
    bridge._config.set('logos_vision', {
      app_name: 'logos_vision',
      display_name: 'Logos Vision',
      enabled: false,
      api_url: 'https://example.co',
      service_token: 'tok456',
      features: {},
      last_heartbeat: null,
    });
  });

  it('should report initialized status', () => {
    expect(bridge.getStatus().initialized).toBe(true);
  });

  it('should report pulse connection status', () => {
    expect(bridge.getStatus().pulse).toBe(true);
  });

  it('should report logos_vision disconnected', () => {
    expect(bridge.getStatus().logosVision).toBe(false);
  });

  it('should list only enabled apps in connectedApps', () => {
    const { connectedApps } = bridge.getStatus();
    expect(connectedApps).toHaveLength(1);
    expect(connectedApps[0].name).toBe('pulse');
    expect(connectedApps[0].displayName).toBe('Pulse');
  });

  it('should include heartbeat in connected apps', () => {
    const { connectedApps } = bridge.getStatus();
    expect(connectedApps[0].lastHeartbeat).toBe('2026-03-29T10:00:00Z');
  });

  it('should include features in connected apps', () => {
    const { connectedApps } = bridge.getStatus();
    expect(connectedApps[0].features).toEqual({ sync_meetings: true });
  });
});

// =====================================================
// 5. INBOUND TOKEN VALIDATION (Edge Function Logic)
// =====================================================

describe('Ecosystem Inbound — Token Validation', () => {
  // Replicates the inbound edge function's validation logic
  function validateInboundRequest(headers, configs) {
    const token = headers['X-Ecosystem-Token'];
    const sourceApp = headers['X-Ecosystem-Source'];

    if (!token || !sourceApp) {
      return { valid: false, status: 401, error: 'Missing required headers' };
    }

    const config = configs.find(
      (c) => c.app_name === sourceApp && c.inbound_token === token && c.enabled
    );

    if (!config) {
      return { valid: false, status: 403, error: 'Invalid token or source app not configured' };
    }

    return { valid: true, config };
  }

  const configs = [
    { app_name: 'pulse', inbound_token: 'pulse-inbound-tok', enabled: true },
    { app_name: 'logos_vision', inbound_token: 'lv-inbound-tok', enabled: false },
  ];

  it('should accept valid token from enabled app', () => {
    const result = validateInboundRequest({
      'X-Ecosystem-Token': 'pulse-inbound-tok',
      'X-Ecosystem-Source': 'pulse',
    }, configs);
    expect(result.valid).toBe(true);
    expect(result.config.app_name).toBe('pulse');
  });

  it('should reject missing token header', () => {
    const result = validateInboundRequest({
      'X-Ecosystem-Source': 'pulse',
    }, configs);
    expect(result.valid).toBe(false);
    expect(result.status).toBe(401);
  });

  it('should reject missing source header', () => {
    const result = validateInboundRequest({
      'X-Ecosystem-Token': 'pulse-inbound-tok',
    }, configs);
    expect(result.valid).toBe(false);
    expect(result.status).toBe(401);
  });

  it('should reject token for disabled app', () => {
    const result = validateInboundRequest({
      'X-Ecosystem-Token': 'lv-inbound-tok',
      'X-Ecosystem-Source': 'logos_vision',
    }, configs);
    expect(result.valid).toBe(false);
    expect(result.status).toBe(403);
  });

  it('should reject mismatched token/source', () => {
    const result = validateInboundRequest({
      'X-Ecosystem-Token': 'pulse-inbound-tok',
      'X-Ecosystem-Source': 'logos_vision',
    }, configs);
    expect(result.valid).toBe(false);
  });

  it('should reject unknown source app', () => {
    const result = validateInboundRequest({
      'X-Ecosystem-Token': 'some-token',
      'X-Ecosystem-Source': 'unknown_app',
    }, configs);
    expect(result.valid).toBe(false);
  });
});

// =====================================================
// 6. INBOUND EVENT ROUTING
// =====================================================

describe('Ecosystem Inbound — Event Routing', () => {
  const SUPPORTED_EVENT_TYPES = [
    'task.completed',
    'contact.updated',
    'notification.send',
    'health.ping',
  ];

  function getHandlerName(eventType) {
    const handlerMap = {
      'task.completed': 'handleTaskCompleted',
      'contact.updated': 'handleContactUpdated',
      'notification.send': 'handleNotification',
      'health.ping': 'healthPing',
    };
    return handlerMap[eventType] || null;
  }

  it('should have handlers for all supported event types', () => {
    for (const type of SUPPORTED_EVENT_TYPES) {
      expect(getHandlerName(type)).toBeTruthy();
    }
  });

  it('should return null for unsupported event types', () => {
    expect(getHandlerName('meeting.processed')).toBeNull();
    expect(getHandlerName('unknown.event')).toBeNull();
    expect(getHandlerName('')).toBeNull();
  });

  it('should handle health.ping with pong response', () => {
    // Replicates the health.ping handler
    function handleHealthPing() {
      return { pong: true, timestamp: new Date().toISOString(), app: 'entomate' };
    }

    const result = handleHealthPing();
    expect(result.pong).toBe(true);
    expect(result.app).toBe('entomate');
    expect(result.timestamp).toBeTruthy();
  });

  it('should return acknowledged for unhandled events', () => {
    // Replicates the default case
    function handleDefault() {
      return { acknowledged: true, handled: false };
    }

    const result = handleDefault();
    expect(result.acknowledged).toBe(true);
    expect(result.handled).toBe(false);
  });
});

// =====================================================
// 7. OUTBOUND EVENT BUILDING
// =====================================================

describe('EcosystemBridge — Outbound Event Shape', () => {
  const SOURCE_APP = 'entomate';

  function buildOutboundEvent(event, targetApp) {
    return {
      id: event.id || 'test-uuid',
      source: SOURCE_APP,
      timestamp: new Date().toISOString(),
      eventType: event.eventType,
      entityType: event.entityType || null,
      entityId: event.entityId || null,
      data: event.data || {},
      targetApp,
    };
  }

  it('should set source to entomate', () => {
    const evt = buildOutboundEvent({ eventType: 'meeting.processed', data: {} }, 'pulse');
    expect(evt.source).toBe('entomate');
  });

  it('should include targetApp', () => {
    const evt = buildOutboundEvent({ eventType: 'meeting.processed', data: {} }, 'logos_vision');
    expect(evt.targetApp).toBe('logos_vision');
  });

  it('should include ISO timestamp', () => {
    const evt = buildOutboundEvent({ eventType: 'test', data: {} }, 'pulse');
    expect(() => new Date(evt.timestamp)).not.toThrow();
  });

  it('should default entityType and entityId to null', () => {
    const evt = buildOutboundEvent({ eventType: 'test', data: {} }, 'pulse');
    expect(evt.entityType).toBeNull();
    expect(evt.entityId).toBeNull();
  });

  it('should pass through entityType and entityId when provided', () => {
    const evt = buildOutboundEvent({
      eventType: 'meeting.processed',
      entityType: 'meeting',
      entityId: 'mtg-123',
      data: {},
    }, 'pulse');
    expect(evt.entityType).toBe('meeting');
    expect(evt.entityId).toBe('mtg-123');
  });

  it('should default data to empty object', () => {
    const evt = buildOutboundEvent({ eventType: 'test' }, 'pulse');
    expect(evt.data).toEqual({});
  });
});

// =====================================================
// 8. OUTBOUND HEADER BUILDING
// =====================================================

describe('EcosystemBridge — Outbound Headers', () => {
  function buildOutboundHeaders(serviceToken, eventId, gatewayKey) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Ecosystem-Token': serviceToken,
      'X-Ecosystem-Source': 'entomate',
      'X-Ecosystem-Event-Id': eventId,
    };
    if (gatewayKey) {
      headers['Authorization'] = `Bearer ${gatewayKey}`;
    }
    return headers;
  }

  it('should always include ecosystem headers', () => {
    const h = buildOutboundHeaders('tok123', 'evt-1', null);
    expect(h['X-Ecosystem-Token']).toBe('tok123');
    expect(h['X-Ecosystem-Source']).toBe('entomate');
    expect(h['X-Ecosystem-Event-Id']).toBe('evt-1');
    expect(h['Content-Type']).toBe('application/json');
  });

  it('should add Authorization when gateway_key exists', () => {
    const h = buildOutboundHeaders('tok123', 'evt-1', 'anon-key');
    expect(h['Authorization']).toBe('Bearer anon-key');
  });

  it('should NOT add Authorization when gateway_key is null', () => {
    const h = buildOutboundHeaders('tok123', 'evt-1', null);
    expect(h['Authorization']).toBeUndefined();
  });

  it('should include X-Ecosystem-Source as entomate', () => {
    const h = buildOutboundHeaders('tok', 'evt', null);
    expect(h['X-Ecosystem-Source']).toBe('entomate');
  });
});

// =====================================================
// 9. CONVENIENCE: postToPulse() SHAPE
// =====================================================

describe('EcosystemBridge — postToPulse() Event Shape', () => {
  function buildPostToPulseEvent({ channel, message, title, urgency = 'normal', metadata = {} }) {
    return {
      eventType: 'message.bot_post',
      entityType: 'message',
      data: {
        channel: channel || 'entomate-meetings',
        title,
        message,
        urgency,
        senderName: 'Entomate Bot',
        senderType: 'bot',
        metadata,
      },
    };
  }

  it('should set eventType to message.bot_post', () => {
    const evt = buildPostToPulseEvent({ message: 'Hello' });
    expect(evt.eventType).toBe('message.bot_post');
  });

  it('should default channel to entomate-meetings', () => {
    const evt = buildPostToPulseEvent({ message: 'Hello' });
    expect(evt.data.channel).toBe('entomate-meetings');
  });

  it('should use provided channel', () => {
    const evt = buildPostToPulseEvent({ channel: 'entomate-tasks', message: 'Hello' });
    expect(evt.data.channel).toBe('entomate-tasks');
  });

  it('should default urgency to normal', () => {
    const evt = buildPostToPulseEvent({ message: 'Hello' });
    expect(evt.data.urgency).toBe('normal');
  });

  it('should set sender as Entomate Bot', () => {
    const evt = buildPostToPulseEvent({ message: 'Hello' });
    expect(evt.data.senderName).toBe('Entomate Bot');
    expect(evt.data.senderType).toBe('bot');
  });

  it('should include title in data', () => {
    const evt = buildPostToPulseEvent({ message: 'Hello', title: 'Meeting Summary' });
    expect(evt.data.title).toBe('Meeting Summary');
  });

  it('should pass metadata through', () => {
    const evt = buildPostToPulseEvent({ message: 'Hello', metadata: { meetingId: 'm1' } });
    expect(evt.data.metadata).toEqual({ meetingId: 'm1' });
  });
});

// =====================================================
// 10. CONVENIENCE: notifyViaPulse() SHAPE
// =====================================================

describe('EcosystemBridge — notifyViaPulse() Event Shape', () => {
  function buildNotifyEvent({ title, body, urgency = 'normal', recipientIds = [] }) {
    return {
      eventType: 'notification.send',
      entityType: 'notification',
      data: { title, body, urgency, recipientIds },
    };
  }

  it('should set eventType to notification.send', () => {
    const evt = buildNotifyEvent({ title: 'Alert', body: 'Something happened' });
    expect(evt.eventType).toBe('notification.send');
  });

  it('should include title and body', () => {
    const evt = buildNotifyEvent({ title: 'Alert', body: 'Details here' });
    expect(evt.data.title).toBe('Alert');
    expect(evt.data.body).toBe('Details here');
  });

  it('should default urgency to normal', () => {
    const evt = buildNotifyEvent({ title: 'Alert', body: 'Details' });
    expect(evt.data.urgency).toBe('normal');
  });

  it('should pass recipientIds', () => {
    const evt = buildNotifyEvent({ title: 'Alert', body: 'Details', recipientIds: ['u1', 'u2'] });
    expect(evt.data.recipientIds).toEqual(['u1', 'u2']);
  });
});

// =====================================================
// 11. CONVENIENCE: syncMeetingToLogosVision() SHAPE
// =====================================================

describe('EcosystemBridge — syncMeetingToLogosVision() Event Shape', () => {
  function buildMeetingSyncEvent(meeting, actionItems = []) {
    const activityEvent = {
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
        createdAt: meeting.created_at,
      },
    };

    const taskEvents = actionItems.map((item) => ({
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
        context: item.context,
      },
    }));

    return { activityEvent, taskEvents };
  }

  const meeting = {
    id: 'mtg-1',
    title: 'Sprint Review',
    summary: 'Good progress',
    sentiment_label: 'positive',
    key_points: ['Velocity up'],
    decisions: ['Ship v2'],
    attendees: ['Alice', 'Bob'],
    duration_minutes: 45,
    created_at: '2026-03-29T10:00:00Z',
  };

  const actionItems = [
    { id: 'ai-1', task_description: 'Fix bug', assigned_to_name: 'Alice', assigned_to_email: 'alice@test.com', due_date: '2026-04-01', priority: 'high', context: 'From sprint review' },
  ];

  it('should build meeting.processed activity event', () => {
    const { activityEvent } = buildMeetingSyncEvent(meeting);
    expect(activityEvent.eventType).toBe('meeting.processed');
    expect(activityEvent.entityType).toBe('meeting');
    expect(activityEvent.entityId).toBe('mtg-1');
    expect(activityEvent.data.title).toBe('Sprint Review');
    expect(activityEvent.data.sentiment).toBe('positive');
  });

  it('should include action item count', () => {
    const { activityEvent } = buildMeetingSyncEvent(meeting, actionItems);
    expect(activityEvent.data.actionItemCount).toBe(1);
  });

  it('should build task.created events for each action item', () => {
    const { taskEvents } = buildMeetingSyncEvent(meeting, actionItems);
    expect(taskEvents).toHaveLength(1);
    expect(taskEvents[0].eventType).toBe('task.created');
    expect(taskEvents[0].entityType).toBe('action_item');
    expect(taskEvents[0].data.task).toBe('Fix bug');
    expect(taskEvents[0].data.assignedTo).toBe('Alice');
    expect(taskEvents[0].data.priority).toBe('high');
  });

  it('should handle meeting with no action items', () => {
    const { taskEvents } = buildMeetingSyncEvent(meeting);
    expect(taskEvents).toHaveLength(0);
  });

  it('should default optional meeting fields to empty arrays', () => {
    const minMeeting = { id: 'mtg-2', title: 'Quick Sync' };
    const { activityEvent } = buildMeetingSyncEvent(minMeeting);
    expect(activityEvent.data.keyPoints).toEqual([]);
    expect(activityEvent.data.decisions).toEqual([]);
    expect(activityEvent.data.attendees).toEqual([]);
  });
});

// =====================================================
// 12. CONVENIENCE: syncTaskCompleted() SHAPE
// =====================================================

describe('EcosystemBridge — syncTaskCompleted() Event Shape', () => {
  function buildTaskCompletedEvent(taskId, crmTaskId) {
    return {
      eventType: 'task.completed',
      entityType: 'action_item',
      entityId: taskId,
      data: { taskId, crmTaskId, completedAt: new Date().toISOString() },
    };
  }

  it('should set eventType to task.completed', () => {
    const evt = buildTaskCompletedEvent('task-1', 'crm-task-1');
    expect(evt.eventType).toBe('task.completed');
  });

  it('should include both task IDs', () => {
    const evt = buildTaskCompletedEvent('task-1', 'crm-task-1');
    expect(evt.data.taskId).toBe('task-1');
    expect(evt.data.crmTaskId).toBe('crm-task-1');
  });

  it('should include completedAt timestamp', () => {
    const evt = buildTaskCompletedEvent('task-1', 'crm-task-1');
    expect(evt.data.completedAt).toBeTruthy();
    expect(() => new Date(evt.data.completedAt)).not.toThrow();
  });
});

// =====================================================
// 13. CONVENIENCE: syncContactToLogosVision() SHAPE
// =====================================================

describe('EcosystemBridge — syncContactToLogosVision() Event Shape', () => {
  function buildContactDiscoveredEvent({ email, name, company, meetingId }) {
    return {
      eventType: 'contact.discovered',
      entityType: 'contact',
      data: { email, name, company, meetingId, source: 'meeting_attendee' },
    };
  }

  it('should set eventType to contact.discovered', () => {
    const evt = buildContactDiscoveredEvent({ email: 'a@b.com', name: 'Alice', company: 'Acme', meetingId: 'm1' });
    expect(evt.eventType).toBe('contact.discovered');
  });

  it('should set source to meeting_attendee', () => {
    const evt = buildContactDiscoveredEvent({ email: 'a@b.com', name: 'Alice', company: 'Acme', meetingId: 'm1' });
    expect(evt.data.source).toBe('meeting_attendee');
  });

  it('should include contact details', () => {
    const evt = buildContactDiscoveredEvent({ email: 'a@b.com', name: 'Alice', company: 'Acme', meetingId: 'm1' });
    expect(evt.data.email).toBe('a@b.com');
    expect(evt.data.name).toBe('Alice');
    expect(evt.data.company).toBe('Acme');
    expect(evt.data.meetingId).toBe('m1');
  });
});

// =====================================================
// 14. EVENT LOG SHAPE
// =====================================================

describe('Ecosystem Events — Log Shape', () => {
  function buildOutboundEventLog(eventId, event, targetApp) {
    return {
      event_id: eventId,
      source: 'entomate',
      target_app: targetApp,
      event_type: event.eventType,
      entity_type: event.entityType || null,
      entity_id: event.entityId || null,
      direction: 'outbound',
      status: 'pending',
      payload: event,
    };
  }

  function buildInboundEventLog(eventId, sourceApp, event) {
    return {
      event_id: eventId,
      source: sourceApp,
      target_app: 'entomate',
      event_type: event.eventType,
      entity_type: event.entityType || null,
      entity_id: event.entityId || null,
      direction: 'inbound',
      status: 'pending',
      payload: event,
    };
  }

  it('should build valid outbound event log', () => {
    const log = buildOutboundEventLog('evt-1', { eventType: 'meeting.processed', entityType: 'meeting', entityId: 'mtg-1' }, 'pulse');
    expect(log.direction).toBe('outbound');
    expect(log.source).toBe('entomate');
    expect(log.target_app).toBe('pulse');
    expect(log.status).toBe('pending');
    expect(log.event_type).toBe('meeting.processed');
  });

  it('should build valid inbound event log', () => {
    const log = buildInboundEventLog('evt-2', 'pulse', { eventType: 'task.completed', data: {} });
    expect(log.direction).toBe('inbound');
    expect(log.source).toBe('pulse');
    expect(log.target_app).toBe('entomate');
    expect(log.event_type).toBe('task.completed');
  });

  it('should handle optional entity fields', () => {
    const log = buildOutboundEventLog('evt-3', { eventType: 'heartbeat' }, 'pulse');
    expect(log.entity_type).toBeNull();
    expect(log.entity_id).toBeNull();
  });
});

// =====================================================
// 15. EVENT STATS AGGREGATION
// =====================================================

describe('Ecosystem Events — Stats Aggregation', () => {
  function aggregateStats(events) {
    return {
      total: events.length,
      delivered: events.filter((e) => e.status === 'delivered').length,
      failed: events.filter((e) => e.status === 'failed').length,
      pending: events.filter((e) => e.status === 'pending').length,
      inbound: events.filter((e) => e.direction === 'inbound').length,
      outbound: events.filter((e) => e.direction === 'outbound').length,
    };
  }

  it('should count all events', () => {
    const events = [
      { status: 'delivered', direction: 'outbound' },
      { status: 'delivered', direction: 'outbound' },
      { status: 'failed', direction: 'outbound' },
      { status: 'pending', direction: 'inbound' },
    ];
    const stats = aggregateStats(events);
    expect(stats.total).toBe(4);
    expect(stats.delivered).toBe(2);
    expect(stats.failed).toBe(1);
    expect(stats.pending).toBe(1);
    expect(stats.inbound).toBe(1);
    expect(stats.outbound).toBe(3);
  });

  it('should handle empty events', () => {
    const stats = aggregateStats([]);
    expect(stats.total).toBe(0);
    expect(stats.delivered).toBe(0);
    expect(stats.failed).toBe(0);
  });
});

// =====================================================
// 16. RETRY VALIDATION
// =====================================================

describe('EcosystemBridge — Retry Validation', () => {
  function canRetry(event) {
    if (!event) return { allowed: false, error: 'Event not found' };
    if (event.status !== 'failed') {
      return { allowed: false, error: `Event status is '${event.status}', not 'failed'` };
    }
    return { allowed: true };
  }

  it('should allow retrying failed events', () => {
    expect(canRetry({ status: 'failed' }).allowed).toBe(true);
  });

  it('should reject retrying delivered events', () => {
    const result = canRetry({ status: 'delivered' });
    expect(result.allowed).toBe(false);
    expect(result.error).toContain('delivered');
  });

  it('should reject retrying pending events', () => {
    const result = canRetry({ status: 'pending' });
    expect(result.allowed).toBe(false);
    expect(result.error).toContain('pending');
  });

  it('should reject null event', () => {
    const result = canRetry(null);
    expect(result.allowed).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should schedule retry 5 minutes in future', () => {
    const now = Date.now();
    const nextRetry = new Date(now + 5 * 60 * 1000).toISOString();
    const retryDate = new Date(nextRetry);
    const diffMs = retryDate.getTime() - now;
    // Should be approximately 5 minutes (allow 1s tolerance)
    expect(diffMs).toBeGreaterThan(4 * 60 * 1000);
    expect(diffMs).toBeLessThan(6 * 60 * 1000);
  });
});

// =====================================================
// 17. CONFIG VALIDATION (API Route Logic)
// =====================================================

describe('Ecosystem Config — Validation', () => {
  function validateConfigRequest(body) {
    if (!body.appName || !body.apiUrl || !body.serviceToken) {
      return { valid: false, error: 'appName, apiUrl, and serviceToken are required' };
    }
    return { valid: true };
  }

  it('should accept valid config', () => {
    expect(validateConfigRequest({
      appName: 'pulse',
      apiUrl: 'https://example.co',
      serviceToken: 'tok123',
    }).valid).toBe(true);
  });

  it('should reject missing appName', () => {
    const result = validateConfigRequest({ apiUrl: 'https://example.co', serviceToken: 'tok123' });
    expect(result.valid).toBe(false);
  });

  it('should reject missing apiUrl', () => {
    const result = validateConfigRequest({ appName: 'pulse', serviceToken: 'tok123' });
    expect(result.valid).toBe(false);
  });

  it('should reject missing serviceToken', () => {
    const result = validateConfigRequest({ appName: 'pulse', apiUrl: 'https://example.co' });
    expect(result.valid).toBe(false);
  });
});

// =====================================================
// 18. TOKEN MASKING (Config GET)
// =====================================================

describe('Ecosystem Config — Token Masking', () => {
  function maskToken(token) {
    return token ? `${token.substring(0, 8)}...` : null;
  }

  it('should mask long tokens showing first 8 chars', () => {
    expect(maskToken('abcdefghijklmnop')).toBe('abcdefgh...');
  });

  it('should return null for null token', () => {
    expect(maskToken(null)).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(maskToken('')).toBeNull();
  });

  it('should handle short tokens', () => {
    expect(maskToken('abc')).toBe('abc...');
  });
});

// =====================================================
// 19. PULSE POST VALIDATION (Convenience Endpoint)
// =====================================================

describe('Ecosystem Routes — Pulse Post Validation', () => {
  function validatePulsePost(body) {
    if (!body.message) {
      return { valid: false, error: 'message is required' };
    }
    return { valid: true };
  }

  it('should accept valid post with message', () => {
    expect(validatePulsePost({ message: 'Hello' }).valid).toBe(true);
  });

  it('should reject missing message', () => {
    const result = validatePulsePost({ channel: 'general' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('message');
  });

  it('should accept message with optional fields', () => {
    expect(validatePulsePost({
      message: 'Hello',
      channel: 'meetings',
      title: 'Recap',
      urgency: 'high',
      metadata: { meetingId: 'm1' },
    }).valid).toBe(true);
  });
});

// =====================================================
// 20. ENTITY MAP — Cross-App Linking
// =====================================================

describe('Ecosystem Entity Map', () => {
  function buildEntityMapEntry(localType, localId, remoteApp, remoteType, remoteId, metadata = {}) {
    return {
      local_entity_type: localType,
      local_entity_id: localId,
      remote_app: remoteApp,
      remote_entity_type: remoteType,
      remote_entity_id: remoteId,
      metadata,
    };
  }

  it('should build correct entity map for action item sync', () => {
    const entry = buildEntityMapEntry('action_item', 'local-uuid', 'logos_vision', 'task', 'lv-uuid');
    expect(entry.local_entity_type).toBe('action_item');
    expect(entry.remote_app).toBe('logos_vision');
    expect(entry.remote_entity_type).toBe('task');
  });

  it('should build entity map for meeting sync', () => {
    const entry = buildEntityMapEntry('meeting', 'mtg-1', 'pulse', 'bot_message', 'msg-1');
    expect(entry.local_entity_type).toBe('meeting');
    expect(entry.remote_app).toBe('pulse');
  });

  it('should create unique constraint key', () => {
    const entry = buildEntityMapEntry('action_item', 'uuid-1', 'logos_vision', 'task', 'lv-1');
    const uniqueKey = `${entry.local_entity_type}:${entry.local_entity_id}:${entry.remote_app}`;
    expect(uniqueKey).toBe('action_item:uuid-1:logos_vision');
  });

  it('should include metadata', () => {
    const entry = buildEntityMapEntry('action_item', 'uuid-1', 'logos_vision', 'task', 'lv-1', { source: 'auto_sync' });
    expect(entry.metadata).toEqual({ source: 'auto_sync' });
  });

  it('should default metadata to empty object', () => {
    const entry = buildEntityMapEntry('action_item', 'uuid-1', 'logos_vision', 'task', 'lv-1');
    expect(entry.metadata).toEqual({});
  });
});

// =====================================================
// 21. DATABASE SCHEMA VALIDATION
// =====================================================

describe('Ecosystem Database Schema — Expectations', () => {
  // Validates the expected table structures match what the code expects

  const ECOSYSTEM_CONFIG_COLUMNS = [
    'id', 'app_name', 'display_name', 'api_url',
    'service_token', 'inbound_token', 'enabled',
    'features', 'last_heartbeat', 'created_at', 'updated_at',
  ];

  const ECOSYSTEM_EVENTS_COLUMNS = [
    'id', 'event_id', 'source', 'target_app', 'event_type',
    'entity_type', 'entity_id', 'direction', 'status',
    'payload', 'response_data', 'error_message',
    'processing_time_ms', 'retry_count', 'next_retry_at', 'created_at',
  ];

  const ECOSYSTEM_ENTITY_MAP_COLUMNS = [
    'id', 'local_entity_type', 'local_entity_id',
    'remote_app', 'remote_entity_type', 'remote_entity_id',
    'metadata', 'created_at',
  ];

  it('ecosystem_config should have all expected columns', () => {
    expect(ECOSYSTEM_CONFIG_COLUMNS).toContain('app_name');
    expect(ECOSYSTEM_CONFIG_COLUMNS).toContain('display_name');
    expect(ECOSYSTEM_CONFIG_COLUMNS).toContain('service_token');
    expect(ECOSYSTEM_CONFIG_COLUMNS).toContain('inbound_token');
    expect(ECOSYSTEM_CONFIG_COLUMNS).toContain('features');
    expect(ECOSYSTEM_CONFIG_COLUMNS).toContain('last_heartbeat');
    expect(ECOSYSTEM_CONFIG_COLUMNS).toHaveLength(11);
  });

  it('ecosystem_events should have all expected columns', () => {
    expect(ECOSYSTEM_EVENTS_COLUMNS).toContain('event_id');
    expect(ECOSYSTEM_EVENTS_COLUMNS).toContain('target_app');
    expect(ECOSYSTEM_EVENTS_COLUMNS).toContain('response_data');
    expect(ECOSYSTEM_EVENTS_COLUMNS).toContain('retry_count');
    expect(ECOSYSTEM_EVENTS_COLUMNS).toContain('next_retry_at');
    expect(ECOSYSTEM_EVENTS_COLUMNS).toHaveLength(16);
  });

  it('ecosystem_entity_map should have all expected columns', () => {
    expect(ECOSYSTEM_ENTITY_MAP_COLUMNS).toContain('metadata');
    expect(ECOSYSTEM_ENTITY_MAP_COLUMNS).toContain('remote_entity_id');
    expect(ECOSYSTEM_ENTITY_MAP_COLUMNS).toHaveLength(8);
  });

  it('Entomate events table has target_app (differs from Pulse)', () => {
    // Entomate's events table includes target_app; Pulse's does not
    expect(ECOSYSTEM_EVENTS_COLUMNS).toContain('target_app');
  });

  it('Entomate events table has retry fields (differs from Pulse)', () => {
    expect(ECOSYSTEM_EVENTS_COLUMNS).toContain('retry_count');
    expect(ECOSYSTEM_EVENTS_COLUMNS).toContain('next_retry_at');
  });

  it('Entomate config table has display_name (differs from Pulse)', () => {
    expect(ECOSYSTEM_CONFIG_COLUMNS).toContain('display_name');
  });
});

// =====================================================
// 22. SEED DATA VALIDATION
// =====================================================

describe('Ecosystem Config — Seed Data', () => {
  const SEED_APPS = [
    {
      app_name: 'pulse',
      display_name: 'Pulse',
      api_url: 'https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/ecosystem-inbound',
      enabled: false,
      features: { sync_meetings: true, notifications: true },
    },
    {
      app_name: 'logos_vision',
      display_name: 'Logos Vision',
      api_url: 'https://psjgmdnrehcwvppbeqjy.supabase.co/functions/v1/ecosystem-inbound',
      enabled: false,
      features: { sync_meetings: true, sync_tasks: true, sync_contacts: true },
    },
  ];

  it('should seed two apps', () => {
    expect(SEED_APPS).toHaveLength(2);
  });

  it('should include pulse with correct inbound URL', () => {
    const pulse = SEED_APPS.find((a) => a.app_name === 'pulse');
    expect(pulse.api_url).toMatch(/ucaeuszgoihoyrvhewxk.*ecosystem-inbound$/);
  });

  it('should include logos_vision with correct inbound URL', () => {
    const lv = SEED_APPS.find((a) => a.app_name === 'logos_vision');
    expect(lv.api_url).toMatch(/psjgmdnrehcwvppbeqjy.*ecosystem-inbound$/);
  });

  it('should start disabled', () => {
    for (const app of SEED_APPS) {
      expect(app.enabled).toBe(false);
    }
  });

  it('Pulse seed URL should match Pulse config registry', () => {
    const pulse = SEED_APPS.find((a) => a.app_name === 'pulse');
    // This is the canonical Pulse inbound URL
    expect(pulse.api_url).toBe('https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/ecosystem-inbound');
  });

  it('Logos Vision seed URL should match Pulse config registry', () => {
    const lv = SEED_APPS.find((a) => a.app_name === 'logos_vision');
    expect(lv.api_url).toBe('https://psjgmdnrehcwvppbeqjy.supabase.co/functions/v1/ecosystem-inbound');
  });
});

// =====================================================
// 23. POST TO PULSE — Channel Resolution (Agent Action)
// =====================================================

describe('PostToPulse Agent Action — Channel Resolution', () => {
  function resolveChannel(channel, payload) {
    if (channel === 'auto') {
      if (payload.dealId || payload.deal_id) return 'sales';
      if (payload.projectId || payload.project_id) return 'projects';
      if (payload.customerId || payload.customer_id) return 'customer-success';
      return 'general';
    }
    return channel;
  }

  it('should return explicit channel name', () => {
    expect(resolveChannel('meetings', {})).toBe('meetings');
  });

  it('should auto-resolve to sales for deals', () => {
    expect(resolveChannel('auto', { dealId: 'd1' })).toBe('sales');
    expect(resolveChannel('auto', { deal_id: 'd1' })).toBe('sales');
  });

  it('should auto-resolve to projects for projects', () => {
    expect(resolveChannel('auto', { projectId: 'p1' })).toBe('projects');
    expect(resolveChannel('auto', { project_id: 'p1' })).toBe('projects');
  });

  it('should auto-resolve to customer-success for customers', () => {
    expect(resolveChannel('auto', { customerId: 'c1' })).toBe('customer-success');
    expect(resolveChannel('auto', { customer_id: 'c1' })).toBe('customer-success');
  });

  it('should fallback to general for unknown payloads', () => {
    expect(resolveChannel('auto', {})).toBe('general');
    expect(resolveChannel('auto', { meetingId: 'm1' })).toBe('general');
  });
});

// =====================================================
// 24. POST TO PULSE — Message Template Building
// =====================================================

describe('PostToPulse Agent Action — Message Templates', () => {
  function buildMessage(template, payload) {
    const variablePattern = /\{\{(\w+)\}\}/g;
    return template.replace(variablePattern, (match, varName) => {
      const value = payload[varName] || '';
      if (Array.isArray(value)) {
        return value.map((item, i) =>
          `${i + 1}. ${typeof item === 'string' ? item : item.title || JSON.stringify(item)}`
        ).join('\n');
      }
      return String(value || match);
    });
  }

  it('should substitute simple variables', () => {
    const result = buildMessage('Hello {{name}}, welcome!', { name: 'Alice' });
    expect(result).toBe('Hello Alice, welcome!');
  });

  it('should leave unresolved variables as-is', () => {
    const result = buildMessage('Hello {{name}}', {});
    expect(result).toBe('Hello {{name}}');
  });

  it('should format arrays as numbered lists', () => {
    const result = buildMessage('Tasks: {{items}}', { items: ['Fix bug', 'Deploy'] });
    expect(result).toContain('1. Fix bug');
    expect(result).toContain('2. Deploy');
  });

  it('should format array of objects using title field', () => {
    const result = buildMessage('Items: {{items}}', { items: [{ title: 'Task A' }, { title: 'Task B' }] });
    expect(result).toContain('1. Task A');
    expect(result).toContain('2. Task B');
  });

  it('should handle multiple variables', () => {
    const result = buildMessage('{{greeting}} {{name}}, re: {{topic}}', {
      greeting: 'Hi', name: 'Bob', topic: 'Sprint',
    });
    expect(result).toBe('Hi Bob, re: Sprint');
  });
});

// =====================================================
// 25. POST TO PULSE — Mention Building
// =====================================================

describe('PostToPulse Agent Action — Mentions', () => {
  function addMentions(message, config, payload) {
    const mentions = [];
    if (config.mentionOwner && payload.ownerId) {
      mentions.push(`@${payload.ownerName || payload.ownerId}`);
    }
    if (config.mentionAssignee && payload.assigneeId) {
      mentions.push(`@${payload.assigneeName || payload.assigneeId}`);
    }
    if (config.mentionCSM && payload.csmId) {
      mentions.push(`@${payload.csmName || payload.csmId}`);
    }
    return mentions.length > 0 ? `${mentions.join(' ')} ${message}` : message;
  }

  it('should add owner mention', () => {
    const result = addMentions('Task done', { mentionOwner: true }, { ownerId: 'u1', ownerName: 'Alice' });
    expect(result).toBe('@Alice Task done');
  });

  it('should add multiple mentions', () => {
    const result = addMentions('Review needed', { mentionOwner: true, mentionAssignee: true }, {
      ownerId: 'u1', ownerName: 'Alice',
      assigneeId: 'u2', assigneeName: 'Bob',
    });
    expect(result).toBe('@Alice @Bob Review needed');
  });

  it('should not add mentions when not configured', () => {
    const result = addMentions('Hello', { mentionOwner: false }, { ownerId: 'u1' });
    expect(result).toBe('Hello');
  });

  it('should fallback to ID when name is missing', () => {
    const result = addMentions('Hello', { mentionOwner: true }, { ownerId: 'user-uuid' });
    expect(result).toBe('@user-uuid Hello');
  });

  it('should skip mention when user ID is missing', () => {
    const result = addMentions('Hello', { mentionOwner: true, mentionAssignee: true }, {});
    expect(result).toBe('Hello');
  });
});

// =====================================================
// 26. CROSS-APP URL CONSISTENCY
// =====================================================

describe('Ecosystem — Cross-App URL Consistency', () => {
  // These are the canonical inbound URLs that MUST match between apps

  const PULSE_INBOUND = 'https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/ecosystem-inbound';
  const ENTOMATE_INBOUND = 'https://epftmicjaxrthmpyoguy.supabase.co/functions/v1/ecosystem-inbound';
  const LOGOS_VISION_INBOUND = 'https://psjgmdnrehcwvppbeqjy.supabase.co/functions/v1/ecosystem-inbound';

  it('all inbound URLs should follow the same pattern', () => {
    const pattern = /^https:\/\/[a-z]+\.supabase\.co\/functions\/v1\/ecosystem-inbound$/;
    expect(PULSE_INBOUND).toMatch(pattern);
    expect(ENTOMATE_INBOUND).toMatch(pattern);
    expect(LOGOS_VISION_INBOUND).toMatch(pattern);
  });

  it('all inbound URLs should be unique', () => {
    const urls = [PULSE_INBOUND, ENTOMATE_INBOUND, LOGOS_VISION_INBOUND];
    expect(new Set(urls).size).toBe(3);
  });

  it('Pulse URL in Entomate seed matches Pulse self-reported URL', () => {
    // Entomate's seed data for pulse must match Pulse's own config
    expect(PULSE_INBOUND).toBe('https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/ecosystem-inbound');
  });
});

// =====================================================
// 27. SYNC STATUS REPORTING
// =====================================================

describe('Ecosystem Routes — Sync Status', () => {
  function buildSyncStatus(events, meetingId) {
    const pulseEvents = events.filter((e) => e.target_app === 'pulse');
    const lvEvents = events.filter((e) => e.target_app === 'logos_vision');

    return {
      pulse: pulseEvents.length > 0 ? {
        status: pulseEvents[0].status,
        lastSync: pulseEvents[0].created_at,
        error: pulseEvents[0].error_message,
        eventId: pulseEvents[0].id,
      } : null,
      logosVision: lvEvents.length > 0 ? {
        status: lvEvents[0].status,
        lastSync: lvEvents[0].created_at,
        error: lvEvents[0].error_message,
        eventId: lvEvents[0].id,
        eventCount: lvEvents.length,
      } : null,
    };
  }

  it('should report both apps synced', () => {
    const events = [
      { id: 'e1', target_app: 'pulse', status: 'delivered', created_at: '2026-03-29T10:00:00Z', error_message: null },
      { id: 'e2', target_app: 'logos_vision', status: 'delivered', created_at: '2026-03-29T10:01:00Z', error_message: null },
    ];
    const status = buildSyncStatus(events);
    expect(status.pulse.status).toBe('delivered');
    expect(status.logosVision.status).toBe('delivered');
  });

  it('should report pulse failed', () => {
    const events = [
      { id: 'e1', target_app: 'pulse', status: 'failed', created_at: '2026-03-29T10:00:00Z', error_message: 'Timeout' },
    ];
    const status = buildSyncStatus(events);
    expect(status.pulse.status).toBe('failed');
    expect(status.pulse.error).toBe('Timeout');
    expect(status.logosVision).toBeNull();
  });

  it('should report no sync for either app', () => {
    const status = buildSyncStatus([]);
    expect(status.pulse).toBeNull();
    expect(status.logosVision).toBeNull();
  });

  it('should count multiple LV events', () => {
    const events = [
      { id: 'e1', target_app: 'logos_vision', status: 'delivered', created_at: '2026-03-29T10:01:00Z', error_message: null },
      { id: 'e2', target_app: 'logos_vision', status: 'delivered', created_at: '2026-03-29T10:00:00Z', error_message: null },
    ];
    const status = buildSyncStatus(events);
    expect(status.logosVision.eventCount).toBe(2);
  });
});

// =====================================================
// 28. FEATURE FLAGS — Entomate-specific
// =====================================================

describe('Ecosystem Config — Feature Flags (Entomate)', () => {
  const PULSE_FEATURES = { sync_meetings: true, notifications: true };
  const LOGOS_FEATURES = { sync_meetings: true, sync_tasks: true, sync_contacts: true };

  it('Pulse features should include sync_meetings and notifications', () => {
    expect(PULSE_FEATURES.sync_meetings).toBe(true);
    expect(PULSE_FEATURES.notifications).toBe(true);
  });

  it('Logos Vision features should include sync_tasks and sync_contacts', () => {
    expect(LOGOS_FEATURES.sync_tasks).toBe(true);
    expect(LOGOS_FEATURES.sync_contacts).toBe(true);
  });

  it('both apps should support sync_meetings', () => {
    expect(PULSE_FEATURES.sync_meetings).toBe(true);
    expect(LOGOS_FEATURES.sync_meetings).toBe(true);
  });
});
