/**
 * Meeting Completed Trigger
 * Fires when a meeting is marked as completed with transcript ready
 */

import { supabase } from '../../lib/supabase';
import type { TriggerEvent } from '../types';

export interface MeetingCompletedConfig {
  minDurationSec?: number;
  mustHaveTranscript?: boolean;
  projectTypes?: string[];
}

export interface MeetingContext {
  meeting: {
    id: string;
    title: string;
    transcript?: string;
    summary?: string;
    duration_seconds?: number;
    status: string;
    project_id?: string;
    deal_id?: string;
    participants?: string[];
    created_at: string;
    completed_at?: string;
  };
}

/**
 * Evaluate if the meeting meets trigger conditions
 */
export async function evaluate(
  config: MeetingCompletedConfig,
  context: MeetingContext
): Promise<boolean> {
  const {
    minDurationSec = 60,
    mustHaveTranscript = true
  } = config;

  const { meeting } = context;

  if (!meeting) {
    console.log('[Trigger:meeting.completed] No meeting in context');
    return false;
  }

  // Check if meeting is completed
  if (meeting.status !== 'completed') {
    console.log('[Trigger:meeting.completed] Meeting not completed');
    return false;
  }

  // Check transcript requirement
  if (mustHaveTranscript && !meeting.transcript) {
    console.log('[Trigger:meeting.completed] Meeting has no transcript');
    return false;
  }

  // Check minimum duration
  if (meeting.duration_seconds && meeting.duration_seconds < minDurationSec) {
    console.log(`[Trigger:meeting.completed] Meeting too short: ${meeting.duration_seconds}s < ${minDurationSec}s`);
    return false;
  }

  return true;
}

/**
 * Create trigger event from meeting data
 */
export function createTriggerEvent(meetingId: string, meeting: MeetingContext['meeting']): TriggerEvent {
  return {
    type: 'meeting.completed',
    timestamp: meeting.completed_at || new Date().toISOString(),
    sourceId: `meeting:${meetingId}:completed:${Date.now()}`,
    payload: {
      meetingId,
      title: meeting.title,
      projectId: meeting.project_id,
      dealId: meeting.deal_id,
      participants: meeting.participants,
      durationSeconds: meeting.duration_seconds,
      hasTranscript: !!meeting.transcript,
      hasSummary: !!meeting.summary
    }
  };
}

/**
 * Fetch meeting data by ID
 */
export async function getMeetingById(meetingId: string): Promise<MeetingContext['meeting'] | null> {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', meetingId)
    .single();

  if (error || !data) {
    console.error('[Trigger:meeting.completed] Failed to fetch meeting:', error);
    return null;
  }

  return data;
}

/**
 * Find meetings that should trigger this event
 * (Called by scheduler/webhook handler)
 */
export async function findPendingMeetings(): Promise<MeetingContext['meeting'][]> {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('status', 'completed')
    .not('transcript', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[Trigger:meeting.completed] Failed to find pending meetings:', error);
    return [];
  }

  return data || [];
}
