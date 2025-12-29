/**
 * Trigger Handlers Index
 * Re-exports all trigger implementations
 */

export * as meetingCompleted from './meetingCompleted';
export * as taskOverdue from './taskOverdue';
export * as dealStageChanged from './dealStageChanged';

import * as meetingCompleted from './meetingCompleted';
import * as taskOverdue from './taskOverdue';
import * as dealStageChanged from './dealStageChanged';

/**
 * Trigger handler registry
 */
export const triggerHandlers = {
  'meeting.completed': meetingCompleted,
  'task.overdue': taskOverdue,
  'deal.stage_changed': dealStageChanged
};

/**
 * Get trigger handler by type
 */
export function getTriggerHandler(triggerType: string) {
  return triggerHandlers[triggerType as keyof typeof triggerHandlers] || null;
}
