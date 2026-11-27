const express = require('express');
const rateLimit = require('express-rate-limit');
const { createHash, randomUUID } = require('node:crypto');
const { URL } = require('node:url');
const { z } = require('zod');
const { supabaseAdmin } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const { getOrgIdForUser, getOrgIdsForUser } = require('../utils/orgContext');
const ai = require('../config/ai');
const { meterAiForOrg } = require('../services/aiUsage');
const { generateInsights, transcriptKey, viewInsights } = require('../services/liveMeetingInsights');
const recorder = require('../services/meetingRecorder');
const log = require('../utils/log');

const router = express.Router();
const table = () => supabaseAdmin.from('live_meeting_rooms');
const configured = () => Boolean(supabaseAdmin && process.env.DAILY_API_KEY?.trim());
const roomColumns = 'id, host_id, org_id, invite_key, provider_name, url, title, with_notes, audio_only, created_at, expires_at, ending_at, ended_at, meeting_id';
const name = z.string().trim().min(1).max(120);
const createSchema = z.object({
  id: z.uuid(), title: z.string().trim().min(1).max(160), withNotes: z.boolean(), audioOnly: z.boolean(), recordAudio: z.boolean().optional(),
});
const joinSchema = z.object({
  name, acceptNotes: z.boolean().optional(), acceptRecording: z.boolean().optional(), guestId: z.uuid().optional(),
});
const recordingStart = z.object({ mimeType: z.string().max(120) });
const recordingFinish = z.object({
  pieces: z.number().int().min(1).max(1000),
  labels: z.object({ p1: name.optional(), p2: name.optional(), p3: name.optional() }),
});
const linesSchema = z.object({ lines: z.array(z.object({
  id: z.uuid(), atMs: z.number().int().min(0).max(14_400_000), speaker: name, text: z.string().trim().min(1).max(3000),
})).max(100) });

function fail(status, message) {
  return Object.assign(new Error(message), { status });
}

function parse(schema, data) {
  const checked = schema.safeParse(data);
  if (!checked.success) throw fail(400, 'Check the meeting details and try again.');
  return checked.data;
}

function route(handler, { needsDaily = true } = {}) {
  return async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      if (!supabaseAdmin || (needsDaily && !configured())) throw fail(503, 'Live rooms are not configured for this Entomate installation.');
      if (req.params.id && !z.uuid().safeParse(req.params.id).success) throw fail(404, 'Room not found.');
      await handler(req, res);
    } catch (error) {
      if (!error.status || error.status >= 500) log.warn('Live meeting request failed', { code: error.code, status: error.status });
      res.status(error.status || 500).json({ error: error.status ? error.message : 'The live room request failed. Try again.' });
    }
  };
}

async function daily(path, method = 'GET', payload, allowed = []) {
  let response;
  try {
    response = await globalThis.fetch(`https://api.daily.co/v1${path}`, {
      method, signal: globalThis.AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY.trim()}`, 'Content-Type': 'application/json' },
      body: payload && JSON.stringify(payload),
    });
  } catch {
    throw fail(502, 'The video service did not respond. Try again.');
  }
  if (allowed.includes(response.status)) return null;
  if (!response.ok) throw fail(502, 'The video service could not complete this request. Try again.');
  if (response.status === 204) return {};
  return response.json();
}

async function getRoom(id, userId, inviteKey) {
  let query = table().select(roomColumns).eq('id', id);
  if (userId) query = query.eq('host_id', userId);
  if (inviteKey) query = query.eq('invite_key', inviteKey);
  const { data: room, error } = await query.maybeSingle();
  if (error) throw error;
  if (!room) throw fail(404, 'Room not found.');
  if (userId && !(await getOrgIdsForUser(userId)).includes(room.org_id)) throw fail(404, 'Room not found.');
  return room;
}

function available(room) {
  return !room.ending_at && !room.ended_at && Date.parse(room.expires_at) > Date.now();
}

function view(room) {
  return {
    id: room.id, title: room.title, withNotes: room.with_notes, audioOnly: room.audio_only,
    openedAt: room.created_at, available: available(room), finished: Boolean(room.ended_at),
  };
}

async function roomView(room) {
  const audio = room.meeting_id && (await recorder.roomRecordingJob(room))?.recording_job;
  return { ...view(room), ...(audio ? { roomAudio: audio.status } : {}) };
}

function roomGuestId(roomId, nonce) {
  if (!nonce) return randomUUID();
  const digest = createHash('sha256').update(roomId + ':' + nonce).digest('hex');
  return digest.slice(0, 8) + '-' + digest.slice(8, 12) + '-4' + digest.slice(13, 16)
    + '-8' + digest.slice(17, 20) + '-' + digest.slice(20, 32);
}

async function tokenFor(room, userName, hostId, guestId, acceptRecording) {
  const current = await roomView(room);
  if (!hostId && current.roomAudio && !acceptRecording) {
    throw fail(400, 'Acknowledge room audio recording before joining.');
  }
  if (!available(room) || !room.url) throw fail(410, 'This live room has ended or is unavailable.');
  const result = await daily('/meeting-tokens', 'POST', { properties: {
    room_name: room.provider_name, exp: Math.floor(Date.parse(room.expires_at) / 1000),
    user_id: hostId || roomGuestId(room.id, guestId), user_name: userName, is_owner: Boolean(hostId),
  } });
  if (typeof result.token !== 'string' || !result.token) throw fail(502, 'The video service did not return access to this room.');
  if (!available(await getRoom(room.id, hostId))) throw fail(410, 'This live room has ended.');
  return { ...current, url: room.url, token: result.token, host: Boolean(hostId) };
}

router.get('/status', authenticate, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ configured: configured() });
});

router.get('/host', authenticate, route(async (req, res) => {
  const orgs = await getOrgIdsForUser(req.user.id);
  if (!orgs.length) return res.json({ rooms: [] });
  const { data, error } = await table().select(roomColumns).eq('host_id', req.user.id).in('org_id', orgs)
    .is('ended_at', null).not('url', 'is', null).order('created_at', { ascending: false }).limit(10);
  if (error) throw error;
  res.json({ rooms: data.map(view) });
}));

router.post('/', authenticate, rateLimit({
  windowMs: 60_000, limit: 8, keyGenerator: (req) => req.user.id,
}), route(async (req, res) => {
  const body = parse(createSchema, req.body);
  const orgId = await getOrgIdForUser(req.user.id);
  if (!orgId) throw fail(403, 'Create or join a workspace first.');
  const { error } = await table().upsert({
    id: body.id, org_id: orgId, host_id: req.user.id,
    title: body.title, with_notes: body.withNotes, audio_only: body.audioOnly,
  }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw error;
  const room = await getRoom(body.id, req.user.id);
  if (!available(room)) throw fail(410, 'This live room has ended.');
  const enableAudio = body.recordAudio && !room.meeting_id;
  if (enableAudio && room.url) throw fail(409, 'Enable participant audio recording when you create a new room.');
  if (!room.url) {
    const providerPath = `/rooms/${room.provider_name}`;
    const provider = await daily(providerPath, 'GET', undefined, [404]) || await daily('/rooms', 'POST', {
      name: room.provider_name, privacy: 'private',
      properties: {
        enable_knocking: false, enable_screenshare: true, enforce_unique_user_ids: true,
        enable_transcription_storage: false, eject_at_room_exp: true, max_participants: body.recordAudio ? 3 : 25,
        exp: Math.floor(Date.parse(room.expires_at) / 1000),
      },
    });
    const url = new URL(provider.url);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.daily.co') || url.pathname !== `/${room.provider_name}`) {
      throw fail(502, 'The video service returned an invalid room.');
    }
    if (enableAudio) await recorder.prepareRoomRecording(room);
    const savedRoom = { url: url.href, ...(enableAudio ? { meeting_id: room.id } : {}) };
    const { error: updateError } = await table().update(savedRoom).eq('id', room.id).eq('host_id', req.user.id);
    if (updateError) throw updateError;
    Object.assign(room, savedRoom);
  }
  res.status(201).json(await roomView(room));
}));

router.get('/:id/host', authenticate, route(async (req, res) => {
  const room = await getRoom(req.params.id, req.user.id);
  res.json({ ...(await roomView(room)), meetingId: room.meeting_id, inviteKey: room.invite_key });
}));

router.post('/:id/host/join', authenticate, route(async (req, res) => {
  const room = await getRoom(req.params.id, req.user.id);
  const body = parse(joinSchema, req.body);
  res.json(await tokenFor(room, body.name, req.user.id));
}));

const guestLimit = rateLimit({ windowMs: 60_000, limit: 50, message: { error: 'Too many requests. Try again in a minute.' } });
const invitation = z.object({ inviteKey: z.uuid() });
function requireInvite(req, res, next) {
  const result = invitation.safeParse(req.body);
  if (!result.success) {
    res.set('Cache-Control', 'no-store');
    return res.status(401).json({ error: 'A valid live room invitation is required.' });
  }
  req.inviteKey = result.data.inviteKey;
  next();
}

router.post('/:id/guest', guestLimit, requireInvite, route(async (req, res) => {
  const room = await getRoom(req.params.id, null, req.inviteKey);
  if (!available(room) || !room.url) throw fail(410, 'This live room has ended or is unavailable.');
  res.json(await roomView(room));
}));

router.post('/:id/guest/join', guestLimit, requireInvite, route(async (req, res) => {
  const body = parse(joinSchema, req.body);
  const room = await getRoom(req.params.id, null, req.inviteKey);
  if (room.with_notes && !body.acceptNotes) throw fail(400, 'Acknowledge live transcription before joining.');
  res.json(await tokenFor(room, body.name, null, body.guestId, body.acceptRecording));
}));

router.post('/:id/recording/start', authenticate, route(async (req, res) => {
  const room = await getRoom(req.params.id, req.user.id);
  if (!available(room) || room.meeting_id !== room.id) throw fail(409, 'Room recording is unavailable.');
  const { mimeType } = parse(recordingStart, req.body);
  const job = await recorder.startRoomRecording(room, mimeType);
  res.status(201).json({ status: job.status });
}, { needsDaily: false }));

router.post('/:id/recording/finish', authenticate, route(async (req, res) => {
  const room = await getRoom(req.params.id, req.user.id);
  const { pieces, labels } = parse(recordingFinish, req.body);
  const job = await recorder.finishRoomRecording(room, pieces, labels);
  res.json({ status: job.status, meetingId: room.id });
}, { needsDaily: false }));

router.post('/:id/lines', authenticate, route(async (req, res) => {
  const room = await getRoom(req.params.id, req.user.id);
  if (!room.with_notes || room.ending_at || room.ended_at) throw fail(409, 'This room is no longer accepting transcript lines.');
  const { lines } = parse(linesSchema, req.body);
  if (lines.length) {
    const { data: accepted, error } = await supabaseAdmin.rpc('checkpoint_live_meeting', { p_room: room.id, p_host: req.user.id, p_lines: lines });
    if (error) throw error;
    if (!accepted) throw fail(409, 'This room is no longer accepting transcript lines.');
  }
  res.sendStatus(204);
}));

async function readInsights(room) {
  const { data, error } = await table().select('insights').eq('id', room.id).maybeSingle();
  if (error) throw error;
  return data?.insights ?? null;
}

async function readInsightLines(room) {
  if (room.ended_at) {
    if (!room.meeting_id) return [];
    const { data, error } = await supabaseAdmin.from('meetings').select('transcript_segments')
      .eq('id', room.meeting_id).eq('org_id', room.org_id).maybeSingle();
    if (error) throw error;
    return (data?.transcript_segments ?? []).filter(line => line?.eventId)
      .map(({ eventId, atMs, speaker, text }) => ({ id: eventId, atMs, speaker, text }));
  }
  const pageSize = 500;
  const lines = new Map();
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabaseAdmin.from('live_meeting_lines').select('event_id, at_ms, speaker, text')
      .eq('room_id', room.id).order('at_ms').order('event_id').range(offset, offset + pageSize - 1);
    if (error) throw error;
    for (const line of data) lines.set(line.event_id, { id: line.event_id, atMs: line.at_ms, speaker: line.speaker, text: line.text });
    if (data.length < pageSize) break;
  }
  return [...lines.values()];
}

async function insightsRoom(req) {
  const room = await getRoom(req.params.id, req.user.id);
  if (!room.with_notes) throw fail(404, 'Live transcript insights are unavailable for this room.');
  return room;
}

const insightsRoute = handler => route(handler, { needsDaily: false });

router.get('/:id/insights', authenticate, insightsRoute(async (req, res) => {
  const room = await insightsRoom(req);
  res.json(viewInsights(await readInsights(room)));
}));

router.post('/:id/insights/refresh', authenticate, insightsRoute(async (req, res) => {
  const room = await insightsRoom(req);
  if (room.ending_at && !room.ended_at) throw fail(409, 'The room is saving its transcript. Try again from the meeting recap.');
  const previous = await readInsights(room);
  const lines = await readInsightLines(room);
  if (!lines.length || previous?.transcriptKey === transcriptKey(lines)) return res.json(viewInsights(previous));
  if (!ai.isConfigured()) throw fail(503, 'Live summaries are unavailable because AI is not configured.');
  await meterAiForOrg(room.org_id, res, async () => {
    let next;
    try {
      next = await generateInsights(room, lines, previous);
    } catch {
      throw fail(502, 'Could not update the live summary. The transcript and existing drafts are saved.');
    }
    let query = table().update({ insights: next }).eq('id', room.id).eq('host_id', room.host_id);
    query = previous?.revision ? query.eq('insights->>revision', previous.revision) : query.is('insights->>revision', null);
    query = room.ended_at ? query.eq('ended_at', room.ended_at) : query.is('ending_at', null).is('ended_at', null);
    const { data, error } = await query.select('insights').maybeSingle();
    if (error) throw error;
    if (!data) throw fail(409, 'The room or its drafts changed. Refresh the summary to continue.');
    res.json(viewInsights(data.insights));
  });
}));

router.post('/:id/insights/actions/:draftId/approve', authenticate, insightsRoute(async (req, res) => {
  const room = await insightsRoom(req);
  const draftId = parse(z.uuid(), req.params.draftId);
  const { data, error } = await supabaseAdmin.rpc('approve_live_meeting_action', {
    p_room: room.id, p_host: req.user.id, p_draft: draftId,
  });
  if (error) throw error;
  if (data?.roomEnding) throw fail(409, 'The room is saving its transcript. Approve this draft from the meeting recap.');
  if (!data?.taskId) throw fail(404, 'Action draft not found.');
  res.json({ taskId: data.taskId, insights: viewInsights(data.insights) });
}));

router.post('/:id/end', authenticate, route(async (req, res) => {
  const room = await getRoom(req.params.id, req.user.id);
  if (room.ended_at) return res.json({ meetingId: room.meeting_id });
  if (room.meeting_id && (await recorder.roomRecordingJob(room))?.recording_job.status === 'recording') {
    // Persist a recoverable Combined prefix if the host ended after losing capture.
    try { await recorder.finishRoomRecording(room, null, {}); } catch (error) {
      if (error.status !== 400) throw error;
      const { error: updateError } = await supabaseAdmin.from('meetings')
        .update({ recording_job: { source: 'room', status: 'failed', error: 'No room audio was saved.' } })
        .eq('id', room.id).eq('org_id', room.org_id).eq('recording_job->>status', 'recording');
      if (updateError) throw updateError;
    }
  }
  if (!room.ending_at) {
    const { error } = await table().update({ ending_at: new Date().toISOString() })
      .eq('id', room.id).eq('host_id', req.user.id).is('ending_at', null);
    if (error) throw error;
  }
  if (room.url && Date.parse(room.expires_at) > Date.now()) {
    const providerPath = `/rooms/${room.provider_name}`;
    const expiration = await daily(providerPath, 'POST', {
      properties: { exp: Math.min(Math.floor(Date.parse(room.expires_at) / 1000), Math.floor(Date.now() / 1000) + 10), eject_at_room_exp: true },
    }, [404]);
    if (expiration) {
      const presence = await daily(providerPath + '/presence', 'GET', undefined, [404]);
      const ids = presence?.data?.map(participant => participant.id) || [];
      if (ids.length) await daily(providerPath + '/eject', 'POST', { ids }, [404]);
      await daily(providerPath, 'DELETE', undefined, [404]);
    }
  }
  const { data: meetingId, error } = await supabaseAdmin.rpc('finish_live_meeting', { p_room: room.id, p_host: req.user.id });
  if (error) throw error;
  res.json({ meetingId });
}));

module.exports = router;
