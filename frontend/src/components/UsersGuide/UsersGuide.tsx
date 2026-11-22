import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import {
  CATEGORIES, GUIDE_CHANGES, SHORTCUTS, guideSections, guideUpdated, guideVersion,
} from './guideData'
import type { GuideSection, GuideShortcut } from './guideData'
import { markGuideSeen, readSeenVersion } from './useGuideNewFeatures'
import { GUIDE_SHOTS } from './guideShots'
import {
  Cell, Drawer, GroupHead, Grid, Key, PHONE_QUERY, Section, Signal, TextInput, TitleRule, useMediaQuery,
} from '../bench'
import {
  SECTION_LINKS, buildContents, chapterKey, changedSince, eyebrow, findEntry, flatten, highlight, prevNext,
  readUrlState, searchGuide, shortDate, writeUrlState,
} from '../../services/guideView'
import type { ContentsEntry, ContentsGroup, GuideHit, GuideUrlState } from '../../services/guideView'

/**
 * User Guide (route /guide). Direction A "Manual" from the User Guide Slate pass
 * (2026-11-22): the section you are reading (8) beside the contents (4), grouped
 * like the app nav. Subsections are always open. On phone the contents open as a
 * sheet. What's new is one dated list. State lives in the URL (?s=, ?q=, ?new=1).
 */

interface OutletCtx { openAssistant?: () => void }

const SearchIcon = (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <circle cx="7" cy="7" r="4.5" /><path d="M10.4 10.4L14 14" />
  </svg>
)

/** Text with the query marked. */
function Hl({ text, q }: { text: string; q: string }): React.ReactElement {
  return (
    <>
      {highlight(text, q).map((p, i) => (p.hit ? <mark key={i} className="bs-hit">{p.text}</mark> : <React.Fragment key={i}>{p.text}</React.Fragment>))}
    </>
  )
}

const hasHit = (text: string, q: string): boolean => !!q.trim() && text.toLowerCase().includes(q.trim().toLowerCase())

function Steps({ items, q }: { items: ReadonlyArray<string>; q: string }): React.ReactElement {
  return (
    <ol className="bs-guide-steps">
      {items.map((t, i) => <li key={i} className={hasHit(t, q) ? 'is-hit' : undefined}><span><Hl text={t} q={q} /></span></li>)}
    </ol>
  )
}

/**
 * A screenshot of the real app (seeded qntmecos workspace). Both themes ship;
 * CSS shows the one matching html.dark. Missing ids render nothing.
 */
function GuideFigure({ id }: { id: string }): React.ReactElement | null {
  const shot = GUIDE_SHOTS[id]
  if (!shot) return null
  return (
    <figure className="bs-guide-fig">
      <div className="bs-guide-shot">
        <img className="is-light" src={`/guide/${id}-light.webp`} alt={shot.alt} loading="lazy" decoding="async" width={shot.w} height={shot.h} />
        <img className="is-dark" src={`/guide/${id}-dark.webp`} alt="" aria-hidden="true" loading="lazy" decoding="async" width={shot.w} height={shot.h} />
      </div>
      <figcaption>{shot.caption}</figcaption>
    </figure>
  )
}

export function KeyMap({ items }: { items: ReadonlyArray<GuideShortcut> }): React.ReactElement {
  return (
    <dl className="bs-guide-keymap">
      {items.map((s) => (
        <React.Fragment key={s.keys.join('+') + s.label}>
          <dt>{s.keys.map((k) => <kbd key={k}>{k}</kbd>)}</dt>
          <dd>{s.label}</dd>
        </React.Fragment>
      ))}
    </dl>
  )
}

function Reader({ entry, q, updated, groups, onGo }: {
  entry: ContentsEntry
  q: string
  updated: boolean
  groups: ReadonlyArray<ContentsGroup>
  onGo: (id: string) => void
}): React.ReactElement {
  const s: GuideSection = entry.section
  const href = SECTION_LINKS[s.id]
  const { prev, next } = prevNext(groups, s.id)
  const [copied, setCopied] = useState(false)
  const copyLink = (): void => {
    const url = `${window.location.origin}/guide?s=${encodeURIComponent(s.id)}`
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }).catch(() => { /* clipboard refused */ })
  }
  return (
    <article aria-labelledby="guide-section-title" data-chapter={chapterKey(entry.group)}>
      <header className="bs-guide-head">
      <span className="bs-guide-bar" aria-hidden="true" />
      <div className="bs-guide-eyebrow">
        <span className="bs-guide-chip">{eyebrow(entry)}</span>
        {updated && <Signal tone="ai">Updated</Signal>}
      </div>
      <h2 id="guide-section-title" className="bs-guide-h"><Hl text={s.title} q={q} /></h2>
      <p className="bs-guide-sum"><Hl text={s.summary} q={q} /></p>
      <div className="bs-guide-acts">
        {href && <Link to={href} className="bs-key pri">Open {s.title} →</Link>}
        <Key size="sm" onClick={copyLink}>{copied ? 'Copied' : 'Copy link'}</Key>
      </div>
      </header>
      <GuideFigure id={s.id} />

      {s.id === 'keyboard-shortcuts' && (
        <div className="bs-guide-blk">
          <Section level={3} title="Shortcuts" aside={`${SHORTCUTS.length} keys`} />
          <KeyMap items={SHORTCUTS} />
        </div>
      )}
      {(s.steps?.length ?? 0) > 0 && (
        <div className="bs-guide-blk">
          <Section level={3} title="Steps" />
          <Steps items={s.steps ?? []} q={q} />
        </div>
      )}
      {(s.subsections ?? []).map((sub) => (
        <div key={sub.id} className="bs-guide-blk" id={`guide-${sub.id}`}>
          <Section level={3} title={<Hl text={sub.title} q={q} />} />
          {sub.description && <p className="bs-guide-desc">{sub.description}</p>}
          <GuideFigure id={sub.id} />
          <Steps items={sub.steps} q={q} />
          {sub.note && <p className="bs-guide-note"><span className="bs-lbl">Note</span><span><Hl text={sub.note} q={q} /></span></p>}
        </div>
      ))}
      {(s.useCases?.length ?? 0) > 0 && (
        <div className="bs-guide-blk">
          <Section level={3} title="Questions" aside={String(s.useCases?.length ?? 0)} />
          {(s.useCases ?? []).map((uc) => (
            <div key={uc.id} id={`guide-q-${uc.id}`} className="bs-guide-q">
              <p className="bs-guide-qt"><Hl text={uc.title} q={q} /></p>
              <Steps items={uc.steps} q={q} />
            </div>
          ))}
        </div>
      )}
      {(s.tips?.length ?? 0) > 0 && (
        <div className="bs-guide-blk bs-guide-tip">
          <p className="bs-lbl">Good to know</p>
          <ul className="bs-guide-bul">
            {(s.tips ?? []).map((t, i) => <li key={i} className={hasHit(t, q) ? 'is-hit' : undefined}><span><Hl text={t} q={q} /></span></li>)}
          </ul>
        </div>
      )}

      <nav className="bs-guide-pn" aria-label="Previous and next section">
        {prev ? <button type="button" onClick={() => onGo(prev.id)}><span className="bs-lbl">← Previous</span><b>{prev.section.title}</b></button> : <span />}
        {next ? <button type="button" className="is-next" onClick={() => onGo(next.id)}><span className="bs-lbl">Next →</span><b>{next.section.title}</b></button> : <span />}
      </nav>
    </article>
  )
}

function Contents({ groups, current, updated, news, onGo, onNews }: {
  groups: ReadonlyArray<ContentsGroup>
  current: string | null
  updated: ReadonlySet<string>
  news: boolean
  onGo: (id: string, anchor?: string) => void
  onNews: () => void
}): React.ReactElement {
  return (
    <nav className="bs-guide-toc" aria-label="Guide contents">
      {groups.map((g) => (
        <div key={g.label} data-chapter={chapterKey(g.label)}>
          <span className="bs-lbl bs-guide-tg"><i aria-hidden="true" />{g.label}</span>
          {g.entries.map((e) => {
            const on = !news && e.id === current
            return (
              <React.Fragment key={e.id}>
                <button type="button" className="bs-guide-ti" aria-current={on ? 'page' : undefined} onClick={() => onGo(e.id)}>
                  <span className="bs-guide-n">{e.number ?? ''}</span>
                  <span className="bs-guide-tt">{e.section.title}</span>
                  {updated.has(e.id) ? <Signal tone="ai" className="bs-guide-upd">Upd</Signal> : <span />}
                </button>
                {on && (e.section.subsections?.length ?? 0) > 0 && (
                  <div className="bs-guide-onpage">
                    {(e.section.subsections ?? []).map((sub) => (
                      <button key={sub.id} type="button" onClick={() => onGo(e.id, sub.id)}>{sub.title}</button>
                    ))}
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </div>
      ))}
      <button type="button" className="bs-guide-ti bs-guide-newrow" aria-current={news ? 'page' : undefined} onClick={onNews}>
        <span className="bs-guide-n" />
        <span className="bs-guide-tt">What’s new</span>
        <span className="bs-mono bs-mut">{GUIDE_CHANGES.length}</span>
      </button>
    </nav>
  )
}

function Results({ hits, q, onPick, onAsk }: {
  hits: ReadonlyArray<GuideHit>
  q: string
  onPick: (id: string, anchor: string | null) => void
  onAsk?: () => void
}): React.ReactElement {
  if (hits.length === 0) {
    return (
      <div className="bs-guide-empty">
        <p className="bs-h3">Nothing in the guide matches “{q.trim()}”.</p>
        <p className="bs-sub">Ask Entomate looks across the guide and your workspace.</p>
        {onAsk && <Key kbd="⌘/" onClick={onAsk}>Ask Entomate</Key>}
      </div>
    )
  }
  return (
    <div>
      <GroupHead label={`${hits.length} ${hits.length === 1 ? 'section matches' : 'sections match'} “${q.trim()}”`} count="↵ opens the first" />
      <ul className="bs-guide-results">
        {hits.map(({ entry, snippets }) => (
          <li key={entry.id}>
            <button type="button" onClick={() => onPick(entry.id, snippets[0]?.anchor ?? null)}>
              <span className="bs-lbl">{eyebrow(entry)}</span>
              <span className="bs-h3"><Hl text={entry.section.title} q={q} /></span>
              {snippets.length === 0 && <span className="bs-guide-snip"><span /><span><Hl text={entry.section.summary} q={q} /></span></span>}
              {snippets.map((sn, i) => (
                <span key={i} className="bs-guide-snip"><span className="bs-lbl">{sn.kind}</span><span><Hl text={sn.text} q={q} /></span></span>
              ))}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function News({ groups, onGo }: { groups: ReadonlyArray<ContentsGroup>; onGo: (id: string) => void }): React.ReactElement {
  return (
    <section aria-labelledby="guide-news-title">
      <div className="bs-guide-eyebrow"><span className="bs-lbl">Newest first</span></div>
      <h2 id="guide-news-title" className="bs-guide-h">What’s new</h2>
      <p className="bs-guide-sum">Every change to the guide. Each one links to its section.</p>
      <ul className="bs-guide-news">
        {GUIDE_CHANGES.map((c, i) => (
          <li key={i}>
            <button type="button" onClick={() => onGo(c.section)}>
              <span className="bs-mono bs-mut">{shortDate(c.date)}</span>
              <span><b>{findEntry(groups, c.section)?.section.title ?? c.section}</b><span className="bs-sub">{c.text}</span></span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function UsersGuide(): React.ReactElement {
  const [params, setParams] = useSearchParams()
  const url = readUrlState(params)
  const outlet = useOutletContext<OutletCtx | undefined>()
  const isPhone = useMediaQuery(PHONE_QUERY)
  const groups = useMemo(() => buildContents(CATEGORIES, guideSections), [])
  // Read what this browser saw last before anything marks the guide as seen.
  const [updated] = useState<Set<string>>(() => changedSince(GUIDE_CHANGES, readSeenVersion(), guideVersion, guideUpdated))
  const [contentsOpen, setContentsOpen] = useState(false)
  const [scrollTo, setScrollTo] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => { markGuideSeen() }, [])

  const entry = findEntry(groups, url.section) ?? flatten(groups)[0] ?? null
  const searching = url.query.trim().length > 0
  const hits = useMemo(() => searchGuide(groups, url.query), [groups, url.query])

  const setUrl = useCallback((next: Partial<GuideUrlState>, push = false) => {
    setParams((prev) => writeUrlState(prev, next), { replace: !push })
  }, [setParams])

  const go = useCallback((id: string, anchor?: string | null, mark = '') => {
    setContentsOpen(false)
    setUrl({ section: id, query: '', news: false, mark }, true)
    setScrollTo(anchor ? `guide-${anchor}` : 'top')
  }, [setUrl])

  const showNews = useCallback(() => {
    setContentsOpen(false)
    setUrl({ news: true, query: '', mark: '' }, true)
    setScrollTo('top')
  }, [setUrl])

  // Scroll after the section has rendered.
  useEffect(() => {
    if (!scrollTo) return
    const el = scrollTo === 'top' ? topRef.current : document.getElementById(scrollTo)
    el?.scrollIntoView({ block: 'start', behavior: scrollTo === 'top' ? 'auto' : 'smooth' })
    setScrollTo(null)
  }, [scrollTo, url.section, url.news])

  // "/" focuses guide search (⌘K stays the global palette).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement | null)?.tagName ?? ''
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Escape') setUrl({ query: '' })
    if (e.key === 'Enter' && hits[0]) go(hits[0].entry.id, hits[0].snippets[0]?.anchor ?? null, url.query.trim())
  }

  const contents = (
    <Contents groups={groups} current={searching ? null : (entry?.id ?? null)} updated={updated} news={url.news && !searching} onGo={(id, anchor) => go(id, anchor)} onNews={showNews} />
  )

  return (
    <div className="bs-guide" ref={topRef}>
      <TitleRule
        title="User guide"
        meta={<>Version <b>{shortDate(guideUpdated)}</b> · {flatten(groups).length} sections</>}
        actions={(
          <>
            <TextInput
              ref={searchRef}
              icon={SearchIcon}
              className="bs-guide-search"
              type="search"
              placeholder="Search the guide"
              aria-label="Search the guide"
              value={url.query}
              onChange={(e) => setUrl({ query: e.target.value })}
              onKeyDown={onSearchKey}
            />
            {isPhone && <Key onClick={() => setContentsOpen(true)}>Contents</Key>}
            <Key kbd={String(GUIDE_CHANGES.length)} onClick={showNews} aria-pressed={url.news && !searching}>What’s new</Key>
          </>
        )}
      />
      <Grid>
        <Cell span={8} aria-live="polite">
          {searching
            ? <Results hits={hits} q={url.query} onPick={(id, anchor) => go(id, anchor, url.query.trim())} onAsk={outlet?.openAssistant} />
            : url.news
              ? <News groups={groups} onGo={(id) => go(id)} />
              : entry && <Reader entry={entry} q={url.mark} updated={updated.has(entry.id)} groups={groups} onGo={(id) => go(id)} />}
        </Cell>
        <Cell span={4} rule desktopOnly>
          <div className="bs-guide-side">
            {contents}
            <div className="bs-guide-keys">
              <Section level={3} title="Shortcuts" aside={<button type="button" className="bs-guide-link" onClick={() => go('keyboard-shortcuts')}>All {SHORTCUTS.length}</button>} />
              <KeyMap items={SHORTCUTS.filter((s) => s.top)} />
            </div>
          </div>
        </Cell>
      </Grid>
      <Drawer open={contentsOpen} onClose={() => setContentsOpen(false)} label="Contents">
        {contents}
      </Drawer>
    </div>
  )
}
