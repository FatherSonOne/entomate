/**
 * Reports API Routes
 * Week 6: PDF and CSV export endpoints
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const reportService = require('../services/reportService');
const log = require('../utils/log');

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

    // Get meeting details
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', id)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Get action items for this meeting
    const { data: actionItems } = await supabase
      .from('action_items')
      .select('*')
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
 * GET /api/reports/goals/pdf
 * Generate PDF report for all goals
 */
router.get('/goals/pdf', async (req, res) => {
  try {
    const { quarter } = req.query;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Get goals
    let query = supabase.from('goals').select('*');
    if (quarter) {
      query = query.eq('quarter', quarter);
    }

    const { data: goals, error } = await query.order('goal_type');

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch goals' });
    }

    // Calculate stats
    const stats = {
      quarter: quarter || 'All Time',
      total: goals?.length || 0,
      averageProgress: goals?.length > 0
        ? Math.round(goals.reduce((sum, g) => sum + (g.progress || 0), 0) / goals.length)
        : 0,
      onTrack: goals?.filter(g => g.progress >= 70).length || 0,
      atRisk: goals?.filter(g => g.progress < 30 && g.status === 'active').length || 0
    };

    // Generate PDF
    const pdfBuffer = await reportService.generateGoalsReportPDF(goals || [], stats);

    const filename = `goals-report-${quarter || 'all'}-${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    log.error('Error generating goals PDF:', { error: error.message || error });
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

    // Get project stats
    const { data: project, error: projectError } = await supabase
      .from('project_statistics')
      .select('*')
      .eq('id', id)
      .single();

    if (projectError && projectError.code !== 'PGRST116') {
      // Try fetching from meetings directly
      const { data: meeting } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', id)
        .single();

      if (!meeting) {
        return res.status(404).json({ error: 'Project not found' });
      }
    }

    // Get action items
    const { data: actionItems } = await supabase
      .from('action_items')
      .select('*')
      .eq('meeting_id', id)
      .order('status');

    // Get team workload for this project
    const workloadMap = new Map();
    (actionItems || []).forEach(item => {
      if (!item.assigned_to_name) return;
      if (!workloadMap.has(item.assigned_to_name)) {
        workloadMap.set(item.assigned_to_name, {
          team_member: item.assigned_to_name,
          total_assigned: 0,
          completed_items: 0
        });
      }
      const member = workloadMap.get(item.assigned_to_name);
      member.total_assigned++;
      if (item.status === 'done' || item.status === 'complete') {
        member.completed_items++;
      }
    });
    const teamWorkload = Array.from(workloadMap.values());

    // Generate PDF
    const pdfBuffer = await reportService.generateProjectReportPDF(
      project || { title: 'Project Report', id },
      actionItems || [],
      teamWorkload
    );

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

    const [meetingsRes, actionItemsRes, goalsRes] = await Promise.all([
      supabase.from('meetings').select('*').gte('created_at', weekAgoISO).order('created_at', { ascending: false }),
      supabase.from('action_items').select('*').order('created_at', { ascending: false }),
      supabase.from('goals').select('*').eq('status', 'active')
    ]);

    const period = `${weekAgo.toLocaleDateString()} - ${new Date().toLocaleDateString()}`;

    const pdfBuffer = await reportService.generateWeeklySummaryPDF({
      meetings: meetingsRes.data || [],
      actionItems: actionItemsRes.data || [],
      goals: goalsRes.data || [],
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

    let query = supabase.from('action_items').select('*');

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
 * GET /api/reports/goals/csv
 * Export all goals as CSV
 */
router.get('/goals/csv', async (req, res) => {
  try {
    const { quarter, type } = req.query;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    let query = supabase.from('goals').select('*');

    if (quarter) {
      query = query.eq('quarter', quarter);
    }
    if (type) {
      query = query.eq('goal_type', type);
    }

    const { data: goals, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    const csv = reportService.generateGoalsCSV(goals || []);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="goals-export-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    log.error('Error generating goals CSV:', { error: error.message || error });
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
        id: 'goals-report',
        name: 'Goals & OKRs Report',
        description: 'PDF report of all goals with progress',
        endpoint: '/api/reports/goals/pdf',
        format: 'pdf',
        params: ['quarter (optional)']
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
        id: 'goals-csv',
        name: 'Goals Export',
        description: 'CSV export of goals',
        endpoint: '/api/reports/goals/csv',
        format: 'csv',
        params: ['quarter (optional)', 'type (optional)']
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

    // Get meeting
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Get action items
    const { data: actionItems } = await supabase
      .from('action_items')
      .select('*')
      .eq('meeting_id', meetingId);

    await emailService.sendMeetingRecap(email, meeting, actionItems || []);

    res.json({ success: true, message: `Meeting recap sent to ${email}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send meeting recap', details: error.message });
  }
});

module.exports = router;
