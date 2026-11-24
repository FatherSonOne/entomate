/**
 * Entomate AI write verbs (EAI-05, docs/app-dev/entomate-ai-APP-PRODUCT.md §4, D6).
 *
 * The model never writes. When it calls one of these declarations, the loop
 * runs the verb's `prepare` (validate the args, check the record exists in the
 * caller's org, write a one-line summary) and records a 'proposed' row in
 * ento_ai_action_log (actionLog.js). The user confirms on the card; only then
 * does `execute` run, with the caller's user-JWT client (D2) and the org fence
 * `.eq('org_id', orgId)` on every query.
 *
 * Every verb is undoable. `execute` returns the record's id and its updated_at
 * as written; the inverse runs only while updated_at still matches, so an undo
 * never overwrites a change someone made after the agent (actionLog.undo).
 *   undo: 'delete'  — the verb created the row; undo removes it.
 *   undo: 'restore' — the verb changed columns; undo writes the previous values
 *                     back. Only the verb's own `columns` are ever restored.
 *
 * Not in this cut (decided 2026-11-22, EAI-05 gate measure):
 *   - schedule_meeting: creating a Google Calendar event sends invites, and
 *     auto-join then books a bot that emails the invitees. That sends to real
 *     people, which §4 keeps out of the first cut.
 *   - draft_followup_email: Entomate has no draft store; the model writes a
 *     draft in its answer text instead.
 *   - update_goal_progress: Goals was removed from the app in 5264fec.
 */

const { SchemaType } = require('@google/generative-ai');
const calendarService = require('../calendarService');
const autoJoin = require('../calendarAutoJoin');
const { readCalendarSettings } = require('../calendarSettings');
const { uuidArg, dateArg, trunc, calendarTimeZone, localDateTime, ToolInputError } = require('./tools');
const scheduledBriefs = require('./scheduledBriefs');

const STR = { type: SchemaType.STRING };
const DATE = (description) => ({ type: SchemaType.STRING, description });
const enumOf = (values, description) => ({ type: SchemaType.STRING, enum: values, format: 'enum', description });

const TASK_STATUS = ['open', 'in_progress', 'review', 'blocked', 'done'];
const PRIORITY = ['low', 'medium', 'high'];
const PROJECT_STATUS = ['planning', 'active', 'completed', 'archived'];
const NOTE_VISIBILITY = ['private', 'team'];

/** A required, trimmed string no longer than `max`. */
function textArg(v, name, max) {
  if (typeof v !== 'string' || !v.trim()) throw new ToolInputError(`${name} is required`);
  const t = v.trim();
  if (t.length > max) throw new ToolInputError(`${name} is longer than ${max} characters`);
  return t;
}

/** An optional string: '' and null both mean "none". */
function optText(v, name, max) {
  if (v == null || v === '') return null;
  return textArg(String(v), name, max);
}

function enumArg(v, name, values, fallback) {
  if (v == null || v === '') return fallback;
  if (!values.includes(v)) throw new ToolInputError(`${name} must be one of: ${values.join(', ')}`);
  return v;
}

/** Reads one row of the caller's orgs through the user client, or throws "not found". */
async function findRow(ctx, table, id, columns, noun) {
  const { data, error } = await ctx.db.from(table)
    .select(columns)
    .eq('id', id)
    .in('org_id', ctx.orgIds)
    .maybeSingle();
  if (error) throw new Error(error.message || 'query failed');
  if (!data) throw new ToolInputError(`No ${noun} with that id in your workspace`);
  return data;
}

/** The write's single row, or a failure that names what happened. */
function one({ data, error }, what) {
  if (error) throw new Error(error.message || `${what} failed`);
  if (!data) throw new Error(`${what} changed nothing (the record was removed or you cannot change it)`);
  return data;
}

const quote = (s) => `"${trunc(s, 60)}"`;
const changesText = (changes) => Object.entries(changes)
  .map(([k, v]) => `${k} → ${v == null || v === '' ? 'none' : v}`).join(', ');

/** Shared execute for a 'restore' verb: read the previous values, write the new ones. */
async function updateColumns(ctx, table, id, set, columns) {
  const prev = await findRow(ctx, table, id, ['id', 'updated_at', ...columns].join(', '), 'record');
  const previous = {};
  for (const c of columns) previous[c] = prev[c] ?? null;
  const row = one(await ctx.db.from(table)
    .update({ ...set, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .eq('updated_at', prev.updated_at) // a change since the read would make `previous` wrong
    .select('id, updated_at')
    .maybeSingle(), 'The update');
  // prevUpdatedAt lets an older action's undo see that this one was undone exactly (actionLog.undo).
  return { id: row.id, updatedAt: row.updated_at, prevUpdatedAt: prev.updated_at, previous };
}

function bookingError(error) {
  if (error instanceof autoJoin.SettingsError) throw new ToolInputError(error.message);
  throw error;
}

function briefScheduleError(error) {
  if (error instanceof scheduledBriefs.BriefError) throw new ToolInputError(error.message);
  throw error;
}

function upcomingMeeting(result) {
  return result?.eventId ? {
    path: `/meetings?tab=upcoming&event=${encodeURIComponent(result.eventId)}`, label: 'upcoming meeting',
  } : null;
}

const VERBS = {
  create_task: {
    risk: 'write',
    undo: 'delete',
    table: 'tasks',
    noun: 'task',
    // EAI-06: in a plan, a task can go into a project an earlier create_project step makes.
    bindable: { projectId: { from: 'create_project', key: 'projectId' } },
    editable: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'dueDate', label: 'Due date', type: 'date' },
      { key: 'assignedTo', label: 'Assigned to', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
    declaration: {
      description: 'Propose a new task. Nothing is created until the user confirms the card.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          title: { ...STR, description: 'Short task title.' },
          description: STR,
          priority: enumOf(PRIORITY, 'Default medium.'),
          dueDate: DATE('Due date as YYYY-MM-DD.'),
          assignedTo: { ...STR, description: 'Name of the person doing it.' },
          projectId: { ...STR, description: 'Project id (uuid) from list_projects, when the task belongs to one.' },
        },
        required: ['title'],
      },
    },
    async prepare(args, ctx) {
      const payload = {
        title: textArg(args.title, 'title', 200),
        description: optText(args.description, 'description', 2000),
        priority: enumArg(args.priority, 'priority', PRIORITY, 'medium'),
        dueDate: dateArg(args.dueDate, 'dueDate'),
        assignedTo: optText(args.assignedTo, 'assignedTo', 120),
        projectId: args.projectId ? uuidArg(args.projectId, 'projectId') : null,
      };
      let orgId = ctx.orgIds[0];
      let projectName = null;
      if (payload.projectId) {
        const p = await findRow(ctx, 'projects', payload.projectId, 'id, name, org_id', 'project');
        orgId = p.org_id;
        projectName = p.name;
      }
      const bits = [payload.dueDate && `due ${payload.dueDate}`, payload.priority !== 'medium' && payload.priority,
        payload.assignedTo && `for ${payload.assignedTo}`, projectName && `in ${quote(projectName)}`].filter(Boolean);
      return { payload, orgId, summary: `Create task ${quote(payload.title)}${bits.length ? ` · ${bits.join(' · ')}` : ''}` };
    },
    async execute(p, ctx) {
      const row = one(await ctx.db.from('tasks').insert({
        org_id: ctx.orgId,
        title: p.title,
        description: p.description,
        priority: p.priority,
        due_date: p.dueDate,
        assigned_to: p.assignedTo,
        project_id: p.projectId,
        status: 'open',
        tags: [],
        custom_fields: {},
      }).select('id, title, updated_at').maybeSingle(), 'Creating the task');
      return { result: { taskId: row.id, title: row.title }, undo: { id: row.id, updatedAt: row.updated_at } };
    },
    /** Deleting a task cascades to its subtasks: refuse once it has any. */
    async beforeDelete(id, ctx) {
      const { count, error } = await ctx.db.from('tasks').select('id', { count: 'exact', head: true })
        .eq('parent_task_id', id).eq('org_id', ctx.orgId);
      if (error) throw new Error(error.message);
      if (count) return 'It has subtasks now, so it was not removed. Remove it from Tasks if you still want it gone.';
      return null;
    },
    view: () => ({ path: '/tasks', label: 'Tasks' }),
  },

  update_task: {
    risk: 'write',
    undo: 'restore',
    table: 'tasks',
    noun: 'task',
    columns: ['status', 'priority', 'due_date', 'completed_at'],
    editable: [{ key: 'dueDate', label: 'Due date', type: 'date' }],
    declaration: {
      description: 'Propose a change to a task: status (including marking it done), priority or due date. Nothing changes until the user confirms.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          taskId: { ...STR, description: 'Task id (uuid) from list_tasks or get_task.' },
          status: enumOf(TASK_STATUS, 'New status. "done" marks it complete.'),
          priority: enumOf(PRIORITY, 'New priority.'),
          dueDate: DATE('New due date as YYYY-MM-DD.'),
        },
        required: ['taskId'],
      },
    },
    async prepare(args, ctx) {
      const payload = {
        taskId: uuidArg(args.taskId, 'taskId'),
        status: enumArg(args.status, 'status', TASK_STATUS, null),
        priority: enumArg(args.priority, 'priority', PRIORITY, null),
        dueDate: dateArg(args.dueDate, 'dueDate'),
      };
      if (!payload.status && !payload.priority && !payload.dueDate) {
        throw new ToolInputError('Give at least one of status, priority or dueDate');
      }
      const t = await findRow(ctx, 'tasks', payload.taskId, 'id, title, org_id', 'task');
      const changes = {};
      if (payload.status) changes.status = payload.status;
      if (payload.priority) changes.priority = payload.priority;
      if (payload.dueDate) changes.due = payload.dueDate;
      const verb = payload.status === 'done' && !payload.priority && !payload.dueDate ? `Mark ${quote(t.title)} done` : `Update ${quote(t.title)}: ${changesText(changes)}`;
      return { payload, orgId: t.org_id, summary: verb };
    },
    async execute(p, ctx) {
      const set = {};
      if (p.status) {
        set.status = p.status;
        set.completed_at = p.status === 'done' ? new Date().toISOString() : null;
      }
      if (p.priority) set.priority = p.priority;
      if (p.dueDate) set.due_date = p.dueDate;
      const u = await updateColumns(ctx, 'tasks', p.taskId, set, this.columns);
      return { result: { taskId: u.id }, undo: u };
    },
    view: () => ({ path: '/tasks', label: 'Tasks' }),
  },

  assign_task: {
    risk: 'write',
    undo: 'restore',
    table: 'tasks',
    noun: 'task',
    columns: ['assigned_to'],
    editable: [{ key: 'assignedTo', label: 'Assigned to', type: 'text' }],
    declaration: {
      description: 'Propose assigning a task to a person, or unassigning it (empty assignedTo). Nothing changes until the user confirms.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          taskId: { ...STR, description: 'Task id (uuid).' },
          assignedTo: { ...STR, description: 'Name of the person. Empty to unassign.' },
        },
        required: ['taskId'],
      },
    },
    async prepare(args, ctx) {
      const payload = { taskId: uuidArg(args.taskId, 'taskId'), assignedTo: optText(args.assignedTo, 'assignedTo', 120) };
      const t = await findRow(ctx, 'tasks', payload.taskId, 'id, title, org_id', 'task');
      return {
        payload,
        orgId: t.org_id,
        summary: payload.assignedTo ? `Assign ${quote(t.title)} to ${payload.assignedTo}` : `Unassign ${quote(t.title)}`,
      };
    },
    async execute(p, ctx) {
      const u = await updateColumns(ctx, 'tasks', p.taskId, { assigned_to: p.assignedTo }, this.columns);
      return { result: { taskId: u.id }, undo: u };
    },
    view: () => ({ path: '/tasks', label: 'Tasks' }),
  },

  create_action_item: {
    risk: 'write',
    undo: 'delete',
    table: 'action_items',
    noun: 'action item',
    editable: [
      { key: 'description', label: 'Action item', type: 'textarea' },
      { key: 'ownerName', label: 'Owner', type: 'text' },
      { key: 'dueDate', label: 'Due date', type: 'date' },
    ],
    declaration: {
      description: 'Propose a new action item on a meeting. Nothing is created until the user confirms.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          // Required: Meetings › action items opens and completes only items that belong to a meeting.
          meetingId: { ...STR, description: 'Meeting id (uuid) from search_meetings or get_meeting.' },
          description: { ...STR, description: 'What needs doing.' },
          ownerName: { ...STR, description: 'Who owns it.' },
          ownerEmail: STR,
          dueDate: DATE('Due date as YYYY-MM-DD.'),
          priority: enumOf(PRIORITY, 'Default medium.'),
        },
        required: ['meetingId', 'description'],
      },
    },
    async prepare(args, ctx) {
      const payload = {
        meetingId: uuidArg(args.meetingId, 'meetingId'),
        description: textArg(args.description, 'description', 1000),
        ownerName: optText(args.ownerName, 'ownerName', 120),
        ownerEmail: optText(args.ownerEmail, 'ownerEmail', 254),
        dueDate: dateArg(args.dueDate, 'dueDate'),
        priority: enumArg(args.priority, 'priority', PRIORITY, 'medium'),
      };
      if (payload.ownerEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.ownerEmail)) {
        throw new ToolInputError('ownerEmail is not an email address');
      }
      const m = await findRow(ctx, 'meetings', payload.meetingId, 'id, title, org_id', 'meeting');
      const bits = [payload.ownerName && `for ${payload.ownerName}`, payload.dueDate && `due ${payload.dueDate}`].filter(Boolean);
      return {
        payload,
        orgId: m.org_id,
        summary: `Add action item to ${quote(m.title || 'meeting')}: ${trunc(payload.description, 90)}${bits.length ? ` · ${bits.join(' · ')}` : ''}`,
      };
    },
    async execute(p, ctx) {
      const now = new Date().toISOString();
      const row = one(await ctx.db.from('action_items').insert({
        org_id: ctx.orgId,
        meeting_id: p.meetingId,
        task_description: p.description,
        assigned_to_name: p.ownerName,
        assigned_to_email: p.ownerEmail,
        due_date: p.dueDate,
        priority: p.priority,
        status: 'open',
        created_at: now,
        updated_at: now,
      }).select('id, meeting_id, updated_at').maybeSingle(), 'Creating the action item');
      return { result: { actionItemId: row.id, meetingId: row.meeting_id }, undo: { id: row.id, updatedAt: row.updated_at } };
    },
    view: (r) => (r?.meetingId ? { path: `/meetings/${r.meetingId}`, label: 'the meeting' } : null),
  },

  complete_action_item: {
    risk: 'write',
    undo: 'restore',
    table: 'action_items',
    noun: 'action item',
    columns: ['status', 'completed_at'],
    editable: [],
    declaration: {
      description: 'Propose marking an action item done. Nothing changes until the user confirms.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: { actionItemId: { ...STR, description: 'Action item id (uuid) from list_action_items.' } },
        required: ['actionItemId'],
      },
    },
    async prepare(args, ctx) {
      const payload = { actionItemId: uuidArg(args.actionItemId, 'actionItemId') };
      const a = await findRow(ctx, 'action_items', payload.actionItemId, 'id, task_description, status, org_id, meeting_id', 'action item');
      if (a.status === 'done' || a.status === 'completed') throw new ToolInputError('That action item is already done');
      return { payload, orgId: a.org_id, summary: `Mark action item done: ${trunc(a.task_description, 100)}` };
    },
    async execute(p, ctx) {
      // Same write as PATCH /api/meetings/action-items/:id (completed_at feeds Insights).
      const u = await updateColumns(ctx, 'action_items', p.actionItemId,
        { status: 'done', completed_at: new Date().toISOString() }, this.columns);
      const a = await findRow(ctx, 'action_items', p.actionItemId, 'meeting_id', 'action item');
      return { result: { actionItemId: u.id, meetingId: a.meeting_id }, undo: u };
    },
    view: (r) => (r?.meetingId ? { path: `/meetings/${r.meetingId}`, label: 'the meeting' } : null),
  },

  update_action_item: {
    risk: 'write',
    undo: 'restore',
    table: 'action_items',
    noun: 'action item',
    columns: ['due_date', 'priority', 'assigned_to_name', 'assigned_to_email'],
    editable: [
      { key: 'dueDate', label: 'Due date', type: 'date' },
      { key: 'ownerName', label: 'Owner', type: 'text' },
    ],
    declaration: {
      description: 'Propose a change to an action item: due date, priority or owner. Nothing changes until the user confirms.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          actionItemId: { ...STR, description: 'Action item id (uuid).' },
          dueDate: DATE('New due date as YYYY-MM-DD.'),
          priority: enumOf(PRIORITY, 'New priority.'),
          ownerName: { ...STR, description: 'New owner name.' },
          ownerEmail: { ...STR, description: 'New owner email.' },
        },
        required: ['actionItemId'],
      },
    },
    async prepare(args, ctx) {
      const payload = {
        actionItemId: uuidArg(args.actionItemId, 'actionItemId'),
        dueDate: dateArg(args.dueDate, 'dueDate'),
        priority: enumArg(args.priority, 'priority', PRIORITY, null),
        ownerName: optText(args.ownerName, 'ownerName', 120),
        ownerEmail: optText(args.ownerEmail, 'ownerEmail', 254),
      };
      if (!payload.dueDate && !payload.priority && !payload.ownerName && !payload.ownerEmail) {
        throw new ToolInputError('Give at least one of dueDate, priority, ownerName or ownerEmail');
      }
      if (payload.ownerEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.ownerEmail)) {
        throw new ToolInputError('ownerEmail is not an email address');
      }
      const a = await findRow(ctx, 'action_items', payload.actionItemId, 'id, task_description, org_id', 'action item');
      const changes = {};
      if (payload.dueDate) changes.due = payload.dueDate;
      if (payload.priority) changes.priority = payload.priority;
      if (payload.ownerName) changes.owner = payload.ownerName;
      if (payload.ownerEmail) changes.email = payload.ownerEmail;
      return { payload, orgId: a.org_id, summary: `Update action item ${quote(a.task_description)}: ${changesText(changes)}` };
    },
    async execute(p, ctx) {
      const set = {};
      if (p.dueDate) set.due_date = p.dueDate;
      if (p.priority) set.priority = p.priority;
      if (p.ownerName) set.assigned_to_name = p.ownerName;
      if (p.ownerEmail) set.assigned_to_email = p.ownerEmail;
      const u = await updateColumns(ctx, 'action_items', p.actionItemId, set, this.columns);
      const a = await findRow(ctx, 'action_items', p.actionItemId, 'meeting_id', 'action item');
      return { result: { actionItemId: u.id, meetingId: a.meeting_id }, undo: u };
    },
    view: (r) => (r?.meetingId ? { path: `/meetings/${r.meetingId}`, label: 'the meeting' } : null),
  },

  create_project: {
    risk: 'write',
    undo: 'delete',
    table: 'projects',
    noun: 'project',
    editable: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
    declaration: {
      description: 'Propose a new project, owned by the user. Nothing is created until the user confirms.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          name: { ...STR, description: 'Project name.' },
          description: STR,
          status: enumOf(['planning', 'active'], 'Default planning.'),
          startDate: DATE('Start date as YYYY-MM-DD.'),
          endDate: DATE('End date as YYYY-MM-DD.'),
        },
        required: ['name'],
      },
    },
    async prepare(args, ctx) {
      const payload = {
        name: textArg(args.name, 'name', 200),
        description: optText(args.description, 'description', 2000),
        status: enumArg(args.status, 'status', ['planning', 'active'], 'planning'),
        startDate: dateArg(args.startDate, 'startDate'),
        endDate: dateArg(args.endDate, 'endDate'),
      };
      if (payload.startDate && payload.endDate && payload.endDate < payload.startDate) {
        throw new ToolInputError('endDate is before startDate');
      }
      return { payload, orgId: ctx.orgIds[0], summary: `Create project ${quote(payload.name)}${payload.status === 'active' ? ' · active' : ''}` };
    },
    async execute(p, ctx) {
      const row = one(await ctx.db.from('projects').insert({
        org_id: ctx.orgId,
        owner_id: ctx.userId, // projects RLS: only the owner may insert, update or delete
        name: p.name,
        description: p.description,
        status: p.status,
        start_date: p.startDate,
        end_date: p.endDate,
        team_ids: [],
      }).select('id, name, updated_at').maybeSingle(), 'Creating the project');
      return { result: { projectId: row.id, name: row.name }, undo: { id: row.id, updatedAt: row.updated_at } };
    },
    /** Deleting a project cascades to its tasks: refuse once it has any. */
    async beforeDelete(id, ctx) {
      const { count, error } = await ctx.db.from('tasks').select('id', { count: 'exact', head: true })
        .eq('project_id', id).eq('org_id', ctx.orgId);
      if (error) throw new Error(error.message);
      if (count) return 'It has tasks now, so it was not removed. Archive it from Projects instead.';
      return null;
    },
    view: (r) => (r?.projectId ? { path: `/projects/${r.projectId}`, label: 'the project' } : null),
  },

  update_project: {
    risk: 'write',
    undo: 'restore',
    table: 'projects',
    noun: 'project',
    columns: ['status', 'end_date'],
    editable: [{ key: 'endDate', label: 'End date', type: 'date' }],
    declaration: {
      description: 'Propose a change to a project the user owns: status or end date. Nothing changes until the user confirms.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          projectId: { ...STR, description: 'Project id (uuid) from list_projects.' },
          status: enumOf(PROJECT_STATUS, 'New status.'),
          endDate: DATE('New end date as YYYY-MM-DD.'),
        },
        required: ['projectId'],
      },
    },
    async prepare(args, ctx) {
      const payload = {
        projectId: uuidArg(args.projectId, 'projectId'),
        status: enumArg(args.status, 'status', PROJECT_STATUS, null),
        endDate: dateArg(args.endDate, 'endDate'),
      };
      if (!payload.status && !payload.endDate) throw new ToolInputError('Give at least one of status or endDate');
      const p = await findRow(ctx, 'projects', payload.projectId, 'id, name, org_id, owner_id', 'project');
      // projects RLS lets only the owner update; say so now instead of failing on Confirm.
      if (p.owner_id !== ctx.userId) throw new ToolInputError('Only the project owner can change this project');
      const changes = {};
      if (payload.status) changes.status = payload.status;
      if (payload.endDate) changes.end = payload.endDate;
      return { payload, orgId: p.org_id, summary: `Update project ${quote(p.name)}: ${changesText(changes)}` };
    },
    async execute(p, ctx) {
      const set = {};
      if (p.status) set.status = p.status;
      if (p.endDate) set.end_date = p.endDate;
      const u = await updateColumns(ctx, 'projects', p.projectId, set, this.columns);
      return { result: { projectId: u.id }, undo: u };
    },
    view: (r) => (r?.projectId ? { path: `/projects/${r.projectId}`, label: 'the project' } : null),
  },

  change_calendar_bot_booking: {
    risk: 'sensitive',
    editable: [],
    confirmToken: (p) => p.decision === 'cancel' ? 'Cancel this bot' : 'I will notify attendees',
    declaration: {
      description: 'Propose scheduling or cancelling the recording bot for one Google Calendar occurrence. First use get_calendar to find the exact eventKey. Works independently of recurring auto-join. The user must review and confirm.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          eventKey: { ...STR, description: 'The exact eventKey from get_calendar.' },
          decision: enumOf(['schedule', 'cancel'], 'Schedule or cancel the bot for this occurrence.'),
          leadMinutes: {
            type: SchemaType.INTEGER,
            description: 'Whole minutes before the meeting start (0–5). Omit to use the calendar setting.',
          },
        },
        required: ['eventKey', 'decision'],
      },
    },
    async prepare(args, ctx) {
      const timeZone = calendarTimeZone(args.timeZone ?? ctx.timeZone);
      const booking = await autoJoin.prepareBooking(ctx, args).catch(bookingError);
      const payload = {
        eventKey: args.eventKey, decision: args.decision, leadMinutes: booking.leadMinutes,
        orgId: booking.orgId, revision: booking.event.etag || null, timeZone,
      };
      const title = quote(booking.event.summary || 'Untitled meeting');
      const summary = args.decision === 'cancel'
        ? `Cancel the bot for ${title} on ${localDateTime(booking.start.toISOString(), timeZone)}.`
        : `Schedule the recording bot for ${title} at ${localDateTime(booking.joinAt.toISOString(), timeZone)}. Confirm that you’ll tell invitees the meeting is recorded.`;
      return { orgId: booking.orgId, payload, summary };
    },
    async execute(payload, ctx) {
      const result = await autoJoin.saveBooking(ctx, payload).catch(bookingError);
      return { result, undo: null };
    },
    view: upcomingMeeting,
  },

  change_calendar_brief_schedule: {
    risk: 'write',
    editable: [],
    declaration: {
      description: 'Propose scheduling or cancelling one pre-meeting brief in Ask Entomate. First look up the exact eventKey in get_calendar. A cancellation only removes a pending brief. The bot and Google Calendar event are not changed. The user must confirm the card.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          eventKey: { ...STR, description: 'The exact eventKey from get_calendar.' },
          decision: enumOf(['schedule', 'cancel'], 'Schedule a brief or cancel its pending schedule.'),
          leadMinutes: {
            type: SchemaType.INTEGER,
            description: `Minutes before the meeting: ${scheduledBriefs.LEADS.join(', ')}. Default ${scheduledBriefs.DEFAULT_LEAD}. Omit when cancelling.`,
          },
        },
        required: ['eventKey', 'decision'],
      },
    },
    async prepare(args, ctx) {
      const orgId = ctx.proposalOrgId ?? ctx.workspaceId ?? (ctx.orgIds.length === 1 ? ctx.orgIds[0] : null);
      if (!orgId) throw new ToolInputError('Choose a workspace before scheduling or cancelling a brief.');
      const { event, start, runAt, leadMinutes, guard } = await scheduledBriefs.prepareChange(ctx.userId, orgId, args).catch(briefScheduleError);
      const timeZone = calendarTimeZone(args.timeZone ?? ctx.timeZone);
      const title = quote(event.summary || 'Untitled meeting');
      const meetingTime = localDateTime(new Date(start).toISOString(), timeZone);
      const when = runAt > Date.now() ? `at ${localDateTime(new Date(runAt).toISOString(), timeZone)} (${leadMinutes} minutes before)` : 'as soon as possible';
      return {
        orgId,
        payload: { eventKey: args.eventKey, decision: args.decision, leadMinutes, timeZone, guard },
        summary: args.decision === 'cancel'
          ? `Cancel the pending pre-meeting brief for ${title} on ${meetingTime}.`
          : `Prepare a brief for ${title} on ${meetingTime}, ${when}.`,
      };
    },
    async execute(payload, ctx) {
      const result = await scheduledBriefs.confirmChange(ctx.userId, ctx.orgId, payload).catch(briefScheduleError);
      return { result, undo: null };
    },
    view: upcomingMeeting,
  },

  configure_bot_auto_join: {
    risk: 'sensitive',
    editable: [],
    confirmToken: () => 'I will notify attendees',
    declaration: {
      description: "Propose turning on the recording bot for qualifying events on the user's primary Google Calendar, with a lead time before each meeting. Use only when the user explicitly asks for a recurring recording bot rule. Confirmation requires the user to acknowledge notice to attendees. For existing rules this updates the rule.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          leadMinutes: { type: SchemaType.INTEGER, description: `Minutes before meeting start, 0 through ${autoJoin.MAX_LEAD_MINUTES}. Use 0 for start time.` },
          scope: enumOf(autoJoin.SCOPES, 'Set organized or all only when the user specifies which scope. Otherwise preserve the existing scope or default to organized.'),
        },
        required: ['leadMinutes'],
      },
    },
    async prepare(args, ctx) {
      if (!autoJoin.validLeadMinutes(args.leadMinutes)) {
        throw new ToolInputError(`Choose a lead time from 0 to ${autoJoin.MAX_LEAD_MINUTES} whole minutes.`);
      }
      if (!calendarService.isConfigured() || !process.env.RECALL_API_KEY) {
        throw new ToolInputError('Google Calendar and the meeting bot need to be configured first.');
      }
      const row = await readCalendarSettings(ctx.userId, ctx.db);
      const json = row?.calendar_json || {};
      const prev = autoJoin.normalizeSettings(json.auto_join);
      if (!json.tokens) throw new ToolInputError('Connect Google Calendar in Settings → Recording first.');
      const orgId = prev.org_id || (ctx.orgIds.length === 1 ? ctx.orgIds[0] : null);
      if (!orgId) throw new ToolInputError('Choose a workspace for Bot auto-join in Settings → Recording first.');
      const payload = {
        enabled: true,
        scope: enumArg(args.scope, 'scope', autoJoin.SCOPES, prev.scope),
        leadMinutes: args.leadMinutes,
        orgId,
      };
      try {
        await autoJoin.nextSettings(ctx.userId, ctx.orgIds, json, { ...payload, consentAcknowledged: true });
      } catch (e) {
        if (e instanceof autoJoin.SettingsError) throw new ToolInputError(e.message);
        throw e;
      }
      const when = payload.leadMinutes
        ? `${payload.leadMinutes} minute${payload.leadMinutes === 1 ? '' : 's'} before the start`
        : 'at the start';
      const scope = payload.scope === 'all' ? 'all eligible meetings' : 'eligible meetings you organize';
      return {
        orgId,
        payload,
        summary: `Send the recording bot ${when} of ${scope} on your primary Google Calendar. Confirm that you’ll tell invitees the meeting is recorded.`,
      };
    },
    async execute(payload, ctx) {
      const settings = await autoJoin.configure(ctx.userId, ctx.orgIds, { ...payload, consentAcknowledged: true }, ctx.db);
      return { result: { leadMinutes: settings.lead_minutes, scope: settings.scope }, undo: null };
    },
    view: () => ({ path: '/settings?section=recording', label: 'Bot auto-join settings' }),
  },

  log_meeting_note: {
    risk: 'write',
    undo: 'delete',
    table: 'meeting_notes',
    noun: 'note',
    editable: [{ key: 'body', label: 'Note', type: 'textarea' }],
    declaration: {
      description: 'Propose adding a note to a meeting, in the user\'s name. Private unless visibility is "team". Nothing is saved until the user confirms.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          meetingId: { ...STR, description: 'Meeting id (uuid).' },
          body: { ...STR, description: 'The note text, up to 4000 characters.' },
          visibility: enumOf(NOTE_VISIBILITY, 'Default private.'),
        },
        required: ['meetingId', 'body'],
      },
    },
    async prepare(args, ctx) {
      const payload = {
        meetingId: uuidArg(args.meetingId, 'meetingId'),
        body: textArg(args.body, 'body', 4000),
        visibility: enumArg(args.visibility, 'visibility', NOTE_VISIBILITY, 'private'),
      };
      const m = await findRow(ctx, 'meetings', payload.meetingId, 'id, title, org_id', 'meeting');
      const who = payload.visibility === 'team' ? 'team' : 'private';
      return { payload, orgId: m.org_id, summary: `Add a ${who} note to ${quote(m.title || 'meeting')}: ${trunc(payload.body, 80)}` };
    },
    async execute(p, ctx) {
      const row = one(await ctx.db.from('meeting_notes').insert({
        org_id: ctx.orgId,
        meeting_id: p.meetingId,
        author_id: ctx.userId, // meeting_notes RLS: author_id = auth.uid()
        author_name: ctx.userName || null,
        body: p.body,
        visibility: p.visibility,
      }).select('id, meeting_id, updated_at').maybeSingle(), 'Saving the note');
      return { result: { noteId: row.id, meetingId: row.meeting_id }, undo: { id: row.id, updatedAt: row.updated_at } };
    },
    view: (r) => (r?.meetingId ? { path: `/meetings/${r.meetingId}`, label: 'the meeting' } : null),
  },
};

const PLAN_TOOL = 'propose_plan';
const MAX_PLAN_STEPS = 8;

/**
 * EAI-06: one declaration for a multi-step plan. Gemini needs explicit properties, so a
 * step carries `tool` plus the union of every verb's arguments (as Logos AI's propose_plan
 * does); each verb's prepare() still validates its own. Two verbs that share an argument
 * name with different enums (status) get the union of the values.
 */
function planDeclaration() {
  const props = {};
  const verbs = Object.entries(VERBS).filter(([, verb]) => verb.undo && verb.risk !== 'sensitive');
  for (const [, v] of verbs) {
    for (const [key, schema] of Object.entries(v.declaration.parameters.properties)) {
      const seen = props[key];
      if (seen?.enum && schema.enum) props[key] = { ...seen, enum: [...new Set([...seen.enum, ...schema.enum])], description: undefined };
      else if (!seen) props[key] = schema;
    }
  }
  for (const p of Object.values(props)) if (p.description === undefined) delete p.description;
  return {
    name: PLAN_TOOL,
    description: `Propose a MULTI-STEP plan: 2 to ${MAX_PLAN_STEPS} of the write actions above that belong together, run in order and confirmed once. Classic cases: (a) a new project and its first tasks: a create_project step, then create_task steps whose arg_bindings.projectId is "{{step0.result.projectId}}"; (b) several changes the user asked for at once, such as moving three overdue tasks to a new date. Nothing runs until the user confirms the whole plan. For ONE action, call that action's tool instead.`,
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        steps: {
          type: SchemaType.ARRAY,
          description: 'The steps, in the order they run. Each names one write tool and that tool\'s arguments.',
          items: {
            type: SchemaType.OBJECT,
            properties: {
              tool: enumOf(verbs.map(([name]) => name), 'The write tool this step runs.'),
              ...props,
              arg_bindings: {
                type: SchemaType.OBJECT,
                description: 'Arguments taken from an earlier step\'s result when the plan runs.',
                properties: {
                  projectId: { ...STR, description: 'On a create_task step: "{{stepN.result.projectId}}" for the project an earlier create_project step N makes.' },
                },
              },
            },
            required: ['tool'],
          },
        },
      },
      required: ['steps'],
    },
  };
}

const writeDeclarations = [...Object.entries(VERBS).map(([name, v]) => ({ name, ...v.declaration })), planDeclaration()];

module.exports = { VERBS, writeDeclarations, findRow, PLAN_TOOL, MAX_PLAN_STEPS };
