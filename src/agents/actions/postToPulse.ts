/**
 * Post to Pulse Action
 * Posts messages to Pulse chat channels
 */

import { supabase } from '../../lib/supabase';
import type { Agent, ActionStep } from '../types';

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

  try {
    // Post to Pulse via Supabase (assuming pulse_messages table)
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

    console.log('[Action:post_to_pulse] Message posted successfully', { messageId: data?.id });

    return {
      result: {
        posted: true,
        messageId: data?.id,
        channel,
        message: finalMessage
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
    // Auto-detect based on payload context
    if (payload.dealId || payload.deal_id) {
      return 'sales';
    }
    if (payload.projectId || payload.project_id) {
      return 'projects';
    }
    if (payload.customerId || payload.customer_id) {
      return 'customer-success';
    }
    return 'general';
  }
  return channel;
}

/**
 * Build message from template with variable substitution
 */
function buildMessage(template: string, payload: Record<string, any>): string {
  let message = template;

  // Replace all {{variable}} patterns
  const variablePattern = /\{\{(\w+)\}\}/g;

  message = message.replace(variablePattern, (match, varName) => {
    // Try different casings and common variations
    const value = payload[varName]
      || payload[camelToSnake(varName)]
      || payload[snakeToCamel(varName)]
      || payload[varName.toLowerCase()]
      || '';

    if (Array.isArray(value)) {
      return value.map((item, i) => `${i + 1}. ${typeof item === 'string' ? item : item.title || JSON.stringify(item)}`).join('\n');
    }

    return String(value || match);
  });

  return message;
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

  if (mentions.length > 0) {
    return `${mentions.join(' ')} ${message}`;
  }

  return message;
}

/**
 * Convert camelCase to snake_case
 */
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Convert snake_case to camelCase
 */
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}
