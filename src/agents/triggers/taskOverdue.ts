/**
 * Task Overdue Trigger
 * Fires when a task becomes overdue by a specified number of days
 */

import { supabase } from '../../lib/supabase';
import type { TriggerEvent } from '../types';

export interface TaskOverdueConfig {
  overdueByDays?: number;
  priorityFilter?: 'high' | 'medium' | 'low' | 'all';
  projectTypes?: string[];
  excludeStatuses?: string[];
}

export interface TaskContext {
  task: {
    id: string;
    title: string;
    description?: string;
    status: string;
    priority: 'high' | 'medium' | 'low';
    due_date: string;
    assignee_id?: string;
    assignee_name?: string;
    project_id?: string;
    project_name?: string;
    deal_id?: string;
    created_at: string;
  };
  daysOverdue: number;
}

/**
 * Evaluate if the task meets trigger conditions
 */
export async function evaluate(
  config: TaskOverdueConfig,
  context: TaskContext
): Promise<boolean> {
  const {
    overdueByDays = 1,
    priorityFilter = 'all',
    excludeStatuses = ['completed', 'cancelled']
  } = config;

  const { task, daysOverdue } = context;

  if (!task) {
    console.log('[Trigger:task.overdue] No task in context');
    return false;
  }

  // Check if task has a due date
  if (!task.due_date) {
    console.log('[Trigger:task.overdue] Task has no due date');
    return false;
  }

  // Check if task is in an excluded status
  if (excludeStatuses.includes(task.status)) {
    console.log(`[Trigger:task.overdue] Task status excluded: ${task.status}`);
    return false;
  }

  // Check if overdue by enough days
  if (daysOverdue < overdueByDays) {
    console.log(`[Trigger:task.overdue] Not overdue enough: ${daysOverdue} < ${overdueByDays}`);
    return false;
  }

  // Check priority filter
  if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
    console.log(`[Trigger:task.overdue] Priority doesn't match: ${task.priority} != ${priorityFilter}`);
    return false;
  }

  return true;
}

/**
 * Calculate days overdue for a task
 */
export function calculateDaysOverdue(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = now.getTime() - due.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Create trigger event from task data
 */
export function createTriggerEvent(taskId: string, task: TaskContext['task'], daysOverdue: number): TriggerEvent {
  return {
    type: 'task.overdue',
    timestamp: new Date().toISOString(),
    sourceId: `task:${taskId}:overdue:${daysOverdue}d:${Date.now()}`,
    payload: {
      taskId,
      title: task.title,
      priority: task.priority,
      dueDate: task.due_date,
      daysOverdue,
      assigneeId: task.assignee_id,
      assigneeName: task.assignee_name,
      projectId: task.project_id,
      projectName: task.project_name,
      dealId: task.deal_id
    }
  };
}

/**
 * Fetch task data by ID
 */
export async function getTaskById(taskId: string): Promise<TaskContext['task'] | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (error || !data) {
    console.error('[Trigger:task.overdue] Failed to fetch task:', error);
    return null;
  }

  return data;
}

/**
 * Find all overdue tasks
 * (Called by scheduler to check for overdue tasks)
 */
export async function findOverdueTasks(minDaysOverdue = 1): Promise<TaskContext[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - minDaysOverdue);

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .lt('due_date', cutoffDate.toISOString())
    .not('status', 'in', '("completed","cancelled")')
    .order('due_date', { ascending: true })
    .limit(100);

  if (error) {
    console.error('[Trigger:task.overdue] Failed to find overdue tasks:', error);
    return [];
  }

  return (data || []).map(task => ({
    task,
    daysOverdue: calculateDaysOverdue(task.due_date)
  }));
}
