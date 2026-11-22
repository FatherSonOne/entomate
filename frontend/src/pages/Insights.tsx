import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api, { meetingsApi, projectsApi, reportsApi } from '../services/api'
import { useToast } from '../components/vc/ToastProvider'
import {
  Cell, Display, Drawer, Grid, Key, Readout, RuledTable, Section, Signal, Switch, Tag, TitleRule,
} from '../components/bench'
import type { RuledColumn } from '../components/bench'
import {
  EXPORTS, PERIODS, findExport, findOwner, isBehind, meterBars, ownerKey, ownerLabel, periodLabel,
  plural, rateLabel, readUrlState, shortDay, titleMeta, weekLabel, writeUrlState,
} from '../services/insightsView'
import type { ExportDef, ExportKind, InsightsData, OwnerRow, Period, WeekRow } from '../services/insightsView'

/**
 * Insights (route /analytics): is what we agree in meetings getting done, and who is behind?
 * Direction A "Bench" from the Insights Slate pass (2026-11-22). Replaces the old
 * five-tab Analytics page and the Reports page: exports live in the context column
 * and the Export drawer.
 */

interface Option { id: string; label: string }

/** The shared axios client (services/api.js). Its interceptor returns the response body. */
const http = api as unknown as { get: (url: string, config?: Record<string, unknown>) => Promise<unknown> }

interface ToastApi {
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
}

interface InsightsResponse { success: boolean; data: InsightsData }
interface MeetingsResponse { meetings?: Array<{ id: string; title?: string | null; created_at?: string | null }> }
interface ProjectsResponse { projects?: Array<{ id: string; name?: string | null }> }

const ACTION_STATUSES: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

async function runExport(kind: ExportKind, ids: { meeting: string; project: string; status: string }): Promise<void> {
  switch (kind) {
    case 'meeting-pdf': return reportsApi.downloadMeetingPDF(ids.meeting)
    case 'weekly-pdf': return reportsApi.downloadWeeklyPDF()
    case 'project-pdf': return reportsApi.downloadProjectPDF(ids.project)
    case 'meetings-csv': return reportsApi.downloadMeetingsCSV()
    case 'action-items-csv': return reportsApi.downloadActionItemsCSV(ids.status ? { status: ids.status } : {})
    case 'tasks-csv': return reportsApi.downloadTasksCSV({})
  }
}

function previewPath(kind: ExportKind, ids: { meeting: string; project: string }): string | null {
  if (kind === 'meeting-pdf') return ids.meeting ? `/reports/meeting/${ids.meeting}/pdf` : null
  if (kind === 'project-pdf') return ids.project ? `/reports/project/${ids.project}/pdf` : null
  if (kind === 'weekly-pdf') return '/reports/weekly/pdf'
  return null
}

export default function Insights(): React.ReactElement {
  const toast = useToast() as ToastApi
  const [params, setParams] = useSearchParams()
  const url = readUrlState(params)

  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const setUrl = useCallback((next: Parameters<typeof writeUrlState>[1]) => {
    setParams((prev) => writeUrlState(prev, next), { replace: true })
  }, [setParams])

  const load = useCallback(async (period: Period) => {
    setLoading(true)
    setError(null)
    try {
      const res = (await http.get('/analytics/insights', { params: { days: period } })) as InsightsResponse
      setData(res.data)
    } catch (err) {
      console.error('[Insights] load error:', err)
      setError('Insights could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load(url.period) }, [load, url.period])

  const owner = findOwner(data?.owners ?? [], url.owner)
  const openOwner = (row: OwnerRow): void => setUrl({ owner: ownerKey(row.name), exportKind: null })
  const openExport = (kind: ExportKind | ''): void => setUrl({ exportKind: kind, owner: null })

  const ft = data?.followThrough
  const bars = useMemo(() => meterBars(data?.weeks ?? []), [data])

  const ownerColumns: ReadonlyArray<RuledColumn<OwnerRow>> = [
    {
      key: 'owner',
      header: 'Owner',
      render: (o) => (
        <div className="bs-ins-owner">
          <span className="bs-ins-owner-name">{ownerLabel(o.name)}</span>
          <span className="bs-ins-bar" aria-hidden="true">
            <i data-tone={isBehind(o.onTimeRate) ? 'brand' : undefined} style={{ width: `${o.onTimeRate ?? 0}%` }} />
          </span>
        </div>
      ),
    },
    { key: 'open', header: 'Open', align: 'right', className: 'bs-num', render: (o) => o.open },
    { key: 'overdue', header: 'Overdue', align: 'right', className: 'bs-num', render: (o) => <span className={o.overdue ? 'bs-ins-late' : undefined}>{o.overdue}</span> },
    { key: 'done', header: 'Done', align: 'right', className: 'bs-num', secondary: true, render: (o) => o.done },
    { key: 'ontime', header: 'On time', align: 'right', className: 'bs-num', render: (o) => <span className={isBehind(o.onTimeRate) ? 'bs-ins-late' : undefined}>{rateLabel(o.onTimeRate)}</span> },
  ]

  const weekColumns: ReadonlyArray<RuledColumn<WeekRow>> = [
    {
      key: 'week',
      header: 'Week',
      className: 'bs-mono',
      render: (w) => <span className="bs-nowrap">{weekLabel(w.start, w.end)}{w.current && <> <Tag>Now</Tag></>}</span>,
    },
    { key: 'meetings', header: 'Meetings', align: 'right', className: 'bs-num', render: (w) => w.meetings },
    { key: 'decisions', header: 'Decisions', align: 'right', className: 'bs-num', render: (w) => w.decisions },
    { key: 'items', header: 'Items', align: 'right', className: 'bs-num', secondary: true, render: (w) => w.items },
    { key: 'done', header: 'Done', align: 'right', className: 'bs-num', secondary: true, render: (w) => w.done },
    { key: 'ontime', header: 'On time', align: 'right', className: 'bs-num', render: (w) => <span className={isBehind(w.onTimeRate) ? 'bs-ins-late' : undefined}>{rateLabel(w.onTimeRate)}</span> },
  ]

  const actions = (
    <>
      <Switch<Period> label="Period" options={PERIODS} value={url.period} onChange={(p) => setUrl({ period: p })} />
      <Key variant="primary" onClick={() => openExport('')}>Export</Key>
    </>
  )

  return (
    <div className="bs-ins">
      <TitleRule title="Insights" meta={titleMeta(data, url.period)} actions={actions} />

      {error && (
        <p className="bs-ins-error" role="alert">
          <Signal tone="brand">{error}</Signal> <Key size="sm" onClick={() => void load(url.period)}>Try again</Key>
        </p>
      )}

      <Grid>
        <Cell span={8} className="bs-ins-main">
          <Display className="bs-ins-disp" aria-label="Follow-through">
            <div className="bs-ins-disp-head">
              <Signal tone="live">Follow-through · {periodLabel(Number(url.period))}</Signal>
              <span className="bs-lbl">Done by the due date</span>
            </div>
            <div className="bs-ins-disp-main">
              <div>
                <div className="bs-disp-big">{loading && !data ? '··' : rateLabel(ft?.rate ?? null)}</div>
                <div className="bs-ins-disp-sub">
                  {ft && ft.due > 0
                    ? <>{ft.onTime} of {plural(ft.due, 'item')} due were done on time</>
                    : <>Nothing fell due in this period</>}
                  {data && data.overdue > 0 && <> · <span className="bs-ins-disp-late">{data.overdue} overdue now</span></>}
                </div>
              </div>
              {bars.length > 0 && (
                <div className="bs-ins-meter" role="img" aria-label={`Last ${bars.length} weeks, done on time: ${bars.map((b) => b.title).join('; ')}`}>
                  {bars.map((b) => (
                    <div key={b.key} className="bs-ins-meter-col" title={b.title}>
                      <span className="bs-ins-meter-track"><i data-tone={b.tone} style={{ height: `${b.height}%` }} /></span>
                      <span className="bs-ins-meter-lbl">{b.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Display>

          <section aria-labelledby="ins-owners">
            <Section number="01" id="ins-owners" title="Who owes what" aside="Open items by owner" />
            <RuledTable<OwnerRow>
              caption="Open and overdue action items by owner"
              columns={ownerColumns}
              rows={data?.owners ?? []}
              rowKey={(o) => ownerKey(o.name)}
              selectedKey={url.owner}
              onRowClick={openOwner}
              empty={loading ? 'Loading owners' : 'No action items yet. Owners appear here after your first meetings.'}
            />
          </section>

          <section aria-labelledby="ins-weeks">
            <Section number="02" id="ins-weeks" title="By week" aside="Newest first" />
            <RuledTable<WeekRow>
              caption="Meetings, decisions and follow-through by week"
              columns={weekColumns}
              rows={data?.weeks ?? []}
              rowKey={(w) => w.start}
              empty={loading ? 'Loading weeks' : 'No weeks yet.'}
            />
          </section>
        </Cell>

        <Cell span={4} rule className="bs-ins-side">
          <div className="bs-ins-ro">
            <Readout label="Meetings captured" value={data?.meetings ?? '—'} context={data ? plural(data.decisions, 'decision') : undefined} />
            <Readout
              label="Action items"
              value={data?.actionItems.created ?? '—'}
              context={data ? `${data.actionItems.done} done` : undefined}
            />
            <Readout
              label="Agent calls kept"
              value={<span className="bs-ins-ai">{rateLabel(data?.agents.rate ?? null)}</span>}
              context={data ? `${data.agents.kept} of ${plural(data.agents.calls, 'call')}` : undefined}
            />
          </div>

          <section aria-labelledby="ins-exports">
            <Section id="ins-exports" title="Exports" level={3} />
            <ul className="bs-rows">
              {EXPORTS.map((e) => (
                <li key={e.kind} className="bs-row bs-ins-export">
                  <span className="bs-row-text">
                    <span className="bs-ins-export-title">{e.title}</span>
                    <span className="bs-ins-export-desc">{e.desc}</span>
                  </span>
                  <Key size="sm" onClick={() => openExport(e.kind)} aria-label={`${e.title} ${e.format}`}>{e.format}</Key>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="ins-agents">
            <Section id="ins-agents" title="Agent calls" level={3} aside={periodLabel(Number(url.period))} />
            <ul className="bs-rows">
              {(data?.agents.byAgent ?? []).map((a) => (
                <li key={a.key} className="bs-row bs-ins-agent">
                  <span className="bs-row-text">
                    <span><b>{a.label}</b> <span className="bs-mut">· {a.agent}</span></span>
                    <span className="bs-lbl">{plural(a.calls, 'call')}</span>
                  </span>
                  {a.rate != null ? <Tag tone="ai">AI {a.rate}% kept</Tag> : <span className="bs-mut">—</span>}
                </li>
              ))}
            </ul>
            <p className="bs-ins-note bs-mut">Kept means nobody changed the agent's owner, due date or priority afterwards.</p>
          </section>
        </Cell>
      </Grid>

      <Drawer
        open={owner != null}
        onClose={() => setUrl({ owner: null })}
        label="Owner"
        footer={<Link to="/tasks?show=meetings" className="bs-key pri">Open in Tasks</Link>}
      >
        {owner && <OwnerDetail owner={owner} />}
      </Drawer>

      <ExportDrawer
        open={url.exportKind != null}
        kind={url.exportKind || null}
        onPick={(k) => setUrl({ exportKind: k })}
        onClose={() => setUrl({ exportKind: null })}
        toast={toast}
      />
    </div>
  )
}

function OwnerDetail({ owner }: { owner: OwnerRow }): React.ReactElement {
  return (
    <div className="bs-ins-dr">
      <h2 className="bs-h2">{ownerLabel(owner.name)}</h2>
      <p className="bs-sub bs-mono">
        {owner.open} open · {owner.overdue} overdue · {owner.done} done · {rateLabel(owner.onTimeRate)} on time
      </p>
      <Section title="Open" level={3} aside={owner.open > owner.items.length ? `${owner.items.length} of ${owner.open}` : String(owner.open)} />
      {owner.items.length === 0
        ? <p className="bs-mut">Nothing open.</p>
        : (
          <ul className="bs-rows">
            {owner.items.map((i) => (
              <li key={i.id} className="bs-row bs-ins-item">
                <span className="bs-row-text">
                  <span className="bs-ins-item-title">{i.text}</span>
                  {i.meeting && (
                    <Link to={`/meetings/${i.meeting.id}`} className="bs-ins-item-src">{i.meeting.title}</Link>
                  )}
                </span>
                <span className="bs-ins-item-side">
                  <Signal tone={i.overdue ? 'brand' : 'off'}>{i.overdue ? 'Late' : 'Open'}</Signal>
                  <span className="bs-mono bs-mut">{i.dueDate ? shortDay(i.dueDate) : 'No date'}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
    </div>
  )
}

interface ExportDrawerProps {
  open: boolean
  kind: ExportKind | null
  onPick: (kind: ExportKind | '') => void
  onClose: () => void
  toast: ToastApi
}

function ExportDrawer({ open, kind, onPick, onClose, toast }: ExportDrawerProps): React.ReactElement {
  const def: ExportDef | null = findExport(kind)
  const [meetings, setMeetings] = useState<Option[] | null>(null)
  const [projects, setProjects] = useState<Option[] | null>(null)
  const [meeting, setMeeting] = useState<string>('')
  const [project, setProject] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [busy, setBusy] = useState<'download' | 'preview' | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Load pickers the first time a report needs them.
  useEffect(() => {
    if (!open || !def?.needs) return
    if (def.needs === 'meeting' && meetings == null) {
      meetingsApi.list({ limit: 50 })
        .then((r: unknown) => {
          const list = (r as MeetingsResponse).meetings ?? []
          setMeetings(list.map((m) => ({ id: m.id, label: `${m.title || 'Untitled meeting'}${m.created_at ? ` · ${shortDay(m.created_at)}` : ''}` })))
        })
        .catch(() => setMeetings([]))
    }
    if (def.needs === 'project' && projects == null) {
      projectsApi.list({ limit: 100 })
        .then((r: unknown) => setProjects(((r as ProjectsResponse).projects ?? []).map((p) => ({ id: p.id, label: p.name || 'Untitled project' }))))
        .catch(() => setProjects([]))
    }
  }, [open, def, meetings, projects])

  // Drop the preview when the report changes or the drawer closes.
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])
  useEffect(() => { setPreviewUrl(null) }, [kind, meeting, project, open])

  const missing = def?.needs === 'meeting' ? !meeting : def?.needs === 'project' ? !project : false
  const ids = { meeting, project, status }

  const download = async (): Promise<void> => {
    if (!def || missing) return
    setBusy('download')
    try {
      await runExport(def.kind, ids)
      toast.success('Downloaded', `${def.title} ${def.format}`)
    } catch (err) {
      console.error('[Insights] export error:', err)
      toast.error('Error', 'The file could not be made. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const preview = async (): Promise<void> => {
    if (!def) return
    const path = previewPath(def.kind, ids)
    if (!path) return
    setBusy('preview')
    try {
      const blob = (await http.get(path, { responseType: 'blob' })) as Blob
      setPreviewUrl(URL.createObjectURL(new Blob([blob], { type: 'application/pdf' })))
    } catch (err) {
      console.error('[Insights] preview error:', err)
      toast.error('Error', 'The preview could not be loaded.')
    } finally {
      setBusy(null)
    }
  }

  const options = def?.needs === 'meeting' ? meetings : def?.needs === 'project' ? projects : null

  return (
    <Drawer
      open={open}
      onClose={onClose}
      label="Export"
      footer={def ? (
        <>
          {def.format === 'PDF' && (
            <Key onClick={() => void preview()} disabled={busy !== null || missing}>{busy === 'preview' ? 'Loading' : 'Preview'}</Key>
          )}
          <Key variant="primary" onClick={() => void download()} disabled={busy !== null || missing}>
            {busy === 'download' ? 'Preparing' : `Download ${def.format}`}
          </Key>
        </>
      ) : undefined}
    >
      <div className="bs-ins-dr">
        <ul className="bs-rows" role="radiogroup" aria-label="Report">
          {EXPORTS.map((e) => (
            <li key={e.kind} className="bs-row bs-ins-pick">
              <button type="button" role="radio" aria-checked={kind === e.kind} className="bs-ins-pick-btn" onClick={() => onPick(e.kind)}>
                <span className="bs-row-text">
                  <span className="bs-ins-export-title">{e.title}</span>
                  <span className="bs-ins-export-desc">{e.desc}</span>
                </span>
                <span className="bs-lbl">{e.format}</span>
              </button>
            </li>
          ))}
        </ul>

        {def?.needs && (
          <label className="bs-ins-field">
            <span className="bs-lbl">{def.needs === 'meeting' ? 'Meeting' : 'Project'}</span>
            <select
              className="bs-input"
              value={def.needs === 'meeting' ? meeting : project}
              onChange={(e) => (def.needs === 'meeting' ? setMeeting(e.target.value) : setProject(e.target.value))}
            >
              <option value="">{options == null ? 'Loading' : options.length ? `Choose a ${def.needs}` : `No ${def.needs}s yet`}</option>
              {(options ?? []).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
        )}

        {def?.kind === 'action-items-csv' && (
          <label className="bs-ins-field">
            <span className="bs-lbl">Status</span>
            <select className="bs-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {ACTION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
        )}

        {previewUrl && (
          <iframe className="bs-ins-preview" src={previewUrl} title={`${def?.title ?? 'Report'} preview`} />
        )}
        {!def && <p className="bs-mut bs-ins-note">Pick a report. PDFs can be previewed here first.</p>}
      </div>
    </Drawer>
  )
}
