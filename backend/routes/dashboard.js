/**
 * Dashboard API Routes
 * Week 5: Project Management Dashboard
 */

const express = require('express');
const { supabase } = require('../config/supabase');

const router = express.Router();

/**
 * GET /api/dashboard/projects
 * Get all projects (meetings) with statistics
 */
router.get('/projects', async (req, res) => {
  try {
    const { status = 'all', sort = 'updated', limit = 50, search } = req.query;

    console.log('📊 Fetching dashboard projects...');

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Query the project_statistics view
    let query = supabase
      .from('project_statistics')
      .select('*');

    // Apply search filter
    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    // Apply sorting
    const sortMap = {
      'name': { column: 'title', ascending: true },
      'progress': { column: 'progress_percent', ascending: false },
      'updated': { column: 'updated_at', ascending: false },
      'created': { column: 'created_at', ascending: false }
    };
    const sortConfig = sortMap[sort] || sortMap['updated'];
    query = query.order(sortConfig.column, { ascending: sortConfig.ascending });

    // Limit results
    query = query.limit(parseInt(limit));

    const { data: projects, error } = await query;

    if (error) throw error;

    console.log(`✅ Found ${projects?.length || 0} projects`);

    res.json({
      projects: projects || [],
      count: projects?.length || 0
    });

  } catch (error) {
    console.error('❌ Error fetching projects:', error);
    res.status(500).json({
      error: 'Failed to fetch projects',
      details: error.message
    });
  }
});

/**
 * GET /api/dashboard/projects/:id
 * Get project details with action items and team
 */
router.get('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Get project stats from view
    const { data: project, error: projectError } = await supabase
      .from('project_statistics')
      .select('*')
      .eq('id', id)
      .single();

    if (projectError && projectError.code !== 'PGRST116') {
      throw projectError;
    }

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get action items for this project
    const { data: actionItems } = await supabase
      .from('action_items')
      .select('*')
      .eq('meeting_id', id)
      .order('due_date', { ascending: true });

    // Get unique team members
    const teamMap = new Map();
    (actionItems || []).forEach(item => {
      if (item.assigned_to_email) {
        teamMap.set(item.assigned_to_email, {
          name: item.assigned_to_name,
          email: item.assigned_to_email
        });
      }
    });
    const team = Array.from(teamMap.values());

    // Get meeting details
    const { data: meeting } = await supabase
      .from('meetings')
      .select('summary, key_points, decisions')
      .eq('id', id)
      .single();

    res.json({
      ...project,
      summary: meeting?.summary,
      keyPoints: meeting?.key_points,
      decisions: meeting?.decisions,
      actionItems: actionItems || [],
      team,
      timeline: actionItems || []
    });

  } catch (error) {
    console.error('❌ Error fetching project detail:', error);
    res.status(500).json({
      error: 'Failed to fetch project',
      details: error.message
    });
  }
});

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

    console.log('📋 Fetching action items...');

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
      `);

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
    console.error('❌ Error fetching action items:', error);
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

    // If completing, set completed_at
    if (status === 'done') {
      updates.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('action_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      actionItem: data
    });

  } catch (error) {
    console.error('❌ Error updating action item:', error);
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
    console.log('👥 Fetching team workload...');

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Try view first, fall back to direct query
    let workload = [];
    const { data: viewData, error: viewError } = await supabase
      .from('team_workload')
      .select('*')
      .order('total_assigned', { ascending: false });

    if (viewError && viewError.message.includes('schema cache')) {
      // View doesn't exist, calculate from action_items directly
      const { data: actionItems } = await supabase
        .from('action_items')
        .select('assigned_to_name, assigned_to_email, status, priority');

      // Group by assignee
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
        member.total_assigned++;

        if (item.status === 'open' || item.status === 'pending') member.pending_items++;
        if (item.status === 'in_progress') member.in_progress_items++;
        if (item.status === 'done' || item.status === 'complete') member.completed_items++;
        if (item.priority === 'high' && item.status !== 'done') member.high_priority_count++;
      });

      workload = Array.from(workloadMap.values())
        .sort((a, b) => b.total_assigned - a.total_assigned);
    } else if (!viewError) {
      workload = viewData || [];
    }

    res.json({
      workload,
      count: workload.length
    });

  } catch (error) {
    console.error('❌ Error fetching team workload:', error);
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
    console.log('⚠️ Fetching overdue items...');

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Try view first, fall back to direct query
    let overdue = [];
    const { data: viewData, error: viewError } = await supabase
      .from('overdue_items')
      .select('*')
      .limit(50);

    if (viewError && viewError.message.includes('schema cache')) {
      // View doesn't exist, query directly from action_items
      const now = new Date().toISOString();
      const { data: overdueItems } = await supabase
        .from('action_items')
        .select(`
          id,
          task_description,
          assigned_to_name,
          assigned_to_email,
          due_date,
          priority,
          status,
          meeting_id
        `)
        .lt('due_date', now)
        .not('status', 'in', '("done","complete")')
        .order('due_date', { ascending: true })
        .limit(50);

      overdue = (overdueItems || []).map(item => ({
        ...item,
        days_overdue: Math.floor((new Date() - new Date(item.due_date)) / (1000 * 60 * 60 * 24))
      }));
    } else if (!viewError) {
      overdue = viewData || [];
    }

    res.json({
      overdue,
      count: overdue.length,
      alert: overdue.length > 0
    });

  } catch (error) {
    console.error('❌ Error fetching overdue items:', error);
    res.status(500).json({
      error: 'Failed to fetch overdue items',
      details: error.message
    });
  }
});

/**
 * GET /api/dashboard/insights
 * Get dashboard insights and trends for charts
 */
router.get('/insights', async (req, res) => {
  try {
    console.log('📈 Generating insights...');

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Get trends data
    const { data: trends } = await supabase
      .from('action_item_trends')
      .select('*')
      .order('date', { ascending: false })
      .limit(30);

    // Get overall project stats
    const { data: stats } = await supabase
      .from('project_statistics')
      .select('*');

    // Calculate aggregate metrics
    const totalProjects = stats?.length || 0;
    const avgProgress = stats?.length > 0
      ? Math.round(stats.reduce((sum, p) => sum + (p.progress_percent || 0), 0) / stats.length)
      : 0;
    const totalItems = stats?.reduce((sum, p) => sum + (p.total_items || 0), 0) || 0;
    const completedItems = stats?.reduce((sum, p) => sum + (p.complete_items || 0), 0) || 0;
    const overdueItems = stats?.reduce((sum, p) => sum + (p.overdue_items || 0), 0) || 0;
    const overallCompletion = totalItems > 0
      ? Math.round((completedItems / totalItems) * 100)
      : 0;

    // Sentiment breakdown
    const sentimentCounts = {
      Positive: stats?.filter(p => p.sentiment_label === 'Positive').length || 0,
      Neutral: stats?.filter(p => p.sentiment_label === 'Neutral').length || 0,
      Negative: stats?.filter(p => p.sentiment_label === 'Negative').length || 0
    };

    // Priority breakdown from action items
    const { data: actionItems } = await supabase
      .from('action_items')
      .select('priority, status');

    const priorityCounts = {
      high: actionItems?.filter(i => i.priority === 'high').length || 0,
      medium: actionItems?.filter(i => i.priority === 'medium').length || 0,
      low: actionItems?.filter(i => i.priority === 'low').length || 0
    };

    const statusCounts = {
      open: actionItems?.filter(i => i.status === 'open').length || 0,
      in_progress: actionItems?.filter(i => i.status === 'in_progress').length || 0,
      done: actionItems?.filter(i => i.status === 'done').length || 0
    };

    res.json({
      metrics: {
        totalProjects,
        avgProgress,
        totalItems,
        completedItems,
        overdueItems,
        overallCompletion
      },
      sentimentCounts,
      priorityCounts,
      statusCounts,
      trends: trends || []
    });

  } catch (error) {
    console.error('❌ Error generating insights:', error);
    res.status(500).json({
      error: 'Failed to generate insights',
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
      .select('*', { count: 'exact', head: true });

    const { count: actionItemsCount } = await supabase
      .from('action_items')
      .select('*', { count: 'exact', head: true });

    const { count: openItemsCount } = await supabase
      .from('action_items')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open');

    const { count: overdueCount } = await supabase
      .from('action_items')
      .select('*', { count: 'exact', head: true })
      .lt('due_date', new Date().toISOString())
      .neq('status', 'done');

    res.json({
      meetings: meetingsCount || 0,
      actionItems: actionItemsCount || 0,
      openItems: openItemsCount || 0,
      overdue: overdueCount || 0
    });

  } catch (error) {
    console.error('❌ Error fetching summary:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
