const { v5: uuidv5, validate: isUuid } = require('uuid');
const { supabaseAdmin } = require('../config/supabase');

const EVENT_TYPE = 'message.bot_post';
const ATTEMPT_WINDOW_MS = 2 * 60 * 1000;
const EVENT_FIELDS = 'id, status, next_retry_at, retry_count, payload';

function projectDestination(bridge, orgId) {
  if (!bridge.isConnected('pulse')) return null;
  const destination = bridge.getConfig('pulse')?.features?.project_handoff;
  if (destination?.orgId !== orgId || !isUuid(destination.workspaceId) || !isUuid(destination.channelId) ||
      typeof destination.channelName !== 'string' || !destination.channelName.trim()) return null;
  return destination;
}

function eventIdFor(projectId) {
  return uuidv5('pulse:project-handoff', projectId);
}

async function readEvent(projectId) {
  const { data, error } = await supabaseAdmin.from('ecosystem_events').select(EVENT_FIELDS)
    .eq('id', eventIdFor(projectId)).eq('source', 'entomate').eq('target_app', 'pulse')
    .eq('direction', 'outbound').eq('entity_type', 'project').eq('entity_id', projectId).eq('event_type', EVENT_TYPE)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function deliveryState(event, now) {
  if (!event) return 'not_sent';
  if (event.status === 'pending' && Date.parse(event.next_retry_at) <= now) return 'failed';
  return event.status;
}

function sameChannel(event, destination) {
  return event.payload?.data?.workspaceId === destination.workspaceId &&
    event.payload?.data?.channelId === destination.channelId;
}

function describeHandoff(destination, event, canSend) {
  const delivery = deliveryState(event, Date.now());
  const connected = Boolean(destination && (!event || sameChannel(event, destination)));
  const actionable = canSend && connected && (delivery === 'not_sent' || delivery === 'failed');
  return {
    channelName: event?.payload?.channelName ?? destination?.channelName ?? null,
    channelId: actionable ? destination.channelId : null,
    connected,
    delivery
  };
}

async function sendProjectHandoff(bridge, project, destination, event) {
  const now = Date.now();
  const expires = new Date(now + ATTEMPT_WINDOW_MS).toISOString();
  const id = eventIdFor(project.id);
  let claim;
  let payload;
  if (event) {
    if (deliveryState(event, now) !== 'failed' || !sameChannel(event, destination)) return;
    payload = event.payload;
    claim = supabaseAdmin.from('ecosystem_events')
      .update({ status: 'pending', retry_count: event.retry_count + 1, next_retry_at: expires })
      .eq('id', id).eq('status', event.status).eq('retry_count', event.retry_count);
  } else {
    const url = new URL('/projects/' + project.id, process.env.FRONTEND_URL || 'https://entomate.app');
    const name = project.name.replace(/\s+/g, ' ').trim();
    payload = {
      id, eventType: EVENT_TYPE, entityType: 'project', entityId: project.id, channelName: destination.channelName,
      data: {
        workspaceId: destination.workspaceId,
        channelId: destination.channelId,
        content: 'Entomate project handoff: ' + name + '\n\n' + url.href
      }
    };
    claim = supabaseAdmin.from('ecosystem_events').insert({
      id, event_id: id, source: 'entomate', target_app: 'pulse', event_type: EVENT_TYPE,
      entity_type: 'project', entity_id: project.id, direction: 'outbound', status: 'pending',
      payload, next_retry_at: expires
    });
  }

  const { data: attempt, error } = await claim.select('id, retry_count').maybeSingle();
  if (!event && error?.code === '23505') return; // A concurrent request already claimed this handoff.
  if (error) throw error;
  if (attempt) await bridge.sendEvent('pulse', payload, { ...attempt, orgId: project.org_id });
}

module.exports = { projectDestination, readEvent, describeHandoff, sendProjectHandoff };
