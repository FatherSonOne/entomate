/**
 * Project report data (feature audit 2026-11-22, F4).
 *
 * The project PDF used to read a `project_statistics` view that never
 * existed, then looked up action items by meeting_id = project id, so every
 * export came out empty. This builds the report from what a project really
 * has: its tasks, plus the action items from meetings linked to it.
 */

'use strict';

const { rollup, isDone } = require('./projectRollup');
const { readProgress, summarizeMilestones } = require('./projectProgress');
const ACTIVE = new Set(['in_progress', 'review']);

/** Map task and action item statuses onto the PDF's three groups. */
function reportStatus(status) {
  const s = String(status || '').toLowerCase();
  if (isDone(s)) return 'done';
  if (ACTIVE.has(s)) return 'in_progress';
  return 'open';
}

/**
 * @param {{ project: { id: string, name?: string|null }, tasks?: object[], actionItems?: object[], now?: Date }} input
 * @returns {{ project: object, items: object[], teamWorkload: object[] }}
 */
function buildProjectReport({ project, tasks = [], actionItems = [], now = new Date() }) {
  const topLevel = tasks.filter((task) => !task.parent_task_id);
  const { total, done, late } = rollup(topLevel, [], actionItems, now);
  const progress = readProgress(project);
  const milestones = summarizeMilestones(progress.milestones);
  const items = [
    ...topLevel.map((t) => ({
      task_description: t.title || t.description || 'Untitled task',
      status: reportStatus(t.status),
      owner: t.assigned_to || null,
      due_date: t.due_date || null,
    })),
    ...actionItems.map((a) => ({
      task_description: a.task_description || 'Untitled action item',
      status: reportStatus(a.status),
      owner: a.assigned_to_name || null,
      due_date: a.due_date || null,
    })),
  ];

  const byOwner = new Map();
  for (const item of items) {
    if (!item.owner) continue;
    const row = byOwner.get(item.owner) || { team_member: item.owner, total_assigned: 0, completed_items: 0 };
    row.total_assigned += 1;
    if (item.status === 'done') row.completed_items += 1;
    byOwner.set(item.owner, row);
  }

  return {
    project: {
      id: project.id,
      title: project.name || 'Untitled project',
      total_items: total,
      complete_items: done,
      overdue_items: late,
      progress_percent: total ? Math.round((done / total) * 100) : 0,
      ...(milestones.total > 0 && { milestone_counts: { done: milestones.done, total: milestones.total } }),
      ...(progress.updates.length > 0 && { latest_update: progress.updates[0] }),
    },
    items,
    teamWorkload: [...byOwner.values()].sort((a, b) => b.total_assigned - a.total_assigned),
  };
}

module.exports = { buildProjectReport, reportStatus };
