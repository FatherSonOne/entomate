/**
 * Workflow test runs are dry: side-effect steps are skipped, read-only steps run.
 */

'use strict';

jest.mock('../../config/supabase', () => ({ supabase: null, supabaseAdmin: null, supabaseAnon: null }));
jest.mock('../../utils/log', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const WorkflowExecutor = require('../workflow/WorkflowExecutor');
const { isSideEffectNode } = WorkflowExecutor;

function makeExecutor(handlers) {
  const executor = new WorkflowExecutor();
  executor.nodeRegistry = {
    getHandler: (type, subtype) => handlers[`${type}/${subtype}`] || null
  };
  return executor;
}

const workflow = {
  id: 'wf1',
  name: 'Recap to Slack',
  nodes: [
    { id: 'n1', type: 'trigger', subtype: 'manual', config: {} },
    { id: 'n2', type: 'data', subtype: 'set', config: {} },
    { id: 'n3', type: 'action', subtype: 'send_slack', config: { channel: '#team' } },
    { id: 'n4', type: 'data', subtype: 'transform', config: {} }
  ],
  connections: [
    { sourceNodeId: 'n1', targetNodeId: 'n2', sourceOutput: 'main' },
    { sourceNodeId: 'n2', targetNodeId: 'n3', sourceOutput: 'main' },
    { sourceNodeId: 'n3', targetNodeId: 'n4', sourceOutput: 'main' }
  ]
};

function handlers() {
  return {
    'trigger/manual': { execute: jest.fn(async (c, input) => ({ output: 'main', data: input })) },
    'data/set': { execute: jest.fn(async (c, input) => ({ output: 'main', data: { ...input, title: 'Kickoff' } })) },
    'action/send_slack': { execute: jest.fn(async () => ({ output: 'main', data: { sent: true } })) },
    'data/transform': { execute: jest.fn(async (c, input) => ({ output: 'main', data: input })) }
  };
}

describe('isSideEffectNode', () => {
  it.each([
    ['action', 'send_slack'], ['action', 'send_email'], ['action', 'http_request'], ['action', 'create_task'],
    ['action', 'sync_crm'], ['action', 'send_pulse'], ['action', 'execute_workflow'],
    ['crm', 'create_deal'], ['crm', 'update_contact'], ['crm', 'assign_owner'],
    ['rag', 'vector_store'], ['rag', 'document_loader']
  ])('%s/%s is a side effect', (type, subtype) => {
    expect(isSideEffectNode({ type, subtype })).toBe(true);
  });

  it.each([
    ['data', 'set'], ['logic', 'if'], ['ai', 'ai_prompt'], ['crm', 'lookup_contact'], ['rag', 'vector_search'], ['trigger', 'manual']
  ])('%s/%s is read-only', (type, subtype) => {
    expect(isSideEffectNode({ type, subtype })).toBe(false);
  });

  it('treats the AI agent step as a side effect only when it auto-applies', () => {
    expect(isSideEffectNode({ type: 'ai', subtype: 'ai_agent', config: { autoApply: true } })).toBe(true);
    expect(isSideEffectNode({ type: 'ai', subtype: 'ai_agent', config: {} })).toBe(false);
  });
});

describe('WorkflowExecutor test runs', () => {
  it('skips the Slack step, runs the rest, and records the skip in the trace', async () => {
    const h = handlers();
    const result = await makeExecutor(h).test(workflow, { meeting_id: 'm1' });

    expect(result.success).toBe(true);
    expect(h['action/send_slack'].execute).not.toHaveBeenCalled();
    expect(h['data/set'].execute).toHaveBeenCalled();
    expect(h['data/transform'].execute).toHaveBeenCalled();

    const slackStep = result.nodeExecutions.find(n => n.nodeId === 'n3');
    expect(slackStep.status).toBe('skipped');
    expect(slackStep.dryRun).toBe(true);

    // downstream gets the input passed through, tagged as a dry run
    const [, transformInput] = h['data/transform'].execute.mock.calls[0];
    expect(transformInput).toMatchObject({ meeting_id: 'm1', title: 'Kickoff', _dryRun: { skipped: true, step: 'action/send_slack' } });
  });

  it('still performs side effects in a production run', async () => {
    const h = handlers();
    const result = await makeExecutor(h).execute(workflow, { meeting_id: 'm1' });
    expect(result.success).toBe(true);
    expect(h['action/send_slack'].execute).toHaveBeenCalledTimes(1);
  });

  it('skips side effects when testing a single node', async () => {
    const h = handlers();
    const result = await makeExecutor(h).testNode(workflow, 'n3', { a: 1 });
    expect(result.success).toBe(true);
    expect(h['action/send_slack'].execute).not.toHaveBeenCalled();
    expect(result.output._dryRun.skipped).toBe(true);
  });
});
