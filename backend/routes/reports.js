/**
 * Reports API Routes
 * Week 6: PDF and CSV export endpoints
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const reportService = require('../services/reportService');
const { buildProjectReport } = require('../services/projectReport');
const log = require('../utils/log');
const { attachOrgIds } = require('../utils/orgContext');

// Require authentication for all report routes
router.use(authenticate);
router.use(attachOrgIds); // org-owned tables below are limited to req.orgIds (audit finding 3)

/**
 * Helper: get meeting IDs owned by a user (for scoping action_items)
 */
async function getUserMeetingIds(userId) {
  const { data } = await supabase
    .from('meetings')
    .select('id')
    .in('org_id', req.orgIds)
    .eq('created_by', userId);
  return (data || []).map(m => m.id);
}

/**
 * GET /api/reports/meeting/:id/pdf
 * Generate PDF recap for a specific meeting
 */
router.get('/meeting/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Get meeting details (scoped to current user)
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .in('org_id', req.orgIds)
      .eq('id', id)
      .eq('created_by', req.user.id)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Get action items for this meeting
    const { data: actionItems } = await supabase
      .from('action_items')
      .select('*')
      .in('org_id', req.orgIds)
      .eq('meeting_id', id)
      .order('priority', { ascending: true });

    // Generate PDF
    const pdfBuffer = await reportService.generateMeetingRecapPDF(meeting, actionItems || []);

    // Set response headers
    const filename = `meeting-recap-${meeting.title?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    log.error('Error generating meeting PDF:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to generate PDF', details: error.message });
  }
});

/**
 * GET /api/reports/project/:id/pdf
 * Generate PDF report for a project
 */
router.get('/project/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id, name')
      .in('org_id', req.orgIds)
      .eq('id', id)
      .maybeSingle();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const [{ data: tasks }, { data: meetings }] = await Promise.all([
      supabase
        .from('tasks')
        .select('title, description, status, assigned_to, due_date')
        .in('org_id', req.orgIds)
        .eq('project_id', id),
      supabase
        .from('meetings')
        .select('id')
        .in('org_id', req.orgIds)
        .eq('project_id', id),
    ]);

    const meetingIds = (meetings || []).map((m) => m.id);
    let actionItems = [];
    if (meetingIds.length) {
      const { data } = await supabase
        .from('action_items')
        .select('task_description, status, assigned_to_name, due_date')
        .in('org_id', req.orgIds)
        .in('meeting_id', meetingIds);
      actionItems = data || [];
    }

    const report = buildProjectReport({ project, tasks: tasks || [], actionItems });
    const pdfBuffer = await reportService.generateProjectReportPDF(report.project, report.items, report.teamWorkload);

    const filename = `project-report-${id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    log.error('Error generating project PDF:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to generate PDF', details: error.message });
  }
});

/**
 * GET /api/reports/weekly/pdf
 * Generate weekly summary PDF
 */
router.get('/weekly/pdf', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Get data from the past week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoISO = weekAgo.toISOString();

    // Scope all queries to current user
    const meetingIds = await getUserMeetingIds(req.user.id);

    const [meetingsRes, actionItemsRes] = await Promise.all([
      supabase.from('meetings').select('*').eq('created_by', req.user.id).gte('created_at', weekAgoISO).order('created_at', { ascending: false }),
      meetingIds.length > 0
        ? supabase.from('action_items').select('*').in('meeting_id', meetingIds).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] })
    ]);

    const period = `${weekAgo.toLocaleDateString()} - ${new Date().toLocaleDateString()}`;

    const pdfBuffer = await reportService.generateWeeklySummaryPDF({
      meetings: meetingsRes.data || [],
      actionItems: actionItemsRes.data || [],
      period
    });

    const filename = `weekly-summary-${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    log.error('Error generating weekly PDF:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to generate PDF', details: error.message });
  }
});

/**
 * GET /api/reports/meetings/csv
 * Export all meetings as CSV
 */
router.get('/meetings/csv', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { data: meetings, error } = await supabase
      .from('meetings')
      .select('*')
      .in('org_id', req.orgIds)
      .eq('created_by', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const csv = reportService.generateMeetingsCSV(meetings || []);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="meetings-export-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    log.error('Error generating meetings CSV:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to generate CSV', details: error.message });
  }
});

/**
 * GET /api/reports/action-items/csv
 * Export all action items as CSV
 */
router.get('/action-items/csv', async (req, res) => {
  try {
    const { status, meetingId } = req.query;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Scope action items to user's meetings
    const meetingIds = await getUserMeetingIds(req.user.id);
    if (meetingIds.length === 0) {
      const csv = reportService.generateActionItemsCSV([]);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="action-items-export-${Date.now()}.csv"`);
      return res.send(csv);
    }

    let query = supabase.from('action_items').select('*').in('meeting_id', meetingIds);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (meetingId) {
      query = query.eq('meeting_id', meetingId);
    }

    const { data: actionItems, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    const csv = reportService.generateActionItemsCSV(actionItems || []);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="action-items-export-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    log.error('Error generating action items CSV:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to generate CSV', details: error.message });
  }
});

/**
 * GET /api/reports/tasks/csv
 * Export tasks as CSV
 */
router.get('/tasks/csv', async (req, res) => {
  try {
    const { status, priority, projectId, assignedTo } = req.query;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    let query = supabase.from('tasks').select('*').in('org_id', req.orgIds);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (priority && priority !== 'all') {
      query = query.eq('priority', priority);
    }
    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo);
    }

    const { data: tasks, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    const csv = reportService.generateTasksCSV(tasks || []);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="tasks-export-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    log.error('Error generating tasks CSV:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to generate CSV', details: error.message });
  }
});

/**
 * GET /api/reports/available
 * List available report types
 */
router.get('/available', (req, res) => {
  res.json({
    reports: [
      {
        id: 'meeting-recap',
        name: 'Meeting Recap',
        description: 'PDF summary of a meeting with action items',
        endpoint: '/api/reports/meeting/:id/pdf',
        format: 'pdf',
        params: ['id']
      },
      {
        id: 'project-report',
        name: 'Project Report',
        description: 'PDF report of project status and action items',
        endpoint: '/api/reports/project/:id/pdf',
        format: 'pdf',
        params: ['id']
      },
      {
        id: 'weekly-summary',
        name: 'Weekly Summary',
        description: 'PDF summary of the past week',
        endpoint: '/api/reports/weekly/pdf',
        format: 'pdf',
        params: []
      },
      {
        id: 'meetings-csv',
        name: 'Meetings Export',
        description: 'CSV export of all meetings',
        endpoint: '/api/reports/meetings/csv',
        format: 'csv',
        params: []
      },
      {
        id: 'action-items-csv',
        name: 'Action Items Export',
        description: 'CSV export of action items',
        endpoint: '/api/reports/action-items/csv',
        format: 'csv',
        params: ['status (optional)', 'meetingId (optional)']
      },
      {
        id: 'tasks-csv',
        name: 'Tasks Export',
        description: 'CSV export of tasks',
        endpoint: '/api/reports/tasks/csv',
        format: 'csv',
        params: ['status (optional)', 'priority (optional)', 'projectId (optional)', 'assignedTo (optional)']
      }
    ]
  });
});

/**
 * GET /api/reports/scheduler/status
 * Get scheduler service status
 */
router.get('/scheduler/status', (req, res) => {
  try {
    const schedulerService = require('../services/schedulerService');
    const emailService = require('../services/emailService');

    res.json({
      scheduler: schedulerService.getStatus(),
      email: {
        configured: emailService.isConfigured()
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get scheduler status', details: error.message });
  }
});

/**
 * POST /api/reports/scheduler/trigger-weekly
 * Manually trigger weekly summary (for testing)
 */
router.post('/scheduler/trigger-weekly', async (req, res) => {
  try {
    const schedulerService = require('../services/schedulerService');
    await schedulerService.triggerWeeklySummary();
    res.json({ success: true, message: 'Weekly summary triggered' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to trigger weekly summary', details: error.message });
  }
});

/**
 * POST /api/reports/scheduler/trigger-overdue
 * Manually trigger overdue check (for testing)
 */
router.post('/scheduler/trigger-overdue', async (req, res) => {
  try {
    const schedulerService = require('../services/schedulerService');
    await schedulerService.triggerOverdueCheck();
    res.json({ success: true, message: 'Overdue check triggered' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to trigger overdue check', details: error.message });
  }
});

/**
 * POST /api/reports/send-meeting-recap
 * Send meeting recap email
 */
router.post('/send-meeting-recap', async (req, res) => {
  try {
    const { meetingId, email } = req.body;

    if (!meetingId || !email) {
      return res.status(400).json({ error: 'meetingId and email are required' });
    }

    const emailService = require('../services/emailService');
    emailService.initialize();

    if (!emailService.isConfigured()) {
      return res.status(503).json({ error: 'Email service not configured' });
    }

    // Get meeting (scoped to current user)
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .in('org_id', req.orgIds)
      .eq('id', meetingId)
      .eq('created_by', req.user.id)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Get action items
    const { data: actionItems } = await supabase
      .from('action_items')
      .select('*')
      .in('org_id', req.orgIds)
      .eq('meeting_id', meetingId);

    await emailService.sendMeetingRecap(email, meeting, actionItems || []);

    res.json({ success: true, message: `Meeting recap sent to ${email}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send meeting recap', details: error.message });
  }
});

module.exports = router;
