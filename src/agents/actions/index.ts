/**
 * Action Handlers Index
 * Re-exports all action implementations
 */

export * as extractActionItems from './extractActionItems';
export * as postToPulse from './postToPulse';
export * as syncToCrm from './syncToCrm';
export * as createOnboardingProject from './createOnboardingProject';
export * as assignTask from './assignTask';

import * as extractActionItems from './extractActionItems';
import * as postToPulse from './postToPulse';
import * as syncToCrm from './syncToCrm';
import * as createOnboardingProject from './createOnboardingProject';
import * as assignTask from './assignTask';

/**
 * Action handler registry
 */
export const actionHandlers = {
  'extract_action_items': extractActionItems,
  'post_to_pulse': postToPulse,
  'sync_to_crm': syncToCrm,
  'create_onboarding_project': createOnboardingProject,
  'assign_task': assignTask
};

/**
 * Get action handler by type
 */
export function getActionHandler(actionType: string) {
  return actionHandlers[actionType as keyof typeof actionHandlers] || null;
}

/**
 * Execute an action by type
 */
export async function executeAction(
  actionType: string,
  params: {
    agent: any;
    step: any;
    triggerPayload: Record<string, any>;
    dryRun?: boolean;
  }
) {
  const handler = getActionHandler(actionType);
  if (!handler) {
    throw new Error(`Unknown action type: ${actionType}`);
  }
  return handler.execute(params);
}
