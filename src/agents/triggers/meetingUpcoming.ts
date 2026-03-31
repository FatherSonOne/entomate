/**
 * Meeting Upcoming Trigger
 * Fires before a meeting starts to prepare intelligence context.
 * Follows the same pattern as meetingCompleted.ts.
 */

import { supabase } from '../../lib/supabase';
import type { TriggerEvent } from '../types';

export interface MeetingUpcomingConfig {
  minutesBefore?: number;  // How many minutes before meeting to trigger (default: 30)
}

export interface MeetingUpcomingContext {
  meeting: {
    id: string;
    title: string;
    scheduled_at?: string;
    start_time?: string;
    participants?: string[];
    attendees?: string[];
    status?: string;
  };
  intelligenceConfig?: {
    id: string;
    profileId: string | null;
    status: string;
  };
}

/**
 * Evaluate if the meeting should trigger context assembly
 */
export async function evaluate(
  config: MeetingUpcomingConfig,
  context: MeetingUpcomingContext
): Promise<boolean> {
  const { meeting, intelligenceConfig } = context;

  if (!meeting) {
    console.log('[Trigger:meeting.upcoming] No meeting in context');
    return false;
  }

  // Must have an intelligence config with a profile assigned
  if (!intelligenceConfig || !intelligenceConfig.profileId) {
    console.log('[Trigger:meeting.upcoming] No intelligence profile assigned');
    return false;
  }

  // Context must not already be assembled
  if (intelligenceConfig.status !== 'pending') {
    console.log(`[Trigger:meeting.upcoming] Config status is '${intelligenceConfig.status}', not 'pending'`);
    return false;
  }

  // Check if meeting hasn't already passed
  const scheduledAt = meeting.scheduled_at || meeting.start_time;
  if (scheduledAt) {
    const meetingTime = new Date(scheduledAt);
    const now = new Date();

    if (meetingTime < now) {
      console.log('[Trigger:meeting.upcoming] Meeting has already passed');
      return false;
    }

    // Optional: check if within the "minutes before" window
    const minutesBefore = config.minutesBefore || 30;
    const triggerTime = new Date(meetingTime.getTime() - minutesBefore * 60 * 1000);

    if (now < triggerTime) {
      console.log(`[Trigger:meeting.upcoming] Too early — meeting is ${Math.round((meetingTime.getTime() - now.getTime()) / 60000)} minutes away`);
      return false;
    }
  }

  return true;
}

/**
 * Create trigger event from meeting data
 */
export function createTriggerEvent(
  meetingId: string,
  meeting: MeetingUpcomingContext['meeting'],
  intelligenceConfig?: MeetingUpcomingContext['intelligenceConfig']
): TriggerEvent {
  return {
    type: 'meeting.upcoming',
    timestamp: new Date().toISOString(),
    sourceId: `meeting:${meetingId}:upcoming:${Date.now()}`,
    payload: {
      meetingId,
      title: meeting.title,
      scheduledAt: meeting.scheduled_at || meeting.start_time,
      participants: meeting.participants || meeting.attendees || [],
      intelligenceConfig,
    },
  };
}

/**
 * Find meetings that are upcoming and need context assembly
 */
export async function findUpcomingMeetingsNeedingContext(
  minutesBefore: number = 30
): Promise<any[]> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + minutesBefore * 60 * 1000);

  // Find meetings with intelligence configs in 'pending' status
  // that are scheduled within the upcoming window
  const { data: configs, error: configError } = await supabase
    .from('meeting_intelligence_config')
    .select('meeting_id, id, profile_id, status')
    .eq('status', 'pending')
    .not('profile_id', 'is', null);

  if (configError || !configs || configs.length === 0) return [];

  const meetingIds = configs.map(c => c.meeting_id);

  const { data: meetings, error } = await supabase
    .from('meetings')
    .select('id, title, start_time, scheduled_at, participants, attendees')
    .in('id', meetingIds)
    .order('start_time', { ascending: true });

  if (error || !meetings) return [];

  // Filter to meetings within the window
  return meetings.filter(m => {
    const scheduledAt = m.scheduled_at || m.start_time;
    if (!scheduledAt) return true; // No time set — include for safety
    const meetingTime = new Date(scheduledAt);
    return meetingTime >= now && meetingTime <= windowEnd;
  }).map(m => ({
    ...m,
    intelligenceConfig: configs.find(c => c.meeting_id === m.id),
  }));
}
