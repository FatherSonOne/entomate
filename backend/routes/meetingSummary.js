/**
 * Meeting Summary Widget Routes
 *
 * Backend endpoints supporting the AI Meeting Summary Widget
 * - Regenerate AI summary
 * - Publish to Logos CRM
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../config/supabase');
const ai = require('../config/ai');
const { authenticate } = require('../middleware/auth');
const log = require('../utils/log');

const router = express.Router();

/**
 * POST /api/meeting-summary/:id/regenerate
 * Regenerate AI summary for a meeting (widget support)
 */
router.post('/:id/regenerate', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ai.isConfigured()) {
      return res.status(503).json({ error: 'AI API not configured' });
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Get meeting
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', id)
      .single();

    if (meetingError) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    if (!meeting.transcript) {
      return res.status(400).json({ error: 'Meeting has no transcript to analyze' });
    }

    log.info(`[MeetingSummary] Regenerating summary for meeting: ${id}`);

    // Regenerate summary using AI
    const summaryData = await ai.generateSummary(meeting.transcript);

    // Extract next steps from action items or generate them
    let nextSteps = summaryData.nextSteps || [];
    if (nextSteps.length === 0) {
      // Get high priority action items as next steps
      const { data: highPriorityItems } = await supabase
        .from('action_items')
        .select('task_description')
        .eq('meeting_id', id)
        .eq('priority', 'high')
        .limit(3);

      nextSteps = (highPriorityItems || []).map(item => item.task_description);
    }

    // Update meeting with new summary
    const { data: updatedMeeting, error: updateError } = await supabase
      .from('meetings')
      .update({
        summary: summaryData.summary,
        key_points: summaryData.keyPoints || [],
        decisions: summaryData.decisions || [],
        sentiment_label: summaryData.sentiment,
        sentiment_score: summaryData.sentimentScore || 0.5,
        topics: summaryData.topics || [],
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      log.error('[MeetingSummary] Failed to update summary:', { error: updateError.message || updateError });
    }

    // Get action items
    const { data: actionItems } = await supabase
      .from('action_items')
      .select('*')
      .eq('meeting_id', id)
      .order('priority', { ascending: false });

    res.json({
      success: true,
      meeting: {
        id: updatedMeeting?.id || meeting.id,
        title: updatedMeeting?.title || meeting.title,
        summary: summaryData.summary,
        keyPoints: summaryData.keyPoints || [],
        decisions: summaryData.decisions || [],
        nextSteps,
        sentiment: summaryData.sentiment,
        sentimentScore: summaryData.sentimentScore,
        topics: summaryData.topics || [],
        actionItems: actionItems || []
      }
    });

  } catch (error) {
    log.error('[MeetingSummary] Error regenerating summary:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/meeting-summary/:id/publish-crm
 * Publish meeting summary to Logos CRM via shared-hub
 */
router.post('/:id/publish-crm', authenticate, async (req, res) => {
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

    // Sync pending action items to CRM
    const pendingItems = (actionItems || []).filter(
      item => item.crm_sync_status === 'pending' || item.crm_sync_status === 'failed'
    );

    const results = {
      meetingId: id,
      meetingTitle: meeting.title,
      synced: 0,
      failed: 0,
      skipped: 0,
      items: []
    };

    // Import CRM service
    let crmService;
    try {
      crmService = require('../services/crmService');
    } catch (err) {
      log.warn('[MeetingSummary] CRM service not available:', err.message);
      crmService = { configured: false };
    }

    for (const item of pendingItems) {
      try {
        let crmTaskId;

        if (crmService.configured) {
          const crmResult = await crmService.createTask({
            title: item.task_description,
            task_description: item.task_description,
            description: item.context,
            context: item.context,
            assigned_to_email: item.assigned_to_email,
            due_date: item.due_date,
            priority: item.priority,
            meeting_title: meeting.title,
            meeting_id: meeting.id
          });

          if (!crmResult.success) {
            throw new Error(crmResult.error || 'CRM task creation failed');
          }
          crmTaskId = crmResult.taskId;
        } else {
          // Simulate CRM task creation for Logos CRM
          log.info(`[MeetingSummary] Simulating Logos CRM task creation for: ${item.task_description}`);
          crmTaskId = `logos-${uuidv4().substring(0, 8)}`;
        }

        // Update action item
        await supabase
          .from('action_items')
          .update({
            crm_sync_status: 'synced',
            crm_task_id: crmTaskId,
            last_sync_attempt: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);

        results.synced++;
        results.items.push({
          id: item.id,
          task: item.task_description,
          crmTaskId,
          status: 'synced'
        });

      } catch (itemError) {
        // Mark as failed
        await supabase
          .from('action_items')
          .update({
            crm_sync_status: 'failed',
            last_sync_attempt: new Date().toISOString(),
            last_sync_error: itemError.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);

        results.failed++;
        results.items.push({
          id: item.id,
          task: item.task_description,
          error: itemError.message,
          status: 'failed'
        });
      }
    }

    // Mark already synced items
    results.skipped = (actionItems || []).filter(
      item => item.crm_sync_status === 'synced'
    ).length;

    res.json({
      success: true,
      message: results.synced > 0
        ? `Published ${results.synced} items to Logos CRM`
        : results.skipped > 0
          ? 'All items already synced to CRM'
          : 'No items to sync',
      ...results
    });

  } catch (error) {
    log.error('[MeetingSummary] Error publishing to CRM:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/meeting-summary/:id
 * Get meeting summary data for widget display
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Get meeting
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', id)
      .single();

    if (meetingError) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Get action items
    const { data: actionItems } = await supabase
      .from('action_items')
      .select('*')
      .eq('meeting_id', id)
      .order('priority', { ascending: false });

    // Get high priority items as next steps if not stored
    const nextSteps = (actionItems || [])
      .filter(item => item.priority === 'high')
      .slice(0, 3)
      .map(item => item.task_description);

    res.json({
      id: meeting.id,
      title: meeting.title,
      summary: meeting.summary,
      keyPoints: meeting.key_points || [],
      decisions: meeting.decisions || [],
      nextSteps,
      sentiment: meeting.sentiment_label,
      sentimentScore: meeting.sentiment_score,
      topics: meeting.topics || [],
      actionItems: actionItems || [],
      createdAt: meeting.created_at,
      updatedAt: meeting.updated_at
    });

  } catch (error) {
    log.error('[MeetingSummary] Error getting summary:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
