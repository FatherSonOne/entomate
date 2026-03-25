/**
 * VC Component Library — Void × Crimson Design System
 * Style: Neo+Cinema | Playground config 2026-03-21
 *
 * Usage:
 *   import { VCCard, VCButton, VCBadge, VCMetricCard, VCMeetingCard, VCToast, VCCanvas } from '../components/vc'
 */

export { default as VCCanvas } from './VCCanvas'

/* ── VCCard ──────────────────────────────────────────────── */
export function VCCard({ children, className = '', style, onClick }) {
  return (
    <div
      className={`vc ${className}`}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

/* ── VCButton ────────────────────────────────────────────── */
const VBTN_VARIANTS = {
  primary:   'vbtn-primary',
  secondary: 'vbtn-secondary',
  ghost:     'vbtn-ghost',
  mint:      'vbtn-mint',
  amber:     'vbtn-amber',
  danger:    'vbtn-danger',
  icon:      'vbtn-icon',
}

export function VCButton({
  children,
  variant = 'primary',
  size    = '',       // 'sm' | 'lg' | ''
  className = '',
  as: Tag = 'button',
  ...props
}) {
  const variantCls = VBTN_VARIANTS[variant] || 'vbtn-primary'
  const sizeCls    = size === 'sm' ? 'vbtn-sm' : size === 'lg' ? 'vbtn-lg' : ''
  return (
    <Tag className={`vbtn ${variantCls} ${sizeCls} ${className}`.trim()} {...props}>
      {children}
    </Tag>
  )
}

/* ── VCBadge ─────────────────────────────────────────────── */
const VBADGE_COLORS = {
  crimson:  'vbadge-crimson',
  mint:     'vbadge-mint',
  amber:    'vbadge-amber',
  phosphor: 'vbadge-phosphor',
  neutral:  'vbadge-neutral',
  error:    'vbadge-error',
}

export function VCBadge({ children, color = 'crimson', live = false, className = '' }) {
  const colorCls = VBADGE_COLORS[color] || 'vbadge-crimson'
  return (
    <span className={`vbadge ${colorCls} ${live ? 'vbadge-live' : ''} ${className}`.trim()}>
      {children}
    </span>
  )
}

/* ── VCInput ─────────────────────────────────────────────── */
export function VCInput({ className = '', icon, ...props }) {
  if (icon) {
    return (
      <div className="vinput-group">
        <span className="vinput-icon">{icon}</span>
        <input className={`vinput ${className}`} {...props} />
      </div>
    )
  }
  return <input className={`vinput ${className}`} {...props} />
}

/* ── VCSelect ────────────────────────────────────────────── */
export function VCSelect({ className = '', children, ...props }) {
  return <select className={`vselect ${className}`} {...props}>{children}</select>
}

/* ── VCTextarea ──────────────────────────────────────────── */
export function VCTextarea({ className = '', ...props }) {
  return <textarea className={`vinput ${className}`} {...props} />
}

/* ── VCMetricCard ────────────────────────────────────────── */
const MC_ICON_CLASS = {
  crimson:  'mc-icon-c',
  mint:     'mc-icon-m',
  amber:    'mc-icon-a',
  phosphor: 'mc-icon-p',
}
const MC_VAL_COLOR = {
  crimson:  'var(--accent-primary)',
  mint:     'var(--accent-secondary)',
  amber:    'var(--accent-tertiary)',
  phosphor: 'var(--accent-phosphor)',
}

export function VCMetricCard({
  label,
  value,
  delta,
  deltaDir = 'up',  // 'up' | 'down'
  icon,
  color    = 'crimson',
  onClick,
  href,
}) {
  const iconCls  = MC_ICON_CLASS[color] || 'mc-icon-c'
  const valColor = MC_VAL_COLOR[color]

  const inner = (
    <>
      {icon && <div className={`mc-icon ${iconCls}`}>{icon}</div>}
      <div className="mval" style={{ color: valColor }}>{value}</div>
      <div className="mlbl">{label}</div>
      {delta && (
        <div className={`mdelta ${deltaDir === 'up' ? 'mdelta-up' : 'mdelta-dn'}`}>
          {delta}
        </div>
      )}
    </>
  )

  if (href) {
    return (
      <a href={href} className="vc mc" style={{ textDecoration: 'none', display: 'block' }}>
        {inner}
      </a>
    )
  }

  return (
    <div className="vc mc" onClick={onClick} style={onClick ? { cursor: 'pointer' } : {}}>
      {inner}
    </div>
  )
}

/* ── VCMeetingCard ───────────────────────────────────────── */
const MTG_FILL_CLASS = {
  crimson: 'mtg-fill-c',
  mint:    'mtg-fill-m',
  amber:   'mtg-fill-a',
}

export function VCMeetingCard({
  title,
  meta,
  badge,
  status,
  progress,
  progressColor = 'crimson',
  actions,
  onClick,
}) {
  const fillCls = MTG_FILL_CLASS[progressColor] || 'mtg-fill-c'

  return (
    <div className="vc mtg" onClick={onClick} style={onClick ? { cursor: 'pointer' } : {}}>
      <div className="mtg-top">
        <div>
          <div className="mtg-title">{title}</div>
          {meta && <div className="mtg-meta">{meta}</div>}
        </div>
        {badge || status}
      </div>

      {progress !== undefined && (
        <div className="mtg-bar">
          <div className={`mtg-fill ${fillCls}`} style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
      )}

      {actions && <div className="mtg-footer">{actions}</div>}
    </div>
  )
}

/* ── VCToast ─────────────────────────────────────────────── */
const TOAST_COLOR = {
  crimson:  'vtoast-crimson',
  mint:     'vtoast-mint',
  amber:    'vtoast-amber',
  phosphor: 'vtoast-phosphor',
}

export function VCToast({ title, message, color = 'crimson', icon }) {
  const colorCls = TOAST_COLOR[color] || 'vtoast-crimson'
  return (
    <div className={`vtoast ${colorCls}`}>
      {icon && <div className="vtoast-icon">{icon}</div>}
      <div>
        <div className="vtoast-title">{title}</div>
        {message && <div className="vtoast-msg">{message}</div>}
      </div>
    </div>
  )
}

/* ── VCTable ─────────────────────────────────────────────── */
export function VCTable({ columns, rows, className = '' }) {
  return (
    <div className={`vc vtbl-wrap ${className}`}>
      <table className="vtbl">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key || col.label}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {columns.map((col) => (
                <td key={col.key || col.label}>
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── VCAvatar ────────────────────────────────────────────── */
const AV_COLOR = { crimson: 'vc-av-c', mint: 'vc-av-m', amber: 'vc-av-a' }

export function VCAvatar({ initials, src, color = 'crimson', size = 24 }) {
  const cls = AV_COLOR[color] || 'vc-av-c'
  if (src) {
    return (
      <img
        src={src}
        alt={initials}
        className="vc-av"
        style={{ width: size, height: size, objectFit: 'cover' }}
      />
    )
  }
  return (
    <div className={`vc-av ${cls}`} style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </div>
  )
}

/* ── VCAvatarGroup ───────────────────────────────────────── */
export function VCAvatarGroup({ avatars = [], max = 4 }) {
  const visible = avatars.slice(0, max)
  const extra   = avatars.length - max
  return (
    <div className="vc-av-group">
      {visible.map((av, i) => (
        <VCAvatar key={i} initials={av.initials} src={av.src} color={av.color} />
      ))}
      {extra > 0 && (
        <div className="vc-av vc-av-c" style={{ fontSize: 9 }}>+{extra}</div>
      )}
    </div>
  )
}

/* ── VCAIDot ─────────────────────────────────────────────── */
export function VCAIDot({ color = 'crimson' }) {
  const colorMap = {
    crimson:  { background: 'var(--accent-primary)',   boxShadow: '0 0 6px var(--accent-primary)' },
    mint:     { background: 'var(--accent-secondary)', boxShadow: '0 0 6px var(--accent-secondary)' },
    phosphor: { background: 'var(--accent-phosphor)',  boxShadow: '0 0 6px var(--accent-phosphor)' },
  }
  return <span className="vc-ai-dot" style={colorMap[color] || colorMap.crimson} />
}

/* ── VCProgress ──────────────────────────────────────────── */
export function VCProgress({ value = 0, color = 'crimson' }) {
  const fillCls = color === 'mint' ? 'vc-progress-fill-m' : color === 'amber' ? 'vc-progress-fill-a' : 'vc-progress-fill'
  return (
    <div className="vc-progress">
      <div className={fillCls} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  )
}

/* ── VCTopbar ─────────────────────────────────────────────── */
export function VCTopbar({ title, breadcrumb, onSearch, onCommandPalette, rightSlot }) {
  return (
    <header className="vc-topbar" style={{
      position: 'sticky', top: 0, zIndex: 30,
      background: 'var(--bg-elevated)',
      borderBottom: '1px solid var(--b1)',
      padding: '0 20px', height: 52,
      display: 'flex', alignItems: 'center', gap: 12
    }}>
      <div className="vc-topbar-left">
        {breadcrumb && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em' }}>entomate</span>
            <span>›</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{breadcrumb}</span>
          </div>
        )}
        {title && !breadcrumb && (
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>{title}</span>
        )}
      </div>
      <div style={{ flex: 1 }} />
      {onCommandPalette && (
        <button
          onClick={onCommandPalette}
          className="vc-topbar-search"
          style={{ cursor: 'pointer' }}
        >
          <span>⌘</span>
          <span>Search...</span>
          <span className="cmd-kbd" style={{ marginLeft: 4 }}>⌘K</span>
        </button>
      )}
      {rightSlot}
    </header>
  )
}

/* ── VCCommandPalette ────────────────────────────────────────── */
export function VCCommandPalette({ isOpen, onClose, groups = [], query = '', onQueryChange, selectedIndex = 0, onSelectIndex }) {
  if (!isOpen) return null
  let flatIndex = 0

  return (
    <div className="cmd-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="cmd-box">
        <div className="cmd-input-wrap">
          <span style={{ color: 'var(--text-tertiary)', fontSize: 16 }}>⌘</span>
          <input
            className="cmd-input"
            placeholder="Type a command or search..."
            value={query}
            onChange={e => onQueryChange?.(e.target.value)}
            autoFocus
          />
          <button className="cmd-kbd" onClick={onClose} style={{ cursor: 'pointer' }}>Esc</button>
        </div>
        <div className="cmd-results">
          {groups.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
              No commands found
            </div>
          )}
          {groups.map((group, gi) => (
            <div key={gi}>
              {group.label && <div className="cmd-section-label">{group.label}</div>}
              {group.items.map((item, ii) => {
                const idx = flatIndex++
                const isSelected = idx === selectedIndex
                return (
                  <div
                    key={ii}
                    className={`cmd-result${isSelected ? ' selected' : ''}`}
                    onClick={item.onClick}
                    onMouseEnter={() => onSelectIndex?.(idx)}
                  >
                    {item.icon && (
                      <div className="cmd-result-icon">
                        {item.icon}
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div className="cmd-result-title">{item.title}</div>
                      {item.subtitle && <div className="cmd-result-sub">{item.subtitle}</div>}
                    </div>
                    {item.kbd && <span className="cmd-kbd">{item.kbd}</span>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        <div className="cmd-footer">
          <span><kbd className="cmd-kbd">↑↓</kbd> navigate</span>
          <span><kbd className="cmd-kbd">↵</kbd> select</span>
          <span><kbd className="cmd-kbd">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}

/* ── VCTimeline ──────────────────────────────────────────────── */
export function VCTimeline({ events = [] }) {
  const colorMap = {
    crimson: 'tl-dot-crimson',
    mint:    'tl-dot-mint',
    amber:   'tl-dot-amber',
    neutral: 'tl-dot-neutral',
  }
  return (
    <div className="tl">
      {events.map((event, i) => (
        <div key={i} className="tl-item">
          <div className="tl-spine">
            <div className={`tl-dot ${colorMap[event.color || 'neutral']}`} />
            {i < events.length - 1 && <div className="tl-line" />}
          </div>
          <div className="tl-content">
            <div className="tl-title">{event.title}</div>
            {event.time && <div className="tl-time">{event.time}</div>}
            {event.body && <div className="tl-body">{event.body}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── VCIconBox ────────────────────────────────────────────────── */
export function VCIconBox({ children, color = 'neutral', size = 'md', className = '' }) {
  const colorCls = {
    crimson:  'vc-icon-crimson',
    mint:     'vc-icon-mint',
    amber:    'vc-icon-amber',
    phosphor: 'vc-icon-phosphor',
    neutral:  'vc-icon-neutral',
  }[color] || 'vc-icon-neutral'
  const sizeCls = size === 'sm' ? 'vc-icon-sm' : size === 'lg' ? 'vc-icon-lg' : ''
  return (
    <div className={`vc-icon ${colorCls} ${sizeCls} ${className}`.trim()}>
      {children}
    </div>
  )
}
