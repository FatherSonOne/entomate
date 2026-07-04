const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../config/supabase');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const schemas = require('../schemas/projects');
const log = require('../utils/log');
const { aggregateTeamWorkload } = require('../utils/teamWorkload');
const { getOrgIdForUser } = require('../utils/orgContext');

const router = express.Router();

// Require authentication for all project routes
router.use(authenticate);

/**
 * POST /api/projects
 * Create a new project
 */
router.post('/', validate(schemas.create), async (req, res) => {
  try {
    const { name, description, crmDealId, dealValue, startDate, endDate, teamIds, tags } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const projectData = {
      id: uuidv4(),
      name,
      description: description || null,
      crm_deal_id: crmDealId || null,
      deal_value: dealValue || null,
      status: 'planning',
      start_date: startDate || null,
      end_date: endDate || null,
      owner_id: req.user.id,
      team_ids: teamIds || [],
      tags: tags || [],
      settings: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (!supabase) {
      return res.json({ success: true, project: projectData });
    }

    const { data: project, error } = await supabase
      .from('projects')
      .insert(projectData)
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      project
    });

  } catch (error) {
    log.error('Error creating project:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects
 * List all projects with pagination and filters
 */
router.get('/', validate(schemas.list), async (req, res) => {
  try {
    const { limit = 20, offset = 0, status, search, ownerId } = req.query;

    if (!supabase) {
      return res.json({ projects: [], count: 0, hasMore: false });
    }

    let query = supabase
      .from('projects')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (ownerId) {
      query = query.eq('owner_id', ownerId);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: projects, error, count } = await query;

    if (error) throw error;

    res.json({
      projects: projects || [],
      count: count || 0,
      hasMore: (projects?.length || 0) === parseInt(limit)
    });

  } catch (error) {
    log.error('Error listing projects:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects/:id
 * Get project details with tasks and meetings
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(404).json({ error: 'Database not configured' });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (projectError) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: false });

    // Get related meetings
    const { data: meetings } = await supabase
      .from('meetings')
      .select('id, title, summary, created_at, sentiment_label')
      .eq('project_id', id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Calculate project stats
    const stats = {
      totalTasks: tasks?.length || 0,
      completedTasks: tasks?.filter(t => t.status === 'done').length || 0,
      openTasks: tasks?.filter(t => t.status === 'open').length || 0,
      inProgressTasks: tasks?.filter(t => t.status === 'in_progress').length || 0,
      totalMeetings: meetings?.length || 0
    };

    res.json({
      ...project,
      tasks: tasks || [],
      meetings: meetings || [],
      stats
    });

  } catch (error) {
    log.error('Error getting project:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/projects/:id
 * Update project
 */
router.put('/:id', validate(schemas.update), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const allowedFields = ['name', 'description', 'status', 'crm_deal_id', 'deal_value',
                          'start_date', 'end_date', 'team_ids', 'tags', 'settings'];
    const filteredUpdates = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }
    filteredUpdates.updated_at = new Date().toISOString();

    const { data: project, error } = await supabase
      .from('projects')
      .update(filteredUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);

  } catch (error) {
    log.error('Error updating project:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/projects/:id
 * Delete project and its tasks
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Delete tasks first
    await supabase
      .from('tasks')
      .delete()
      .eq('project_id', id);

    // Unlink meetings (don't delete them)
    await supabase
      .from('meetings')
      .update({ project_id: null })
      .eq('project_id', id);

    // Delete project
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ success: true, message: 'Project deleted' });

  } catch (error) {
    log.error('Error deleting project:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/projects/from-deal
 * Create project from CRM deal
 */
router.post('/from-deal', validate(schemas.fromDeal), async (req, res) => {
  try {
    const { dealId, dealName, dealValue, contactName, expectedCloseDate } = req.body;

    if (!dealId || !dealName) {
      return res.status(400).json({ error: 'Deal ID and name are required' });
    }

    const projectData = {
      id: uuidv4(),
      name: `Project: ${dealName}`,
      description: `Project created from CRM deal. Contact: ${contactName || 'N/A'}`,
      crm_deal_id: dealId,
      deal_value: dealValue || null,
      status: 'planning',
      start_date: new Date().toISOString().split('T')[0],
      end_date: expectedCloseDate || null,
      owner_id: req.user.id,
      team_ids: [],
      tags: ['from-crm'],
      settings: { sourceType: 'crm_deal' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (!supabase) {
      return res.json({ success: true, project: projectData });
    }

    const { data: project, error } = await supabase
      .from('projects')
      .insert(projectData)
      .select()
      .single();

    if (error) throw error;

    // Create default tasks for deal projects
    const defaultTasks = [
      { title: 'Discovery call', priority: 'high' },
      { title: 'Prepare proposal', priority: 'high' },
      { title: 'Send contract', priority: 'medium' },
      { title: 'Schedule kickoff meeting', priority: 'medium' },
      { title: 'Project handoff', priority: 'low' }
    ];

    const projectOrgId = await getOrgIdForUser(req.user?.id);
    const tasksToInsert = defaultTasks.map((task, index) => ({
      id: uuidv4(),
      project_id: project.id,
      title: task.title,
      description: null,
      org_id: projectOrgId,
      status: 'open',
      priority: task.priority,
      assigned_to: null,
      due_date: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    await supabase.from('tasks').insert(tasksToInsert);

    res.status(201).json({
      success: true,
      project,
      tasksCreated: defaultTasks.length
    });

  } catch (error) {
    log.error('Error creating project from deal:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects/:id/stats
 * Get project statistics
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Get tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('status, priority, due_date')
      .eq('project_id', id);

    // Get meetings
    const { data: meetings } = await supabase
      .from('meetings')
      .select('id, sentiment_label')
      .eq('project_id', id);

    // Get action items from project meetings
    const meetingIds = meetings?.map(m => m.id) || [];
    let actionItems = [];
    if (meetingIds.length > 0) {
      const { data } = await supabase
        .from('action_items')
        .select('status, priority')
        .in('meeting_id', meetingIds);
      actionItems = data || [];
    }

    const now = new Date();
    const stats = {
      tasks: {
        total: tasks?.length || 0,
        byStatus: {
          open: tasks?.filter(t => t.status === 'open').length || 0,
          in_progress: tasks?.filter(t => t.status === 'in_progress').length || 0,
          review: tasks?.filter(t => t.status === 'review').length || 0,
          done: tasks?.filter(t => t.status === 'done').length || 0,
          blocked: tasks?.filter(t => t.status === 'blocked').length || 0
        },
        byPriority: {
          high: tasks?.filter(t => t.priority === 'high').length || 0,
          medium: tasks?.filter(t => t.priority === 'medium').length || 0,
          low: tasks?.filter(t => t.priority === 'low').length || 0
        },
        overdue: tasks?.filter(t => t.due_date && new Date(t.due_date) < now && t.status !== 'done').length || 0
      },
      meetings: {
        total: meetings?.length || 0,
        bySentiment: {
          Positive: meetings?.filter(m => m.sentiment_label === 'Positive').length || 0,
          Neutral: meetings?.filter(m => m.sentiment_label === 'Neutral').length || 0,
          Negative: meetings?.filter(m => m.sentiment_label === 'Negative').length || 0
        }
      },
      actionItems: {
        total: actionItems.length,
        completed: actionItems.filter(a => a.status === 'done').length,
        pending: actionItems.filter(a => a.status !== 'done').length
      },
      completionRate: tasks?.length > 0
        ? Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100)
        : 0
    };

    res.json(stats);

  } catch (error) {
    log.error('Error getting project stats:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects/:id/dashboard
 * Get project-specific dashboard data (tasks-based, not meetings-based)
 */
router.get('/:id/dashboard', async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Verify project exists
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, status, start_date, end_date')
      .eq('id', id)
      .single();

    if (projectError) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get all tasks for this project
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, status, priority, due_date, assigned_to, completed_at, created_at, updated_at')
      .eq('project_id', id)
      .order('created_at', { ascending: false });

    const allTasks = tasks || [];
    const now = new Date();

    // Task status counts
    const taskStats = {
      open: allTasks.filter(t => t.status === 'open').length,
      in_progress: allTasks.filter(t => t.status === 'in_progress').length,
      review: allTasks.filter(t => t.status === 'review').length,
      done: allTasks.filter(t => t.status === 'done').length,
      blocked: allTasks.filter(t => t.status === 'blocked').length
    };

    // Priority counts
    const priorityStats = {
      high: allTasks.filter(t => t.priority === 'high').length,
      medium: allTasks.filter(t => t.priority === 'medium').length,
      low: allTasks.filter(t => t.priority === 'low').length
    };

    // Overdue count
    const overdueCount = allTasks.filter(t =>
      t.due_date && new Date(t.due_date) < now && t.status !== 'done'
    ).length;

    // Completion rate
    const totalTasks = allTasks.length;
    const completionRate = totalTasks > 0
      ? Math.round((taskStats.done / totalTasks) * 100)
      : 0;

    // Team workload from tasks
    const teamWorkload = aggregateTeamWorkload(allTasks);

    // Recent activity (last 10 task updates)
    const timeline = allTasks
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .slice(0, 10)
      .map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        updatedAt: t.updated_at,
        completedAt: t.completed_at
      }));

    res.json({
      project,
      taskStats,
      priorityStats,
      overdueCount,
      completionRate,
      totalTasks,
      teamWorkload,
      timeline
    });

  } catch (error) {
    log.error('Error getting project dashboard:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
