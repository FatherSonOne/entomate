/**
 * Dashboard API Routes
 * Week 5: Project Management Dashboard
 */

const express = require('express');
const { supabase } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const log = require('../utils/log');
const { aggregateTeamWorkload } = require('../utils/teamWorkload');
const { attachOrgIds } = require('../utils/orgContext');

const router = express.Router();

// Require authentication for all dashboard routes
router.use(authenticate);
router.use(attachOrgIds); // org-owned tables below are limited to req.orgIds (audit finding 3)

/**
 * GET /api/dashboard/action-items
 * Get action items with filtering and grouping
 */
router.get('/action-items', async (req, res) => {
  try {
    const {
      status = 'all',
      priority = 'all',
      assignee = 'all',
      meetingId,
      sort = 'due_date',
      limit = 100
    } = req.query;

    log.info('Fetching action items...');

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    let query = supabase
      .from('action_items')
      .select(`
        *,
        meetings:meeting_id (
          title
        )
      `)
      .in('org_id', req.orgIds);

    // Apply filters
    if (status !== 'all') {
      query = query.eq('status', status);
    }
    if (priority !== 'all') {
      query = query.eq('priority', priority);
    }
    if (assignee !== 'all') {
      query = query.eq('assigned_to_name', assignee);
    }
    if (meetingId) {
      query = query.eq('meeting_id', meetingId);
    }

    // Sort
    const sortConfig = {
      'due_date': { column: 'due_date', ascending: true },
      'priority': { column: 'priority', ascending: true },
      'created': { column: 'created_at', ascending: false },
      'status': { column: 'status', ascending: true }
    };
    const sortOpt = sortConfig[sort] || sortConfig['due_date'];
    query = query.order(sortOpt.column, { ascending: sortOpt.ascending, nullsFirst: false });
    query = query.limit(parseInt(limit));

    const { data: items, error } = await query;

    if (error) throw error;

    // Group by status for Kanban
    const grouped = {
      open: items?.filter(i => i.status === 'open') || [],
      in_progress: items?.filter(i => i.status === 'in_progress') || [],
      done: items?.filter(i => i.status === 'done') || []
    };

    res.json({
      actionItems: items || [],
      grouped,
      count: items?.length || 0
    });

  } catch (error) {
    log.error('Error fetching action items:', { error: error.message || error });
    res.status(500).json({
      error: 'Failed to fetch action items',
      details: error.message
    });
  }
});

/**
 * PATCH /api/dashboard/action-items/:id
 * Update action item status (for Kanban drag-drop)
 */
router.patch('/action-items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority, due_date, assigned_to_name, assigned_to_email } = req.body;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const updates = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (priority) updates.priority = priority;
    if (due_date) updates.due_date = due_date;
    if (assigned_to_name !== undefined) updates.assigned_to_name = assigned_to_name;
    if (assigned_to_email !== undefined) updates.assigned_to_email = assigned_to_email;

    // Reopening must clear the timestamp used by follow-through reporting.
    if (status === 'done') {
      updates.completed_at = updates.updated_at;
    } else if (['open', 'in_progress', 'review', 'blocked'].includes(status)) {
      updates.completed_at = null;
    }

    const { data, error } = await supabase
      .from('action_items')
      .update(updates)
      .in('org_id', req.orgIds)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      actionItem: data
    });

  } catch (error) {
    log.error('Error updating action item:', { error: error.message || error });
    res.status(500).json({
      error: 'Failed to update action item',
      details: error.message
    });
  }
});

/**
 * GET /api/dashboard/team-workload
 * Get team member workload statistics
 */
router.get('/team-workload', async (req, res) => {
  try {
    log.info('Fetching team workload...');

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Computed from action_items, limited to the caller's orgs. (The team_workload
    // view never existed in production and would not have been org-scoped.)
    const { data: actionItems, error: itemsError } = await supabase
      .from('action_items')
      .select('assigned_to_name, assigned_to_email, status, priority')
      .in('org_id', req.orgIds);
    if (itemsError) throw itemsError;

    const DONE = new Set(['done', 'complete', 'completed', 'cancelled']);
    const workloadMap = new Map();
    (actionItems || []).forEach(item => {
      if (!item.assigned_to_name) return;
      if (!workloadMap.has(item.assigned_to_name)) {
        workloadMap.set(item.assigned_to_name, {
          team_member: item.assigned_to_name,
          email: item.assigned_to_email,
          total_assigned: 0,
          pending_items: 0,
          in_progress_items: 0,
          completed_items: 0,
          high_priority_count: 0
        });
      }
      const member = workloadMap.get(item.assigned_to_name);
      const done = DONE.has(item.status);
      member.total_assigned++;
      if (item.status === 'open' || item.status === 'pending') member.pending_items++;
      if (item.status === 'in_progress') member.in_progress_items++;
      if (done) member.completed_items++;
      if (item.priority === 'high' && !done) member.high_priority_count++;
    });

    const workload = Array.from(workloadMap.values())
      .sort((a, b) => b.total_assigned - a.total_assigned);

    res.json({
      workload,
      count: workload.length
    });

  } catch (error) {
    log.error('Error fetching team workload:', { error: error.message || error });
    res.status(500).json({
      error: 'Failed to fetch team workload',
      details: error.message
    });
  }
});

/**
 * GET /api/dashboard/overdue
 * Get overdue action items
 */
router.get('/overdue', async (req, res) => {
  try {
    log.info('Fetching overdue items...');

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Straight from action_items, limited to the caller's orgs (the overdue_items
    // view never existed in production).
    const now = new Date().toISOString();
    const { data: overdueItems, error: overdueError } = await supabase
      .from('action_items')
      .select('id, task_description, assigned_to_name, assigned_to_email, due_date, priority, status, meeting_id')
      .in('org_id', req.orgIds)
      .lt('due_date', now)
      .not('status', 'in', '("done","complete","completed","cancelled")')
      .order('due_date', { ascending: true })
      .limit(50);
    if (overdueError) throw overdueError;

    const overdue = (overdueItems || []).map(item => ({
      ...item,
      days_overdue: Math.floor((new Date() - new Date(item.due_date)) / (1000 * 60 * 60 * 24))
    }));

    res.json({
      overdue,
      count: overdue.length,
      alert: overdue.length > 0
    });

  } catch (error) {
    log.error('Error fetching overdue items:', { error: error.message || error });
    res.status(500).json({
      error: 'Failed to fetch overdue items',
      details: error.message
    });
  }
});

/**
 * GET /api/dashboard/project-insights
 * Get dashboard insights aggregated from projects + tasks tables (not meetings)
 */
router.get('/project-insights', async (req, res) => {
  try {
    log.info('Generating project-based insights...');

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Get all projects
    const { data: projects } = await supabase
      .from('projects')
      .select('id, name, status, start_date, end_date, created_at')
      .in('org_id', req.orgIds);

    // Get all tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, project_id, status, priority, due_date, assigned_to, completed_at')
      .in('org_id', req.orgIds);

    const allProjects = projects || [];
    const allTasks = tasks || [];
    const now = new Date();

    // Project status counts
    const projectStatusCounts = {
      planning: allProjects.filter(p => p.status === 'planning').length,
      active: allProjects.filter(p => p.status === 'active').length,
      completed: allProjects.filter(p => p.status === 'completed').length,
      archived: allProjects.filter(p => p.status === 'archived').length
    };

    // Task status counts
    const statusCounts = {
      open: allTasks.filter(t => t.status === 'open').length,
      in_progress: allTasks.filter(t => t.status === 'in_progress').length,
      review: allTasks.filter(t => t.status === 'review').length,
      done: allTasks.filter(t => t.status === 'done').length,
      blocked: allTasks.filter(t => t.status === 'blocked').length
    };

    // Priority counts
    const priorityCounts = {
      high: allTasks.filter(t => t.priority === 'high').length,
      medium: allTasks.filter(t => t.priority === 'medium').length,
      low: allTasks.filter(t => t.priority === 'low').length
    };

    // Overdue counts
    const overdueItems = allTasks.filter(t =>
      t.due_date && new Date(t.due_date) < now && t.status !== 'done'
    ).length;

    const overdueProjects = allProjects.filter(p =>
      p.end_date && new Date(p.end_date) < now && p.status !== 'completed' && p.status !== 'archived'
    ).length;

    // Overall metrics
    const totalProjects = allProjects.length;
    const totalTasks = allTasks.length;
    const completedTasks = statusCounts.done;
    const overallCompletion = totalTasks > 0
      ? Math.round((completedTasks / totalTasks) * 100)
      : 0;

    // Team workload from tasks (excludes unassigned for global view)
    const teamWorkload = aggregateTeamWorkload(allTasks.filter(t => t.assigned_to));

    // Generate insights
    const insights = [];
    if (overdueItems > 0) {
      insights.push({
        type: 'warning',
        message: `You have ${overdueItems} overdue task${overdueItems > 1 ? 's' : ''} that need attention.`
      });
    }
    if (overdueProjects > 0) {
      insights.push({
        type: 'warning',
        message: `${overdueProjects} project${overdueProjects > 1 ? 's' : ''} past their end date.`
      });
    }
    if (overallCompletion > 75) {
      insights.push({
        type: 'success',
        message: `Great progress! Overall completion rate is ${overallCompletion}%.`
      });
    }
    if (priorityCounts.high > 5) {
      insights.push({
        type: 'warning',
        message: `${priorityCounts.high} high-priority tasks. Consider delegating or prioritizing.`
      });
    }
    if (statusCounts.blocked > 0) {
      insights.push({
        type: 'warning',
        message: `${statusCounts.blocked} task${statusCounts.blocked > 1 ? 's are' : ' is'} blocked.`
      });
    }
    if (insights.length === 0 && totalProjects > 0) {
      insights.push({
        type: 'info',
        message: `${totalProjects} project${totalProjects > 1 ? 's' : ''} with ${totalTasks} total tasks.`
      });
    }

    res.json({
      metrics: {
        totalProjects,
        totalTasks,
        completedTasks,
        overdueItems,
        overdueProjects,
        overallCompletion
      },
      projectStatusCounts,
      statusCounts,
      priorityCounts,
      teamWorkload,
      insights
    });

  } catch (error) {
    log.error('Error generating project insights:', { error: error.message || error });
    res.status(500).json({
      error: 'Failed to generate project insights',
      details: error.message
    });
  }
});

/**
 * GET /api/dashboard/summary
 * Quick summary stats for dashboard header
 */
router.get('/summary', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Get counts
    const { count: meetingsCount } = await supabase
      .from('meetings')
      .select('*', { count: 'exact', head: true })
      .in('org_id', req.orgIds);

    const { count: actionItemsCount } = await supabase
      .from('action_items')
      .select('*', { count: 'exact', head: true })
      .in('org_id', req.orgIds);

    const { count: openItemsCount } = await supabase
      .from('action_items')
      .select('*', { count: 'exact', head: true })
      .in('org_id', req.orgIds)
      .eq('status', 'open');

    const { count: overdueCount } = await supabase
      .from('action_items')
      .select('*', { count: 'exact', head: true })
      .in('org_id', req.orgIds)
      .lt('due_date', new Date().toISOString())
      .neq('status', 'done');

    res.json({
      meetings: meetingsCount || 0,
      actionItems: actionItemsCount || 0,
      openItems: openItemsCount || 0,
      overdue: overdueCount || 0
    });

  } catch (error) {
    log.error('Error fetching summary:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
