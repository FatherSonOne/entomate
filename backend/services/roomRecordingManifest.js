'use strict';

const AUDIO_EXTENSIONS = new Map([
  ['audio/webm', '.webm'], ['audio/wav', '.wav'], ['audio/x-wav', '.wav'],
  ['audio/aac', '.aac'], ['audio/mp4', '.aac'],
]);

function recordingOrigin(events, startSeconds) {
  for (const { type, data } of events) {
    if (type !== 'recording-media-started') continue;
    const prefix = String(data?.uri).split('/').at(-1).match(/^(\d{13})-/);
    if (prefix) return Number(prefix[1]);
  }
  return startSeconds * 1000;
}

function readManifest({ events }, recording, participants, keys) {
  if (!Array.isArray(events) || !events.length) throw new Error('Daily returned no recording events');
  const origin = recordingOrigin(events, recording.start_ts);
  if (!Number.isSafeInteger(origin)) throw new Error('Daily returned no recording start time');
  const timestamp = seconds => Math.round(seconds * 1000 - origin);
  const last = Math.max(...events.slice(-50).map(event => timestamp(event.ts)).filter(Number.isFinite), 0);
  const durationMs = Math.max(Math.round(recording.duration * 1000) || 0, last);
  if (durationMs <= 0 || durationMs > 7_260_000) throw new Error('Daily returned an invalid room audio duration');
  const roster = new Map(participants.map(person => [person.participant_id, person]));
  const files = new Map(keys.map(key => [key.split('/').at(-1), key]));
  const sessions = new Map();

  for (const { type, participant_id: sessionId, ts, data } of events) {
    const number = data?.trackSessionNum;
    if (number == null) continue;
    const atMs = timestamp(ts);
    if (type === 'track-added') {
      if (data.kind !== 'audio' || /^screen/i.test(data.trackType ?? '')) continue;
      sessions.set(number, { sessionId, label: data.displayName, pauses: [], pausedAt: data.paused ? atMs : null });
      continue;
    }
    const segment = sessions.get(number);
    if (!segment) continue;
    if (type === 'recording-media-started') {
      const base = String(data.uri).split('/').at(-1);
      const ext = AUDIO_EXTENSIONS.get(data.contentType) ?? '.webm';
      segment.key = files.get(base) ?? files.get(base + ext) ?? (ext === '.aac' ? files.get(base + '.mp4') : undefined);
      segment.startMs = Math.max(0, timestamp(data.mediaStartTime ?? ts));
      segment.hasMedia = true;
    } else if (type === 'track-paused') {
      segment.pausedAt ??= atMs;
    } else if (type === 'track-resumed' && segment.pausedAt != null) {
      segment.pauses.push({ startMs: segment.pausedAt, endMs: atMs });
      segment.pausedAt = null;
    } else if (type === 'track-removed') {
      segment.endMs = atMs;
    }
  }

  const people = new Map();
  const addPerson = (person, fallbackName) => {
    const witnessedAt = timestamp(person.join_time);
    let track = people.get(person.user_id);
    if (!track) {
      const label = String(person.user_name || fallbackName || 'Participant').trim().slice(0, 120);
      track = { label: label || 'Participant', segments: [], witnessedAt };
      people.set(person.user_id, track);
    } else if (Number.isFinite(witnessedAt)) {
      track.witnessedAt = Number.isFinite(track.witnessedAt) ? Math.min(witnessedAt, track.witnessedAt) : witnessedAt;
    }
    return track;
  };
  for (const person of participants) {
    const joined = timestamp(person.join_time);
    const left = joined + (person.duration ?? 0) * 1000;
    if (person.user_id && joined < durationMs && left > 0) addPerson(person);
  }
  for (const segment of sessions.values()) {
    const person = roster.get(segment.sessionId);
    if (!person?.user_id) return null;
    const track = addPerson(person, segment.label);
    if (segment.hasMedia && !segment.key) return null;
    if (!segment.key || !Number.isFinite(segment.startMs) || segment.startMs >= durationMs) continue;
    segment.endMs = Math.max(segment.startMs, Math.min(durationMs, segment.endMs ?? durationMs));
    if (segment.pausedAt != null) segment.pauses.push({ startMs: segment.pausedAt, endMs: segment.endMs });
    track.segments.push(segment);
  }

  return { origin, durationMs, people: [...people.values()] };
}

// Use the media duration as well as Daily's events. A truncated object ends
// coverage earlier than the track-removed event. The first join can be late.
function coverageGaps(segments, durationMs, witnessedAt) {
  const sorted = [...segments].sort((a, b) => a.startMs - b.startMs);
  const gaps = [];
  let through = Math.max(0, Number.isFinite(witnessedAt) ? witnessedAt : sorted[0]?.startMs ?? 0);
  for (const segment of sorted) {
    const end = Math.min(segment.endMs, segment.startMs + segment.mediaDurationMs, durationMs);
    if (segment.startMs > through + 750) gaps.push({ startMs: through, endMs: segment.startMs });
    for (const pause of segment.pauses) {
      const startMs = Math.max(through, segment.startMs, pause.startMs);
      const endMs = Math.min(end, pause.endMs);
      if (endMs > startMs + 750) gaps.push({ startMs, endMs });
    }
    through = Math.max(through, end);
  }
  if (through + 750 < durationMs) gaps.push({ startMs: through, endMs: durationMs });
  return gaps;
}

module.exports = { readManifest, coverageGaps };
