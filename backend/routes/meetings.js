const express = require('express');
const multer = require('multer');
const { v4: uuidv4, v5: uuidv5 } = require('uuid');
const { supabase } = require('../config/supabase');
const ai = require('../config/ai');
const embeddingService = require('../services/embeddingService');
const hubEventPublisher = require('../services/hubEventPublisher');
const { getEcosystemBridge } = require('../services/ecosystemBridge');
const { authenticate, apiKeyAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../schemas/meetings');
const log = require('../utils/log');
const { getOrgIdForUser } = require('../utils/orgContext');
const carryForward = require('../services/carryForward');

const calendarService = require('../services/calendarService');
const meetingNotes = require('../services/meetingNotesService');
const meetingEvents = require('../services/meetingEvents');
const transcriptMoments = require('../services/transcriptMoments');
const summaryTemplates = require('../services/summaryTemplates');
const { loadProfile, profileGuidance } = require('../services/meetingIntelligenceProfile');
const speakerNames = require('../services/speakerNames');
const actionItemNudge = require('../services/actionItemNudge');
const ownerPreferences = require('../services/ownerPreferences');
const priorityPreferences = require('../services/priorityPreferences');

const router = express.Router();

/**
 * Extract calendar tokens from request (session, cookie, or header)
 */
function getCalendarTokens(req) {
  if (req.session?.calendarTokens) return req.session.calendarTokens;
  if (req.cookies?.calendar_tokens) {
    try { return JSON.parse(req.cookies.calendar_tokens); } catch { return null; }
  }
  return null;
}

/**
 * Org-scope a meeting route. The backend runs on the service-role key, so RLS does not
 * protect these reads: without this check any signed-in user could read, edit or delete
 * another workspace's meeting by id. Answers 404 (not 403) for a meeting outside the
 * caller's orgs, so ids cannot be probed. Returns the meeting's org id, or null after
 * sending the error response.
 */
async function meetingOrgOrRespond(req, res, meetingId) {
  try {
    return await meetingNotes.assertMeetingAccess(req.user?.id, meetingId);
  } catch (accessError) {
    if (accessError instanceof meetingNotes.NotesError) {
      const message = accessError.status === 401 ? 'Unauthorized' : accessError.message;
      res.status(accessError.status).json({ error: message });
      return null;
    }
    throw accessError;
  }
}

/** Every org the user belongs to (a user can be in more than one). */
async function orgIdsForUser(userId) {
  if (!userId || userId === 'anonymous') return [];
  const { data, error } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId);
  if (error) throw error;
  return [...new Set((data || []).map((r) => r.org_id).filter(Boolean))];
}

const MAX_SPEAKER_NAME = 120;

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    // Held in memory for transcription, so keep it well under the instance's
    // RAM (audit finding 12). ~25 MB is about 30 minutes of compressed audio;
    // longer meetings should use the browser recorder, which uploads in pieces.
    fileSize: 25 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/webm', 'audio/ogg', 'audio/m4a'];
    if (allowedTypes.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  }
});

/**
 * POST /api/meetings/process
 * Upload audio and process with Gemini AI
 */
router.post('/process', authenticate, upload.single('audio'), validate(schemas.process), async (req, res) => {
  try {
    const { title, attendees, projectId, crmDealId } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    if (!ai.isConfigured()) {
      return res.status(503).json({ error: 'AI API not configured (set OPENAI_API_KEY or GEMINI_API_KEY)' });
    }

    log.info(`Processing meeting: ${title || 'Untitled Meeting'} (using ${ai.getProviderName()})`);

    // Step 1: Transcribe audio
    const transcript = await ai.transcribeAudio(req.file.buffer, req.file.mimetype);

    // Step 2: Run AI pipeline (summary, action items, embedding)
    const { summaryData, actionItems, embedding } = await runAIPipeline(transcript, title, { attendees: parseAttendees(attendees) });

    // Step 3: Upload audio to Supabase Storage
    let audioUrl = null;
    if (supabase) {
      try {
        const audioFileName = `meetings/${uuidv4()}.${req.file.mimetype.split('/')[1] || 'wav'}`;
        const { data: uploadData, error: uploadError } = await supabase
          .storage
          .from('recordings')
          .upload(audioFileName, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: false
          });

        if (!uploadError && uploadData?.path) {
          const { data: urlData } = supabase.storage.from('recordings').getPublicUrl(uploadData.path);
          audioUrl = urlData?.publicUrl;
        }
      } catch (storageError) {
        log.warn('Audio upload failed:', storageError.message);
      }
    }

    // Step 4: Save meeting to database
    const meetingId = uuidv4();
    const now = new Date();
    const durationMin = parseInt(req.body.duration) || parseDuration(summaryData.estimatedDuration) || 0;
    const startTime = durationMin > 0
      ? new Date(now.getTime() - durationMin * 60 * 1000).toISOString()
      : now.toISOString();
    const orgId = await getOrgIdForUser(req.user?.id);
    const meetingData = {
      id: meetingId,
      title: title || `Meeting ${new Date().toLocaleDateString()}`,
      transcript,
      summary: summaryData.summary,
      key_points: summaryData.keyPoints || [],
      decisions: summaryData.decisions || [],
      sentiment_label: summaryData.sentiment,
      sentiment_score: summaryData.sentimentScore || 0.5,
      topics: summaryData.topics || [],
      ...summaryTemplates.summaryFields(summaryData),
      attendees: parseAttendees(attendees),
      duration_minutes: durationMin || null,
      start_time: startTime,
      end_time: now.toISOString(),
      audio_file_url: audioUrl,
      project_id: projectId || null,
      crm_deal_id: crmDealId || null,
      created_by: req.user?.id || null,
      org_id: orgId,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    };

    if (embedding) {
      meetingData.transcript_embedding = embedding;
    }

    const { meeting: savedMeeting, actionItems: savedActionItems } = await createMeetingWithActions(meetingData, actionItems);

    // Step 6: Async post-processing (embeddings + ecosystem sync + calendar auto-sync)
    firePostProcessing(savedMeeting, summaryData, savedActionItems, {
      userId: req.user?.id,
      calendarTokens: getCalendarTokens(req)
    });

    // Return response
    res.json({
      success: true,
      meeting: {
        id: savedMeeting.id,
        title: savedMeeting.title,
        transcript: savedMeeting.transcript,
        summary: savedMeeting.summary,
        keyPoints: summaryData.keyPoints,
        decisions: summaryData.decisions,
        sentiment: savedMeeting.sentiment_label,
        sentimentScore: savedMeeting.sentiment_score,
        topics: summaryData.topics,
        audioUrl: audioUrl
      },
      actionItems: savedActionItems,
      stats: {
        transcriptLength: transcript.length,
        actionItemCount: savedActionItems.length,
        processingTime: 'completed'
      }
    });

  } catch (error) {
    log.error('Error processing meeting:', { error: error.message || error });
    res.status(500).json({
      error: 'Failed to process meeting',
      details: error.message,
      ...(error.meetingId && { meetingId: error.meetingId })
    });
  }
});

/**
 * POST /api/meetings/transcript
 * Process a text transcript (no audio)
 */
router.post('/transcript', authenticate, validate(schemas.transcript), async (req, res) => {
  try {
    const { title, transcript, attendees, projectId, crmDealId } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    if (!ai.isConfigured()) {
      return res.status(503).json({ error: 'AI API not configured' });
    }

    log.info('Processing transcript:', title || 'Untitled Meeting');

    // Run AI pipeline (summary, action items, embedding)
    const { summaryData, actionItems, embedding } = await runAIPipeline(transcript, title, { attendees: parseAttendees(attendees) });

    // Save meeting
    const meetingId = uuidv4();
    const now = new Date();
    const orgId = await getOrgIdForUser(req.user?.id);
    const meetingData = {
      id: meetingId,
      title: title || `Meeting ${new Date().toLocaleDateString()}`,
      transcript,
      summary: summaryData.summary,
      key_points: summaryData.keyPoints || [],
      decisions: summaryData.decisions || [],
      sentiment_label: summaryData.sentiment,
      sentiment_score: summaryData.sentimentScore || 0.5,
      topics: summaryData.topics || [],
      ...summaryTemplates.summaryFields(summaryData),
      attendees: parseAttendees(attendees),
      duration_minutes: parseDuration(summaryData.estimatedDuration),
      start_time: now.toISOString(),
      project_id: projectId || null,
      crm_deal_id: crmDealId || null,
      created_by: req.user?.id || null,
      org_id: orgId,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    };

    if (embedding) {
      meetingData.transcript_embedding = embedding;
    }

    const { meeting: savedMeeting, actionItems: savedActionItems } = await createMeetingWithActions(meetingData, actionItems);

    // Async post-processing (embeddings + ecosystem sync + calendar auto-sync)
    firePostProcessing(savedMeeting, summaryData, savedActionItems, {
      userId: req.user?.id,
      calendarTokens: getCalendarTokens(req)
    });

    res.json({
      success: true,
      meeting: {
        id: savedMeeting.id,
        title: savedMeeting.title,
        transcript: savedMeeting.transcript,
        summary: savedMeeting.summary,
        keyPoints: summaryData.keyPoints,
        decisions: summaryData.decisions,
        sentiment: savedMeeting.sentiment_label,
        topics: summaryData.topics
      },
      actionItems: savedActionItems
    });

  } catch (error) {
    log.error('Error processing transcript:', { error: error.message || error });
    res.status(500).json({
      error: 'Failed to process transcript',
      details: error.message,
      ...(error.meetingId && { meetingId: error.meetingId })
    });
  }
});

/**
 * GET /api/meetings
 * List all meetings with pagination and filters
 */
router.get('/', authenticate, validate(schemas.list), async (req, res) => {
  try {
    const { limit = 20, offset = 0, projectId, search, startDate, endDate, beforeDate, status } = req.query;

    if (!supabase) {
      return res.json({ meetings: [], count: 0, hasMore: false });
    }

    const orgIds = await orgIdsForUser(req.user?.id);
    if (orgIds.length === 0) {
      return res.json({ meetings: [], count: 0, hasMore: false });
    }

    let query = supabase
      .from('meetings')
      .select('*', { count: 'exact' })
      .in('org_id', orgIds)
      .order('meeting_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    if (search) {
      const literal = JSON.stringify('%' + search.replace(/[%_\\*]/g, '\\$&') + '%');
      query = query.or(['title', 'summary', 'transcript'].map(field => field + '.ilike.' + literal).join(','));
    }

    // Status filter: a coarse superset of the list's status words (frontend
    // services/meetingView.ts meetingStatus); the page applies the exact rule.
    if (status === 'live') {
      query = query.in('recording_job->>status', ['recording', 'transcribing', 'backup']);
    } else if (status === 'ready') {
      query = query.or('summary.not.is.null,chat_posted.eq.true');
    } else if (status === 'attention') {
      query = query.or('summary.is.null,summary.eq.,recording_job->>status.in.(failed,transcribing)');
    }

    if (startDate) {
      query = query.gte('meeting_at', startDate);
    }

    if (endDate) {
      query = query.lte('meeting_at', endDate);
    }
    if (beforeDate) query = query.lt('meeting_at', beforeDate);

    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: meetings, error, count } = await query;

    if (error) throw error;

    // Per-row follow-through for the list: open action items, and how many are on the caller.
    const rows = meetings || [];
    if (rows.length > 0) {
      const { data: items } = await supabase
        .from('action_items')
        .select('meeting_id, status, assigned_to_email')
        .in('org_id', orgIds)
        .in('meeting_id', rows.map((m) => m.id));
      const me = (req.user?.email || '').toLowerCase();
      const counts = {};
      for (const it of items || []) {
        const c = counts[it.meeting_id] || (counts[it.meeting_id] = { total: 0, open: 0, mine: 0 });
        c.total++;
        if (it.status !== 'done') {
          c.open++;
          if (me && (it.assigned_to_email || '').toLowerCase() === me) c.mine++;
        }
      }
      for (const m of rows) m.action_counts = counts[m.id] || { total: 0, open: 0, mine: 0 };
    }

    res.json({
      meetings: rows,
      count: count || 0,
      hasMore: Number(offset) + rows.length < (count || 0)
    });

  } catch (error) {
    log.error('Error listing meetings:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

router.get('/workspace-months', authenticate, async (req, res) => {
  let timezone;
  try {
    if (typeof req.query.timezone !== 'string' || req.query.timezone.length > 80) throw new Error('Invalid timezone');
    timezone = new Intl.DateTimeFormat('en', { timeZone: req.query.timezone }).resolvedOptions().timeZone;
  } catch {
    return res.status(400).json({ error: 'Invalid time zone.' });
  }
  if (!supabase) return res.json({ months: [] });
  try {
    const orgIds = await orgIdsForUser(req.user.id);
    if (!orgIds.length) return res.json({ months: [] });
    const { data, error } = await supabase.rpc('meeting_workspace_months', { p_org_ids: orgIds, p_timezone: timezone });
    if (error) throw error;
    res.json({ months: data.map(row => row.month) });
  } catch (error) {
    log.warn('Could not load meeting months', { code: error.code });
    res.status(500).json({ error: 'Meeting months could not be loaded.' });
  }
});

router.post('/:id/actions', authenticate, validate(schemas.createAction), async (req, res) => {
  try {
    const { id } = req.validated.params;
    const orgId = await meetingOrgOrRespond(req, res, id);
    if (!orgId) return;
    const { requestId, title, context, owner, dueDate, atMs } = req.validated.body;
    const actionId = uuidv5(`urn:entomate:manual-meeting-action:${id}:${requestId}`, uuidv5.URL);
    const { error } = await supabase.from('action_items').upsert({
      id: actionId, meeting_id: id, org_id: orgId, task_description: title,
      context: context || null, assigned_to_name: owner || null, due_date: dueDate || null,
      transcript_at_ms: atMs ?? null, manually_created: true,
    }, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw error;
    res.status(201).json({ id: actionId });
  } catch (error) {
    log.warn('Could not create meeting action', { code: error.code });
    res.status(500).json({ error: 'The meeting task could not be created.' });
  }
});

/**
 * GET /api/meetings/:id
 * Get meeting details with action items
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(404).json({ error: 'Database not configured' });
    }

    const orgId = await meetingOrgOrRespond(req, res, id);
    if (!orgId) return;

    const readMeeting = (columns) => supabase
      .from('meetings')
      .select(columns)
      .eq('id', id)
      .eq('org_id', orgId)
      .single();
    let { data: meeting, error: meetingError } = await readMeeting('*, meeting_passage_index(revision)');
    if (meetingError?.code === 'PGRST200') {
      ({ data: meeting, error: meetingError } = await readMeeting('*'));
    }

    if (meetingError) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const { data: actionItems } = await supabase
      .from('action_items')
      .select('*')
      .eq('meeting_id', id)
      .order('priority', { ascending: false });

    const { meeting_passage_index: passageIndex, ...record } = meeting;
    res.json({
      ...record,
      transcript_search_revision: passageIndex?.revision ?? null,
      actionItems: actionItems || []
    });

  } catch (error) {
    log.error('Error getting meeting:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/meetings/:id
 * Update meeting
 */
router.put('/:id', authenticate, validate(schemas.update), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const orgId = await meetingOrgOrRespond(req, res, id);
    if (!orgId) return;

    // Only allow certain fields to be updated
    const allowedFields = ['title', 'summary', 'key_points', 'decisions', 'project_id', 'crm_deal_id'];
    const filteredUpdates = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }
    filteredUpdates.updated_at = new Date().toISOString();

    // Edited key points or decisions get fresh timecodes, so a link never points at the
    // moment of an item that was rewritten or removed.
    if (filteredUpdates.key_points !== undefined || filteredUpdates.decisions !== undefined) {
      const { data: current } = await supabase
        .from('meetings')
        .select('key_points, decisions, transcript_segments')
        .eq('id', id)
        .eq('org_id', orgId)
        .maybeSingle();
      if (Array.isArray(current?.transcript_segments) && current.transcript_segments.length > 0) {
        filteredUpdates.summary_moments = transcriptMoments.summaryMoments(
          current.transcript_segments,
          filteredUpdates.key_points ?? current.key_points,
          filteredUpdates.decisions ?? current.decisions
        );
      }
    }

    const { data: meeting, error } = await supabase
      .from('meetings')
      .update(filteredUpdates)
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    res.json(meeting);

  } catch (error) {
    log.error('Error updating meeting:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/meetings/:id
 * Delete meeting and its action items
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const orgId = await meetingOrgOrRespond(req, res, id);
    if (!orgId) return;

    // Delete action items first (cascade should handle this, but being explicit)
    await supabase
      .from('action_items')
      .delete()
      .eq('meeting_id', id);

    // Delete meeting
    const { error } = await supabase
      .from('meetings')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // A browser recording may still have audio saved (unfinished or failed).
    require('../services/meetingRecorder')
      .purgeRecordingAudio(orgId, id)
      .catch((purgeError) => log.warn('Meeting deleted but its recording audio was not', { meetingId: id, error: purgeError.message }));

    res.json({ success: true, message: 'Meeting deleted' });

  } catch (error) {
    log.error('Error deleting meeting:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/meetings/action-items/:id
 * Correct an action item's wording, owner, priority or deadline, or toggle open/done.
 */
router.patch('/action-items/:id', authenticate, validate(schemas.actionItemUpdate), async (req, res) => {
  try {
    const { id } = req.params;
    const { version, ...changes } = req.validated.body;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { data: existingItem, error: readError } = await supabase
      .from('action_items')
      .select('meeting_id, org_id, assigned_to_name, assigned_to_email, updated_at, task_description, priority, agent_notes, owner_correction, priority_correction')
      .eq('id', id)
      .maybeSingle();
    if (readError) throw readError;
    if (!existingItem?.meeting_id) {
      return res.status(404).json({ error: 'Action item not found' });
    }
    const itemOrgId = await meetingOrgOrRespond(req, res, existingItem.meeting_id);
    if (!itemOrgId) return;
    if (existingItem.org_id !== itemOrgId) return res.status(404).json({ error: 'Action item not found' });

    const currentVersion = existingItem.updated_at ?? null;
    const conflict = () => res.status(409).json({ error: 'This action item changed. Reload it before editing again.' });
    if (version !== undefined && version !== currentVersion) return conflict();

    // A name-only reassignment must never keep the previous recipient's address.
    const nameChanged = changes.assigned_to_name !== undefined && changes.assigned_to_name !== existingItem.assigned_to_name;
    const emailChanged = changes.assigned_to_email !== undefined && changes.assigned_to_email !== existingItem.assigned_to_email;
    if (nameChanged && changes.assigned_to_email === undefined) changes.assigned_to_email = null;
    if (nameChanged || emailChanged) changes.assigned_to_id = null;

    // completed_at feeds the follow-through rate on Insights (done by the due date).
    const previous = Date.parse(currentVersion);
    const now = new Date(Math.max(Date.now(), Number.isFinite(previous) ? previous + 1 : 0)).toISOString();
    const updates = { ...changes, updated_at: now };
    if (changes.status !== undefined) updates.completed_at = changes.status === 'done' ? now : null;
    if (nameChanged && (existingItem.agent_notes?.assignment?.applied || existingItem.owner_correction)) {
      updates.owner_correction = await ownerPreferences.correctionForEdit(supabase, existingItem, changes, now);
    } else if (emailChanged && existingItem.owner_correction) {
      updates.owner_correction = null;
    }
    if (changes.priority !== undefined && changes.priority !== existingItem.priority &&
        (existingItem.agent_notes?.priority?.applied || existingItem.priority_correction)) {
      updates.priority_correction = await priorityPreferences.correctionForEdit(supabase, existingItem, changes, now);
    }
    const query = supabase
      .from('action_items')
      .update(updates)
      .eq('id', id)
      .eq('meeting_id', existingItem.meeting_id)
      .eq('org_id', itemOrgId);
    const scoped = currentVersion == null ? query.is('updated_at', null) : query.eq('updated_at', currentVersion);
    const { data: item, error } = await scoped.select().maybeSingle();

    if (error) throw error;
    if (!item) return conflict();

    res.json(item);
  } catch (error) {
    log.error('Error updating action item:', { error: error.message || error });
    res.status(500).json({ error: 'Could not update the action item. Try again.' });
  }
});

/**
 * POST /api/meetings/action-items/:id/nudge
 * Email the item's owner one reminder, sent in the caller's name (Reply-To: the
 * caller). Once per item per 24 hours. 422 when the owner has no email.
 */
router.post('/action-items/:id/nudge', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    const { data: item } = await supabase
      .from('action_items')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!item?.meeting_id) return res.status(404).json({ error: 'Action item not found' });
    const orgId = await meetingOrgOrRespond(req, res, item.meeting_id);
    if (!orgId) return;

    const { data: meeting } = await supabase
      .from('meetings')
      .select('id, title')
      .eq('id', item.meeting_id)
      .eq('org_id', orgId)
      .maybeSingle();

    const u = req.user || {};
    const sender = { email: u.email || null, name: [u.firstName, u.lastName].filter(Boolean).join(' ') || null };
    const result = await actionItemNudge.sendNudge(supabase, { item, meeting, sender });
    if (!result.ok) return res.status(result.status).json({ error: result.error, code: result.code });

    log.info('Action item nudged', { itemId: id, orgId, stored: result.stored });
    res.json({ nudgedAt: result.nudgedAt, to: result.to });
  } catch (error) {
    log.error('Error nudging action item:', { error: error.message || error });
    res.status(500).json({ error: 'Could not send the reminder' });
  }
});

/**
 * POST /api/meetings/carry-forward
 * Commitments to bring into an upcoming meeting (a calendar event that has no
 * meetings row yet): open items from earlier meetings with the same people or
 * series, and items those people own. Body: { title, attendees, startsAt }.
 */
router.post('/carry-forward', authenticate, validate(schemas.carryForwardPreview), async (req, res) => {
  try {
    const orgIds = await orgIdsForUser(req.user?.id);
    const { title, attendees, startsAt } = req.body;
    const result = await carryForward.load(
      { title: title || '', attendees: attendees || [], at: startsAt || new Date().toISOString() },
      orgIds
    );
    res.json(result);
  } catch (error) {
    log.error('Error building carry-forward preview:', { error: error.message || error });
    res.status(500).json({ error: 'Could not load earlier commitments' });
  }
});

/**
 * GET /api/meetings/:id/carry-forward
 * What was promised before this meeting: open and done items from earlier
 * meetings with the same people or series.
 */
router.get('/:id/carry-forward', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = await meetingOrgOrRespond(req, res, id);
    if (!orgId) return;

    const { data: meeting, error } = await supabase
      .from('meetings')
      .select('id, title, attendees, created_at, project_id')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();
    if (error || !meeting) return res.status(404).json({ error: 'Meeting not found' });

    const result = await carryForward.load(
      { id: meeting.id, projectId: meeting.project_id, title: meeting.title, attendees: meeting.attendees, at: meeting.created_at },
      [orgId]
    );
    res.json(result);
  } catch (error) {
    log.error('Error building carry-forward:', { error: error.message || error });
    res.status(500).json({ error: 'Could not load earlier commitments' });
  }
});

/**
 * POST /api/meetings/:id/ask
 * Ask AI question about a specific meeting
 */
router.post('/:id/ask', authenticate, validate(schemas.ask), async (req, res) => {
  try {
    const { id } = req.params;
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    if (!ai.isConfigured()) {
      return res.status(503).json({ error: 'Gemini API not configured' });
    }

    // Get meeting
    let meeting;
    if (supabase) {
      const orgId = await meetingOrgOrRespond(req, res, id);
      if (!orgId) return;

      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', id)
        .eq('org_id', orgId)
        .single();

      if (error) {
        return res.status(404).json({ error: 'Meeting not found' });
      }
      meeting = data;
    } else {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Build context
    const context = `
Meeting Title: ${meeting.title}
Date: ${meeting.created_at}
Summary: ${meeting.summary}
Key Points: ${JSON.stringify(meeting.key_points)}
Decisions: ${JSON.stringify(meeting.decisions)}

Full Transcript:
${meeting.transcript}
`;

    // Ask Gemini
    const answer = await ai.answerQuestion(question, context);

    res.json({
      question,
      ...answer,
      meetingId: id,
      meetingTitle: meeting.title
    });

  } catch (error) {
    log.error('Error answering question:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/meetings/:id/speakers
 * Rename a speaker everywhere in a meeting's transcript. With merge: true, to must be an existing label.
 * Diarization and platform names are often "Speaker 2" or a dial-in number, so this is
 * how a teammate fixes the labels once. Any member of the meeting's org may do it, the
 * same people who can read the transcript. Both the timed lines and the flat text change,
 * so search, Ask and recaps see the new name.
 */
router.patch('/:id/speakers', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const from = typeof req.body?.from === 'string' ? req.body.from.trim() : '';
    const to = typeof req.body?.to === 'string' ? req.body.to.trim() : '';
    const merge = req.body?.merge === true;

    if (!from || !to) {
      return res.status(400).json({ error: 'Both the current and the new speaker name are required' });
    }
    if (merge && from === to) return res.status(400).json({ error: 'Choose two different speakers to merge' });
    if (to.length > MAX_SPEAKER_NAME) {
      return res.status(400).json({ error: `A speaker name can be at most ${MAX_SPEAKER_NAME} characters` });
    }
    if (/[\r\n:]/.test(to)) {
      // A colon or line break would corrupt the "Speaker: words" text the AI reads.
      return res.status(400).json({ error: 'A speaker name cannot contain a colon or a line break' });
    }
    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const orgId = await meetingOrgOrRespond(req, res, id);
    if (!orgId) return;

    const { data: meeting, error } = await supabase
      .from('meetings')
      .select('id, transcript, transcript_segments, attendees, recording_job, updated_at')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();
    if (error || !meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const segments = Array.isArray(meeting.transcript_segments) ? meeting.transcript_segments : null;
    if (!segments || !segments.some((s) => s?.speaker === from)) {
      return res.status(404).json({ error: 'That speaker is not in this transcript' });
    }
    if (merge && !segments.some((s) => s?.speaker === to)) {
      return res.status(404).json({ error: 'The speaker to keep is no longer in this transcript' });
    }
    const job = meeting.recording_job;
    if (job?.transcriptRebuildAt && require('../services/meetingRecorder').isTranscriptRebuilding(job)) {
      return res.status(409).json({ error: 'Wait for the transcript rebuild to finish before editing speakers' });
    }

    const renamed = segments.map((s) => (s?.speaker === from ? { ...s, speaker: to } : s));
    const { buildTranscriptText } = require('../services/transcriptIngest');
    let write = supabase
      .from('meetings')
      .update({
        transcript_segments: renamed,
        transcript: buildTranscriptText(renamed),
        // The attendee list drives carry-forward matching, so it follows the rename.
        attendees: speakerNames.renameAttendees(meeting.attendees, { [from]: to }),
        ...(job
          ? { recording_job: {
            ...job,
            ...(Array.isArray(job.speakerSuggestions)
              ? { speakerSuggestions: job.speakerSuggestions.filter((g) => g?.speaker !== from && g?.name !== to) }
              : {}),
            ...(merge ? { speakers: new Set(renamed.map(s => s?.speaker).filter(Boolean)).size } : {}),
          } }
          : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('org_id', orgId);
    write = meeting.updated_at ? write.eq('updated_at', meeting.updated_at) : write.is('updated_at', null);
    const { data: updated, error: updateError } = await write
      .select('id, transcript, transcript_segments, attendees, recording_job')
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return res.status(409).json({ error: 'The meeting changed. Reload the meeting and try again.' });

    // Action items the summary gave to "Speaker 2" now belong to the real person.
    const { error: itemsError } = await supabase
      .from('action_items')
      .update({ assigned_to_name: to, updated_at: new Date().toISOString() })
      .eq('meeting_id', id)
      .eq('org_id', orgId)
      .eq('assigned_to_name', from);
    if (itemsError) log.warn('Speaker rename: action item owners not updated', { meetingId: id, error: itemsError.message });

    res.json({ success: true, data: updated });
  } catch (error) {
    log.error('Error renaming speaker:', { error: error.message || error });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/meetings/:id/speakers/suggest
 * Guess real names for "Speaker N" labels from the transcript (self-introductions,
 * being addressed by name, and an AI read with quoted evidence). Renames nothing:
 * the page shows the guesses and a person accepts each one.
 */
router.post('/:id/speakers/suggest', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });
    const orgId = await meetingOrgOrRespond(req, res, id);
    if (!orgId) return;

    const { data: meeting, error } = await supabase
      .from('meetings')
      .select('id, org_id, created_by, attendees, transcript_segments')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();
    if (error || !meeting) return res.status(404).json({ error: 'Meeting not found' });

    const segments = Array.isArray(meeting.transcript_segments) ? meeting.transcript_segments : [];
    const candidates = await speakerNames.loadCandidates(meeting);
    const { applied, suggestions } = await speakerNames.suggestNames(segments, candidates);
    // Nothing is applied here, so strong guesses are suggestions too.
    res.json({ success: true, data: { suggestions: [...applied, ...suggestions] } });
  } catch (error) {
    log.error('Error suggesting speaker names:', { error: error.message || error });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/meetings/:id/recap
 * Get formatted chat recap for a meeting
 */
router.get('/:id/recap', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // The recap now carries team notes, so it must be org-scoped: a user outside the
    // meeting's org gets the same 404 as for a missing meeting.
    let orgId;
    try {
      orgId = await meetingNotes.assertMeetingAccess(req.user?.id, id);
    } catch (accessError) {
      if (accessError instanceof meetingNotes.NotesError) {
        return res.status(accessError.status).json({ error: accessError.message });
      }
      throw accessError;
    }

    // Get meeting with action items
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (meetingError) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const { data: actionItems } = await supabase
      .from('action_items')
      .select('*')
      .eq('meeting_id', id);

    const teamNotes = await meetingNotes.getTeamNotesForMeeting(orgId, id);

    // Format recap
    let recap;
    if (ai.isConfigured()) {
      recap = await ai.formatChatRecap({
        ...meeting,
        keyPoints: meeting.key_points,
        actionItems: actionItems || []
      });
    } else {
      // Fallback formatting
      recap = formatRecapFallback(meeting, actionItems || []);
    }

    // Team notes are appended after formatting, never handed to the AI to rewrite.
    if (teamNotes.length > 0 && typeof recap === 'string') {
      const lines = teamNotes.map(n => `• ${n.body}${n.authorName ? ` (${n.authorName})` : ''}`);
      recap += `\n\n*Team Notes:*\n${lines.join('\n')}`;
    }

    res.json({
      meetingId: id,
      meetingTitle: meeting.title,
      recap
    });

  } catch (error) {
    log.error('Error generating recap:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

// ── Shared AI Pipeline ──

/**
 * Run the AI processing pipeline on a meeting's transcript.
 * Used by /process, /transcript, and /:id/reprocess routes.
 *
 * @param {string} transcript - The meeting transcript text
 * @param {string} title - Meeting title (used for embedding context and template choice)
 * @param {{ attendees?: unknown[], template?: string|null, extractActions?: boolean, meetingId?: string }} [opts]
 * @returns {{ summaryData, actionItems, embedding }}
 */
async function runAIPipeline(transcript, title, opts = {}) {
  // Summary template per meeting type: chosen on the meeting page, else guessed from title/attendees.
  const template = summaryTemplates.detectTemplate({ title, attendees: opts.attendees, chosen: opts.template });
  const { actionAddon, summaryAddon, sections } = profileGuidance(await loadProfile(opts.meetingId), template);
  const summaryData = await ai.generateSummary(transcript, { addon: summaryAddon });
  if (typeof summaryData?.summary !== 'string' || !summaryData.summary.trim()) {
    throw new Error('Meeting summary was empty');
  }
  summaryData.template = template;
  summaryData.sections = summaryTemplates.normalizeSections(summaryData.sections, template, sections);
  const actionItems = opts.extractActions === false ? [] : await ai.extractActionItems(transcript, { addon: actionAddon });

  let embedding = null;
  try {
    const textForEmbedding = `${title || ''} ${summaryData.summary} ${transcript.substring(0, 5000)}`;
    embedding = await ai.generateEmbedding(textForEmbedding);
  } catch (embeddingError) {
    log.warn('Embedding generation failed:', embeddingError.message);
  }

  return { summaryData, actionItems, embedding };
}

/**
 * The first successful batch is the meeting's action list. Reuse stored rows so a
 * retry preserves edits, completion and integration IDs, even if AI paraphrases.
 */
async function saveActionItems(meeting, actionItems) {
  const read = () => supabase.from('action_items').select('*')
    .eq('meeting_id', meeting.id).eq('org_id', meeting.org_id);

  if (!meeting.org_id) throw new Error('Cannot save actions without a meeting workspace');
  const { data: existing, error: readError } = await read();
  if (readError) throw readError;
  if (meeting.action_items_require_approval || existing.some((item) => !item.manually_created) || !actionItems.length) {
    return { items: existing, created: false };
  }

  const now = new Date().toISOString();
  const rows = actionItems.map((item, index) => ({
    // Concurrent runs all contend on the same first ID, even with differing AI output.
    // Postgres inserts the entire batch or none of it.
    id: index === 0 ? uuidv5('urn:entomate:meeting-actions:' + meeting.id, uuidv5.URL) : uuidv4(),
    meeting_id: meeting.id,
    org_id: meeting.org_id,
    task_description: item.task,
    context: item.context ?? null,
    assigned_to_name: item.owner ?? null,
    assigned_to_email: item.ownerEmail ?? null,
    due_date: item.dueDate ?? null,
    priority: item.priority?.toLowerCase() || 'medium',
    status: 'open',
    crm_sync_status: 'pending',
    created_at: now,
    updated_at: now,
    transcript_at_ms: Number.isInteger(item.transcriptAtMs) && item.transcriptAtMs >= 0
      ? item.transcriptAtMs : null,
  }));
  const { data, error } = await supabase.from('action_items').insert(rows).select();
  if (!error) return { items: [...existing, ...data], created: true };
  if (error.code === '23505') {
    const { data: committed, error: retryError } = await read();
    if (retryError) throw retryError;
    if (committed.some((item) => item.id === rows[0].id)) return { items: committed, created: false };
  }
  throw error;
}

async function createMeetingWithActions(meeting, actionItems) {
  const { error: insertError } = await supabase.from('meetings').insert({ ...meeting, summary: null });
  if (insertError) throw insertError;

  try {
    const { items: savedActions } = await saveActionItems(meeting, actionItems);
    const { data, error } = await supabase.from('meetings').update({ summary: meeting.summary })
      .eq('id', meeting.id).eq('org_id', meeting.org_id).is('summary', null).select().maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Meeting changed while saving its minutes');
    return { meeting: data, actionItems: savedActions };
  } catch (error) {
    log.error('Could not finish imported meeting minutes', { meetingId: meeting.id, error: error.message });
    const failure = new Error('The transcript is saved. Open the meeting to try writing the minutes again.');
    failure.meetingId = meeting.id;
    throw failure;
  }
}

/**
 * Fire async post-processing: embeddings + ecosystem bridge sync.
 * Non-blocking — errors are logged but never thrown.
 */
function firePostProcessing(savedMeeting, summaryData, savedActionItems, ctx = {}) {
  // Existing commitments can be included in the recap without reassigning them
  // or replaying action-created notifications and exports.
  const newActions = ctx.actionsCreated === false ? [] : savedActionItems;
  // Fire-and-forget with top-level .catch() to prevent unhandled rejections
  (async () => {
    try {
      await embeddingService.generateEmbeddingsForMeeting(
        savedMeeting.id,
        {
          summary: savedMeeting.summary,
          key_points: summaryData.keyPoints,
          decisions: summaryData.decisions,
          transcript: savedMeeting.transcript,
        },
        savedActionItems
      );
      log.info(`Generated embeddings for meeting ${savedMeeting.id}`);
    } catch (embeddingError) {
      log.warn('Embedding generation failed:', embeddingError.message);
    }

    try {
      const bridge = await getEcosystemBridge();

      if (bridge.isConnected('pulse')) {
        const recap = formatRecapFallback(savedMeeting, savedActionItems);
        await bridge.postToPulse({
          channel: 'entomate-meetings',
          title: `Meeting processed: ${savedMeeting.title}`,
          message: recap,
          urgency: savedActionItems.some(i => i.priority === 'high') ? 'high' : 'normal',
          metadata: { meetingId: savedMeeting.id },
        });

        const highPriItems = newActions.filter(i => i.priority === 'high');
        if (highPriItems.length > 0) {
          const taskMsg = highPriItems.map(i =>
            `🔴 ${i.task_description} → ${i.assigned_to_name || 'Unassigned'} (due ${i.due_date || 'TBD'})`
          ).join('\n');
          await bridge.postToPulse({
            channel: 'entomate-tasks',
            title: `${highPriItems.length} high-priority task(s) from: ${savedMeeting.title}`,
            message: taskMsg,
            urgency: 'high',
          });
        }

        const workspaceId = process.env.ECOSYSTEM_PULSE_WORKSPACE_ID;
        if (workspaceId && newActions.length > 0) {
          await bridge.sendEvent('pulse', {
            eventType: 'meeting.action_items_extracted',
            entityType: 'meeting',
            entityId: savedMeeting.id,
            data: {
              workspaceId,
              meetingTitle: savedMeeting.title,
              actionItems: newActions.map(item => ({
                id: item.id,
                description: item.task_description,
                assignee: item.assigned_to_name || item.assigned_to_email || null,
                priority: item.priority,
                dueDate: item.due_date,
              })),
            },
          });
        }
      }

      if (bridge.isConnected('logos_vision')) {
        await bridge.syncMeetingToLogosVision({
          meeting: savedMeeting,
          actionItems: newActions,
          actionItemCount: savedActionItems.length,
        });

        const attendees = savedMeeting.attendees || [];
        for (const attendee of attendees) {
          if (attendee.email) {
            await bridge.syncContactToLogosVision({
              email: attendee.email,
              name: attendee.name,
              meetingId: savedMeeting.id,
            });
          }
        }
      }

      try {
        await hubEventPublisher.meetingCompleted({
          ...savedMeeting,
          action_items: savedActionItems,
        });
      } catch { /* hub may not be configured */ }

      log.info(`Ecosystem sync complete for meeting ${savedMeeting.id}`);
    } catch (syncError) {
      log.warn('Ecosystem sync failed (non-blocking):', syncError.message);
    }

    // Calendar auto-sync (if user has enabled it and has calendar connected)
    try {
      if (ctx.userId && ctx.calendarTokens && calendarService.isConfigured()) {
        // Check user setting for auto_sync_meetings_to_calendar
        let autoSync = false;
        if (supabase) {
          const { data: settings } = await supabase
            .from('user_settings')
            .select('meetings_json')
            .eq('user_id', ctx.userId)
            .single();

          autoSync = settings?.meetings_json?.auto_sync_meetings_to_calendar === true;
        }

        if (autoSync) {
          await calendarService.createEventFromMeeting(ctx.calendarTokens, savedMeeting);
          log.info(`Auto-synced meeting ${savedMeeting.id} to Google Calendar`);
        }
      }
    } catch (calendarError) {
      log.warn('Calendar auto-sync failed (non-blocking):', calendarError.message);
    }

    // Agents + meeting/action-item workflow triggers (never throws)
    await meetingEvents.handleMeetingProcessed(savedMeeting, newActions);
  })().catch(err => {
    log.error('Post-processing unexpected error:', err.message || err);
  });
}

// ── Reprocess Endpoint ──

/**
 * POST /api/meetings/:id/reprocess
 * Re-run AI processing on an existing meeting (e.g., after ecosystem import).
 * Used by the ecosystem-inbound edge function after receiving a Pulse export.
 */
// Signed-in users, or the ecosystem-inbound edge function with X-API-Key
// (audit finding 8). A service call may reprocess any meeting, so it is
// limited to the meeting's own org below.
const userOrServiceAuth = (req, res, next) =>
  (req.headers['x-api-key'] ? apiKeyAuth(req, res, next) : authenticate(req, res, next));

/**
 * Only fetch meeting audio from this project's own Supabase Storage, never
 * an arbitrary URL stored on the row (audit findings 2 and 8: SSRF).
 */
function isOwnStorageUrl(url) {
  try {
    const target = new URL(url);
    const own = new URL(process.env.SUPABASE_URL);
    return target.protocol === 'https:' && target.origin === own.origin && target.pathname.startsWith('/storage/v1/');
  } catch {
    return false;
  }
}

router.post('/:id/reprocess', userOrServiceAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    let orgId;
    if (req.isServiceRequest) {
      const { data: row } = await supabase.from('meetings').select('org_id').eq('id', id).maybeSingle();
      orgId = row?.org_id;
      if (!orgId) return res.status(404).json({ error: 'Meeting not found' });
    } else {
      orgId = await meetingOrgOrRespond(req, res, id);
      if (!orgId) return;
    }

    const { data: meeting, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (error) throw error;
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // A completed extraction can legitimately have no key points or actions.
    if (meeting.summary && !meeting.recording_job?.summaryError) {
      return res.json({ success: true, alreadyProcessed: true, meetingId: id });
    }

    if (meeting.recording_job?.status === 'transcribing') {
      return res.status(409).json({ error: 'This meeting is still being processed. Try again when it finishes.' });
    }

    if (!ai.isConfigured()) {
      return res.status(503).json({ error: 'AI not configured' });
    }

    let transcript = meeting.transcript;

    // Transcribe audio if we have audio but no transcript
    if (!transcript && meeting.audio_file_url && !isOwnStorageUrl(meeting.audio_file_url)) {
      log.warn('Reprocess: audio_file_url is not in this project\'s storage, not fetching', { meetingId: id });
    } else if (!transcript && meeting.audio_file_url) {
      try {
        const audioResp = await fetch(meeting.audio_file_url);
        if (audioResp.ok) {
          const buffer = Buffer.from(await audioResp.arrayBuffer());
          const mimeType = audioResp.headers.get('content-type') || 'audio/webm';
          transcript = await ai.transcribeAudio(buffer, mimeType);
        }
      } catch (transcribeErr) {
        log.warn('Audio transcription failed:', transcribeErr.message);
      }
    }

    if (!transcript) {
      return res.status(400).json({ error: 'No transcript or audio available to process' });
    }

    // Run AI pipeline
    const { summaryData, actionItems: rawActionItems, embedding } = await runAIPipeline(transcript, meeting.title, {
      attendees: meeting.attendees, template: meeting.summary_template,
      extractActions: meeting.action_items_require_approval !== true,
      meetingId: id,
    });
    const segments = Array.isArray(meeting.transcript_segments) ? meeting.transcript_segments : null;
    const actionItems = transcriptMoments.withActionItemMoments(segments, rawActionItems);

    // Update meeting record
    const updateData = {
      transcript,
      summary: summaryData.summary,
      key_points: summaryData.keyPoints || [],
      decisions: summaryData.decisions || [],
      sentiment_label: summaryData.sentiment,
      sentiment_score: summaryData.sentimentScore || 0.5,
      topics: summaryData.topics || [],
      ...summaryTemplates.summaryFields(summaryData),
      duration_minutes: meeting.duration_minutes || parseDuration(summaryData.estimatedDuration),
      updated_at: new Date(Math.max(Date.now(), (Date.parse(meeting.updated_at) || 0) + 1)).toISOString(),
    };
    if (segments) {
      updateData.summary_moments = transcriptMoments.summaryMoments(segments, updateData.key_points, updateData.decisions);
    }
    if (embedding) {
      updateData.transcript_embedding = embedding;
    }

    // A browser recording whose first summary failed: the summary exists now.
    if (meeting.recording_job?.summaryError) {
      updateData.recording_job = { ...meeting.recording_job, summaryError: null };
    }

    // Do not mark the minutes complete until the whole action batch is durable.
    const { items: savedActionItems, created: actionsCreated } = await saveActionItems(meeting, actionItems);
    let save = supabase.from('meetings').update(updateData).eq('id', id).eq('org_id', orgId);
    save = meeting.updated_at == null ? save.is('updated_at', null) : save.eq('updated_at', meeting.updated_at);
    const { data: updatedMeeting, error: saveError } = await save.select().maybeSingle();
    if (saveError) throw saveError;
    if (!updatedMeeting) {
      const { data: latest, error: readError } = await supabase.from('meetings').select('summary, recording_job')
        .eq('id', id).eq('org_id', orgId).maybeSingle();
      if (readError) throw readError;
      if (latest?.summary && !latest.recording_job?.summaryError) {
        return res.json({ success: true, alreadyProcessed: true, meetingId: id });
      }
      return res.status(409).json({ error: 'The meeting changed while loading its minutes. Try again.' });
    }

    // Fire async post-processing (embeddings + ecosystem sync + calendar auto-sync)
    firePostProcessing(updatedMeeting, summaryData, savedActionItems, {
      actionsCreated,
      userId: req.user?.id,
      calendarTokens: getCalendarTokens(req)
    });

    res.json({
      success: true,
      meetingId: id,
      summary: summaryData.summary,
      sentiment: summaryData.sentiment,
      actionItemCount: savedActionItems.length,
    });
  } catch (err) {
    log.error('Reprocess error:', err);
    res.status(500).json({ error: 'Could not finish writing the meeting minutes. Try again.' });
  }
});

// Helper functions
function parseAttendees(attendeesInput) {
  if (!attendeesInput) return [];
  if (Array.isArray(attendeesInput)) return attendeesInput;
  try {
    return JSON.parse(attendeesInput);
  } catch {
    return attendeesInput.split(',').map(a => a.trim()).filter(Boolean);
  }
}

function parseDuration(durationStr) {
  if (!durationStr) return null;
  const match = durationStr.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

function formatRecapFallback(meeting, actionItems) {
  const sentimentEmoji = {
    'Positive': '😊',
    'Neutral': '😐',
    'Negative': '😟'
  }[meeting.sentiment_label] || '📝';

  let message = `${sentimentEmoji} *Meeting Recap: ${meeting.title}*\n\n`;
  message += `*Summary:* ${meeting.summary}\n\n`;

  if (meeting.key_points?.length > 0) {
    message += `*Key Points:*\n`;
    meeting.key_points.forEach(point => {
      message += `• ${point}\n`;
    });
    message += '\n';
  }

  if (meeting.decisions?.length > 0) {
    message += `*Decisions:*\n`;
    meeting.decisions.forEach(decision => {
      message += `• ${decision}\n`;
    });
    message += '\n';
  }

  if (actionItems?.length > 0) {
    message += `*Action Items:*\n`;
    actionItems.forEach(item => {
      const priorityEmoji = { 'high': '🔴', 'medium': '🟡', 'low': '🟢' }[item.priority] || '';
      message += `${priorityEmoji} ${item.task_description} (${item.assigned_to_name}, due ${item.due_date})\n`;
    });
  }

  return message;
}

// ── Follow-up email (Slate pick C "Letter", 2026-11-23) ──
// One drafted email per meeting, sent on its own 20 minutes after the meeting
// unless someone edits or stops it. See services/followUp.js.

const followUp = require('../services/followUp');

/** What the Follow-up tab needs, in one shape. */
async function followUpPayload(req, result, orgId) {
  const { row, parts } = result;
  return {
    followUp: row,
    parts,
    autoSend: await followUp.autoSendFor(req.user.id),
    mailReady: require('../services/mailer').isConfigured(),
    canSend: await followUp.canSend(req.user.id, row, orgId),
  };
}

/** GET /api/meetings/follow-up/auto-send — the caller's own switch. */
router.get('/follow-up/auto-send', authenticate, async (req, res) => {
  try {
    res.json({ enabled: await followUp.autoSendFor(req.user.id) });
  } catch (error) {
    log.error('Error reading follow-up auto-send:', { error: error.message || error });
    res.status(500).json({ error: 'Could not read the setting' });
  }
});

/** PUT /api/meetings/follow-up/auto-send { enabled } */
router.put('/follow-up/auto-send', authenticate, validate(schemas.followUpAutoSend), async (req, res) => {
  try {
    res.json({ enabled: await followUp.setAutoSend(req.user.id, req.body.enabled) });
  } catch (error) {
    log.error('Error saving follow-up auto-send:', { error: error.message || error });
    res.status(500).json({ error: 'Could not save the setting' });
  }
});

/** GET /api/meetings/:id/follow-up — the draft, written on first ask. */
router.get('/:id/follow-up', authenticate, validate(schemas.followUpAction), async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });
    const orgId = await meetingOrgOrRespond(req, res, req.params.id);
    if (!orgId) return;
    const result = await followUp.getOrCreate(req.params.id, { userId: req.user.id });
    if (!result) return res.status(404).json({ error: 'Meeting not found' });
    res.json(await followUpPayload(req, result, orgId));
  } catch (error) {
    log.error('Error loading follow-up:', { error: error.message || error });
    res.status(500).json({ error: 'Could not load the follow-up' });
  }
});

/** PUT /api/meetings/:id/follow-up — save edits; a scheduled one waits for Send now. */
router.put('/:id/follow-up', authenticate, validate(schemas.followUpUpdate), async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });
    const orgId = await meetingOrgOrRespond(req, res, req.params.id);
    if (!orgId) return;
    const out = await followUp.update(req.params.id, req.body);
    if (out.error === 'not_found') return res.status(404).json({ error: 'No follow-up for this meeting yet' });
    if (out.error === 'locked') return res.status(409).json({ error: 'It has already gone out.', status: out.status });
    const result = await followUp.getOrCreate(req.params.id, { userId: req.user.id });
    res.json(await followUpPayload(req, { ...result, row: out.row }, orgId));
  } catch (error) {
    log.error('Error saving follow-up:', { error: error.message || error });
    res.status(500).json({ error: 'Could not save the follow-up' });
  }
});

/** Send or stop: the person it is sent for, or a workspace owner/admin. */
function followUpAction(action) {
  return async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: 'Database not configured' });
      const orgId = await meetingOrgOrRespond(req, res, req.params.id);
      if (!orgId) return;
      const current = await followUp.getOrCreate(req.params.id, { userId: req.user.id });
      if (!current) return res.status(404).json({ error: 'Meeting not found' });
      if (!current.row) return res.status(409).json({ error: 'Nothing to send until the minutes are ready.' });
      if (!(await followUp.canSend(req.user.id, current.row, orgId))) {
        return res.status(403).json({ error: `Only the person it is sent for, or a workspace admin, can ${action} it.` });
      }
      if (action === 'send') {
        const out = await followUp.send(req.params.id);
        if (out.error) return res.status(out.status || 502).json({ error: out.error });
        log.info('Follow-up sent', { meetingId: req.params.id, orgId });
        return res.json(await followUpPayload(req, { ...current, row: out.row }, orgId));
      }
      const row = await followUp.stop(req.params.id);
      if (!row) return res.status(409).json({ error: 'It has already gone out.' });
      res.json(await followUpPayload(req, { ...current, row }, orgId));
    } catch (error) {
      log.error(`Error on follow-up ${action}:`, { error: error.message || error });
      res.status(500).json({ error: `Could not ${action} the follow-up` });
    }
  };
}

router.post('/:id/follow-up/send', authenticate, validate(schemas.followUpAction), followUpAction('send'));
router.post('/:id/follow-up/stop', authenticate, validate(schemas.followUpAction), followUpAction('stop'));

module.exports = router;

// Shared with services/transcriptIngest.js, which turns finished bot sessions into meetings.
module.exports._pipeline = { runAIPipeline, saveActionItems, firePostProcessing };
