/**
 * Task ETA Prediction
 * Baseline rule-based model for predicting task completion date
 */

import { supabase } from '../lib/supabase';
import { getModelVersion } from './modelRegistry';
import { formatEntityId } from '../graph/idFormat';
import type { TaskEtaResult, TaskData, TaskHistoryStats } from './types';

/**
 * Default typical days by priority (fallback when no history)
 */
const DEFAULT_DAYS_BY_PRIORITY: Record<string, number> = {
  high: 3,
  medium: 7,
  low: 14
};

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Fetch task data from database
 */
async function getTaskData(taskId: string): Promise<TaskData | null> {
  // Try to fetch from tasks table
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (error || !data) {
    console.log('[TaskEta] Task not found:', taskId);
    return null;
  }

  return {
    id: data.id,
    priority: data.priority || 'medium',
    status: data.status || 'open',
    created_at: data.created_at,
    due_date: data.due_date,
    assignee_id: data.assigned_to
  };
}

/**
 * Get historical statistics for task estimation
 */
async function getTaskHistoryStats(
  taskId: string,
  taskData: TaskData
): Promise<TaskHistoryStats> {
  // Try to get average completion time for similar tasks
  // (same priority, same project, etc.)

  let typicalDays: number | null = null;
  let assigneeOpenTasks = 0;

  // Get assignee workload if available
  if (taskData.assignee_id) {
    const { count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', taskData.assignee_id)
      .in('status', ['open', 'in_progress']);

    assigneeOpenTasks = count || 0;
  }

  // Try to get average completion time from completed tasks
  const { data: completedTasks } = await supabase
    .from('tasks')
    .select('created_at, updated_at, status')
    .eq('priority', taskData.priority)
    .eq('status', 'done')
    .limit(50);

  if (completedTasks && completedTasks.length >= 5) {
    // Calculate average days to complete (use updated_at as completion proxy)
    const durations = completedTasks
      .filter(t => t.updated_at && t.created_at)
      .map(t => {
        const created = new Date(t.created_at);
        const completed = new Date(t.updated_at);
        return Math.max(1, Math.floor((completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
      });

    if (durations.length > 0) {
      typicalDays = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    }
  }

  return {
    typicalDaysForSimilar: typicalDays,
    assigneeOpenTasks,
    projectAverageCompletionDays: null // Could be added later
  };
}

/**
 * Compute task ETA using baseline rules
 */
export async function computeTaskEta(taskId: string): Promise<TaskEtaResult> {
  const task = await getTaskData(taskId);
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const stats = await getTaskHistoryStats(taskId, task);

  // Get typical days from history or use defaults
  let typicalDays = stats.typicalDaysForSimilar;
  if (!typicalDays) {
    typicalDays = DEFAULT_DAYS_BY_PRIORITY[task.priority] || 7;
  }

  // Adjustments
  let extraDays = 0;
  const adjustmentReasons: string[] = [];

  // Workload adjustment
  if (stats.assigneeOpenTasks > 10) {
    extraDays += 3;
    adjustmentReasons.push('+3 days (assignee workload)');
  } else if (stats.assigneeOpenTasks > 5) {
    extraDays += 1;
    adjustmentReasons.push('+1 day (moderate workload)');
  }

  // Status adjustment
  if (task.status === 'open') {
    extraDays += 1;
    adjustmentReasons.push('+1 day (not started)');
  }

  // Calculate predicted date
  const now = new Date();
  const predictedCompletionDate = addDays(now, typicalDays + extraDays);

  // Determine confidence
  let confidence: 'low' | 'medium' | 'high';
  if (stats.typicalDaysForSimilar !== null && stats.assigneeOpenTasks < 5) {
    confidence = 'high';
  } else if (stats.typicalDaysForSimilar !== null || stats.assigneeOpenTasks < 10) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // Build explanation
  const baseExplanation = stats.typicalDaysForSimilar
    ? `Based on historical ${task.priority} priority tasks (avg ${typicalDays} days)`
    : `Using default estimate for ${task.priority} priority (${typicalDays} days)`;

  const explanation = adjustmentReasons.length > 0
    ? `${baseExplanation}. Adjustments: ${adjustmentReasons.join(', ')}`
    : baseExplanation;

  const result: TaskEtaResult = {
    taskId,
    predictedCompletionDate,
    confidence,
    explanation,
    modelVersion: getModelVersion('task_eta')
  };

  // Store prediction
  await storePrediction('task_eta', 'task', taskId, result);

  return result;
}

/**
 * Store prediction in database
 */
async function storePrediction(
  predictionType: string,
  entityType: string,
  entityId: string,
  result: TaskEtaResult
): Promise<void> {
  const prefixedId = formatEntityId(entityType, entityId);

  const { error } = await supabase
    .from('predictions')
    .insert({
      prediction_type: predictionType,
      entity_type: entityType,
      entity_id: prefixedId,
      predicted_value: result,
      explanation: result.explanation,
      model_version: result.modelVersion
    });

  if (error) {
    console.error('[TaskEta] Failed to store prediction:', error);
  }
}

/**
 * Get latest prediction for a task (includes created_at for staleness checks)
 */
export async function getLatestTaskEta(
  taskId: string
): Promise<{ prediction: TaskEtaResult; createdAt: string } | null> {
  const prefixedId = formatEntityId('task', taskId);

  const { data, error } = await supabase
    .from('predictions')
    .select('*')
    .eq('entity_type', 'task')
    .eq('entity_id', prefixedId)
    .eq('prediction_type', 'task_eta')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    prediction: data.predicted_value as TaskEtaResult,
    createdAt: data.created_at
  };
}

/**
 * Batch compute ETAs for multiple tasks (parallel)
 */
export async function computeTaskEtasBatch(
  taskIds: string[]
): Promise<Map<string, TaskEtaResult>> {
  const results = new Map<string, TaskEtaResult>();

  const settled = await Promise.allSettled(
    taskIds.map(async (taskId) => {
      const result = await computeTaskEta(taskId);
      return { taskId, result };
    })
  );

  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      results.set(outcome.value.taskId, outcome.value.result);
    } else {
      console.error('[TaskEta] Failed for task:', outcome.reason);
    }
  }

  return results;
}
