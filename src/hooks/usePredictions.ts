/**
 * usePredictions Hook
 * React hook for fetching and displaying predictions
 */

import { useState, useEffect, useCallback } from 'react';
import { computeDealProbability, getLatestDealProbability } from '../analytics/dealProbability';
import { computeTaskEta, getLatestTaskEta } from '../analytics/taskEta';
import type { DealProbabilityResult, TaskEtaResult } from '../analytics/types';

/**
 * Hook for deal probability prediction
 */
export function useDealProbability(dealId: string | null) {
  const [prediction, setPrediction] = useState<DealProbabilityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!dealId) {
      setPrediction(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Try to get cached prediction first
      const cached = await getLatestDealProbability(dealId);

      // If no cached prediction or it's stale (>1 hour), compute new one
      const STALENESS_MS = 60 * 60 * 1000;
      const isStale = cached?.createdAt
        ? (Date.now() - new Date(cached.createdAt).getTime()) > STALENESS_MS
        : false;

      let result: DealProbabilityResult;
      if (!cached || isStale) {
        result = await computeDealProbability(dealId);
      } else {
        result = cached.prediction;
      }

      setPrediction(result);
    } catch (err) {
      console.error('Error fetching deal probability:', err);
      setError(err instanceof Error ? err.message : 'Failed to get prediction');
      setPrediction(null);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  // Compute fresh prediction
  const compute = useCallback(async () => {
    if (!dealId) return null;

    setLoading(true);
    setError(null);

    try {
      const result = await computeDealProbability(dealId);
      setPrediction(result);
      return result;
    } catch (err) {
      console.error('Error computing deal probability:', err);
      setError(err instanceof Error ? err.message : 'Failed to compute prediction');
      return null;
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  // Load on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  return { prediction, loading, error, refresh, compute };
}

/**
 * Hook for task ETA prediction
 */
export function useTaskEta(taskId: string | null) {
  const [prediction, setPrediction] = useState<TaskEtaResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!taskId) {
      setPrediction(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Try to get cached prediction first
      const cached = await getLatestTaskEta(taskId);

      // If no cached prediction or it's stale (>1 hour), compute new one
      const STALENESS_MS = 60 * 60 * 1000;
      const isStale = cached?.createdAt
        ? (Date.now() - new Date(cached.createdAt).getTime()) > STALENESS_MS
        : false;

      let result: TaskEtaResult;
      if (!cached || isStale) {
        result = await computeTaskEta(taskId);
      } else {
        result = cached.prediction;
      }

      setPrediction(result);
    } catch (err) {
      console.error('Error fetching task ETA:', err);
      setError(err instanceof Error ? err.message : 'Failed to get prediction');
      setPrediction(null);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  // Compute fresh prediction
  const compute = useCallback(async () => {
    if (!taskId) return null;

    setLoading(true);
    setError(null);

    try {
      const result = await computeTaskEta(taskId);
      setPrediction(result);
      return result;
    } catch (err) {
      console.error('Error computing task ETA:', err);
      setError(err instanceof Error ? err.message : 'Failed to compute prediction');
      return null;
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  // Load on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  return { prediction, loading, error, refresh, compute };
}

/**
 * Get color for probability score
 */
export function getProbabilityColor(probability: number): string {
  if (probability >= 70) return '#22c55e'; // green
  if (probability >= 40) return '#f59e0b'; // amber
  return '#ef4444'; // red
}

/**
 * Get background color for probability badge
 */
export function getProbabilityBgColor(probability: number): string {
  if (probability >= 70) return '#dcfce7'; // green-100
  if (probability >= 40) return '#fef3c7'; // amber-100
  return '#fee2e2'; // red-100
}

/**
 * Get color for confidence level
 */
export function getConfidenceColor(confidence: 'low' | 'medium' | 'high'): string {
  switch (confidence) {
    case 'high': return '#22c55e';
    case 'medium': return '#f59e0b';
    case 'low': return '#9ca3af';
    default: return '#9ca3af';
  }
}

/**
 * Format predicted date for display
 */
export function formatPredictedDate(isoDate: string): string {
  const date = new Date(isoDate);
  const today = new Date();
  const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
  if (diffDays <= 7) return `In ${diffDays} days`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default { useDealProbability, useTaskEta };
