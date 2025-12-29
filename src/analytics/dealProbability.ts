/**
 * Deal Close Probability Prediction
 * Baseline rule-based model for predicting deal close probability
 */

import { supabase } from '../lib/supabase';
import { logosVisionSupabase, getConnectionInfo } from '../lib/logosVisionClient';
import { getModelVersion } from './modelRegistry';
import { formatEntityId } from '../graph/idFormat';
import type { DealProbabilityResult, DealData, DealStats } from './types';

/**
 * Stage score adjustments
 */
const STAGE_SCORES: Record<string, number> = {
  'discovery': 0,
  'qualification': 5,
  'proposal': 10,
  'negotiation': 20,
  'verbal_commit': 30,
  'closed_won': 50,
  'closed_lost': -50
};

/**
 * Clamp a number between min and max
 */
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Calculate days since a date
 */
function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Fetch deal data from Logos Vision CRM or local database
 */
async function getDealData(dealId: string): Promise<DealData | null> {
  console.log('[DealProbability] Fetching deal:', dealId);

  const connectionInfo = getConnectionInfo();

  // Try to fetch from Logos Vision CRM if configured
  if (connectionInfo.isConfigured) {
    try {
      // Query Logos Vision projects table (deals are often stored as projects)
      const { data: project, error } = await logosVisionSupabase
        .from('projects')
        .select('id, name, status, start_date, end_date, created_at, updated_at')
        .eq('entomate_deal_id', dealId)
        .single();

      if (project && !error) {
        // Map Logos Vision project status to deal stage
        const stageMapping: Record<string, string> = {
          'Lead': 'discovery',
          'Proposal': 'proposal',
          'Active': 'negotiation',
          'Completed': 'closed_won',
          'Cancelled': 'closed_lost'
        };

        return {
          id: dealId,
          stage: stageMapping[project.status] || 'discovery',
          value: 0, // Value would come from a separate field if available
          updated_at: project.updated_at || project.created_at,
          created_at: project.created_at
        };
      }
    } catch (err) {
      console.warn('[DealProbability] Error fetching from Logos Vision:', err);
    }
  }

  // Fallback: Try to fetch from local deals table
  const { data: localDeal, error: localError } = await supabase
    .from('deals')
    .select('*')
    .eq('id', dealId)
    .single();

  if (localDeal && !localError) {
    return {
      id: localDeal.id,
      stage: localDeal.stage || 'discovery',
      value: localDeal.value || 0,
      updated_at: localDeal.updated_at,
      created_at: localDeal.created_at
    };
  }

  console.warn('[DealProbability] Deal not found in any source:', dealId);
  return null;
}

/**
 * Fetch deal statistics (tasks, meetings, activity)
 */
async function getDealStats(dealId: string): Promise<DealStats> {
  const prefixedId = formatEntityId('deal', dealId);
  const connectionInfo = getConnectionInfo();

  let overdueHighTasks = 0;
  let overdueMediumTasks = 0;
  let completedTasks = 0;
  let totalTasks = 0;
  let lastMeetingDaysAgo: number | null = null;
  let lastActivityDaysAgo: number | null = null;
  let meetingSentiment: 'positive' | 'neutral' | 'negative' | undefined;

  // Fetch tasks from Logos Vision if configured
  if (connectionInfo.isConfigured) {
    try {
      const { data: tasks } = await logosVisionSupabase
        .from('tasks')
        .select('id, status, priority, due_date')
        .eq('entomate_deal_id', dealId);

      if (tasks && tasks.length > 0) {
        const now = new Date();
        totalTasks = tasks.length;
        completedTasks = tasks.filter(t => t.status === 'Done').length;

        for (const task of tasks) {
          if (task.due_date && task.status !== 'Done') {
            const dueDate = new Date(task.due_date);
            if (dueDate < now) {
              if (task.priority === 'high') overdueHighTasks++;
              else if (task.priority === 'medium') overdueMediumTasks++;
            }
          }
        }
      }

      // Fetch last activity/meeting
      const { data: activities } = await logosVisionSupabase
        .from('activities')
        .select('id, type, activity_date')
        .eq('entomate_deal_id', dealId)
        .order('activity_date', { ascending: false })
        .limit(1);

      if (activities && activities.length > 0) {
        lastActivityDaysAgo = daysSince(activities[0].activity_date);
        if (activities[0].type === 'Meeting') {
          lastMeetingDaysAgo = lastActivityDaysAgo;
        }
      }
    } catch (err) {
      console.warn('[DealProbability] Error fetching stats from Logos Vision:', err);
    }
  }

  // Also check local relationships and tasks
  const { data: relationships } = await supabase
    .from('relationships')
    .select('*')
    .or(`source_id.eq.${prefixedId},target_id.eq.${prefixedId}`);

  // Get task IDs from relationships
  const taskRelationships = (relationships || []).filter(
    r => r.target_type === 'task' || r.source_type === 'task'
  );
  const localTaskIds = taskRelationships.map(r =>
    r.target_type === 'task' ? r.target_id : r.source_id
  ).map(id => id.replace('task:', ''));

  if (localTaskIds.length > 0) {
    const { data: localTasks } = await supabase
      .from('tasks')
      .select('id, status, priority, due_date')
      .in('id', localTaskIds);

    if (localTasks) {
      const now = new Date();
      totalTasks += localTasks.length;
      completedTasks += localTasks.filter(t => t.status === 'completed' || t.status === 'done').length;

      for (const task of localTasks) {
        if (task.due_date && task.status !== 'completed' && task.status !== 'done') {
          const dueDate = new Date(task.due_date);
          if (dueDate < now) {
            if (task.priority === 'high') overdueHighTasks++;
            else if (task.priority === 'medium') overdueMediumTasks++;
          }
        }
      }
    }
  }

  // Get meeting relationships for sentiment
  const meetingRelationships = (relationships || []).filter(
    r => r.target_type === 'meeting' || r.source_type === 'meeting'
  );
  const meetingIds = meetingRelationships.map(r =>
    r.target_type === 'meeting' ? r.target_id : r.source_id
  ).map(id => id.replace('meeting:', ''));

  if (meetingIds.length > 0) {
    const { data: meetings } = await supabase
      .from('entomate_meetings')
      .select('id, sentiment_label, created_at')
      .in('id', meetingIds)
      .order('created_at', { ascending: false })
      .limit(1);

    if (meetings && meetings.length > 0) {
      const latestMeeting = meetings[0];
      if (lastMeetingDaysAgo === null) {
        lastMeetingDaysAgo = daysSince(latestMeeting.created_at);
      }
      meetingSentiment = latestMeeting.sentiment_label as 'positive' | 'neutral' | 'negative' | undefined;
    }
  }

  return {
    overdueHighTasks,
    overdueMediumTasks,
    completedTasks,
    totalTasks,
    lastMeetingDaysAgo,
    lastActivityDaysAgo: lastActivityDaysAgo ?? 7,
    meetingSentiment
  };
}

/**
 * Compute deal close probability using baseline rules
 */
export async function computeDealProbability(
  dealId: string
): Promise<DealProbabilityResult> {
  const deal = await getDealData(dealId);
  if (!deal) {
    throw new Error(`Deal not found: ${dealId}`);
  }

  const stats = await getDealStats(dealId);

  let score = 50; // Base score
  const reasons: string[] = [];
  const riskFlags: string[] = [];

  // Stage adjustment
  const stageScore = STAGE_SCORES[deal.stage?.toLowerCase()] ?? 0;
  if (stageScore !== 0) {
    score += stageScore;
    reasons.push(`${stageScore > 0 ? '+' : ''}${stageScore} ${deal.stage} stage`);
  }

  // Activity adjustment
  if (stats.lastMeetingDaysAgo !== null) {
    if (stats.lastMeetingDaysAgo <= 7) {
      score += 10;
      reasons.push('+10 recent meeting');
    } else if (stats.lastMeetingDaysAgo > 14) {
      score -= 10;
      riskFlags.push('no_recent_meeting');
      reasons.push('-10 no meeting in 14+ days');
    }
  }

  // Task adjustments
  if (stats.overdueHighTasks > 0) {
    const penalty = Math.min(30, stats.overdueHighTasks * 10);
    score -= penalty;
    riskFlags.push('overdue_tasks');
    reasons.push(`-${penalty} overdue high priority tasks`);
  }

  if (stats.completedTasks > 0) {
    const bonus = Math.min(15, stats.completedTasks * 5);
    score += bonus;
    reasons.push(`+${bonus} completed deliverables`);
  }

  // Sentiment adjustment
  if (stats.meetingSentiment === 'negative') {
    score -= 10;
    riskFlags.push('negative_sentiment');
    reasons.push('-10 negative meeting sentiment');
  } else if (stats.meetingSentiment === 'positive') {
    score += 5;
    reasons.push('+5 positive meeting sentiment');
  }

  // Clamp final score
  score = clamp(score, 0, 100);

  const result: DealProbabilityResult = {
    dealId,
    probability: score,
    riskFlags,
    explanation: reasons.slice(0, 4).join('; '),
    modelVersion: getModelVersion('deal_close_probability')
  };

  // Store prediction
  await storePrediction('deal_close_probability', 'deal', dealId, result);

  return result;
}

/**
 * Store prediction in database
 */
async function storePrediction(
  predictionType: string,
  entityType: string,
  entityId: string,
  result: DealProbabilityResult
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
    console.error('[DealProbability] Failed to store prediction:', error);
  }
}

/**
 * Get latest prediction for a deal
 */
export async function getLatestDealProbability(
  dealId: string
): Promise<DealProbabilityResult | null> {
  const prefixedId = formatEntityId('deal', dealId);

  const { data, error } = await supabase
    .from('predictions')
    .select('*')
    .eq('entity_type', 'deal')
    .eq('entity_id', prefixedId)
    .eq('prediction_type', 'deal_close_probability')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data.predicted_value as DealProbabilityResult;
}
