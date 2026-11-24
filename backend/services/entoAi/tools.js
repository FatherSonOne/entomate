/**
 * Entomate AI read tools (EAI-04, docs/app-dev/entomate-ai-APP-PRODUCT.md §4).
 *
 * Each tool is a Gemini function declaration plus an executor. Executors run
 * with the caller's user-JWT client (`ctx.db`, D2), so RLS
 * (org_id IN get_my_org_ids()) is the perimeter; the `.in('org_id', orgIds)`
 * on every query is a second fence. Nothing here writes.
 *
 * Results are slim JSON for the model: capped lists, truncated text, and an
 * exact `total` where a count question is likely ("how many open tasks").
 */

const { SchemaType } = require('@google/generative-ai');
const searchEverything = require('../searchEverything');
const calendarService = require('../calendarService');
const autoJoin = require('../calendarAutoJoin');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}/;
/** Status values that mean "finished" across tasks and action items (measured on the live DB). */
const CLOSED = ['done', 'completed', 'complete', 'cancelled'];
const CLOSED_FILTER = `(${CLOSED.map((s) => `"${s}"`).join(',')})`;
const MAX_RANGE_DAYS = 62;

class ToolInputError extends Error {}

function limitOf(n, def = 10, max = 25) {
  const v = parseInt(n, 10);
  return Number.isFinite(v) ? Math.min(Math.max(v, 1), max) : def;
}

function trunc(s, n) {
  if (s == null) return null;
  const t = String(s);
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function uuidArg(v, name) {
  if (typeof v !== 'string' || !UUID_RE.test(v)) throw new ToolInputError(`${name} must be a record id (uuid)`);
  return v;
}

function dateArg(v, name) {
  if (v == null || v === '') return null;
  if (typeof v !== 'string' || !DATE_RE.test(v) || Number.isNaN(Date.parse(v))) {
    throw new ToolInputError(`${name} must be a date as YYYY-MM-DD`);
  }
  return v.slice(0, 10);
}

function calendarTimeZone(value) {
  try {
    if (typeof value === 'string' && value.length <= 80) {
      return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone;
    }
  } catch { /* Older clients and invalid zones use UTC. */ }
  return 'UTC';
}

function today(timeZone = 'UTC', now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function dayBoundary(date, timeZone) {
  const midnight = Date.parse(`${date}T00:00:00Z`);
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' });
  const offsetAt = (at) => {
    const zone = formatter.formatToParts(at).find((part) => part.type === 'timeZoneName')?.value || '';
    const offset = /GMT([+-])(\d{2}):(\d{2})/.exec(zone);
    return offset ? (offset[1] === '-' ? -1 : 1) * (Number(offset[2]) * 60 + Number(offset[3])) * 60_000 : 0;
  };
  // Compare both offsets around a date with a midnight clock change.
  const candidates = [-1, 1].map((day) => midnight - offsetAt(midnight + day * 86_400_000))
    .sort((a, b) => a - b);
  const boundary = candidates.find((at) => today(timeZone, new Date(at)) === date) ?? candidates[1];
  return new Date(boundary).toISOString();
}

function addDays(ymd, days) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Throws the PostgREST error so the tool reports a failure instead of "nothing found". */
function rows({ data, error }) {
  if (error) throw new Error(error.message || 'query failed');
  return data || [];
}

/** Apply the open / closed / exact status filter shared by tasks and action items. */
function statusFilter(q, status) {
  if (!status || status === 'all') return q;
  if (status === 'open') return q.not('status', 'in', CLOSED_FILTER);
  if (status === 'closed') return q.in('status', CLOSED);
  return q.eq('status', String(status));
}

function textFilter(q, columns, query) {
  if (!query) return q;
  const words = searchEverything.terms(query);
  return words.length ? q.or(searchEverything.orFilter(columns, words)) : q;
}

function slimAttendees(attendees) {
  if (!Array.isArray(attendees)) return [];
  return attendees.slice(0, 30).map((a) => (
    typeof a === 'string' ? a : (a && (a.name || a.displayName || a.email)) || null
  )).filter(Boolean);
}

function slimTask(t) {
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.due_date,
    assignedTo: t.assigned_to,
    projectId: t.project_id,
    projectName: t.projects?.name || null,
  };
}

function slimActionItem(a) {
  return {
    id: a.id,
    description: trunc(a.task_description, 240),
    owner: a.assigned_to_name || a.assigned_to_email || null,
    dueDate: a.due_date,
    priority: a.priority,
    status: a.status,
    meetingId: a.meeting_id,
    meetingTitle: a.meetings?.title || null,
  };
}

const STR = { type: SchemaType.STRING };
const INT = { type: SchemaType.INTEGER };
const BOOL = { type: SchemaType.BOOLEAN };
const DATE = (description) => ({ type: SchemaType.STRING, description });
const OPEN_STATUS = {
  type: SchemaType.STRING,
  description: '"open" (default: not finished), "closed" (done, completed or cancelled), "all", or one exact status such as "todo", "in_progress", "review", "blocked".',
};

const TOOLS = {
  search_meetings: {
    label: 'Searching meetings',
    declaration: {
      description: 'Find meetings by words in the title or summary, and/or by date. Use it to find a meeting before get_meeting.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          query: { ...STR, description: 'Words to look for. Leave out to list recent meetings.' },
          from: DATE('Earliest meeting date, YYYY-MM-DD.'),
          to: DATE('Latest meeting date, YYYY-MM-DD.'),
          limit: { ...INT, description: 'Max meetings to return (default 10, max 25).' },
        },
      },
    },
    async run(args, { db, orgIds }) {
      const from = dateArg(args.from, 'from');
      const to = dateArg(args.to, 'to');
      let q = db.from('meetings')
        .select('id, title, summary, start_time, created_at, duration_minutes, sentiment_label, attendees', { count: 'exact' })
        .in('org_id', orgIds);
      q = textFilter(q, ['title', 'summary'], args.query);
      if (from) q = q.gte('created_at', from);
      if (to) q = q.lt('created_at', addDays(to, 1));
      const res = await q.order('created_at', { ascending: false }).limit(limitOf(args.limit));
      const meetings = rows(res).map((m) => ({
        id: m.id,
        title: m.title,
        date: m.start_time || m.created_at,
        durationMinutes: m.duration_minutes,
        sentiment: m.sentiment_label,
        attendees: slimAttendees(m.attendees).length,
        summary: trunc(m.summary, 220),
      }));
      return { total: res.count ?? meetings.length, meetings };
    },
  },

  get_meeting: {
    label: 'Reading the meeting',
    declaration: {
      description: 'One meeting in full: summary, key points, decisions, topics, attendees, sentiment, action items, accessible meeting notes and a transcript excerpt.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          meeting_id: { ...STR, description: 'The meeting id from search_meetings or search_everything.' },
          transcript_chars: { ...INT, description: 'How much transcript to include (default 3000, max 12000). 0 for none.' },
        },
        required: ['meeting_id'],
      },
    },
    async run(args, { db, orgIds, userId }) {
      const id = uuidArg(args.meeting_id, 'meeting_id');
      const n = args.transcript_chars === 0 ? 0 : limitOf(args.transcript_chars, 3000, 12000);
      const { data: m, error } = await db.from('meetings')
        .select('id, title, summary, key_points, decisions, topics, sentiment_label, sentiment_score, start_time, end_time, duration_minutes, attendees, project_id, created_at, transcript')
        .eq('id', id).in('org_id', orgIds).maybeSingle();
      if (error) throw new Error(error.message);
      if (!m) return { found: false };
      const [items, notes] = await Promise.all([
        db.from('action_items')
          .select('id, task_description, assigned_to_name, assigned_to_email, due_date, priority, status, meeting_id')
          .eq('meeting_id', id).in('org_id', orgIds).limit(50).then(rows),
        db.from('meeting_notes').select('author_id, author_name, body, visibility, created_at')
          .eq('meeting_id', id).in('org_id', orgIds)
          .or(`visibility.eq.team,author_id.eq.${userId}`)
          .order('created_at', { ascending: false }).limit(10).then(rows),
      ]);
      const transcript = m.transcript || '';
      return {
        found: true,
        meeting: {
          id: m.id,
          title: m.title,
          date: m.start_time || m.created_at,
          endTime: m.end_time,
          durationMinutes: m.duration_minutes,
          projectId: m.project_id,
          attendees: slimAttendees(m.attendees),
          sentiment: m.sentiment_label,
          sentimentScore: m.sentiment_score,
          summary: trunc(m.summary, 2000),
          keyPoints: m.key_points,
          decisions: m.decisions,
          topics: m.topics,
          actionItems: items.map(slimActionItem),
          notes: notes.filter((note) => note.visibility === 'team' || note.author_id === userId)
            .map((note) => ({ text: trunc(note.body, 1000), author: note.author_name, date: note.created_at })),
          transcriptExcerpt: n ? transcript.slice(0, n) : undefined,
          transcriptTruncated: n ? transcript.length > n : undefined,
        },
      };
    },
  },

  list_action_items: {
    label: 'Checking action items',
    declaration: {
      description: 'Action items that came out of meetings, with owner, due date and the meeting they came from.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          status: OPEN_STATUS,
          meeting_id: { ...STR, description: 'Only items from this meeting.' },
          owner: { ...STR, description: 'Part of the owner name or email.' },
          overdue: { ...BOOL, description: 'Only open items past their due date.' },
          due_before: DATE('Only items due on or before this date, YYYY-MM-DD.'),
          limit: { ...INT, description: 'Max items (default 15, max 25).' },
        },
      },
    },
    async run(args, { db, orgIds }) {
      const dueBefore = dateArg(args.due_before, 'due_before');
      let q = db.from('action_items')
        .select('id, task_description, assigned_to_name, assigned_to_email, due_date, priority, status, meeting_id, meetings(title)', { count: 'exact' })
        .in('org_id', orgIds);
      q = statusFilter(q, args.overdue ? 'open' : (args.status || 'open'));
      if (args.meeting_id) q = q.eq('meeting_id', uuidArg(args.meeting_id, 'meeting_id'));
      if (args.owner) {
        const w = String(args.owner).replace(/[%,()*\\]/g, '').slice(0, 60);
        if (w) q = q.or(`assigned_to_name.ilike.%${w}%,assigned_to_email.ilike.%${w}%`);
      }
      if (args.overdue) q = q.lt('due_date', today());
      if (dueBefore) q = q.lte('due_date', dueBefore);
      const res = await q.order('due_date', { ascending: true, nullsFirst: false }).limit(limitOf(args.limit, 15));
      const items = rows(res).map(slimActionItem);
      return { total: res.count ?? items.length, actionItems: items };
    },
  },

  list_tasks: {
    label: 'Checking tasks',
    declaration: {
      description: 'Tasks, filtered by status, priority, project, due date or words. Returns an exact total and up to 25 tasks.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          status: OPEN_STATUS,
          priority: { ...STR, description: 'e.g. "high", "medium", "low", "urgent".' },
          project_id: { ...STR, description: 'Only tasks in this project.' },
          overdue: { ...BOOL, description: 'Only open tasks past their due date.' },
          due_before: DATE('Only tasks due on or before this date, YYYY-MM-DD.'),
          query: { ...STR, description: 'Words in the title or description.' },
          limit: { ...INT, description: 'Max tasks (default 15, max 25).' },
        },
      },
    },
    async run(args, { db, orgIds }) {
      const dueBefore = dateArg(args.due_before, 'due_before');
      let q = db.from('tasks')
        .select('id, title, status, priority, due_date, assigned_to, project_id, projects(name)', { count: 'exact' })
        .in('org_id', orgIds);
      q = statusFilter(q, args.overdue ? 'open' : (args.status || 'open'));
      if (args.priority) q = q.eq('priority', String(args.priority).toLowerCase());
      if (args.project_id) q = q.eq('project_id', uuidArg(args.project_id, 'project_id'));
      if (args.overdue) q = q.lt('due_date', today());
      if (dueBefore) q = q.lte('due_date', dueBefore);
      q = textFilter(q, ['title', 'description'], args.query);
      const res = await q.order('due_date', { ascending: true, nullsFirst: false }).limit(limitOf(args.limit, 15));
      const tasks = rows(res).map(slimTask);
      return { total: res.count ?? tasks.length, tasks };
    },
  },

  get_task: {
    label: 'Reading the task',
    declaration: {
      description: 'One task in full, with its project and subtasks.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: { task_id: { ...STR, description: 'The task id.' } },
        required: ['task_id'],
      },
    },
    async run(args, { db, orgIds }) {
      const id = uuidArg(args.task_id, 'task_id');
      const { data: t, error } = await db.from('tasks')
        .select('id, title, description, status, priority, due_date, start_date, assigned_to, project_id, parent_task_id, estimated_hours, actual_hours, tags, created_at, completed_at, projects(name)')
        .eq('id', id).in('org_id', orgIds).maybeSingle();
      if (error) throw new Error(error.message);
      if (!t) return { found: false };
      const subtasks = rows(await db.from('tasks')
        .select('id, title, status, priority, due_date, assigned_to, project_id')
        .eq('parent_task_id', id).in('org_id', orgIds).limit(25));
      return {
        found: true,
        task: {
          ...slimTask(t),
          description: trunc(t.description, 2000),
          startDate: t.start_date,
          parentTaskId: t.parent_task_id,
          estimatedHours: t.estimated_hours,
          actualHours: t.actual_hours,
          tags: t.tags,
          createdAt: t.created_at,
          completedAt: t.completed_at,
          subtasks: subtasks.map(slimTask),
        },
      };
    },
  },

  list_projects: {
    label: 'Checking projects',
    declaration: {
      description: 'Projects with status, dates and open / finished task counts.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          status: { ...STR, description: 'e.g. "active", "planning", "completed". Leave out for all.' },
          query: { ...STR, description: 'Words in the name or description.' },
          limit: { ...INT, description: 'Max projects (default 15, max 25).' },
        },
      },
    },
    async run(args, { db, orgIds }) {
      let q = db.from('projects')
        .select('id, name, description, status, start_date, end_date, deal_value, created_at', { count: 'exact' })
        .in('org_id', orgIds);
      if (args.status && args.status !== 'all') q = q.eq('status', String(args.status));
      q = textFilter(q, ['name', 'description'], args.query);
      const res = await q.order('created_at', { ascending: false }).limit(limitOf(args.limit, 15));
      const projects = rows(res);
      const counts = {};
      if (projects.length) {
        const tasks = rows(await db.from('tasks').select('project_id, status')
          .in('org_id', orgIds).in('project_id', projects.map((p) => p.id)).limit(2000));
        for (const t of tasks) {
          const c = counts[t.project_id] || (counts[t.project_id] = { open: 0, finished: 0 });
          if (CLOSED.includes(t.status)) c.finished += 1; else c.open += 1;
        }
      }
      return {
        total: res.count ?? projects.length,
        projects: projects.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          startDate: p.start_date,
          endDate: p.end_date,
          dealValue: p.deal_value,
          description: trunc(p.description, 200),
          tasks: counts[p.id] || { open: 0, finished: 0 },
        })),
      };
    },
  },

  get_project: {
    label: 'Reading the project',
    declaration: {
      description: 'One project in full: its tasks (with counts by status) and the meetings linked to it.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: { project_id: { ...STR, description: 'The project id.' } },
        required: ['project_id'],
      },
    },
    async run(args, { db, orgIds }) {
      const id = uuidArg(args.project_id, 'project_id');
      const { data: p, error } = await db.from('projects')
        .select('id, name, description, status, start_date, end_date, deal_value, tags, created_at')
        .eq('id', id).in('org_id', orgIds).maybeSingle();
      if (error) throw new Error(error.message);
      if (!p) return { found: false };
      const [tasks, meetings] = await Promise.all([
        db.from('tasks').select('id, title, status, priority, due_date, assigned_to, project_id')
          .eq('project_id', id).in('org_id', orgIds).order('due_date', { ascending: true, nullsFirst: false }).limit(50).then(rows),
        db.from('meetings').select('id, title, start_time, created_at')
          .eq('project_id', id).in('org_id', orgIds).order('created_at', { ascending: false }).limit(10).then(rows),
      ]);
      const byStatus = {};
      let overdue = 0;
      const now = today();
      for (const t of tasks) {
        byStatus[t.status || 'none'] = (byStatus[t.status || 'none'] || 0) + 1;
        if (!CLOSED.includes(t.status) && t.due_date && t.due_date < now) overdue += 1;
      }
      return {
        found: true,
        project: {
          id: p.id,
          name: p.name,
          status: p.status,
          startDate: p.start_date,
          endDate: p.end_date,
          dealValue: p.deal_value,
          tags: p.tags,
          description: trunc(p.description, 2000),
          taskCounts: { total: tasks.length, byStatus, overdue },
          tasks: tasks.slice(0, 25).map(slimTask),
          meetings: meetings.map((m) => ({ id: m.id, title: m.title, date: m.start_time || m.created_at })),
        },
      };
    },
  },

  get_calendar: {
    label: 'Checking the calendar',
    declaration: {
      description: 'What falls in a date range: Google Calendar events (with video links and agendas when available), bot auto-join settings, meetings, and open tasks and action items due.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          from: DATE('First day, YYYY-MM-DD (default today).'),
          query: { ...STR, description: 'Optional Google Calendar search by meeting title or topic.' },
          to: DATE('Last day, YYYY-MM-DD (default 7 days after from, max 62 days).'),
        },
      },
    },
    async run(args, { db, orgIds, userId, timeZone = 'UTC' }) {
      const from = dateArg(args.from, 'from') || today(timeZone);
      let to = dateArg(args.to, 'to') || addDays(from, 7);
      if (to < from) throw new ToolInputError('to must be on or after from');
      if (to > addDays(from, MAX_RANGE_DAYS)) to = addDays(from, MAX_RANGE_DAYS);
      const timeMin = dayBoundary(from, timeZone);
      const timeMax = dayBoundary(addDays(to, 1), timeZone);
      const query = typeof args.query === 'string' ? args.query.trim().slice(0, 160) : '';

      const [meetings, tasks, items, google] = await Promise.all([
        db.from('meetings').select('id, title, start_time, end_time, created_at')
          .in('org_id', orgIds).gte('start_time', timeMin).lt('start_time', timeMax)
          .order('start_time', { ascending: true }).limit(25).then(rows),
        statusFilter(db.from('tasks').select('id, title, status, priority, due_date, assigned_to, project_id, projects(name)')
          .in('org_id', orgIds), 'open').gte('due_date', from).lte('due_date', to)
          .order('due_date', { ascending: true }).limit(25).then(rows),
        statusFilter(db.from('action_items').select('id, task_description, assigned_to_name, assigned_to_email, due_date, priority, status, meeting_id, meetings(title)')
          .in('org_id', orgIds), 'open').gte('due_date', from).lte('due_date', to)
          .order('due_date', { ascending: true }).limit(25).then(rows),
        googleEvents(db, userId, timeMin, timeMax, query),
      ]);
      return {
        from,
        to,
        googleCalendar: google.state,
        events: google.events,
        autoJoin: google.autoJoin || null,
        meetings: meetings.map((m) => ({ id: m.id, title: m.title, start: m.start_time, end: m.end_time })),
        tasksDue: tasks.map(slimTask),
        actionItemsDue: items.map(slimActionItem),
      };
    },
  },

  search_everything: {
    label: 'Searching everything',
    declaration: {
      description: 'Word search across meetings (titles, transcripts), decisions, action items, tasks, projects and notes. Use it when you do not know where something is.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          query: { ...STR, description: 'What to look for.' },
          types: {
            type: SchemaType.ARRAY,
            items: STR,
            description: `Limit to some of: ${searchEverything.TYPES.join(', ')}.`,
          },
        },
        required: ['query'],
      },
    },
    async run(args, { db, orgIds, userId }) {
      const query = typeof args.query === 'string' ? args.query.trim().slice(0, 300) : '';
      if (!query) throw new ToolInputError('query is required');
      const types = Array.isArray(args.types) && args.types.length ? args.types.map(String) : undefined;
      const r = await searchEverything.search({ query, types, limit: 6, orgIds, userId, db });
      const groups = {};
      for (const [key, list] of Object.entries(r.groups || {})) {
        groups[key] = list.map((x) => ({
          type: x.type,
          id: x.id,
          title: x.title,
          snippet: trunc(x.snippet, 200),
          date: x.meta?.date || null,
          status: x.meta?.status,
          meetingId: x.meta?.meetingId,
          meetingTitle: x.meta?.meetingTitle,
          projectName: x.meta?.projectName,
        }));
      }
      return { total: r.total || 0, counts: r.counts || {}, groups };
    },
  },
};

/** The caller's own Google events, read with their own tokens (user_settings_self RLS). */
async function googleEvents(db, userId, timeMin, timeMax, query) {
  if (!calendarService.isConfigured()) return { state: 'not_configured', events: [] };
  let autoJoinSettings = null;
  try {
    const { data, error } = await db.from('user_settings').select('calendar_json').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    const tokens = data?.calendar_json?.tokens;
    if (!tokens) return { state: 'not_connected', events: [] };
    const settings = autoJoin.normalizeSettings(data.calendar_json.auto_join);
    autoJoinSettings = { enabled: settings.enabled, scope: settings.scope, leadMinutes: settings.lead_minutes };
    const events = await calendarService.getEvents({
      ...tokens, _onRefresh: (updated) => autoJoin.persistTokens(userId, updated, tokens, db),
    }, {
      timeMin,
      timeMax,
      maxResults: 50,
      query: query || undefined,
    });
    return {
      state: 'connected',
      autoJoin: autoJoinSettings,
      events: (events || []).filter((e) => e.status !== 'cancelled').map((e) => ({
        title: e.summary,
        start: e.start?.dateTime || e.start?.date,
        end: e.end?.dateTime || e.end?.date,
        allDay: !e.start?.dateTime,
        location: trunc(e.location, 200),
        agenda: trunc(e.description, 720),
        meetingLink: autoJoin.meetingLink(e)?.url || null,
        attendees: (e.attendees || []).filter((a) => !a.resource).length,
      })),
    };
  } catch (e) {
    return { state: 'error', events: [], autoJoin: autoJoinSettings };
  }
}

/** The number of records a result carries, for the panel's "Checking tasks · 9" chip. */
function resultCount(out) {
  if (!out || typeof out !== 'object') return 0;
  if (out.found === false) return 0;
  if (out.found === true) return 1;
  if (Number.isFinite(out.total)) return out.total;
  return ['events', 'meetings', 'tasksDue', 'actionItemsDue']
    .reduce((n, k) => n + (Array.isArray(out[k]) ? out[k].length : 0), 0);
}

const RECORD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_RECORD_LINKS = 20;

/**
 * EAI-02c (LV PR-2333): the meetings and projects a read returned, as { kind, id, label } for
 * the record buttons under the answer. Tasks and action items have no detail page, so only
 * the meeting an item came from is kept.
 */
function recordLinksOf(out) {
  const links = [];
  const add = (kind, id, label) => {
    if (typeof id === 'string' && RECORD_ID.test(id) && typeof label === 'string' && label.trim()) {
      links.push({ kind, id, label: label.trim().slice(0, 120) });
    }
  };
  const fromItems = (list) => {
    for (const x of Array.isArray(list) ? list : []) add('meeting', x.meetingId, x.meetingTitle);
  };
  if (!out || typeof out !== 'object') return links;
  for (const m of [...(out.meetings || []), ...(out.project?.meetings || [])]) add('meeting', m.id, m.title);
  for (const p of out.projects || []) add('project', p.id, p.name);
  if (out.meeting) { add('meeting', out.meeting.id, out.meeting.title); fromItems(out.meeting.actionItems); }
  if (out.project) add('project', out.project.id, out.project.name);
  fromItems(out.actionItems);
  fromItems(out.actionItemsDue);
  for (const list of Object.values(out.groups || {})) {
    for (const x of Array.isArray(list) ? list : []) {
      if (x.type === 'meeting' || x.type === 'project') add(x.type, x.id, x.title);
      add('meeting', x.meetingId, x.meetingTitle);
    }
  }
  return links;
}

/** The records the answer names, one per record, at most 20 (LV `recordLinksForAnswer`). */
function recordLinksForAnswer(answer, links) {
  if (!answer) return [];
  const lower = answer.toLowerCase();
  const out = [];
  for (const l of links) {
    if (out.length >= MAX_RECORD_LINKS) break;
    if (out.some((o) => o.kind === l.kind && o.id === l.id)) continue;
    if (lower.includes(l.label.toLowerCase())) out.push(l);
  }
  return out;
}

const declarations = Object.entries(TOOLS).map(([name, t]) => ({ name, ...t.declaration }));

/**
 * Run one tool call. Never throws: a failure comes back as { ok: false } so the
 * model can say what went wrong and the panel can mark the step failed.
 */
async function runTool(name, args, ctx, timeoutMs = 10000) {
  const tool = TOOLS[name];
  if (!tool) return { name, ok: false, count: 0, response: { error: `Unknown tool ${name}` } };
  let timer;
  try {
    const out = await Promise.race([
      tool.run(args || {}, ctx),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timed out')), timeoutMs); }),
    ]);
    return { name, ok: true, count: resultCount(out), response: out };
  } catch (e) {
    const message = e instanceof ToolInputError ? e.message : `Lookup failed: ${e.message}`;
    return { name, ok: false, count: 0, response: { error: message } };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { calendarTimeZone, today, TOOLS, declarations, runTool, resultCount, recordLinksOf, recordLinksForAnswer, CLOSED, ToolInputError, uuidArg, dateArg, trunc };
