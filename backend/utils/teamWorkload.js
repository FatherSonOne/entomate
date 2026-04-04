/**
 * Shared team workload aggregation utility.
 * Used by both projects.js dashboard and dashboard.js project-insights routes.
 */

function aggregateTeamWorkload(tasks) {
  const teamMap = new Map();

  tasks.forEach(task => {
    const assignee = task.assigned_to || 'Unassigned';
    if (!teamMap.has(assignee)) {
      teamMap.set(assignee, {
        team_member: assignee,
        total_assigned: 0,
        pending_items: 0,
        in_progress_items: 0,
        completed_items: 0,
        high_priority_count: 0
      });
    }
    const member = teamMap.get(assignee);
    member.total_assigned++;
    if (task.status === 'open') member.pending_items++;
    if (task.status === 'in_progress' || task.status === 'review') member.in_progress_items++;
    if (task.status === 'done') member.completed_items++;
    if (task.priority === 'high' && task.status !== 'done') member.high_priority_count++;
  });

  return Array.from(teamMap.values())
    .sort((a, b) => b.total_assigned - a.total_assigned);
}

module.exports = { aggregateTeamWorkload };
