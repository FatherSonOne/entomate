/**
 * Prepare Context Action
 * Assembles cross-app context for a meeting intelligence profile.
 * Follows the same pattern as extractActionItems.ts.
 */

import { assembleContext } from '../../intelligence/contextAssembler';
import { getProfileById } from '../../intelligence/profileService';
import type { Agent, ActionStep } from '../types';
import type { AssembledContext } from '../../intelligence/types';

export interface PrepareContextConfig {
  forceRefresh?: boolean;
}

/**
 * Execute the prepare_context action
 */
export async function execute(params: {
  agent: Agent;
  step: ActionStep;
  triggerPayload: Record<string, any>;
  dryRun?: boolean;
}): Promise<{
  result: { context: AssembledContext | null; skipped?: boolean; reason?: string };
  countersDelta?: { pulseMessages?: number; crmTasks?: number };
}> {
  const { step, triggerPayload, dryRun } = params;
  const config = step.config as PrepareContextConfig;

  const meetingId = triggerPayload.meetingId || triggerPayload.meeting?.id;
  const intelligenceConfig = triggerPayload.intelligenceConfig;

  console.log('[Action:prepare_context] Starting context assembly', { meetingId, dryRun });

  // If no intelligence config, nothing to prepare
  if (!intelligenceConfig || !intelligenceConfig.profileId) {
    console.log('[Action:prepare_context] No intelligence config or profile — skipping');
    return {
      result: { context: null, skipped: true, reason: 'No intelligence profile assigned to meeting' },
      countersDelta: {},
    };
  }

  // If context already assembled and not forcing refresh, skip
  if (intelligenceConfig.status === 'context_ready' && !config.forceRefresh) {
    console.log('[Action:prepare_context] Context already assembled — skipping');
    return {
      result: { context: intelligenceConfig.assembledContext, skipped: true, reason: 'Context already assembled' },
      countersDelta: {},
    };
  }

  // In dry run mode, report what would happen
  if (dryRun) {
    console.log('[Action:prepare_context] DRY RUN — would assemble context for:', {
      meetingId,
      profileId: intelligenceConfig.profileId,
    });
    return {
      result: {
        context: null,
        skipped: false,
        reason: '[DRY RUN] Would assemble context from profile sources',
      },
      countersDelta: {},
    };
  }

  // Load the profile
  const profile = await getProfileById(intelligenceConfig.profileId);
  if (!profile) {
    console.error('[Action:prepare_context] Profile not found:', intelligenceConfig.profileId);
    return {
      result: { context: null, skipped: true, reason: 'Profile not found' },
      countersDelta: {},
    };
  }

  // Assemble context
  try {
    const context = await assembleContext(meetingId, profile);

    console.log('[Action:prepare_context] Context assembled:', {
      sources: context.sources,
      participants: context.participants.length,
      tokenEstimate: context.tokenEstimate,
    });

    return {
      result: { context },
      countersDelta: {},
    };
  } catch (err) {
    console.error('[Action:prepare_context] Context assembly failed:', err);
    throw new Error(`Failed to assemble context: ${err instanceof Error ? err.message : String(err)}`);
  }
}
