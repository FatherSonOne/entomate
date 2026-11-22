import { describe, expect, it } from 'vitest'
import {
  RECIPES, buildFromRecipe, cronWords, describe as describeWf, groupAutomations, groupRuns, latestRuns,
  orderedNodes, status, whenWords, type WorkflowRow,
} from '../services/automationsView'

const recap: WorkflowRow = {
  id: 'w1', name: 'Recap', active: true,
  nodes: [
    { id: 'slack', type: 'action', subtype: 'send_slack', config: { channel: '#sales' } },
    { id: 'trigger', type: 'trigger', subtype: 'meeting_processed', config: {} },
  ],
  connections: [{ sourceNodeId: 'trigger', targetNodeId: 'slack' }],
}

describe('describe', () => {
  it('puts meeting triggers first and orders steps from the trigger', () => {
    const d = describeWf(recap)
    expect(d.group).toBe('meeting')
    expect(d.steps).toEqual(['Meeting processed', 'Slack · #sales'])
    expect(d.note).toBeNull()
  })

  it('sends paused converted rows to the "before the merge" group', () => {
    const d = describeWf({
      id: 'w2', name: 'Meeting follow-up', active: false,
      settings: { migrated_from_automation: 'a1', migration_note: 'Converted' },
      nodes: [{ id: 'trigger', type: 'trigger', subtype: 'meeting_processed' }, { id: 't', type: 'action', subtype: 'create_task', config: { title: 'Follow up' } }],
      connections: [{ sourceNodeId: 'trigger', targetNodeId: 't' }],
    })
    expect(d.group).toBe('moved')
    expect(d.note).toBe('Converted')
    expect(d.steps[1]).toBe('Task · Follow up')
  })

  it('moves a converted row back to its trigger group once it is on', () => {
    const d = describeWf({ id: 'w3', name: 'x', active: true, settings: { migrated_from_automation: 'a' }, nodes: [{ id: 't', type: 'trigger', subtype: 'schedule', config: { cron: '0 9 * * 1-5' } }] })
    expect(d.group).toBe('other')
    expect(d.steps).toEqual(['Weekdays 09:00'])
  })

  it('flags old-format seed rows', () => {
    const d = describeWf({ id: 'w4', name: 'Old', active: false, nodes: [{ id: 'a', type: 'meeting_created' }, { id: 'b', type: 'send_slack' }] })
    expect(d.legacy).toBe(true)
    expect(d.group).toBe('moved')
    expect(d.steps).toEqual(['Meeting created', 'Slack · pick a channel'])
  })
})

describe('cronWords', () => {
  it('reads common shapes', () => {
    expect(cronWords('0 9 * * *')).toBe('Daily 09:00')
    expect(cronWords('30 8 * * 1')).toBe('Mon 08:30')
    expect(cronWords('*/5 * * * *')).toBe('*/5 * * * *')
  })
})

describe('orderedNodes', () => {
  it('appends unconnected nodes after the chain', () => {
    const out = orderedNodes(
      [{ id: 'x' }, { id: 't', type: 'trigger' }, { id: 'a' }],
      [{ source: 't', target: 'a' }],
    )
    expect(out.map((n) => n.id)).toEqual(['t', 'a', 'x'])
  })
})

describe('groups, runs and status', () => {
  const runs = [
    { id: 'r1', workflow_id: 'w1', status: 'completed', started_at: '2026-11-21T09:42:00Z', meeting_id: 'm1', meeting_title: 'Northwind' },
    { id: 'r2', workflow_id: 'w2', status: 'failed', started_at: '2026-11-21T09:42:05Z', meeting_id: 'm1', meeting_title: 'Northwind' },
    { id: 'r3', workflow_id: 'w1', status: 'completed', started_at: '2026-11-20T10:00:00Z', mode: 'test' },
  ]

  it('groups recent runs by meeting and ignores test runs', () => {
    const g = groupRuns(runs)
    expect(g).toHaveLength(1)
    expect(g[0]).toMatchObject({ title: 'Northwind', kind: 'meeting', meetingId: 'm1' })
    expect(g[0]?.runs.map((r) => r.id)).toEqual(['r1', 'r2'])
  })

  it('reads status from the latest real run', () => {
    const last = latestRuns(runs)
    const d = describeWf(recap)
    expect(status(d, last.get('w1'))).toEqual({ tone: 'mint', word: 'Sent' })
    expect(status({ ...d, active: false }, last.get('w1'))).toEqual({ tone: 'off', word: 'Paused' })
    expect(status(d, { id: 'x', workflow_id: 'w1', status: 'failed' })).toEqual({ tone: 'brand', word: 'Failed' })
    expect(status(d, null)).toEqual({ tone: 'mint', word: 'On' })
  })

  it('filters and counts groups', () => {
    const rows = [describeWf(recap), describeWf({ ...recap, id: 'w9', active: false })]
    expect(groupAutomations(rows, 'on')[0]?.items).toHaveLength(1)
    expect(groupAutomations(rows)[0]?.on).toBe(1)
  })

  it('formats times', () => {
    const now = new Date('2026-11-22T12:00:00')
    expect(whenWords('2026-11-22T09:05:00', now)).toBe('09:05')
    expect(whenWords('2026-11-20T10:58:00', now)).toBe('Fri 10:58')
    expect(whenWords(null, now)).toBe('—')
  })
})

describe('recipes', () => {
  it('fills the blank and switches the automation on', () => {
    const r = RECIPES.find((x) => x.id === 'recap-slack')!
    const built = buildFromRecipe(r, ' #sales ')
    expect(built.active).toBe(true)
    expect(built.nodes[1]?.config?.channel).toBe('#sales')
    expect(built.connections).toEqual([{ id: 'c1', sourceNodeId: 'trigger', sourceOutput: 'main', targetNodeId: 'slack', targetInput: 'main' }])
    expect(r.nodes[1]?.config?.channel).toBe('#meetings') // recipe itself untouched
  })

  it('lists meeting recipes first', () => {
    expect(RECIPES[0]?.group).toBe('meeting')
    expect(RECIPES.filter((r) => r.group === 'meeting').length).toBeGreaterThanOrEqual(4)
  })
})
