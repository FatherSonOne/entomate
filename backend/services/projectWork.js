const PAGE_SIZE = 250;
const MEETING_BATCH_SIZE = 100;

async function readAllRows(makeQuery) {
  const rows = [];
  for (;;) {
    const { data, error } = await makeQuery().order('id', { ascending: true })
      .range(rows.length, rows.length + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

async function readMeetingActions(db, meetings, orgIds, columns) {
  const actions = [];
  for (let start = 0; start < meetings.length; start += MEETING_BATCH_SIZE) {
    const ids = meetings.slice(start, start + MEETING_BATCH_SIZE).map((m) => m.id);
    actions.push(...await readAllRows(() => db.from('action_items').select(columns)
      .in('org_id', orgIds).in('meeting_id', ids)));
  }
  return actions;
}

async function loadProjectWork(db, projectIds, orgIds) {
  if (!projectIds.length) return { tasks: [], meetings: [], actionItems: [] };
  const [tasks, meetings] = await Promise.all([
    readAllRows(() => db.from('tasks')
      .select('id, project_id, title, description, status, due_date, assigned_to, parent_task_id, priority')
      .in('org_id', orgIds).in('project_id', projectIds)),
    readAllRows(() => db.from('meetings').select('id, project_id, title, start_time, created_at, decisions')
      .in('org_id', orgIds).in('project_id', projectIds)),
  ]);
  const actionItems = await readMeetingActions(db, meetings, orgIds,
    'id, meeting_id, task_description, status, due_date, assigned_to_name');
  return { tasks, meetings, actionItems };
}

module.exports = { readAllRows, readMeetingActions, loadProjectWork };
