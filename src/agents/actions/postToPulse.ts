/**
 * Post to Pulse Action
 * Posts messages to Pulse chat channels via the Ecosystem Bridge.
 *
 * Uses the backend /api/ecosystem/pulse endpoint (bridge pattern),
 * falling back to direct Supabase insert if backend is unavailable.
 */

import { supabase } from '../../lib/supabase';
import type { Agent, ActionStep } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export interface PostToPulseConfig {
  channel: string | 'auto';
  messageTemplate: string;
  mentionOwner?: boolean;
  mentionAssignee?: boolean;
  mentionCSM?: boolean;
  includeLink?: boolean;
}

export interface PostToPulseResult {
  posted: boolean;
  messageId?: string;
  channel: string;
  message: string;
  viaBridge?: boolean;
}

/**
 * Execute the post to Pulse action
 */
export async function execute(params: {
  agent: Agent;
  step: ActionStep;
  triggerPayload: Record<string, any>;
  dryRun?: boolean;
}): Promise<{
  result: PostToPulseResult;
  countersDelta: { pulseMessages: number };
}> {
  const { step, triggerPayload, dryRun } = params;
  const config = step.config as PostToPulseConfig;

  console.log('[Action:post_to_pulse] Preparing message', { dryRun, channel: config.channel });

  // Resolve the channel
  const channel = resolveChannel(config.channel, triggerPayload);

  // Build the message from template
  const message = buildMessage(config.messageTemplate, triggerPayload);

  // Add mentions if configured
  const finalMessage = addMentions(message, config, triggerPayload);

  if (dryRun) {
    console.log('[Action:post_to_pulse] DRY RUN - Would post:', { channel, message: finalMessage });
    return {
      result: {
        posted: false,
        channel,
        message: `[DRY RUN] ${finalMessage}`
      },
      countersDelta: { pulseMessages: 0 }
    };
  }

  // Try ecosystem bridge API first
  try {
    const response = await fetch(`${API_BASE_URL}/api/ecosystem/pulse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel,
        message: finalMessage,
        title: `Agent: ${params.agent.name}`,
        metadata: {
          agent_id: params.agent.id,
          agent_name: params.agent.name,
          trigger_event_id: triggerPayload.triggerEventId,
          source: 'entomate_agent'
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('[Action:post_to_pulse] Posted via ecosystem bridge');
      return {
        result: {
          posted: true,
          messageId: data.eventLogId,
          channel,
          message: finalMessage,
          viaBridge: true
        },
        countersDelta: { pulseMessages: 1 }
      };
    }

    // If bridge endpoint returns non-OK, fall through to legacy path
    console.warn('[Action:post_to_pulse] Bridge returned non-OK, falling back to direct insert');
  } catch (bridgeErr) {
    console.warn('[Action:post_to_pulse] Bridge unavailable, falling back to direct insert:', (bridgeErr as Error).message);
  }

  // Fallback: direct Supabase insert (legacy path)
  try {
    const { data, error } = await supabase
      .from('pulse_messages')
      .insert({
        channel,
        content: finalMessage,
        sender_type: 'agent',
        sender_id: params.agent.id,
        metadata: {
          agent_name: params.agent.name,
          trigger_event_id: triggerPayload.triggerEventId,
          source: 'entomate_agent'
        }
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to post to Pulse: ${error.message}`);
    }

    console.log('[Action:post_to_pulse] Message posted via direct insert', { messageId: data?.id });

    return {
      result: {
        posted: true,
        messageId: data?.id,
        channel,
        message: finalMessage,
        viaBridge: false
      },
      countersDelta: { pulseMessages: 1 }
    };

  } catch (err) {
    console.error('[Action:post_to_pulse] Failed to post:', err);
    throw err;
  }
}

/**
 * Resolve the channel name
 */
function resolveChannel(channel: string | 'auto', payload: Record<string, any>): string {
  if (channel === 'auto') {
    if (payload.dealId || payload.deal_id) return 'sales';
    if (payload.projectId || payload.project_id) return 'projects';
    if (payload.customerId || payload.customer_id) return 'customer-success';
    return 'general';
  }
  return channel;
}

/**
 * Build message from template with variable substitution
 */
function buildMessage(template: string, payload: Record<string, any>): string {
  const variablePattern = /\{\{(\w+)\}\}/g;

  return template.replace(variablePattern, (match, varName) => {
    const value = payload[varName]
      || payload[camelToSnake(varName)]
      || payload[snakeToCamel(varName)]
      || payload[varName.toLowerCase()]
      || '';

    if (Array.isArray(value)) {
      return value.map((item, i) =>
        `${i + 1}. ${typeof item === 'string' ? item : item.title || JSON.stringify(item)}`
      ).join('\n');
    }

    return String(value || match);
  });
}

/**
 * Add mentions to message
 */
function addMentions(
  message: string,
  config: PostToPulseConfig,
  payload: Record<string, any>
): string {
  const mentions: string[] = [];

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

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}
