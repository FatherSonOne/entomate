/**
 * Deal Stage Changed Trigger
 * Fires when a CRM deal moves from one stage to another
 */

import type { TriggerEvent } from '../types';

export interface DealStageChangedConfig {
  fromStage?: string | null;  // null = any stage
  toStage?: string | null;    // null = any stage
  dealValueMin?: number;
  dealValueMax?: number;
}

export interface DealContext {
  deal: {
    id: string;
    name: string;
    value?: number;
    owner_id?: string;
    owner_name?: string;
    customer_id?: string;
    customer_name?: string;
    created_at: string;
    updated_at: string;
  };
  previousStage: string;
  newStage: string;
}

/**
 * Common CRM deal stages
 */
export const DEAL_STAGES = [
  'discovery',
  'qualification',
  'proposal',
  'negotiation',
  'verbal_commit',
  'implementation',
  'closed_won',
  'closed_lost'
] as const;

/**
 * Evaluate if the deal stage change meets trigger conditions
 */
export async function evaluate(
  config: DealStageChangedConfig,
  context: DealContext
): Promise<boolean> {
  const {
    fromStage = null,
    toStage = null,
    dealValueMin,
    dealValueMax
  } = config;

  const { deal, previousStage, newStage } = context;

  if (!deal) {
    console.log('[Trigger:deal.stage_changed] No deal in context');
    return false;
  }

  // Check fromStage filter
  if (fromStage !== null && previousStage !== fromStage) {
    console.log(`[Trigger:deal.stage_changed] fromStage mismatch: ${previousStage} != ${fromStage}`);
    return false;
  }

  // Check toStage filter
  if (toStage !== null && newStage !== toStage) {
    console.log(`[Trigger:deal.stage_changed] toStage mismatch: ${newStage} != ${toStage}`);
    return false;
  }

  // Check deal value filters
  if (deal.value !== undefined) {
    if (dealValueMin !== undefined && deal.value < dealValueMin) {
      console.log(`[Trigger:deal.stage_changed] Deal value too low: ${deal.value} < ${dealValueMin}`);
      return false;
    }
    if (dealValueMax !== undefined && deal.value > dealValueMax) {
      console.log(`[Trigger:deal.stage_changed] Deal value too high: ${deal.value} > ${dealValueMax}`);
      return false;
    }
  }

  // Must actually be a stage change
  if (previousStage === newStage) {
    console.log('[Trigger:deal.stage_changed] No actual stage change');
    return false;
  }

  return true;
}

/**
 * Create trigger event from deal stage change
 */
export function createTriggerEvent(
  dealId: string,
  deal: DealContext['deal'],
  previousStage: string,
  newStage: string
): TriggerEvent {
  return {
    type: 'deal.stage_changed',
    timestamp: new Date().toISOString(),
    sourceId: `deal:${dealId}:stage:${previousStage}:${newStage}:${Date.now()}`,
    payload: {
      dealId,
      dealName: deal.name,
      dealValue: deal.value,
      previousStage,
      newStage,
      ownerId: deal.owner_id,
      ownerName: deal.owner_name,
      customerId: deal.customer_id,
      customerName: deal.customer_name
    }
  };
}

/**
 * Check if stage transition is a "forward" progression
 */
export function isForwardProgression(fromStage: string, toStage: string): boolean {
  const fromIndex = DEAL_STAGES.indexOf(fromStage as any);
  const toIndex = DEAL_STAGES.indexOf(toStage as any);

  if (fromIndex === -1 || toIndex === -1) {
    return false; // Unknown stages
  }

  return toIndex > fromIndex;
}

/**
 * Check if deal moved to a "won" stage
 */
export function isWonTransition(toStage: string): boolean {
  return toStage === 'closed_won' || toStage === 'implementation';
}

/**
 * Check if deal moved to a "lost" stage
 */
export function isLostTransition(toStage: string): boolean {
  return toStage === 'closed_lost';
}

/**
 * Handle webhook from Logos Vision CRM
 * (Called when CRM sends stage change notification)
 */
export function parseWebhookPayload(payload: any): DealContext | null {
  try {
    // Adapt to Logos Vision webhook format
    // This is a placeholder - adjust based on actual webhook structure
    return {
      deal: {
        id: payload.deal_id || payload.id,
        name: payload.deal_name || payload.name,
        value: payload.deal_value || payload.value,
        owner_id: payload.owner_id,
        owner_name: payload.owner_name,
        customer_id: payload.customer_id || payload.account_id,
        customer_name: payload.customer_name || payload.account_name,
        created_at: payload.created_at,
        updated_at: payload.updated_at || new Date().toISOString()
      },
      previousStage: payload.previous_stage || payload.from_stage,
      newStage: payload.new_stage || payload.to_stage || payload.stage
    };
  } catch (err) {
    console.error('[Trigger:deal.stage_changed] Failed to parse webhook:', err);
    return null;
  }
}
