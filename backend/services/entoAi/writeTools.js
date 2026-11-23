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
const { uuidArg, dateArg, trunc, ToolInputError } = require('./tools');

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
    .select('id, updated_at')
    .maybeSingle(), 'The update');
  return { id: row.id, updatedAt: row.updated_at, previous };
}

const VERBS = {
  create_task: {
    risk: 'write',
    undo: 'delete',
    table: 'tasks',
    noun: 'task',
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

const writeDeclarations = Object.entries(VERBS).map(([name, v]) => ({ name, ...v.declaration }));

module.exports = { VERBS, writeDeclarations, findRow };
