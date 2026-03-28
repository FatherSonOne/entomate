/**
 * Analytics Service
 * Tracks profile usage through the suggestion → selection → completion pipeline
 * and aggregates effectiveness metrics for the learning feedback loop.
 */

import { supabase } from '../lib/supabase';

// ==================== TYPES ====================

export interface ProfileEffectiveness {
  profileId: string;
  timesSuggested: number;
  timesAccepted: number;
  timesDismissed: number;
  timesManuallySelected: number;
  timesCompleted: number;
  acceptanceRate: number;
  completionRate: number;
  avgUserRating: number | null;
  avgOutputQuality: number | null;
  avgActionItems: number | null;
  avgContextSources: number | null;
  avgContextTokens: number | null;
  lastUsedAt: string | null;
}

// ==================== EVENT TRACKING ====================

export async function trackSuggestion(
  meetingId: string,
  profileId: string,
  confidence: number
): Promise<string | null> {
  const { data, error } = await supabase
    .from('intelligence_profile_analytics')
    .insert([{
      profile_id: profileId,
      meeting_id: meetingId,
      was_suggested: true,
      suggestion_confidence: confidence,
      suggested_at: new Date().toISOString(),
    }])
    .select('id')
    .single();

  if (error) {
    console.error('[Intelligence:analytics] Failed to track suggestion:', error);
    return null;
  }
  return data?.id || null;
}

export async function trackAccepted(analyticsId: string): Promise<void> {
  const { error } = await supabase
    .from('intelligence_profile_analytics')
    .update({ suggestion_accepted: true, selected_at: new Date().toISOString() })
    .eq('id', analyticsId);

  if (error) console.error('[Intelligence:analytics] Failed to track accepted:', error);
}

export async function trackDismissed(analyticsId: string): Promise<void> {
  const { error } = await supabase
    .from('intelligence_profile_analytics')
    .update({ suggestion_dismissed: true })
    .eq('id', analyticsId);

  if (error) console.error('[Intelligence:analytics] Failed to track dismissed:', error);
}

export async function trackManualSelection(
  meetingId: string,
  profileId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('intelligence_profile_analytics')
    .insert([{
      profile_id: profileId,
      meeting_id: meetingId,
      was_manually_selected: true,
      selected_at: new Date().toISOString(),
    }])
    .select('id')
    .single();

  if (error) {
    console.error('[Intelligence:analytics] Failed to track manual selection:', error);
    return null;
  }
  return data?.id || null;
}

export async function trackContextAssembled(
  analyticsId: string,
  sourcesCount: number,
  tokenCount: number
): Promise<void> {
  const { error } = await supabase
    .from('intelligence_profile_analytics')
    .update({
      context_assembled: true,
      context_sources_count: sourcesCount,
      context_token_count: tokenCount,
      context_assembled_at: new Date().toISOString(),
    })
    .eq('id', analyticsId);

  if (error) console.error('[Intelligence:analytics] Failed to track context assembled:', error);
}

export async function trackMeetingCompleted(
  meetingId: string,
  durationSeconds: number,
  actionItemCount: number
): Promise<void> {
  const { error } = await supabase
    .from('intelligence_profile_analytics')
    .update({
      meeting_completed: true,
      meeting_duration_seconds: durationSeconds,
      action_items_extracted: actionItemCount,
      meeting_completed_at: new Date().toISOString(),
    })
    .eq('meeting_id', meetingId);

  if (error) console.error('[Intelligence:analytics] Failed to track meeting completed:', error);

  // Update effectiveness for the profile
  const { data } = await supabase
    .from('intelligence_profile_analytics')
    .select('profile_id')
    .eq('meeting_id', meetingId)
    .single();

  if (data?.profile_id) {
    await updateProfileEffectiveness(data.profile_id);
  }
}

export async function trackFeedback(
  meetingId: string,
  rating: number,
  feedback?: string
): Promise<void> {
  const { error } = await supabase
    .from('intelligence_profile_analytics')
    .update({
      user_rating: rating,
      user_feedback: feedback || null,
      feedback_at: new Date().toISOString(),
    })
    .eq('meeting_id', meetingId);

  if (error) console.error('[Intelligence:analytics] Failed to track feedback:', error);

  // Update effectiveness
  const { data } = await supabase
    .from('intelligence_profile_analytics')
    .select('profile_id')
    .eq('meeting_id', meetingId)
    .single();

  if (data?.profile_id) {
    await updateProfileEffectiveness(data.profile_id);
  }
}

// ==================== EFFECTIVENESS AGGREGATION ====================

export async function updateProfileEffectiveness(profileId: string): Promise<void> {
  const { data: records, error } = await supabase
    .from('intelligence_profile_analytics')
    .select('*')
    .eq('profile_id', profileId);

  if (error || !records || records.length === 0) return;

  const suggested = records.filter(r => r.was_suggested);
  const accepted = records.filter(r => r.suggestion_accepted);
  const dismissed = records.filter(r => r.suggestion_dismissed);
  const manual = records.filter(r => r.was_manually_selected);
  const completed = records.filter(r => r.meeting_completed);
  const rated = records.filter(r => r.user_rating != null);
  const withQuality = records.filter(r => r.output_quality_score != null);
  const withContext = records.filter(r => r.context_assembled);

  const totalUsed = accepted.length + manual.length;

  const effectiveness = {
    profile_id: profileId,
    times_suggested: suggested.length,
    times_accepted: accepted.length,
    times_dismissed: dismissed.length,
    times_manually_selected: manual.length,
    times_completed: completed.length,
    acceptance_rate: suggested.length > 0 ? accepted.length / suggested.length : 0,
    completion_rate: totalUsed > 0 ? completed.length / totalUsed : 0,
    avg_user_rating: rated.length > 0 ? rated.reduce((s, r) => s + r.user_rating, 0) / rated.length : null,
    avg_output_quality: withQuality.length > 0 ? withQuality.reduce((s, r) => s + r.output_quality_score, 0) / withQuality.length : null,
    avg_action_items: completed.length > 0 ? completed.reduce((s, r) => s + (r.action_items_extracted || 0), 0) / completed.length : null,
    avg_context_sources: withContext.length > 0 ? withContext.reduce((s, r) => s + (r.context_sources_count || 0), 0) / withContext.length : null,
    avg_context_tokens: withContext.length > 0 ? withContext.reduce((s, r) => s + (r.context_token_count || 0), 0) / withContext.length : null,
    last_used_at: records.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.created_at || null,
    updated_at: new Date().toISOString(),
  };

  await supabase
    .from('intelligence_profile_effectiveness')
    .upsert(effectiveness, { onConflict: 'profile_id' });
}

export async function updateAllProfileEffectiveness(): Promise<void> {
  const { data: profiles } = await supabase
    .from('intelligence_profiles')
    .select('id')
    .eq('is_active', true);

  if (!profiles) return;

  for (const p of profiles) {
    await updateProfileEffectiveness(p.id);
  }
}

export async function getProfileEffectiveness(profileId: string): Promise<ProfileEffectiveness | null> {
  const { data, error } = await supabase
    .from('intelligence_profile_effectiveness')
    .select('*')
    .eq('profile_id', profileId)
    .single();

  if (error || !data) return null;

  return {
    profileId: data.profile_id,
    timesSuggested: data.times_suggested || 0,
    timesAccepted: data.times_accepted || 0,
    timesDismissed: data.times_dismissed || 0,
    timesManuallySelected: data.times_manually_selected || 0,
    timesCompleted: data.times_completed || 0,
    acceptanceRate: data.acceptance_rate || 0,
    completionRate: data.completion_rate || 0,
    avgUserRating: data.avg_user_rating,
    avgOutputQuality: data.avg_output_quality,
    avgActionItems: data.avg_action_items,
    avgContextSources: data.avg_context_sources,
    avgContextTokens: data.avg_context_tokens,
    lastUsedAt: data.last_used_at,
  };
}

export async function getAllProfileEffectiveness(): Promise<ProfileEffectiveness[]> {
  const { data, error } = await supabase
    .from('intelligence_profile_effectiveness')
    .select('*')
    .order('times_completed', { ascending: false });

  if (error || !data) return [];

  return data.map(d => ({
    profileId: d.profile_id,
    timesSuggested: d.times_suggested || 0,
    timesAccepted: d.times_accepted || 0,
    timesDismissed: d.times_dismissed || 0,
    timesManuallySelected: d.times_manually_selected || 0,
    timesCompleted: d.times_completed || 0,
    acceptanceRate: d.acceptance_rate || 0,
    completionRate: d.completion_rate || 0,
    avgUserRating: d.avg_user_rating,
    avgOutputQuality: d.avg_output_quality,
    avgActionItems: d.avg_action_items,
    avgContextSources: d.avg_context_sources,
    avgContextTokens: d.avg_context_tokens,
    lastUsedAt: d.last_used_at,
  }));
}

// ==================== OUTPUT QUALITY SCORING ====================

export function computeOutputQuality(meeting: {
  summary?: string;
  actionItemCount: number;
  keyPointsCount: number;
  decisionsCount: number;
  durationSeconds: number;
}): number {
  let score = 0.5;

  if (meeting.summary && meeting.summary.length > 100) score += 0.1;
  if (meeting.actionItemCount > 0) score += 0.1;
  score += Math.min(0.15, (meeting.actionItemCount - 1) * 0.05);
  if (meeting.keyPointsCount > 2) score += 0.05;
  if (meeting.decisionsCount > 0) score += 0.05;
  if (meeting.durationSeconds > 300) score += 0.05;

  return Math.min(1.0, Math.max(0, score));
}
