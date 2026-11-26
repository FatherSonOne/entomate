import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { settingsApi, workflowsApi } from '../services/api'
import cache from '../services/apiCache'
import { useOrg } from '../contexts/OrgContext'
import {
  Cell, Drawer, GroupHead, Grid, Key, Section, Signal, Switch, TextInput, TitleRule, Toggle,
} from '../components/bench'
import { useConfirm } from '../components/vc/ConfirmDialog'
import { useToast } from '../components/vc/ToastProvider'
import ErrorState from '../components/vc/ErrorState'
import {
  RECIPES, buildFromRecipe, describe, editableField, groupAutomations, groupRuns, latestRuns, orderedNodes,
  runSignal, status, stepWords, triggerWords, whenWords,
} from '../services/automationsView'

/**
 * 05 Automations (Bench Swiss, direction A · Recipes). One module for what
 * used to be Automations, Workflows and AI Agents: automations are workflows
 * on the workflow engine, grouped with meeting-end recipes first. A row opens
 * a drawer to fill in the blanks, test on the last meeting, or open the full
 * builder (/workflows/:id). Meeting agents are tuned in Settings.
 * View logic lives in services/automationsView.ts.
 */

const SHOW_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Paused' },
]
const AGENT_ROWS = [
  { key: 'assignment', name: 'Owner', what: 'Assigns unowned items to someone in the meeting' },
  { key: 'priority', name: 'Priority', what: 'Raises or lowers priority' },
  { key: 'deadline', name: 'Deadline', what: 'Fills a due date when none was said' },
]

function fresh() {
  cache.invalidate('/workflows')
}

function Steps({ steps }) {
  return (
    <span className="bs-auto-chain">
      {steps.map((s, i) => (
        <React.Fragment key={`${i}-${s}`}>
          {i > 0 && <span className="bs-auto-ar" aria-hidden="true">→</span>}
          <span>{s}</span>
        </React.Fragment>
      ))}
    </span>
  )
}

export default function Automations() {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const { org } = useOrg()
  const [params, setParams] = useSearchParams()
  const show = ['on', 'off'].includes(params.get('show')) ? params.get('show') : 'all'
  const openId = params.get('a') || null
  const recipesOpen = params.get('new') === '1'

  const [rows, setRows] = useState([])
  const [runs, setRuns] = useState([])
  const [agents, setAgents] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)

  const setParam = useCallback((key, value) => {
    setParams((p) => {
      const next = new URLSearchParams(p)
      if (value === null || value === undefined || value === '') next.delete(key)
      else next.set(key, value)
      return next
    }, { replace: true })
  }, [setParams])

  const load = useCallback(async () => {
    try {
      setError(null)
      const [list, recent] = await Promise.all([
        workflowsApi.list({ template: false, limit: 100 }),
        workflowsApi.recentRuns(30).catch(() => ({ data: [] })),
      ])
      setRows(Array.isArray(list?.data) ? list.data : [])
      setRuns(Array.isArray(recent?.data) ? recent.data : [])
    } catch (err) {
      setError(err.message || 'Could not load automations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!org?.id) return
    settingsApi.getMeetingAgents(org.id).then((res) => setAgents(res.settings || null)).catch(() => setAgents(null))
  }, [org?.id])

  const described = useMemo(() => rows.map(describe), [rows])
  const last = useMemo(() => latestRuns(runs), [runs])
  const groups = useMemo(() => groupAutomations(described, show), [described, show])
  const runGroups = useMemo(() => groupRuns(runs, 4), [runs])
  const onCount = described.filter((d) => d.active).length
  const newest = runs.find((r) => r.mode !== 'test')

  const toggle = async (d, active) => {
    setBusy(d.id)
    setRows((rs) => rs.map((r) => (r.id === d.id ? { ...r, active } : r)))
    try {
      await workflowsApi.toggle(d.id, active)
      fresh()
      toast?.success?.(active ? `On: ${d.name}` : `Paused: ${d.name}`)
    } catch (err) {
      setRows((rs) => rs.map((r) => (r.id === d.id ? { ...r, active: !active } : r)))
      toast?.error?.(err.message || 'Could not change it')
    } finally {
      setBusy(null)
    }
  }

  const newBlank = () => navigate('/workflows/new')

  const unavailable = Boolean(error && rows.length === 0)

  const meta = (
    <>
      <b>{onCount} on</b> · {described.length - onCount} paused
      {newest ? <> · last run {whenWords(newest.started_at)}</> : null}
    </>
  )

  return (
    <div className="bs-auto">
      <TitleRule
        title="Automations"
        meta={meta}
        actions={(
          <>
            <Key onClick={() => setParam('new', '1')}>Browse recipes</Key>
            <Key variant="primary" onClick={newBlank}>New automation</Key>
          </>
        )}
      />

      <Grid>
        <Cell span={8} className="bs-auto-main">
          <div className="bs-auto-fbar">
            <Switch label="Show" options={SHOW_OPTIONS} value={show} onChange={(v) => setParam('show', v === 'all' ? null : v)} />
          </div>

          {unavailable && <ErrorState message={error} onRetry={load} />}
          {loading && <p className="bs-auto-empty">Loading…</p>}

          {!unavailable && !loading && described.length === 0 && (
            <div className="bs-auto-empty">
              <p>No automations yet. Start with a meeting recipe: it runs every time a meeting is processed.</p>
              <Key onClick={() => setParam('new', '1')}>Browse recipes</Key>
            </div>
          )}

          {!loading && described.length > 0 && groups.length === 0 && (
            <p className="bs-auto-empty">Nothing {show === 'on' ? 'switched on' : 'paused'}.</p>
          )}

          {groups.map((g) => (
            <section key={g.id} className="bs-auto-grp" aria-label={g.title}>
              <GroupHead label={g.title} count={`${g.on} on · ${g.items.length}`} />
              {g.note && <p className="bs-auto-note">{g.note}</p>}
              <ul className="bs-auto-list">
                <li className="bs-auto-row head bs-dt" aria-hidden="true">
                  <span className="bs-lbl">On</span>
                  <span className="bs-lbl">Automation</span>
                  <span className="bs-lbl">Last run</span>
                  <span className="bs-lbl">Time</span>
                </li>
                {g.items.map((d) => {
                  const lr = last.get(d.id)
                  const sig = status(d, lr)
                  return (
                    <li
                      key={d.id}
                      className={`bs-auto-row${d.active ? '' : ' off'}${openId === d.id ? ' sel' : ''}`}
                      onClick={() => setParam('a', d.id)}
                    >
                      <Toggle
                        checked={d.active}
                        disabled={busy === d.id || d.legacy}
                        label={`${d.active ? 'Turn off' : 'Turn on'}: ${d.name}`}
                        onChange={(v) => toggle(d, v)}
                      />
                      <div className="bs-auto-body">
                        <button type="button" className="bs-auto-title" onClick={(e) => { e.stopPropagation(); setParam('a', d.id) }}>
                          {d.name}
                        </button>
                        <Steps steps={d.steps} />
                        {sig.word === 'Failed' && lr?.error_message && (
                          <span className="bs-why"><Signal tone="brand">Last run failed</Signal>{lr.error_message}</span>
                        )}
                        {d.note && <span className="bs-why bs-auto-why">{d.note}</span>}
                      </div>
                      <Signal tone={sig.tone}>{sig.word}</Signal>
                      <span className="bs-auto-time bs-dt">{whenWords(lr?.started_at || null)}</span>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </Cell>

        {!unavailable && <Cell span={4} rule className="bs-auto-ctx">
          <Section level={3} title="Recent runs" aside={<span className="bs-lbl">{runs.filter((r) => r.mode !== 'test').length} latest</span>} />
          {runGroups.length === 0 && (
            <p className="bs-auto-empty">Nothing has run yet. Runs show here after the next meeting is processed.</p>
          )}
          <ul className="bs-auto-runs">
            {runGroups.map((g) => (
              <li key={g.key} className="bs-auto-run">
                <span className="bs-auto-run-t">{whenWords(g.at)}</span>
                <div className="bs-auto-run-b">
                  {g.meetingId
                    ? <Link to={`/meetings/${g.meetingId}`} className="bs-auto-run-m">{g.title}</Link>
                    : <span className="bs-auto-run-m">{g.title}</span>}
                  <ul className="bs-auto-run-list">
                    {g.runs.map((r) => {
                      const s = runSignal(r)
                      return (
                        <li key={r.id}>
                          <Signal tone={s.tone}>{s.word}</Signal>
                          <span>{g.meetingId ? r.workflow_name : (r.error_message || r.workflow_name)}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </li>
            ))}
          </ul>

          <div className="bs-auto-ctx-sec">
            <Section
              level={3}
              title="Meeting agents"
              aside={<Key size="sm" onClick={() => navigate('/settings', { state: { section: 'meeting-agents' } })}>Settings</Key>}
            />
            <ul className="bs-auto-agents">
              {AGENT_ROWS.map((a) => {
                const cfg = agents?.[a.key]
                const on = cfg ? cfg.enabled : true
                const bar = cfg?.minConfidence
                return (
                  <li key={a.key} className="bs-auto-agent">
                    <div>
                      <b>{a.name}</b>
                      <span className="bs-auto-agent-w">{a.what}</span>
                    </div>
                    <Signal tone={on ? 'ai' : 'off'}>{on ? (bar ? `On · ${Math.round(bar * 100)}%` : 'On') : 'Off'}</Signal>
                  </li>
                )
              })}
              <li className="bs-auto-agent">
                <div>
                  <b>Follow-up</b>
                  <span className="bs-auto-agent-w">Spots promises with no action item</span>
                </div>
                <Signal tone="off">As a step</Signal>
              </li>
            </ul>
            <p className="bs-auto-fold">Branching, webhooks and AI steps open in the builder from any automation.</p>
          </div>
        </Cell>}
      </Grid>

      <AutomationDrawer
        row={rows.find((r) => r.id === openId) || null}
        open={Boolean(openId)}
        onClose={() => setParam('a', null)}
        onToggle={toggle}
        onSaved={(updated) => { setRows((rs) => rs.map((r) => (r.id === updated.id ? { ...r, ...updated } : r))); fresh() }}
        onDeleted={(id) => { setRows((rs) => rs.filter((r) => r.id !== id)); setParam('a', null); fresh() }}
        confirm={confirm}
        toast={toast}
      />

      <RecipesDrawer
        open={recipesOpen}
        onClose={() => setParam('new', null)}
        onCreated={(row) => { setRows((rs) => [row, ...rs]); fresh(); setParam('new', null) }}
        onBlank={() => { setParam('new', null); newBlank() }}
        toast={toast}
      />
    </div>
  )
}

/* ── Automation drawer: fill in the blanks, test, open in builder ── */

function AutomationDrawer({ row, open, onClose, onToggle, onSaved, onDeleted, confirm, toast }) {
  const navigate = useNavigate()
  const [nodes, setNodes] = useState([])
  const [name, setName] = useState('')
  const [runs, setRuns] = useState([])
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [test, setTest] = useState(null)

  useEffect(() => {
    if (!row) return
    setNodes(Array.isArray(row.nodes) ? row.nodes.map((n) => ({ ...n, config: { ...(n.config || {}) } })) : [])
    setName(row.name || '')
    setTest(null)
    let live = true
    workflowsApi.getExecutions(row.id, { limit: 5 })
      .then((res) => { if (live) setRuns(Array.isArray(res?.data) ? res.data : []) })
      .catch(() => { if (live) setRuns([]) })
    return () => { live = false }
  }, [row?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!row) return <Drawer open={false} onClose={onClose} label="Automation"><span /></Drawer>

  const d = describe(row)
  const ordered = d.legacy ? nodes : orderedNodes(nodes, Array.isArray(row.connections) ? row.connections : [])
  const dirty = name.trim() !== (row.name || '') || JSON.stringify(nodes) !== JSON.stringify(row.nodes || [])
  const lastRun = runs.find((r) => r.mode !== 'test')
  const sig = status(d, lastRun ? { ...lastRun, workflow_id: row.id } : null)

  const setField = (id, field, value) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, config: { ...(n.config || {}), [field]: value } } : n)))
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await workflowsApi.update(row.id, {
        name: name.trim() || row.name,
        description: row.description,
        nodes,
        connections: row.connections || [],
        settings: row.settings || {},
      })
      onSaved(res.data || { id: row.id, name: name.trim(), nodes })
      toast?.success?.('Saved')
    } catch (err) {
      toast?.error?.(err.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const runTest = async () => {
    setTesting(true)
    setTest(null)
    try {
      const res = await workflowsApi.test(row.id, {}, { lastMeeting: true })
      setTest(res)
    } catch (err) {
      setTest({ success: false, error: err.message })
    } finally {
      setTesting(false)
    }
  }

  const remove = async () => {
    const ok = await confirm?.({ title: 'Delete this automation?', message: `“${row.name}” and its run history will be removed.`, confirmLabel: 'Delete', variant: 'danger' })
    if (!ok) return
    try {
      await workflowsApi.delete(row.id)
      onDeleted(row.id)
      toast?.success?.('Deleted')
    } catch (err) {
      toast?.error?.(err.message || 'Could not delete')
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      label="Automation"
      footer={(
        <div className="bs-auto-keys">
          <Key onClick={runTest} disabled={testing || d.legacy || nodes.length < 2}>{testing ? 'Testing…' : 'Test on last meeting'}</Key>
          <Key onClick={() => navigate(`/workflows/${row.id}`)}>Open in builder</Key>
          <Key variant="primary" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</Key>
        </div>
      )}
    >
      <div className="bs-auto-dhead">
        <Signal tone={sig.tone}>{sig.word}</Signal>
        <Toggle checked={d.active} disabled={d.legacy} label={`${d.active ? 'Turn off' : 'Turn on'}: ${d.name}`} onChange={(v) => onToggle(d, v)} />
      </div>
      <label className="bs-auto-name">
        <span className="bs-lbl">Name</span>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} aria-label="Automation name" />
      </label>
      {d.note && <p className="bs-auto-note">{d.note}</p>}

      <ol className="bs-auto-steps">
        {ordered.map((n, i) => {
          const isTrig = i === 0 && (d.legacy || n.type === 'trigger')
          const edit = d.legacy ? null : editableField(n)
          return (
            <li key={n.id} className="bs-auto-step">
              <span className={`bs-auto-w${isTrig ? ' when' : ''}`}>{isTrig ? 'When' : 'Then'}</span>
              <div className="bs-auto-sb">
                <b>{isTrig ? triggerWords(n) : stepWords(n)}</b>
                {edit && (
                  <label className="bs-auto-field">
                    <span className="bs-lbl">{edit.label}</span>
                    <TextInput
                      value={String(n.config?.[edit.field] ?? '')}
                      onChange={(e) => setField(n.id, edit.field, e.target.value)}
                      aria-label={edit.label}
                    />
                  </label>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {test && (
        <div className="bs-auto-test" role="status">
          <Signal tone={test.success ? 'mint' : 'brand'}>{test.success ? 'Test passed' : 'Test failed'}</Signal>
          <p>
            {test.success
              ? 'Every step ran on the newest meeting. Steps that send or write were skipped, so nothing went out.'
              : (test.error || 'A step failed.')}
          </p>
        </div>
      )}
      {!test && <p className="bs-auto-fold">A test runs every step on your newest meeting but sends nothing.</p>}

      <div className="bs-auto-dsec">
        <Section level={3} title="Runs" aside={<span className="bs-lbl">{row.execution_count || 0} total</span>} />
        {runs.length === 0 && <p className="bs-auto-empty">No runs yet.</p>}
        <ul className="bs-auto-runs">
          {runs.map((r) => {
            const s = runSignal(r)
            return (
              <li key={r.id} className="bs-auto-run">
                <span className="bs-auto-run-t">{whenWords(r.started_at)}</span>
                <div className="bs-auto-run-b">
                  <Signal tone={s.tone}>{r.mode === 'test' ? `Test · ${s.word}` : s.word}</Signal>
                  {r.error_message && <span className="bs-auto-agent-w">{r.error_message}</span>}
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="bs-auto-dsec">
        <Key size="sm" onClick={remove}>Delete automation</Key>
      </div>
    </Drawer>
  )
}

/* ── Recipes drawer: switch on a meeting recipe in one step ── */

function RecipesDrawer({ open, onClose, onCreated, onBlank, toast }) {
  const [picked, setPicked] = useState(null)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (!open) { setPicked(null); setValue('') } }, [open])

  const choose = (r) => {
    setPicked(r.id)
    setValue('')
  }

  const create = async (r) => {
    if (r.blank && !value.trim()) return
    setSaving(true)
    try {
      const res = await workflowsApi.create(buildFromRecipe(r, r.blank ? value : undefined))
      onCreated(res.data)
      toast?.success?.(`On: ${r.name}`)
    } catch (err) {
      toast?.error?.(err.message || 'Could not create it')
    } finally {
      setSaving(false)
    }
  }

  const meeting = RECIPES.filter((r) => r.group === 'meeting')
  const other = RECIPES.filter((r) => r.group !== 'meeting')

  const row = (r) => {
    const isPicked = picked === r.id
    return (
      <li key={r.id} className={`bs-auto-tpl${isPicked ? ' sel' : ''}`}>
        <div className="bs-auto-tpl-b">
          <b>{r.name}</b>
          <span className="bs-auto-agent-w">{r.description}</span>
          {isPicked && r.blank && (
            <label className="bs-auto-field">
              <span className="bs-lbl">{r.blank.label}</span>
              <TextInput
                autoFocus
                value={value}
                placeholder={r.blank.placeholder}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') create(r) }}
                aria-label={r.blank.label}
              />
            </label>
          )}
        </div>
        {isPicked
          ? <Key size="sm" variant="primary" disabled={saving || (r.blank && !value.trim())} onClick={() => create(r)}>{saving ? 'Saving…' : 'Turn on'}</Key>
          : <Key size="sm" onClick={() => (r.blank ? choose(r) : create(r))}>Use</Key>}
      </li>
    )
  }

  return (
    <Drawer open={open} onClose={onClose} label="Recipes">
      <GroupHead label="After a meeting" count={meeting.length} />
      <ul className="bs-auto-tpls">{meeting.map(row)}</ul>
      <GroupHead label="On a schedule" count={other.length} />
      <ul className="bs-auto-tpls">{other.map(row)}</ul>
      <div className="bs-auto-dsec">
        <Key onClick={onBlank}>Blank in the builder</Key>
      </div>
      <p className="bs-auto-fold">A recipe turns on as soon as you add it. CRM recipes return when your workspace connects its own CRM.</p>
    </Drawer>
  )
}
