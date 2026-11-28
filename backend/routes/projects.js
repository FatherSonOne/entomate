const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../config/supabase');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorizePlatformAdmin, lookupPlatformAdmin } = require('../middleware/authorizePlatformAdmin');
const schemas = require('../schemas/projects');
const gemini = require('../config/gemini');
const { aiLimiter } = require('../middleware/rateLimiter');
const { meterAiForOrg } = require('../services/aiUsage');
const { storedBrief, evidenceFor, suggestChanges } = require('../services/projectBrief');
const log = require('../utils/log');
const { aggregateTeamWorkload } = require('../utils/teamWorkload');
const { getOrgIdForUser } = require('../utils/orgContext');
const { attachOrgIds } = require('../utils/orgContext');
const { summarizeProjects, rollup, isDone } = require('../services/projectRollup');
const { readAllRows, readMeetingActions, loadProjectWork } = require('../services/projectWork');
const { readProgress, summarizeMilestones } = require('../services/projectProgress');
const { getEcosystemBridge } = require('../services/ecosystemBridge');
const { projectDestination, readEvent, describeHandoff, sendProjectHandoff } = require('../services/projectHandoff');

const router = express.Router();

// Require authentication for all project routes
router.use(authenticate);
router.use(attachOrgIds); // org-owned tables below are limited to req.orgIds (audit finding 3)

async function readBriefProject(id, orgIds) {
  const { data, error } = await supabase.from('projects')
    .select('id, org_id, owner_id, status, settings, updated_at')
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

function memberName({ user_id, user_name, user_email }) {
  return user_name?.trim() || user_email || 'Workspace member ' + user_id.slice(0, 8);
}

function projectPeople(members) {
  return members.map((member) => ({ id: member.user_id, name: memberName(member) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function briefResponse(project, brief, members, editable) {
  const people = projectPeople(members);
  return { brief, owner: people.find((person) => person.id === brief.ownerId) ?? null,
    canEdit: editable, members: editable ? people : [], version: project.updated_at ?? null };
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
      const { tasks, meetings, actionItems } = await loadProjectWork(supabase, ids, req.orgIds);
      summary = summarizeProjects(projects, tasks, meetings, actionItems);
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

router.get('/launch-milestones', async (req, res) => {
  const { workspaceId } = req.query;
  if (typeof workspaceId !== 'string' || !req.orgIds.includes(workspaceId)) {
    return res.status(403).json({ error: 'Workspace access required' });
  }
  try {
    const projects = await readAllRows(() => supabase.from('projects').select('id,name,settings')
      .eq('org_id', workspaceId));
    const milestones = projects.flatMap((project) => readProgress(project).milestones
      .filter((item) => /\b(?:launch|release|go[\s-]+live)\b/i.test(project.name + ' ' + item.title))
      .map(({ id, title, dueDate, completedAt }) => ({
        id, title, dueDate, completedAt, projectId: project.id, projectName: project.name,
      })))
      .sort((a, b) => a.projectName.localeCompare(b.projectName) || a.title.localeCompare(b.title) || a.dueDate.localeCompare(b.dueDate));
    return res.json({ milestones });
  } catch (error) {
    log.error('Error listing launch milestones:', error.message);
    return res.status(500).json({ error: 'Could not load launch milestones' });
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
        .eq('org_id', project.org_id).eq('project_id', id).order('created_at', { ascending: false })),
      readAllRows(() => supabase.from('meetings')
        .select('id, title, summary, created_at, start_time, duration_minutes, decisions, summary_moments, sentiment_label')
        .eq('org_id', project.org_id).eq('project_id', id).order('created_at', { ascending: false })),
    ]);
    const actionItems = await readMeetingActions(supabase, meetings, [project.org_id], '*, meetings:meeting_id ( title )');
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

/** Read shared minutes and propose a draft. This route never edits a brief. */
router.post('/:id/brief/suggestions', aiLimiter, validate(schemas.suggestBrief), async (req, res) => {
  try {
    const project = await readBriefProject(req.params.id, req.orgIds);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const [member] = await readProjectMembers(project.org_id, [req.user.id]);
    if (!canEditBrief(project, member)) {
      return res.status(403).json({ error: 'Only the project owner or a workspace admin can review brief suggestions' });
    }
    const { data: meeting, error } = await supabase.from('meetings')
      .select('id, title, summary, key_points, decisions, summary_moments')
      .eq('id', req.validated.body.meetingId).eq('org_id', project.org_id).eq('project_id', project.id)
      .maybeSingle();
    if (error) throw error;
    if (!meeting) return res.status(404).json({ error: 'Linked meeting not found' });

    const evidence = evidenceFor(meeting);
    const source = { meetingId: meeting.id, meetingTitle: meeting.title || 'Untitled meeting' };
    const version = project.updated_at ?? null;
    if (!evidence.length) return res.json({ source, version, suggestions: [] });
    if (!gemini.isConfigured()) return res.status(503).json({ error: 'Brief suggestions are unavailable. You can edit the brief yourself.' });

    return await meterAiForOrg(project.org_id, res, async () => {
      const suggestions = await suggestChanges(storedBrief(project), evidence);
      return res.json({ source, version, suggestions });
    });
  } catch (error) {
    log.error('Error suggesting project brief changes:', { error: error.message || error });
    return res.status(500).json({ error: 'Could not suggest brief changes. Try again.' });
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

    const previous = storedBrief(project);
    const sources = brief.sources ?? Object.fromEntries(
      Object.entries(previous.sources ?? {}).filter(([field]) => brief[field] === previous[field])
    );
    const meetingIds = [...new Set(Object.entries(sources)
      .filter(([field, source]) => previous.sources?.[field]?.meetingId !== source.meetingId)
      .map(([, source]) => source.meetingId))];
    if (meetingIds.length) {
      const { data: meetings, error } = await supabase.from('meetings').select('id')
        .eq('org_id', project.org_id).eq('project_id', project.id).in('id', meetingIds);
      if (error) throw error;
      if (meetings.length !== meetingIds.length) {
        return res.status(400).json({ error: 'Choose a source meeting linked to this project' });
      }
    }
    const savedBrief = Object.keys(sources).length ? { ...brief, sources } : brief;
    const update = { settings: { ...project.settings, brief: savedBrief }, updated_at: nextProjectVersion(version) };
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

function progressResponse(progress, members, canEdit) {
  const people = projectPeople(members);
  const names = new Map(people.map((person) => [person.id, person.name]));
  return {
    milestones: progress.milestones.map((item) => ({ ...item, ownerName: names.get(item.ownerId) ?? null })),
    updates: progress.updates,
    members: canEdit ? people : [],
    canEdit,
    version: progress.version
  };
}

router.get('/:id/progress', validate(schemas.getProgress), async (req, res) => {
  try {
    const project = await readBriefProject(req.params.id, req.orgIds);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const progress = readProgress(project);
    const ids = [...new Set([req.user.id, ...progress.milestones.map((item) => item.ownerId)].filter(Boolean))];
    const related = await readProjectMembers(project.org_id, ids);
    const canEdit = canEditBrief(project, related.find((member) => member.user_id === req.user.id));
    const members = canEdit ? await readProjectMembers(project.org_id) : related;
    return res.json(progressResponse(progress, members, canEdit));
  } catch (error) {
    log.error('Error reading project progress:', error.message);
    return res.status(500).json({ error: 'Could not load project progress' });
  }
});

router.patch('/:id/progress', validate(schemas.updateProgress), async (req, res) => {
  try {
    const project = await readBriefProject(req.params.id, req.orgIds);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const [author] = await readProjectMembers(project.org_id, [req.user.id]);
    if (!canEditBrief(project, author)) {
      return res.status(403).json({ error: 'Only the project owner or a workspace admin can change project progress' });
    }

    const change = req.validated.body;
    const conflict = () => res.status(409).json({ error: 'Progress changed. Load the latest version before saving.' });
    const progress = readProgress(project);
    if (progress.version !== change.version) return conflict();

    const members = await readProjectMembers(project.org_id);
    const existing = progress.milestones.find((item) => item.id === change.id);
    if (change.ownerId && change.ownerId !== existing?.ownerId && !members.some((member) => member.user_id === change.ownerId)) {
      return res.status(400).json({ error: 'Choose a milestone owner from this workspace' });
    }

    const now = new Date();
    if (change.operation === 'postUpdate') {
      const { tasks, meetings, actionItems } = await loadProjectWork(supabase, [project.id], [project.org_id]);
      const { total, done, late } = rollup(tasks, meetings, actionItems, now);
      const milestoneCounts = summarizeMilestones(progress.milestones);
      progress.updates.unshift({
        id: uuidv4(), health: change.health, note: change.note,
        authorId: req.user.id, authorName: memberName(author), postedAt: now.toISOString(),
        counts: { total, done, late, milestones: milestoneCounts.total, milestonesDone: milestoneCounts.done }
      });
    } else if (change.operation === 'addMilestone') {
      progress.milestones.push({ id: uuidv4(), title: change.title, dueDate: change.dueDate, ownerId: change.ownerId, completedAt: null });
    } else {
      const item = existing;
      if (!item) return res.status(404).json({ error: 'Milestone not found' });
      if (change.operation === 'editMilestone') {
        Object.assign(item, { title: change.title, dueDate: change.dueDate, ownerId: change.ownerId });
      } else {
        item.completedAt = change.done ? item.completedAt ?? now.toISOString() : null;
      }
    }

    const updatedAt = nextProjectVersion(project.updated_at);
    progress.version = updatedAt;
    const { data: saved, error } = await matchProjectVersion(
      supabase.from('projects').update({ settings: { ...project.settings, progress }, updated_at: updatedAt })
        .eq('id', project.id).eq('org_id', project.org_id), project.updated_at
    ).select('updated_at').maybeSingle();
    if (error) throw error;
    if (!saved) return conflict();
    return res.json(progressResponse(progress, members, true));
  } catch (error) {
    log.error('Error saving project progress:', error.message);
    return res.status(500).json({ error: 'Could not save project progress' });
  }
});

router.get('/:id/handoff', validate(schemas.getBrief), async (req, res) => {
  try {
    const project = await readBriefProject(req.params.id, req.orgIds);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const [bridge, event] = await Promise.all([getEcosystemBridge(), readEvent(project.id)]);
    const destination = projectDestination(bridge, project.org_id);
    let canSend = false;
    if (destination) {
      const { data, error } = await lookupPlatformAdmin(req.user.id);
      if (error) throw error;
      canSend = Boolean(data);
    }
    return res.json(describeHandoff(destination, event, canSend));
  } catch (error) {
    log.error('Error reading project handoff:', error.message);
    return res.status(500).json({ error: 'Could not load the Pulse handoff' });
  }
});

router.post('/:id/handoff', validate(schemas.sendHandoff), authorizePlatformAdmin, async (req, res) => {
  try {
    const { data: project, error } = await supabase.from('projects').select('id, org_id, name')
      .eq('id', req.params.id).in('org_id', req.orgIds).maybeSingle();
    if (error) throw error;
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const bridge = await getEcosystemBridge();
    const destination = projectDestination(bridge, project.org_id);
    if (!destination || destination.channelId !== req.validated.body.channelId) {
      return res.status(409).json({ error: 'The Pulse destination changed. Refresh the handoff and try again.' });
    }

    const event = await readEvent(project.id);
    await sendProjectHandoff(bridge, project, destination, event);
    const updated = await readEvent(project.id);
    return res.json(describeHandoff(destination, updated, true));
  } catch (error) {
    log.error('Error sending project handoff:', error.message);
    return res.status(500).json({ error: 'Could not confirm delivery. Refresh the Pulse handoff before retrying.' });
  }
});

const RESTORABLE_STATUSES = ['planning', 'active', 'completed'];

function restoreStatus(status) {
  return RESTORABLE_STATUSES.includes(status) ? status : 'planning';
}

async function canArchiveProject(project, userId) {
  const [member] = await readProjectMembers(project.org_id, [userId]);
  return canEditBrief(project, member);
}

/**
 * PUT /api/projects/:id
 * Update project. Entering or leaving the archive also preserves its previous status.
 */
router.put('/:id', validate(schemas.update), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.validated.body;

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
    let current;
    if (filteredUpdates.settings !== undefined || filteredUpdates.status !== undefined) {
      current = await readBriefProject(id, req.orgIds);
      if (!current) return res.status(404).json({ error: 'Project not found' });
    }
    const settings = current?.settings ?? {};
    if (filteredUpdates.settings !== undefined) {
      for (const key of ['brief', 'progress', 'archive']) {
        if (Object.hasOwn(settings, key)) filteredUpdates.settings[key] = settings[key];
      }
    }
    const status = filteredUpdates.status;
    if (status !== undefined && (status === 'archived' || current.status === 'archived')) {
      if (!await canArchiveProject(current, req.user.id)) {
        return res.status(403).json({ error: 'Only the project owner or a workspace admin can archive or restore this project' });
      }
      if (status !== current.status) {
        filteredUpdates.settings ??= { ...settings };
        if (status === 'archived') {
          filteredUpdates.settings.archive = { previousStatus: restoreStatus(current.status) };
        } else {
          delete filteredUpdates.settings.archive;
        }
      }
    }

    filteredUpdates.updated_at = nextProjectVersion(current?.updated_at);
    let query = supabase.from('projects').update(filteredUpdates).eq('id', id);
    query = current
      ? matchProjectVersion(query.eq('org_id', current.org_id), current.updated_at)
      : query.in('org_id', req.orgIds);
    const { data: project, error } = await query.select().maybeSingle();

    if (error) throw error;
    if (!project) return current
      ? res.status(409).json({ error: 'This project changed. Reload before saving.' })
      : res.status(404).json({ error: 'Project not found' });

    res.json(project);

  } catch (error) {
    log.error('Error updating project:', { error: error.message || error });
    res.status(500).json({ error: 'Could not update this project. Try again.' });
  }
});

router.patch('/:id/restore', validate(schemas.getBrief), async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    const current = await readBriefProject(req.params.id, req.orgIds);
    if (!current) return res.status(404).json({ error: 'Project not found' });
    if (!await canArchiveProject(current, req.user.id)) {
      return res.status(403).json({ error: 'Only the project owner or a workspace admin can archive or restore this project' });
    }
    if (current.status !== 'archived') return res.json({ status: current.status });

    const { archive, ...settings } = current.settings ?? {};
    const { data: project, error } = await matchProjectVersion(
      supabase.from('projects').update({
        status: restoreStatus(archive?.previousStatus), settings, updated_at: nextProjectVersion(current.updated_at)
      }).eq('id', current.id).eq('org_id', current.org_id), current.updated_at
    ).select('status').maybeSingle();
    if (error) throw error;
    if (!project) return res.status(409).json({ error: 'This project changed. Reload before restoring.' });
    return res.json({ status: project.status });
  } catch (error) {
    log.error('Error restoring project:', error.message);
    return res.status(500).json({ error: 'Could not restore this project. Try again.' });
  }
});

router.delete('/:id', (_req, res) => {
  res.set('Allow', 'GET, PUT').status(405).json({ error: 'Archive the project to keep its work and history.' });
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
