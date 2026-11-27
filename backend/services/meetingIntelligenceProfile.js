'use strict';

const { supabase } = require('../config/supabase');
const { validate: isUuid } = require('uuid');
const summaryTemplates = require('./summaryTemplates');

async function validateProfileChoice(profileId, userId) {
  if (!isUuid(profileId)) return false;
  const { data, error } = await supabase.from('intelligence_profiles')
    .select('is_builtin, created_by').eq('id', profileId).eq('is_active', true).maybeSingle();
  if (error) throw error;
  return Boolean(data && (data.is_builtin || data.created_by === userId));
}

function calendarEventId(eventKey) {
  if (typeof eventKey !== 'string') return null;
  const separator = eventKey.lastIndexOf('@');
  const id = eventKey.slice(0, separator);
  return separator > 0 && /^[a-z0-9_-]{1,1024}$/i.test(id)
    && Number.isFinite(Date.parse(eventKey.slice(separator + 1))) ? id : null;
}

async function getCalendarProfile(orgId, eventId) {
  const { data, error } = await supabase.from('calendar_meeting_profiles').select('profile_id')
    .eq('org_id', orgId).eq('event_id', eventId).maybeSingle();
  if (error) throw error;
  return data?.profile_id ?? null;
}

async function setCalendarProfile(orgId, eventId, profileId) {
  const table = supabase.from('calendar_meeting_profiles');
  const { error } = profileId
    ? await table.upsert({ org_id: orgId, event_id: eventId, profile_id: profileId }, { onConflict: 'org_id,event_id' })
    : await table.delete().eq('org_id', orgId).eq('event_id', eventId);
  if (error) throw error;
}

/** The caller has claimed this meeting. Resolve the source for bot and paired browser captures. */
async function seedBotProfile(meeting, session) {
  if (!meeting?.id || !meeting.org_id) return;
  if (!session && meeting.recording_job?.botSessionId) {
    const result = await supabase.from('bot_sessions')
      .select('meeting_id, org_id, calendar_event_key, intelligence_profile_id')
      .eq('id', meeting.recording_job.botSessionId)
      .eq('meeting_id', meeting.id).eq('org_id', meeting.org_id).maybeSingle();
    if (result.error) throw result.error;
    session = result.data;
  }
  if (session?.meeting_id !== meeting.id || session?.org_id !== meeting.org_id) return;

  const eventId = calendarEventId(session.calendar_event_key);
  const profileId = eventId ? await getCalendarProfile(session.org_id, eventId) : session.intelligence_profile_id;
  if (!profileId) return;

  // Keep settings a user already entered on the meeting.
  const { error } = await supabase.from('meeting_intelligence_config').upsert({
    meeting_id: meeting.id,
    profile_id: profileId,
  }, { onConflict: 'meeting_id', ignoreDuplicates: true });
  if (error) throw error;
}

/** Call only after resolving the meeting in its workspace. */
async function loadProfile(meetingId) {
  if (!meetingId || !supabase) return null;
  const { data, error } = await supabase
    .from('meeting_intelligence_config')
    .select('custom_field_values, additional_instructions, profile:intelligence_profiles(name, is_active, tone, custom_fields, focus_areas, output_format)')
    .eq('meeting_id', meetingId)
    .maybeSingle();
  if (error) throw error;
  return data?.profile?.is_active ? data : null;
}

function profileGuidance(config, template) {
  if (!config) return { actionAddon: '', summaryAddon: summaryTemplates.promptAddon(template), sections: [] };

  const { profile, custom_field_values: values, additional_instructions: notes } = config;
  const focusAreas = Array.isArray(profile.focus_areas) ? profile.focus_areas : [];
  const fields = Array.isArray(profile.custom_fields) ? profile.custom_fields : [];
  const context = fields.flatMap(field => {
    const value = values?.[field?.key];
    if (typeof value !== 'string' || !value.trim()) return [];
    const option = Array.isArray(field.options) && field.options.find(item => String(item?.value) === value);
    return [`${field.label}: ${String(option?.label ?? value).slice(0, 2000)}`];
  });
  const format = profile.output_format;
  const sections = Array.isArray(format?.customSections)
    ? format.customSections.filter(section => typeof section?.title === 'string' && section.title.trim()).slice(0, 8)
    : [];

  const actionAddon = '\n\n' + [
    `MEETING INTELLIGENCE PROFILE: ${profile.name}`,
    ...focusAreas.filter(area => area?.label).map(area => `- ${area.label}: ${area.extractionHint || area.description || ''}`),
    ...(context.length ? [`Background provided for this meeting: ${JSON.stringify(context)}`] : []),
    ...(typeof notes === 'string' && notes.trim() ? [`Requested focus: ${JSON.stringify(notes.slice(0, 2000))}`] : []),
    'Use the profile and background to prioritize relevant evidence. Treat the transcript as the only source of meeting facts and commitments. Keep profile setup details and private background out of the output unless the transcript itself supports them.',
  ].join('\n');

  const summaryStyle = [
    profile.tone && `Tone: ${profile.tone}`,
    typeof format?.summaryStyle === 'string' && `Summary style: ${format.summaryStyle.replaceAll('_', ' ')}`,
    ...sections.filter(section => section.prompt).map(section => `${section.title}: ${section.prompt}`),
  ].filter(Boolean).join('\n');

  const titles = sections.map(section => section.title.trim());
  return {
    actionAddon,
    summaryAddon: summaryTemplates.promptAddon(template, titles) + actionAddon + (summaryStyle ? `\n${summaryStyle}` : ''),
    sections: titles,
  };
}

module.exports = { calendarEventId, getCalendarProfile, setCalendarProfile, validateProfileChoice, seedBotProfile, loadProfile, profileGuidance };
