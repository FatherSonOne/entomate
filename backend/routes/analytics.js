const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { asyncHandler } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validate');
const schemas = require('../schemas/analytics');

/**
 * GET /api/analytics/dashboard
 * Get main analytics dashboard data
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;

  // Default to last 30 days
  const endDate = end_date ? new Date(end_date) : new Date();
  const startDate = start_date
    ? new Date(start_date)
    : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Fetch all relevant data
  const [
    meetingsResult,
    tasksResult,
    projectsResult,
    actionItemsResult,
    automationsResult
  ] = await Promise.all([
    supabase
      .from('meetings')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString()),
    supabase
      .from('tasks')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString()),
    supabase
      .from('projects')
      .select('*'),
    supabase
      .from('action_items')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString()),
    supabase
      .from('automation_logs')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
  ]);

  const meetings = meetingsResult.data || [];
  const tasks = tasksResult.data || [];
  const projects = projectsResult.data || [];
  const actionItems = actionItemsResult.data || [];
  const automationLogs = automationsResult.data || [];

  // Calculate metrics
  const dashboard = {
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    },
    overview: {
      meetingsProcessed: meetings.length,
      tasksCreated: tasks.length,
      tasksCompleted: tasks.filter(t => t.status === 'done').length,
      actionItemsExtracted: actionItems.length,
      automationsRun: automationLogs.length,
      activeProjects: projects.filter(p => p.status === 'active').length
    },
    meetings: {
      total: meetings.length,
      totalDuration: meetings.reduce((sum, m) => sum + (m.duration_minutes || 0), 0),
      avgDuration: meetings.length > 0
        ? Math.round(meetings.reduce((sum, m) => sum + (m.duration_minutes || 0), 0) / meetings.length)
        : 0,
      sentiment: {
        positive: meetings.filter(m => m.sentiment_label === 'Positive').length,
        neutral: meetings.filter(m => m.sentiment_label === 'Neutral').length,
        negative: meetings.filter(m => m.sentiment_label === 'Negative').length
      },
      avgActionItemsPerMeeting: meetings.length > 0
        ? Math.round(actionItems.length / meetings.length * 10) / 10
        : 0
    },
    tasks: {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'done').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      open: tasks.filter(t => t.status === 'open').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
      completionRate: tasks.length > 0
        ? Math.round(tasks.filter(t => t.status === 'done').length / tasks.length * 100)
        : 0,
      byPriority: {
        high: tasks.filter(t => t.priority === 'high').length,
        medium: tasks.filter(t => t.priority === 'medium').length,
        low: tasks.filter(t => t.priority === 'low').length
      }
    },
    actionItems: {
      total: actionItems.length,
      synced: actionItems.filter(a => a.crm_sync_status === 'synced').length,
      pending: actionItems.filter(a => a.crm_sync_status === 'pending').length,
      completed: actionItems.filter(a => a.status === 'done').length,
      syncRate: actionItems.length > 0
        ? Math.round(actionItems.filter(a => a.crm_sync_status === 'synced').length / actionItems.length * 100)
        : 0
    },
    automations: {
      totalRuns: automationLogs.length,
      successful: automationLogs.filter(a => a.success).length,
      failed: automationLogs.filter(a => !a.success).length,
      successRate: automationLogs.length > 0
        ? Math.round(automationLogs.filter(a => a.success).length / automationLogs.length * 100)
        : 0
    },
    projects: {
      total: projects.length,
      byStatus: {
        planning: projects.filter(p => p.status === 'planning').length,
        active: projects.filter(p => p.status === 'active').length,
        completed: projects.filter(p => p.status === 'completed').length,
        archived: projects.filter(p => p.status === 'archived').length
      },
      totalDealValue: projects.reduce((sum, p) => sum + (Number(p.deal_value) || 0), 0)
    }
  };

  res.json({
    success: true,
    data: dashboard
  });
}));

/**
 * GET /api/analytics/trends
 * Get trend data over time
 */
router.get('/trends', asyncHandler(async (req, res) => {
  const { metric, period = '30d' } = req.query;

  // Calculate date range
  const endDate = new Date();
  let startDate;
  let groupBy;

  switch (period) {
    case '7d':
      startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      groupBy = 'day';
      break;
    case '30d':
      startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      groupBy = 'day';
      break;
    case '90d':
      startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
      groupBy = 'week';
      break;
    case '1y':
      startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
      groupBy = 'month';
      break;
    default:
      startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      groupBy = 'day';
  }

  // Fetch data based on metric
  let data = [];

  if (!metric || metric === 'meetings') {
    const { data: meetings } = await supabase
      .from('meetings')
      .select('created_at, duration_minutes')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at');

    data = groupByPeriod(meetings || [], groupBy, 'created_at', (items) => ({
      count: items.length,
      totalDuration: items.reduce((sum, m) => sum + (m.duration_minutes || 0), 0)
    }));
  }

  if (metric === 'tasks') {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('created_at, completed_at, status')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at');

    data = groupByPeriod(tasks || [], groupBy, 'created_at', (items) => ({
      created: items.length,
      completed: items.filter(t => t.status === 'done').length
    }));
  }

  if (metric === 'automations') {
    const { data: logs } = await supabase
      .from('automation_logs')
      .select('created_at, success')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at');

    data = groupByPeriod(logs || [], groupBy, 'created_at', (items) => ({
      total: items.length,
      successful: items.filter(l => l.success).length,
      failed: items.filter(l => !l.success).length
    }));
  }

  res.json({
    success: true,
    data: {
      period,
      groupBy,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      trends: data
    }
  });
}));

/**
 * GET /api/analytics/team-performance
 * Get team performance metrics
 */
router.get('/team-performance', asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;

  const endDate = end_date ? new Date(end_date) : new Date();
  const startDate = start_date
    ? new Date(start_date)
    : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Get tasks grouped by assignee
  const { data: tasks } = await supabase
    .from('tasks')
    .select('assigned_to, status, priority, created_at, completed_at')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  // Get users
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, email');

  // Calculate metrics per user
  const userMetrics = {};
  (tasks || []).forEach(task => {
    const userId = task.assigned_to || 'unassigned';
    if (!userMetrics[userId]) {
      userMetrics[userId] = {
        userId,
        tasksCreated: 0,
        tasksCompleted: 0,
        highPriorityCompleted: 0,
        avgCompletionDays: []
      };
    }

    userMetrics[userId].tasksCreated++;
    if (task.status === 'done') {
      userMetrics[userId].tasksCompleted++;
      if (task.priority === 'high') {
        userMetrics[userId].highPriorityCompleted++;
      }
      if (task.completed_at && task.created_at) {
        const days = (new Date(task.completed_at) - new Date(task.created_at)) / (1000 * 60 * 60 * 24);
        userMetrics[userId].avgCompletionDays.push(days);
      }
    }
  });

  // Calculate averages and add user info
  const teamPerformance = Object.values(userMetrics).map(metrics => {
    const user = (users || []).find(u => u.id === metrics.userId);
    const avgDays = metrics.avgCompletionDays.length > 0
      ? Math.round(metrics.avgCompletionDays.reduce((a, b) => a + b, 0) / metrics.avgCompletionDays.length * 10) / 10
      : null;

    return {
      userId: metrics.userId,
      userName: user?.full_name || 'Unknown',
      email: user?.email || '',
      tasksCreated: metrics.tasksCreated,
      tasksCompleted: metrics.tasksCompleted,
      completionRate: metrics.tasksCreated > 0
        ? Math.round(metrics.tasksCompleted / metrics.tasksCreated * 100)
        : 0,
      highPriorityCompleted: metrics.highPriorityCompleted,
      avgCompletionDays: avgDays
    };
  });

  // Sort by completion rate
  teamPerformance.sort((a, b) => b.completionRate - a.completionRate);

  res.json({
    success: true,
    data: {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      teamMembers: teamPerformance
    }
  });
}));

/**
 * GET /api/analytics/ai-effectiveness
 * Get AI/automation effectiveness metrics
 */
router.get('/ai-effectiveness', asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;

  const endDate = end_date ? new Date(end_date) : new Date();
  const startDate = start_date
    ? new Date(start_date)
    : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Get meeting processing data
  const { data: meetings } = await supabase
    .from('meetings')
    .select('id, transcript, summary, key_points, action_items(id)')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  // Get automation logs
  const { data: automationLogs } = await supabase
    .from('automation_logs')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  // Get agent executions
  const { data: agentExecutions } = await supabase
    .from('agent_executions')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  // Calculate metrics
  const meetingsProcessed = (meetings || []).filter(m => m.summary).length;
  const meetingsWithTranscripts = (meetings || []).filter(m => m.transcript).length;

  const automations = automationLogs || [];
  const agents = agentExecutions || [];

  const effectiveness = {
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    },
    transcription: {
      meetingsProcessed,
      successRate: (meetings || []).length > 0
        ? Math.round(meetingsWithTranscripts / (meetings || []).length * 100)
        : 0
    },
    summarization: {
      meetingsSummarized: meetingsProcessed,
      avgKeyPoints: meetingsProcessed > 0
        ? Math.round((meetings || []).reduce((sum, m) => sum + (m.key_points?.length || 0), 0) / meetingsProcessed * 10) / 10
        : 0
    },
    actionItemExtraction: {
      totalExtracted: (meetings || []).reduce((sum, m) => sum + (m.action_items?.length || 0), 0),
      avgPerMeeting: meetingsProcessed > 0
        ? Math.round((meetings || []).reduce((sum, m) => sum + (m.action_items?.length || 0), 0) / meetingsProcessed * 10) / 10
        : 0
    },
    automations: {
      totalExecutions: automations.length,
      successful: automations.filter(a => a.success).length,
      failed: automations.filter(a => !a.success).length,
      successRate: automations.length > 0
        ? Math.round(automations.filter(a => a.success).length / automations.length * 100)
        : 0,
      avgDuration: automations.length > 0
        ? Math.round(automations.reduce((sum, a) => sum + (a.duration_ms || 0), 0) / automations.length)
        : 0
    },
    aiAgents: {
      totalExecutions: agents.length,
      successful: agents.filter(a => a.success).length,
      successRate: agents.length > 0
        ? Math.round(agents.filter(a => a.success).length / agents.length * 100)
        : 0,
      avgFeedbackRating: agents.filter(a => a.feedback_rating).length > 0
        ? Math.round(agents.filter(a => a.feedback_rating).reduce((sum, a) => sum + a.feedback_rating, 0) / agents.filter(a => a.feedback_rating).length * 10) / 10
        : null
    },
    timeSaved: {
      estimatedMinutes: meetingsProcessed * 45 + automations.length * 5,
      breakdown: {
        transcription: meetingsProcessed * 30,
        summarization: meetingsProcessed * 10,
        actionItems: meetingsProcessed * 5,
        automations: automations.length * 5
      }
    }
  };

  res.json({
    success: true,
    data: effectiveness
  });
}));

/**
 * POST /api/analytics/record
 * Record a metric event
 */
router.post('/record', validate(schemas.record), asyncHandler(async (req, res) => {
  const {
    metric_type,
    value,
    unit,
    source_type,
    source_id,
    metadata
  } = req.body;

  if (!metric_type || value === undefined) {
    return res.status(400).json({
      success: false,
      error: 'metric_type and value are required'
    });
  }

  const { data, error } = await supabase
    .from('metrics')
    .insert({
      metric_type,
      value: Number(value),
      unit,
      source_type,
      source_id,
      user_id: req.user?.id,
      team_id: req.user?.teamId,
      recorded_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;

  res.status(201).json({
    success: true,
    data
  });
}));

// Helper function to group data by time period
function groupByPeriod(items, groupBy, dateField, aggregator) {
  const groups = {};

  items.forEach(item => {
    const date = new Date(item[dateField]);
    let key;

    switch (groupBy) {
      case 'day':
        key = date.toISOString().split('T')[0];
        break;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
        break;
      case 'month':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      default:
        key = date.toISOString().split('T')[0];
    }

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  });

  return Object.entries(groups)
    .map(([date, items]) => ({
      date,
      ...aggregator(items)
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

module.exports = router;
