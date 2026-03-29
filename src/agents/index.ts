/**
 * Agents Framework Module
 * Re-exports all agent-related functionality
 */

export * from './types';
export * from './agentRegistry';
export * from './agentService';
export * from './agentRunner';

// Templates
export * from './templates';

// Triggers
export { triggerHandlers, getTriggerHandler } from './triggers';

// Actions
export { actionHandlers, getActionHandler, executeAction } from './actions';

// Trigger Service (for firing triggers from app events)
export {
  fireMeetingCompletedTrigger,
  fireMeetingUpcomingTrigger,
  fireDealStageChangedTrigger,
  fireTaskOverdueTrigger,
  checkOverdueTasks,
  checkAtRiskDeals,
  manualTriggerAgent,
  onMeetingProcessed,
  onDealStageChanged
} from './agentTriggerService';
