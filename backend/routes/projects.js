const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../config/supabase');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const schemas = require('../schemas/projects');
const log = require('../utils/log');
const { aggregateTeamWorkload } = require('../utils/teamWorkload');
const { getOrgIdForUser } = require('../utils/orgContext');
const { attachOrgIds } = require('../utils/orgContext');
const { summarizeProjects, rollup, isDone } = require('../services/projectRollup');

const router = express.Router();

// Require authentication for all project routes
router.use(authenticate);
router.use(attachOrgIds); // org-owned tables below are limited to req.orgIds (audit finding 3)

const READ_PAGE_SIZE = 250;
const MEETING_ID_BATCH_SIZE = 100;

// Supporting reads must finish before the route can report a trustworthy total.
async function readAllRows(makeQuery) {
  const rows = [];
  for (;;) {
    const { data, error } = await makeQuery()
      .order('id', { ascending: true })
      .range(rows.length, rows.length + READ_PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < READ_PAGE_SIZE) return rows;
  }
}

async function readMeetingActions(meetings, orgIds, columns) {
  const actions = [];
  // Bound the length of the PostgREST URL even for projects with years of history.
  for (let from = 0; from < meetings.length; from += MEETING_ID_BATCH_SIZE) {
    const ids = meetings.slice(from, from + MEETING_ID_BATCH_SIZE).map((m) => m.id);
    const batch = await readAllRows(() => supabase.from('action_items').select(columns)
      .in('org_id', orgIds).in('meeting_id', ids));
    actions.push(...batch);
  }
  return actions;
}

async function readBriefProject(id, orgIds) {
  const { data, error } = await supabase.from('projects')
    .select('id, org_id, owner_id, settings, updated_at')
    .eq('id', id).in('org_id', orgIds).maybeSingle();
  if (error) throw error;
  return data;
}

async function readProjectMembers(orgId, userIds) {
  return readAllRows(() => {
    const query = supabase.from('org_members').select('id, user_id, user_name, user_email, role').eq('org_id', orgId);
    return userIds ? query.in('user_id', userIds) : query;
  });
}

function canEditBrief(project, member) {
  return Boolean(member && (member.user_id === project.owner_id || ['owner', 'admin'].includes(member.role)));
}

function storedBrief(project) {
  const parsed = schemas.brief.safeParse(project.settings?.brief);
  return parsed.success ? parsed.data : { outcome: '', scope: '', successCriteria: '', ownerId: project.owner_id ?? null, resources: [] };
}

function briefResponse(project, brief, members, editable) {
  const people = members.map(({ user_id, user_name, user_email }) => ({
    id: user_id,
    name: user_name?.trim() || user_email || `Workspace member ${user_id.slice(0, 8)}`
  }));
  return { brief, owner: people.find((person) => person.id === brief.ownerId) ?? null,
    canEdit: editable, members: editable ? people.sort((a, b) => a.name.localeCompare(b.name)) : [], version: project.updated_at ?? null };
}

function matchProjectVersion(query, version) {
  return version == null ? query.is('updated_at', null) : query.eq('updated_at', version);
}

function nextProjectVersion(version) {
  const previousTime = Date.parse(version);
  return new Date(Math.max(Date.now(), Number.isFinite(previousTime) ? previousTime + 1 : 0)).toISOString();
}

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
      org_id: await getOrgIdForUser(req.user.id),
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
      return res.status(503).json({ error: 'Could not load projects. Try again.' });
    }

    let query = supabase
      .from('projects')
      .select('*', { count: 'exact' })
      .in('org_id', req.orgIds)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true });

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

    // Roll each project's tasks, linked meetings and their action items into counts,
    // so the list can show progress and late work (Projects Slate pass).
    const ids = (projects || []).map((p) => p.id);
    let summary = { projects: projects || [], needsYou: [], lateTotal: 0 };
    if (ids.length) {
      const [tasks, meetings] = await Promise.all([
        readAllRows(() => supabase.from('tasks').select('id, project_id, title, status, due_date, assigned_to, parent_task_id')
          .in('org_id', req.orgIds).in('project_id', ids)),
        readAllRows(() => supabase.from('meetings').select('id, project_id, title, start_time, created_at, decisions')
          .in('org_id', req.orgIds).in('project_id', ids)),
      ]);
      const actions = await readMeetingActions(meetings, req.orgIds,
        'id, meeting_id, task_description, status, due_date, assigned_to_name');
      summary = summarizeProjects(projects, tasks, meetings, actions);
    }

    res.json({
      projects: summary.projects,
      needsYou: summary.needsYou,
      lateTotal: summary.lateTotal,
      count: count || 0,
      hasMore: Number(offset) + summary.projects.length < count
    });

  } catch (error) {
    log.error('Error listing projects:', { error: error.message || error });
    res.status(500).json({ error: 'Could not load projects and their work. Try again.' });
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
      return res.status(503).json({ error: 'Could not load this project. Try again.' });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .in('org_id', req.orgIds)
      .eq('id', id)
      .maybeSingle();

    if (projectError) throw projectError;
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const [tasks, meetings] = await Promise.all([
      readAllRows(() => supabase.from('tasks').select('*')
        .in('org_id', req.orgIds).eq('project_id', id).order('created_at', { ascending: false })),
      readAllRows(() => supabase.from('meetings')
        .select('id, title, summary, created_at, start_time, duration_minutes, decisions, summary_moments, sentiment_label')
        .in('org_id', req.orgIds).eq('project_id', id).order('created_at', { ascending: false })),
    ]);
    const actionItems = await readMeetingActions(meetings, req.orgIds, '*, meetings:meeting_id ( title )');
    actionItems.sort((a, b) => (a.due_date ?? '9999-12-31').localeCompare(b.due_date ?? '9999-12-31'));

    // Legacy rows say todo / completed (see tasksView.normalizeStatus)
    const stats = {
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => isDone(t.status)).length,
      openTasks: tasks.filter(t => t.status === 'open' || t.status === 'todo').length,
      inProgressTasks: tasks.filter(t => t.status === 'in_progress').length,
      totalMeetings: meetings.length
    };

    res.json({
      ...project,
      tasks,
      meetings,
      actionItems,
      rollup: rollup(tasks, meetings, actionItems),
      stats
    });

  } catch (error) {
    log.error('Error getting project:', { error: error.message || error });
    res.status(500).json({ error: 'Could not load this project and its work. Try again.' });
  }
});

/** Read the native, workspace-shared brief and its available lead choices. */
router.get('/:id/brief', validate(schemas.getBrief), async (req, res) => {
  try {
    const project = await readBriefProject(req.params.id, req.orgIds);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const brief = storedBrief(project);
    const relatedIds = [...new Set([req.user.id, brief.ownerId].filter(Boolean))];
    const related = await readProjectMembers(project.org_id, relatedIds);
    const editable = canEditBrief(project, related.find((member) => member.user_id === req.user.id));
    const members = editable ? await readProjectMembers(project.org_id) : related;
    return res.json(briefResponse(project, brief, members, editable));
  } catch (error) {
    log.error('Error reading project brief:', { error: error.message || error });
    return res.status(500).json({ error: 'Could not load the project brief' });
  }
});

/** Save only the brief, retaining other project settings and rejecting stale edits. */
router.put('/:id/brief', validate(schemas.updateBrief), async (req, res) => {
  try {
    const { brief, version } = req.validated.body;
    const project = await readBriefProject(req.params.id, req.orgIds);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const ids = [...new Set([req.user.id, brief.ownerId].filter(Boolean))];
    const members = await readProjectMembers(project.org_id, ids);
    if (!canEditBrief(project, members.find((member) => member.user_id === req.user.id))) {
      return res.status(403).json({ error: 'Only the project owner or a workspace admin can edit the brief' });
    }
    if (brief.ownerId && !members.some((member) => member.user_id === brief.ownerId)) {
      return res.status(400).json({ error: 'Choose a project lead from this workspace' });
    }

    const conflict = () => res.status(409).json({ error: 'This project changed. Load the latest brief before saving.' });
    if ((project.updated_at ?? null) !== version) return conflict();

    const update = { settings: { ...project.settings, brief }, updated_at: nextProjectVersion(version) };
    const { data: saved, error } = await matchProjectVersion(supabase.from('projects')
      .update(update).eq('id', project.id).eq('org_id', project.org_id), version)
      .select('updated_at').maybeSingle();
    if (error) throw error;
    if (!saved) return conflict();
    return res.json({ version: saved.updated_at });
  } catch (error) {
    log.error('Error saving project brief:', { error: error.message || error });
    return res.status(500).json({ error: 'Could not save the project brief' });
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
    let query = supabase.from('projects');
    if (filteredUpdates.settings !== undefined) {
      const current = await readBriefProject(id, req.orgIds);
      if (!current) return res.status(404).json({ error: 'Project not found' });
      if (Object.hasOwn(current.settings ?? {}, 'brief')) {
        filteredUpdates.settings = { ...filteredUpdates.settings, brief: current.settings.brief };
      }
      filteredUpdates.updated_at = nextProjectVersion(current.updated_at);
      query = matchProjectVersion(query.update(filteredUpdates), current.updated_at);
    } else {
      filteredUpdates.updated_at = new Date().toISOString();
      query = query.update(filteredUpdates);
    }

    const { data: project, error } = await query
      .in('org_id', req.orgIds)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (!project) return filteredUpdates.settings !== undefined
      ? res.status(409).json({ error: 'This project changed. Reload before saving.' })
      : res.status(404).json({ error: 'Project not found' });

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
      .in('org_id', req.orgIds)
      .eq('project_id', id);

    // Unlink meetings (don't delete them)
    await supabase
      .from('meetings')
      .update({ project_id: null })
      .in('org_id', req.orgIds)
      .eq('project_id', id);

    // Delete project
    const { error } = await supabase
      .from('projects')
      .delete()
      .in('org_id', req.orgIds)
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
      org_id: await getOrgIdForUser(req.user.id),
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
      .in('org_id', req.orgIds)
      .eq('project_id', id);

    // Get meetings
    const { data: meetings } = await supabase
      .from('meetings')
      .select('id, sentiment_label')
      .in('org_id', req.orgIds)
      .eq('project_id', id);

    // Get action items from project meetings
    const meetingIds = meetings?.map(m => m.id) || [];
    let actionItems = [];
    if (meetingIds.length > 0) {
      const { data } = await supabase
        .from('action_items')
        .select('status, priority')
        .in('org_id', req.orgIds)
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
      .in('org_id', req.orgIds)
      .eq('id', id)
      .single();

    if (projectError) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get all tasks for this project
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, status, priority, due_date, assigned_to, completed_at, created_at, updated_at')
      .in('org_id', req.orgIds)
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
