/**
 * What the person sees about a bot session: its phase (scheduled, live,
 * processing, ready...) and, once the call ends, the debrief: how far the
 * pipeline got (transcript, summary, action items, audio) and where each
 * piece went. Pure functions over rows from bot_sessions, meetings,
 * action_items and bot_session_attendees, so the Bot page, the meeting page
 * and the "debrief takes focus" watcher all read the same answer.
 *
 * Debug fields (Recall bot id, callback hashes, URLs) never leave here.
 */

'use strict';

const LIVE = new Set(['in_call']);
const JOINING = new Set(['pending', 'launching', 'joining']);

/**
 * @param {object} session  bot_sessions row
 * @param {object|null} meeting  meetings row, null until the transcript is ingested
 * @param {number} [now]
 * @returns {'scheduled'|'joining'|'live'|'processing'|'ready'|'failed'|'stopped'}
 */
function sessionPhase(session, meeting, now = Date.now()) {
  const status = session?.status;
  if (status === 'failed' || status === 'timeout') return 'failed';
  if (LIVE.has(status)) return 'live';
  if (JOINING.has(status)) {
    const joinAt = session.join_at ? new Date(session.join_at).getTime() : 0;
    return joinAt > now + 60 * 1000 ? 'scheduled' : 'joining';
  }
  // completed, or stopped by hand after the bot was in the call
  if (meeting && meeting.summary) return 'ready';
  if (status === 'stopped' && !session.started_at) return 'stopped';
  if (!meeting) {
    // Ingest makes the meeting within a minute or two. Nothing after 20 minutes
    // means there was nothing to write up (an empty call, or a stop before anyone spoke).
    const ended = session.ended_at ? new Date(session.ended_at).getTime() : now;
    return now - ended > 20 * 60 * 1000 ? 'stopped' : 'processing';
  }
  return 'processing';
}

function durationMs(session, meeting) {
  const segs = Array.isArray(meeting?.transcript_segments) ? meeting.transcript_segments : [];
  const lastEnd = segs.reduce((m, s) => Math.max(m, Number(s?.endMs ?? s?.atMs ?? 0) || 0), 0);
  if (lastEnd > 0) return lastEnd;
  if (meeting?.duration_minutes) return meeting.duration_minutes * 60 * 1000;
  const start = session?.started_at ? new Date(session.started_at).getTime() : 0;
  const end = session?.ended_at ? new Date(session.ended_at).getTime() : 0;
  return start && end > start ? end - start : 0;
}

/** Pipeline steps for the debrief display, in the order they happen. */
function pipeline(session, meeting, actionItems) {
  const ended = ['completed', 'stopped'].includes(session?.status);
  const segs = Array.isArray(meeting?.transcript_segments) ? meeting.transcript_segments : null;
  const job = meeting?.recording_job || {};
  const audio = job.playbackFile
    ? { state: 'done', value: job.bytes ? `${(job.bytes / (1024 * 1024)).toFixed(1)} MB` : 'Saved' }
    : job.audioRemovedAt
      ? { state: 'done', value: 'Removed' }
      : job.source === 'bot'
        ? { state: 'done', value: 'Linked' }
        : { state: meeting ? 'working' : 'waiting', value: meeting ? 'Saving' : 'Waiting' };
  return [
    { key: 'left', label: 'Left the call', state: ended ? 'done' : 'waiting', value: ended ? 'Done' : 'In call' },
    {
      key: 'transcript', label: 'Transcript',
      state: segs ? 'done' : ended ? 'working' : 'waiting',
      value: segs ? `${segs.length} lines` : ended ? 'Writing' : 'Waiting'
    },
    {
      key: 'summary', label: 'Summary',
      state: meeting?.summary ? 'done' : segs ? 'working' : 'waiting',
      value: meeting?.summary ? (meeting.summary_template ? titleCase(meeting.summary_template) : 'Done') : segs ? 'Writing' : 'Waiting'
    },
    {
      key: 'actions', label: 'Action items',
      state: meeting?.summary ? 'done' : 'waiting',
      value: meeting?.summary ? String(actionItems.length) : 'Waiting'
    },
    { key: 'audio', label: 'Audio', ...audio }
  ];
}

function titleCase(s) {
  return String(s).replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function speakersOf(meeting) {
  const segs = Array.isArray(meeting?.transcript_segments) ? meeting.transcript_segments : [];
  const names = new Set(segs.map((s) => s?.speaker).filter(Boolean));
  if (names.size) return names.size;
  return Array.isArray(meeting?.attendees) ? meeting.attendees.length : 0;
}

/**
 * The view the app reads for one session.
 * @returns {object}
 */
function buildBotView({ session, meeting = null, actionItems = [], attendees = [], now = Date.now() }) {
  const phase = sessionPhase(session, meeting, now);
  const told = attendees.filter((a) => ['sent', 'skipped'].includes(a.email_status)).length;
  const optedOut = attendees.filter((a) => a.opted_out_at).length;
  const decisions = Array.isArray(meeting?.decisions) ? meeting.decisions.length : 0;
  return {
    sessionId: session.id,
    meetingId: session.meeting_id,
    title: meeting?.title || session.title || null,
    platform: session.platform,
    status: session.status,
    phase,
    joinAt: session.join_at || null,
    startedAt: session.started_at || null,
    endedAt: session.ended_at || null,
    launchedBy: session.consent_acknowledged_by || null,
    autoJoin: Boolean(session.calendar_event_key),
    // From Recall's in_call_recording / in_call_not_recording; null until Recall says.
    recording: typeof session.live_state?.recording === 'boolean' ? session.live_state.recording : null,
    captionsOn: typeof session.live_state?.captions === 'boolean' ? session.live_state.captions : null,
    failure: phase === 'failed' ? friendlyFailure(session.failure_reason) : null,
    meetingReady: Boolean(meeting),
    marks: (Array.isArray(session.marks) ? session.marks : []).map((m) => ({
      id: m.id, atMs: typeof m.atMs === 'number' ? m.atMs : null, quote: m.quote || null, speaker: m.speaker || null, note: m.note || null
    })),
    debrief: phase === 'live' || phase === 'joining' || phase === 'scheduled' ? null : {
      steps: pipeline(session, meeting, actionItems),
      durationMs: durationMs(session, meeting),
      speakers: speakersOf(meeting),
      decisions,
      actionItems: actionItems.length,
      invitees: { total: attendees.length, told, optedOut },
      audioSaved: Boolean(meeting?.recording_job?.playbackFile)
    }
  };
}

/** Recall's raw failure text, turned into something a person can act on. */
function friendlyFailure(reason) {
  const r = String(reason || '').toLowerCase();
  if (!r) return 'The bot could not finish this meeting.';
  if (r.includes('waiting_room') || r.includes('waiting room')) return 'Nobody let the bot in from the waiting room.';
  if (r.includes('denied') || r.includes('rejected')) return 'The host did not let the bot in.';
  if (r.includes('invalid') && r.includes('url')) return 'The meeting link did not work.';
  if (r.includes('meeting_not_found') || r.includes('not found') || r.includes('ended')) return 'The meeting had ended or the link expired.';
  if (r.includes('timeout')) return 'The bot waited too long to be let in.';
  if (r.includes('recall_launch_failed')) return 'The bot could not be started. Try again in a minute.';
  return 'The bot could not finish this meeting.';
}

module.exports = { buildBotView, sessionPhase, pipeline, durationMs, friendlyFailure };
