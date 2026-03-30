const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../config/supabase');
const ai = require('../config/ai');
const embeddingService = require('../services/embeddingService');
const hubEventPublisher = require('../services/hubEventPublisher');
const { getEcosystemBridge } = require('../services/ecosystemBridge');
const { validate } = require('../middleware/validate');
const schemas = require('../schemas/meetings');
const log = require('../utils/log');

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
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
router.post('/process', upload.single('audio'), validate(schemas.process), async (req, res) => {
  try {
    const { title, attendees, projectId, crmDealId } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    if (!ai.isConfigured()) {
      return res.status(503).json({ error: 'AI API not configured (set OPENAI_API_KEY or GEMINI_API_KEY)' });
    }

    log.info(`Processing meeting: ${title || 'Untitled Meeting'} (using ${ai.getProviderName()})`);

    // Step 1: Transcribe audio
    const transcript = await ai.transcribeAudio(req.file.buffer, req.file.mimetype);

    // Step 2: Generate summary
    const summaryData = await ai.generateSummary(transcript);

    // Step 3: Extract action items
    const actionItems = await ai.extractActionItems(transcript);

    // Step 4: Generate embedding for semantic search
    let embedding = null;
    try {
      const textForEmbedding = `${title || ''} ${summaryData.summary} ${transcript.substring(0, 5000)}`;
      embedding = await ai.generateEmbedding(textForEmbedding);
    } catch (embeddingError) {
      log.warn('Embedding generation failed:', embeddingError.message);
    }

    // Step 5: Upload audio to Supabase Storage (if configured)
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

    // Step 6: Save meeting to database
    const meetingId = uuidv4();
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
      attendees: parseAttendees(attendees),
      duration_minutes: parseDuration(summaryData.estimatedDuration),
      audio_file_url: audioUrl,
      project_id: projectId || null,
      crm_deal_id: crmDealId || null,
      created_by: (req.user?.id && req.user.id !== 'anonymous') ? req.user.id : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Add embedding if available (stored as array)
    if (embedding) {
      meetingData.transcript_embedding = embedding;
    }

    let savedMeeting = meetingData;
    if (supabase) {
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert(meetingData)
        .select()
        .single();

      if (meetingError) {
        log.error('Meeting save error:', { error: meetingError.message || meetingError });
        // Continue anyway - return data even if DB save fails
      } else {
        savedMeeting = meeting;
      }
    }

    log.info('Meeting saved:', savedMeeting.id);

    // Step 7: Save action items
    const savedActionItems = [];
    for (const item of actionItems) {
      const actionItemData = {
        id: uuidv4(),
        meeting_id: savedMeeting.id,
        task_description: item.task,
        context: item.context,
        assigned_to_name: item.owner,
        assigned_to_email: item.ownerEmail,
        due_date: item.dueDate,
        priority: item.priority?.toLowerCase() || 'medium',
        status: 'open',
        crm_sync_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (supabase) {
        const { data: actionItem, error: actionError } = await supabase
          .from('action_items')
          .insert(actionItemData)
          .select()
          .single();

        if (!actionError) {
          savedActionItems.push(actionItem);
        } else {
          savedActionItems.push(actionItemData);
        }
      } else {
        savedActionItems.push(actionItemData);
      }
    }

    log.info(`Saved ${savedActionItems.length} action items`);

    // Step 8: Generate embeddings for semantic search (async, non-blocking)
    setTimeout(async () => {
      try {
        await embeddingService.generateEmbeddingsForMeeting(
          savedMeeting.id,
          {
            summary: savedMeeting.summary,
            key_points: summaryData.keyPoints,
            decisions: summaryData.decisions,
            transcript: savedMeeting.transcript
          },
          savedActionItems
        );
        log.info(`Generated embeddings for meeting ${savedMeeting.id}`);
      } catch (embeddingError) {
        log.warn('Embedding generation failed:', embeddingError.message);
      }

      // Step 9: Ecosystem Bridge sync (Logos Vision + Pulse)
      try {
        const bridge = await getEcosystemBridge();

        // Post meeting recap to Pulse
        if (bridge.isConnected('pulse')) {
          const recap = formatRecapFallback(savedMeeting, savedActionItems);
          await bridge.postToPulse({
            channel: 'entomate-meetings',
            title: `Meeting processed: ${savedMeeting.title}`,
            message: recap,
            urgency: savedActionItems.some(i => i.priority === 'high') ? 'high' : 'normal',
            metadata: { meetingId: savedMeeting.id }
          });

          // Post task assignments to Pulse
          const highPriItems = savedActionItems.filter(i => i.priority === 'high');
          if (highPriItems.length > 0) {
            const taskMsg = highPriItems.map(i =>
              `🔴 ${i.task_description} → ${i.assigned_to_name || 'Unassigned'} (due ${i.due_date || 'TBD'})`
            ).join('\n');
            await bridge.postToPulse({
              channel: 'entomate-tasks',
              title: `${highPriItems.length} high-priority task(s) from: ${savedMeeting.title}`,
              message: taskMsg,
              urgency: 'high'
            });
          }
        }

        // Sync meeting + action items to Logos Vision
        if (bridge.isConnected('logos_vision')) {
          await bridge.syncMeetingToLogosVision({
            meeting: savedMeeting,
            actionItems: savedActionItems
          });

          // Discover contacts from attendees
          const attendees = savedMeeting.attendees || [];
          for (const attendee of attendees) {
            if (attendee.email) {
              await bridge.syncContactToLogosVision({
                email: attendee.email,
                name: attendee.name,
                meetingId: savedMeeting.id
              });
            }
          }
        }

        // Legacy hub fallback (for backward compat during migration)
        try {
          await hubEventPublisher.meetingCompleted({
            ...savedMeeting,
            action_items: savedActionItems
          });
        } catch { /* hub may not be configured */ }

        log.info(`Ecosystem sync complete for meeting ${savedMeeting.id}`);
      } catch (syncError) {
        log.warn('Ecosystem sync failed (non-blocking):', syncError.message);
      }
    }, 0);

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
      details: error.message
    });
  }
});

/**
 * POST /api/meetings/transcript
 * Process a text transcript (no audio)
 */
router.post('/transcript', validate(schemas.transcript), async (req, res) => {
  try {
    const { title, transcript, attendees, projectId, crmDealId } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    if (!ai.isConfigured()) {
      return res.status(503).json({ error: 'Gemini API not configured' });
    }

    log.info('Processing transcript:', title || 'Untitled Meeting');

    // Generate summary
    const summaryData = await ai.generateSummary(transcript);

    // Extract action items
    const actionItems = await ai.extractActionItems(transcript);

    // Generate embedding
    let embedding = null;
    try {
      const textForEmbedding = `${title || ''} ${summaryData.summary} ${transcript.substring(0, 5000)}`;
      embedding = await ai.generateEmbedding(textForEmbedding);
    } catch (embeddingError) {
      log.warn('Embedding generation failed:', embeddingError.message);
    }

    // Save meeting
    const meetingId = uuidv4();
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
      attendees: parseAttendees(attendees),
      duration_minutes: parseDuration(summaryData.estimatedDuration),
      project_id: projectId || null,
      crm_deal_id: crmDealId || null,
      created_by: (req.user?.id && req.user.id !== 'anonymous') ? req.user.id : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (embedding) {
      meetingData.transcript_embedding = embedding;
    }

    let savedMeeting = meetingData;
    if (supabase) {
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert(meetingData)
        .select()
        .single();

      if (!meetingError) {
        savedMeeting = meeting;
      }
    }

    // Save action items
    const savedActionItems = [];
    for (const item of actionItems) {
      const actionItemData = {
        id: uuidv4(),
        meeting_id: savedMeeting.id,
        task_description: item.task,
        context: item.context,
        assigned_to_name: item.owner,
        assigned_to_email: item.ownerEmail,
        due_date: item.dueDate,
        priority: item.priority?.toLowerCase() || 'medium',
        status: 'open',
        crm_sync_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (supabase) {
        const { data: actionItem, error } = await supabase
          .from('action_items')
          .insert(actionItemData)
          .select()
          .single();

        savedActionItems.push(error ? actionItemData : actionItem);
      } else {
        savedActionItems.push(actionItemData);
      }
    }

    // Generate embeddings for semantic search (async, non-blocking)
    setTimeout(async () => {
      try {
        await embeddingService.generateEmbeddingsForMeeting(
          savedMeeting.id,
          {
            summary: savedMeeting.summary,
            key_points: summaryData.keyPoints,
            decisions: summaryData.decisions,
            transcript: savedMeeting.transcript
          },
          savedActionItems
        );
        log.info(`Generated embeddings for meeting ${savedMeeting.id}`);
      } catch (embeddingError) {
        log.warn('Embedding generation failed:', embeddingError.message);
      }
    }, 0);

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
      details: error.message
    });
  }
});

/**
 * GET /api/meetings
 * List all meetings with pagination and filters
 */
router.get('/', validate(schemas.list), async (req, res) => {
  try {
    const { limit = 20, offset = 0, projectId, search, startDate, endDate } = req.query;

    if (!supabase) {
      return res.json({ meetings: [], count: 0, hasMore: false });
    }

    let query = supabase
      .from('meetings')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%`);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: meetings, error, count } = await query;

    if (error) throw error;

    res.json({
      meetings: meetings || [],
      count: count || 0,
      hasMore: (meetings?.length || 0) === parseInt(limit)
    });

  } catch (error) {
    log.error('Error listing meetings:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/meetings/:id
 * Get meeting details with action items
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(404).json({ error: 'Database not configured' });
    }

    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', id)
      .single();

    if (meetingError) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const { data: actionItems } = await supabase
      .from('action_items')
      .select('*')
      .eq('meeting_id', id)
      .order('priority', { ascending: false });

    res.json({
      ...meeting,
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
router.put('/:id', validate(schemas.update), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Only allow certain fields to be updated
    const allowedFields = ['title', 'summary', 'key_points', 'decisions', 'project_id', 'crm_deal_id'];
    const filteredUpdates = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }
    filteredUpdates.updated_at = new Date().toISOString();

    const { data: meeting, error } = await supabase
      .from('meetings')
      .update(filteredUpdates)
      .eq('id', id)
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
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Delete action items first (cascade should handle this, but being explicit)
    await supabase
      .from('action_items')
      .delete()
      .eq('meeting_id', id);

    // Delete meeting
    const { error } = await supabase
      .from('meetings')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    res.json({ success: true, message: 'Meeting deleted' });

  } catch (error) {
    log.error('Error deleting meeting:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/meetings/:id/ask
 * Ask AI question about a specific meeting
 */
router.post('/:id/ask', validate(schemas.ask), async (req, res) => {
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
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', id)
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
 * GET /api/meetings/:id/recap
 * Get formatted chat recap for a meeting
 */
router.get('/:id/recap', async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Get meeting with action items
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', id)
      .single();

    if (meetingError) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const { data: actionItems } = await supabase
      .from('action_items')
      .select('*')
      .eq('meeting_id', id);

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
 * @param {string} title - Meeting title (used for embedding context)
 * @returns {{ summaryData, actionItems, embedding }}
 */
async function runAIPipeline(transcript, title) {
  const summaryData = await ai.generateSummary(transcript);
  const actionItems = await ai.extractActionItems(transcript);

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
 * Save action items to DB for a given meeting.
 * @returns {Array} saved action items
 */
async function saveActionItems(meetingId, actionItems) {
  const saved = [];
  for (const item of actionItems) {
    const data = {
      id: uuidv4(),
      meeting_id: meetingId,
      task_description: item.task,
      context: item.context,
      assigned_to_name: item.owner,
      assigned_to_email: item.ownerEmail,
      due_date: item.dueDate,
      priority: item.priority?.toLowerCase() || 'medium',
      status: 'open',
      crm_sync_status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (supabase) {
      const { data: row, error } = await supabase
        .from('action_items')
        .insert(data)
        .select()
        .single();
      saved.push(error ? data : row);
    } else {
      saved.push(data);
    }
  }
  return saved;
}

/**
 * Fire async post-processing: embeddings + ecosystem bridge sync.
 * Non-blocking — errors are logged but never thrown.
 */
function firePostProcessing(savedMeeting, summaryData, savedActionItems) {
  setTimeout(async () => {
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

        const highPriItems = savedActionItems.filter(i => i.priority === 'high');
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
      }

      if (bridge.isConnected('logos_vision')) {
        await bridge.syncMeetingToLogosVision({
          meeting: savedMeeting,
          actionItems: savedActionItems,
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
  }, 0);
}

// ── Reprocess Endpoint ──

/**
 * POST /api/meetings/:id/reprocess
 * Re-run AI processing on an existing meeting (e.g., after ecosystem import).
 * Used by the ecosystem-inbound edge function after receiving a Pulse export.
 */
router.post('/:id/reprocess', async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { data: meeting, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Already fully processed?
    if (meeting.summary && meeting.key_points?.length > 0) {
      return res.json({ success: true, alreadyProcessed: true, meetingId: id });
    }

    if (!ai.isConfigured()) {
      return res.status(503).json({ error: 'AI not configured' });
    }

    let transcript = meeting.transcript;

    // Transcribe audio if we have audio but no transcript
    if (!transcript && meeting.audio_file_url) {
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
    const { summaryData, actionItems, embedding } = await runAIPipeline(transcript, meeting.title);

    // Update meeting record
    const updateData = {
      transcript,
      summary: summaryData.summary,
      key_points: summaryData.keyPoints || [],
      decisions: summaryData.decisions || [],
      sentiment_label: summaryData.sentiment,
      sentiment_score: summaryData.sentimentScore || 0.5,
      topics: summaryData.topics || [],
      duration_minutes: meeting.duration_minutes || parseDuration(summaryData.estimatedDuration),
      updated_at: new Date().toISOString(),
    };
    if (embedding) {
      updateData.transcript_embedding = embedding;
    }

    await supabase.from('meetings').update(updateData).eq('id', id);

    // Save action items
    const savedActionItems = await saveActionItems(id, actionItems);

    // Build the updated meeting object for post-processing
    const updatedMeeting = { ...meeting, ...updateData };

    // Fire async post-processing (embeddings + ecosystem sync)
    firePostProcessing(updatedMeeting, summaryData, savedActionItems);

    res.json({
      success: true,
      meetingId: id,
      summary: summaryData.summary,
      sentiment: summaryData.sentiment,
      actionItemCount: savedActionItems.length,
    });
  } catch (err) {
    log.error('Reprocess error:', err);
    res.status(500).json({ error: 'Failed to reprocess meeting' });
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

module.exports = router;
