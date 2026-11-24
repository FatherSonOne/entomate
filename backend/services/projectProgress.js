const { milestone, statusUpdate } = require('../schemas/projects');

function validatedRows(schema, input) {
  return (Array.isArray(input) ? input : []).flatMap((row) => {
    const parsed = schema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

function readProgress(project) {
  return {
    version: project.settings?.progress?.version ?? null,
    milestones: validatedRows(milestone, project.settings?.progress?.milestones),
    updates: validatedRows(statusUpdate, project.settings?.progress?.updates)
  };
}

function summarizeMilestones(milestones) {
  const incomplete = milestones.filter((item) => item.completedAt == null)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return { total: milestones.length, done: milestones.length - incomplete.length, next: incomplete[0] ?? null };
}

module.exports = { readProgress, summarizeMilestones };
