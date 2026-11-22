/**
 * WorkflowScheduler.syncWorkflow keeps cron jobs in step with workflow_schedules.
 */
const mockRows = { data: [], error: null };

jest.mock('../config/supabase', () => {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    update: jest.fn(() => chain),
    then: (resolve) => resolve(mockRows),
  };
  return { supabase: { from: jest.fn(() => chain) } };
});

jest.mock('node-cron', () => ({
  validate: jest.fn(() => true),
  schedule: jest.fn(() => ({ stop: jest.fn() })),
}));

jest.mock('../services/workflow/WorkflowExecutor', () => jest.fn().mockImplementation(() => ({ execute: jest.fn() })));
jest.mock('../utils/log', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

const scheduler = require('../services/workflow/WorkflowScheduler');

const row = (id, workflowId, active = true) => ({
  id, workflow_id: workflowId, node_id: 'n1', cron_expression: '0 * * * *', timezone: 'UTC',
  run_count: 0, consecutive_failures: 0, workflows: { id: workflowId, name: 'wf', active, execution_count: 0 },
});

beforeEach(() => {
  scheduler.jobs.clear();
  scheduler.jobWorkflows.clear();
});

test('starts enabled schedules of an active workflow', async () => {
  mockRows.data = [row('s1', 'w1'), row('s2', 'w1')];
  expect(await scheduler.syncWorkflow('w1')).toBe(2);
  expect([...scheduler.jobWorkflows.values()]).toEqual(['w1', 'w1']);
});

test('stops jobs of that workflow when it has no enabled schedules left', async () => {
  mockRows.data = [row('s1', 'w1')];
  await scheduler.syncWorkflow('w1');
  const job = scheduler.jobs.get('s1');
  mockRows.data = [];
  expect(await scheduler.syncWorkflow('w1')).toBe(0);
  expect(job.stop).toHaveBeenCalled();
  expect(scheduler.jobs.size).toBe(0);
});

test('leaves other workflows alone and skips inactive ones', async () => {
  mockRows.data = [row('s9', 'w9')];
  await scheduler.syncWorkflow('w9');
  mockRows.data = [row('s1', 'w1', false)];
  expect(await scheduler.syncWorkflow('w1')).toBe(0);
  expect(scheduler.jobs.has('s9')).toBe(true);
});
