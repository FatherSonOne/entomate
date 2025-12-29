/**
 * Type definitions for Predictive Analytics
 */

// Prediction types
export type PredictionType = 'deal_close_probability' | 'task_eta';

// Entity types that can have predictions
export type PredictableEntityType = 'deal' | 'task';

/**
 * Stored prediction record
 */
export interface Prediction {
  id: string;
  prediction_type: PredictionType;
  entity_type: PredictableEntityType;
  entity_id: string;
  predicted_value: Record<string, any>;
  explanation: string;
  model_version: string;
  created_at: string;
}

/**
 * Deal close probability result
 */
export interface DealProbabilityResult {
  dealId: string;
  probability: number;       // 0-100
  riskFlags: string[];       // e.g., ['overdue_tasks', 'no_recent_meeting']
  explanation: string;       // Human-readable
  modelVersion: string;
}

/**
 * Task ETA result
 */
export interface TaskEtaResult {
  taskId: string;
  predictedCompletionDate: string;  // ISO date
  confidence: 'low' | 'medium' | 'high';
  explanation: string;
  modelVersion: string;
}

/**
 * Deal data needed for probability calculation
 */
export interface DealData {
  id: string;
  stage: string;
  value?: number;
  updated_at: string;
  created_at: string;
}

/**
 * Deal statistics for probability calculation
 */
export interface DealStats {
  overdueHighTasks: number;
  overdueMediumTasks: number;
  completedTasks: number;
  totalTasks: number;
  lastMeetingDaysAgo: number | null;
  lastActivityDaysAgo: number;
  meetingSentiment?: 'positive' | 'neutral' | 'negative';
}

/**
 * Task data needed for ETA calculation
 */
export interface TaskData {
  id: string;
  priority: 'high' | 'medium' | 'low';
  status: string;
  created_at: string;
  due_date?: string;
  assignee_id?: string;
}

/**
 * Task history statistics for ETA calculation
 */
export interface TaskHistoryStats {
  typicalDaysForSimilar: number | null;
  assigneeOpenTasks: number;
  projectAverageCompletionDays: number | null;
}
