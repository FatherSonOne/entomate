/**
 * Model Registry
 * Tracks prediction model versions for comparison and improvement
 */

import type { PredictionType } from './types';

/**
 * Model metadata
 */
interface ModelInfo {
  version: string;
  description: string;
  releaseDate: string;
}

/**
 * Registry of prediction models
 */
const MODELS: Record<PredictionType, ModelInfo> = {
  deal_close_probability: {
    version: 'baseline_v1',
    description: 'Rule-based scoring using stage, activity, and task status',
    releaseDate: '2025-12-16'
  },
  task_eta: {
    version: 'baseline_v1',
    description: 'Cycle-time based estimation with workload adjustments',
    releaseDate: '2025-12-16'
  }
};

/**
 * Get the current model version for a prediction type
 */
export function getModelVersion(predictionType: PredictionType): string {
  return MODELS[predictionType]?.version || 'unknown';
}

/**
 * Get full model info
 */
export function getModelInfo(predictionType: PredictionType): ModelInfo | null {
  return MODELS[predictionType] || null;
}

/**
 * Get all registered models
 */
export function getAllModels(): Record<PredictionType, ModelInfo> {
  return { ...MODELS };
}
