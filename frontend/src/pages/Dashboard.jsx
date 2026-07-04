import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Mic, FolderKanban, CheckSquare, Zap, ArrowRight,
  Plus, Sparkles, AlertTriangle, Users, BarChart3,
  ChevronDown, ChevronUp, Keyboard,
} from 'lucide-react'
import MeetingRecorder from '../components/MeetingRecorder'
import IntelligenceDashboard from '../components/intelligence/IntelligenceDashboard'
import { LearningInsightsWidget } from '../components/intelligence'
import SentimentTrendMini from '../components/intelligence/SentimentTrendMini'
import { meetingsApi, tasksApi, projectsApi, automationsApi, dashboardApi, learningApi, checkHealth } from '../services/api'
import { VCBadge } from '../components/vc'
import ErrorState from '../components/vc/ErrorState'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/vc/ToastProvider'

/* ═══════════════════════════════════════════════════════════════
   RING GAUGE
   ═══════════════════════════════════════════════════════════════ */
const RING_COLORS = {
  crimson:  { stroke: '#FF2D6B', glow: 'rgba(255,45,107,.4)',  bg: 'rgba(255,45,107,.10)', text: '#FF2D6B' },
  mint:     { stroke: '#00F5D4', glow: 'rgba(0,245,212,.35)',  bg: 'rgba(0,245,212,.10)',  text: '#00F5D4' },
  neutral:  { stroke: '#968890', glow: 'rgba(150,136,144,.25)', bg: 'rgba(150,136,144,.12)', text: '#968890' },
  // Reserved signals — use ONLY for their meaning: amber = AI/prediction, phosphor = live/real-time.
  amber:    { stroke: '#FFB800', glow: 'rgba(255,184,0,.35)',   bg: 'rgba(255,184,0,.10)',  text: '#FFB800' },
  phosphor: { stroke: '#A0FF32', glow: 'rgba(160,255,50,.30)', bg: 'rgba(160,255,50,.10)', text: '#A0FF32' },
}

function RingGauge({ value, max, label, icon, color = 'crimson', size = 84 }) {
  const c   = RING_COLORS[color] || RING_COLORS.crimson
  const r   = (size / 2) - 7
  const circ = 2 * Math.PI * r
  const pct  = Math.min(value / Math.max(max, 1), 1)
  const [animated, setAnimated] = useState(0)

  useEffect(() => {
    const id = setTimeout(() => setAnimated(pct * circ), 120)
    return () => clearTimeout(id)
  }, [pct, circ])

  return (
    <div className="vc" style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'12px 8px', gap:4, position:'relative' }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)', flexShrink:0 }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(248,240,242,.07)" strokeWidth={4.5} />
        <circle
          cx={size/2} cy={size/2} r={r}
          fill="none"
          stroke={c.stroke}
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ - animated}
          style={{ transition:'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)', filter:`drop-shadow(0 0 5px ${c.glow})` }}
        />
      </svg>

      {/* Center label */}
      <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-56%)', display:'flex', flexDirection:'column', alignItems:'center', gap:0 }}>
        <span style={{ fontSize:18, fontWeight:700, fontFamily:'var(--font)', color:c.text, lineHeight:1 }}>{value}</span>
        <span style={{ fontSize:11, color:'var(--t1)', fontFamily:'var(--font)', letterSpacing:'.04em', textTransform:'uppercase' }}>{label}</span>
      </div>

      {/* Icon dot bottom-right */}
      <div style={{ position:'absolute', bottom:8, right:8, width:18, height:18, borderRadius:5, background:c.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <span style={{ color:c.text, display:'flex' }}>{icon}</span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   DOCKED QUICK ACTIONS BAR
   ═══════════════════════════════════════════════════════════════ */
function QuickActionsBar({ navigate, recorderRef }) {
  const actions = [
    { label:'Start Meeting', icon:<Mic style={{ width:13, height:13 }} />,          cls:'vbtn-primary',   action:() => recorderRef.current?.scrollIntoView({ behavior:'smooth', block:'center' }) },
    { label:'New Task',      icon:<Plus style={{ width:13, height:13 }} />,          cls:'vbtn-ghost',     action:() => navigate('/tasks') },
    { label:'New Project',   icon:<FolderKanban style={{ width:13, height:13 }} />,  cls:'vbtn-ghost',     action:() => navigate('/projects') },
    { label:'AI Insights',   icon:<Sparkles style={{ width:13, height:13 }} />,      cls:'vbtn-ghost',     action:() => navigate('/reports') },
    { label:'Automations',   icon:<Zap style={{ width:13, height:13 }} />,           cls:'vbtn-ghost',     action:() => navigate('/automations') },
  ]

  return (
    <div className="vc" style={{
      display:'flex', alignItems:'center', gap:8, flexWrap:'wrap',
      padding:'10px 14px',
    }}>
      <span style={{ fontSize:11, fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--t1)', marginRight:2, whiteSpace:'nowrap' }}>Quick Actions</span>
      <div style={{ width:1, height:16, background:'var(--b1)', flexShrink:0 }} />
      {actions.map(a => (
        <button key={a.label} onClick={a.action} className={`vbtn ${a.cls} vbtn-sm`} style={{ gap:5 }}>
          {a.icon}
          {a.label}
        </button>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD HERO
   ═══════════════════════════════════════════════════════════════ */
function DashboardHero({ stats, loading, navigate, recorderRef }) {
  const { user } = useAuth()
  const hour = new Date().getHours()
  const timeGreet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.name?.trim().split(' ')[0] || 'there'
  const greeting = `${timeGreet}, ${firstName}.`

  const rings = [
    { label:'Meetings',  value:stats.meetings,  max:Math.max(stats.meetings, 15),  color:'crimson',  icon:<Mic style={{ width:9, height:9 }} />,          href:'/meetings' },
    { label:'Tasks',     value:stats.tasks,     max:Math.max(stats.tasks, 20),     color:'neutral',  icon:<CheckSquare style={{ width:9, height:9 }} />,   href:'/tasks' },
    { label:'Projects',  value:stats.projects,  max:Math.max(stats.projects, 10),  color:'mint',     icon:<FolderKanban style={{ width:9, height:9 }} />,  href:'/projects' },
    { label:'Automations', value:stats.automations, max:Math.max(stats.automations, 10), color:'neutral', icon:<Zap style={{ width:9, height:9 }} />,        href:'/automations' },
  ]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {/* ── Greeting ── */}
      <div className="vc" style={{ padding:'20px 22px' }}>
        <div style={{ fontSize:20, fontWeight:700, fontFamily:'var(--font)', color:'var(--t0)', lineHeight:1.3, letterSpacing:'-.01em' }}>
          {greeting}
        </div>
        <div style={{ marginTop:6, fontSize:12, color:'var(--t1)' }}>
          {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}
        </div>
      </div>

      {/* ── Metric strip — the single home for the four core counts ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8 }}>
        {rings.map(m => (
          <a key={m.label} href={m.href} style={{ textDecoration:'none', display:'flex' }}>
            <RingGauge
              value={loading ? 0 : m.value}
              max={m.max}
              label={m.label}
              icon={m.icon}
              color={m.color}
              size={84}
            />
          </a>
        ))}
      </div>

      {/* ── Docked quick actions bar ── */}
      <QuickActionsBar navigate={navigate} recorderRef={recorderRef} />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   SYSTEM STATUS BAR (with Ecosystem indicators)
   ═══════════════════════════════════════════════════════════════ */
function SystemStatus({ systemStatus }) {
  const svc = (key) => {
    const s = systemStatus?.services?.[key] || 'checking...'
    return { status: s, ok: s.includes('connected') }
  }

  const ecosystemApps = [
    { label:'Pulse',      color:'#FF2D6B' },
    { label:'Entomate',   color:'#00F5D4' },
    { label:'LogosVision', color:'#38BDF8' },
  ]

  return (
    <div style={{ padding:'8px 14px', borderTop:'1px solid var(--b0)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap', fontSize:11, fontFamily:'var(--font-mono, JetBrains Mono, monospace)' }}>
        {[['AI', 'gemini'], ['DB', 'database']].map(([label, key]) => {
          const { status, ok } = svc(key)
          return (
            <div key={key} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:5, height:5, borderRadius:'50%', background: ok ? 'var(--m)' : 'var(--t1)', boxShadow: ok ? '0 0 6px var(--m)' : 'none' }} />
              <span style={{ color:'var(--t1)' }}>{label}:</span>
              <span style={{ color:'var(--t0)' }}>{status}</span>
            </div>
          )
        })}

        {/* Ecosystem separator */}
        <div style={{ width:1, height:12, background:'rgba(248,240,242,.12)' }} />
        <span style={{ color:'var(--t1)', fontSize:11, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase' }}>Ecosystem</span>

        {ecosystemApps.map(app => {
          const ecoStatus = systemStatus?.ecosystem?.[app.label.toLowerCase()]
          const ok = ecoStatus?.connected !== false
          return (
            <div key={app.label} style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:5, height:5, borderRadius:'50%', background: ok ? app.color : 'var(--t2)', boxShadow: ok ? `0 0 6px ${app.color}` : 'none', opacity: ok ? 1 : 0.4 }} />
              <span style={{ color: ok ? 'var(--t0)' : 'var(--t2)' }}>{app.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   OVERDUE ALERT BANNER
   ═══════════════════════════════════════════════════════════════ */
function OverdueAlertBanner({ items, navigate }) {
  const [expanded, setExpanded] = useState(false)
  if (!items || items.length === 0) return null

  return (
    <div className="vc" style={{ overflow:'hidden' }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width:'100%', padding:'10px 14px', display:'flex', alignItems:'center', gap:10,
          background:'none', border:'none', cursor:'pointer', color:'var(--t0)',
        }}
      >
        <AlertTriangle style={{ width:14, height:14, color:'var(--c)', flexShrink:0 }} />
        <span style={{ fontSize:12, fontWeight:700, fontFamily:'var(--font)', color:'var(--c)' }}>
          {items.length} overdue item{items.length !== 1 ? 's' : ''} need attention
        </span>
        <span style={{ marginLeft:'auto', display:'flex' }}>
          {expanded
            ? <ChevronUp style={{ width:14, height:14, color:'var(--t1)' }} />
            : <ChevronDown style={{ width:14, height:14, color:'var(--t1)' }} />
          }
        </span>
      </button>

      {/* Expandable list */}
      {expanded && (
        <div style={{ padding:'0 14px 10px', display:'flex', flexDirection:'column', gap:4 }}>
          {items.slice(0, 10).map(item => (
            <div
              key={item.id}
              onClick={() => navigate(`/tasks`)}
              style={{
                padding:'6px 10px', borderRadius:8, display:'flex', alignItems:'center', gap:10,
                cursor:'pointer', background:'rgba(255,45,107,.04)',
              }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,45,107,.10)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(255,45,107,.04)'}
            >
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--t0)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {item.task_description || item.title}
                </div>
                <div style={{ fontSize:11, color:'var(--t1)', fontFamily:'var(--font-mono)' }}>
                  {item.assigned_to_name && `${item.assigned_to_name} · `}Due: {new Date(item.due_date).toLocaleDateString()}
                </div>
              </div>
              <VCBadge color="crimson">{item.days_overdue || Math.floor((Date.now() - new Date(item.due_date)) / 86400000)}d late</VCBadge>
            </div>
          ))}
          {items.length > 10 && (
            <div style={{ fontSize:11, color:'var(--t1)', textAlign:'center', padding:4 }}>
              +{items.length - 10} more overdue items
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   TEAM WORKLOAD WIDGET
   ═══════════════════════════════════════════════════════════════ */
function TeamWorkloadWidget({ workload }) {
  if (!workload || workload.length === 0) return null

  const maxAssigned = Math.max(...workload.map(m => m.total_assigned), 1)

  return (
    <div className="vc" style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--b0)', display:'flex', alignItems:'center', gap:8 }}>
        <Users style={{ width:13, height:13, color:'var(--m)' }} />
        <h3 style={{ fontFamily:'var(--font)', fontWeight:600, fontSize:13, color:'var(--t0)' }}>Team Workload</h3>
        <span style={{ fontSize:11, color:'var(--t1)', marginLeft:'auto' }}>{workload.length} member{workload.length !== 1 ? 's' : ''}</span>
      </div>
      <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:10 }}>
        {workload.slice(0, 8).map((member, i) => {
          const pctDone = member.total_assigned > 0 ? (member.completed_items / member.total_assigned) * 100 : 0
          const pctInProgress = member.total_assigned > 0 ? (member.in_progress_items / member.total_assigned) * 100 : 0
          const pctPending = 100 - pctDone - pctInProgress
          const barWidth = `${(member.total_assigned / maxAssigned) * 100}%`

          return (
            <div key={i}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                <span style={{ fontSize:12, fontWeight:600, color:'var(--t0)' }}>{member.team_member || member.name}</span>
                <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--t1)' }}>
                  {member.high_priority_count > 0 && (
                    <span style={{ color:'var(--c)', fontWeight:700 }}>{member.high_priority_count} high</span>
                  )}
                  <span>{member.total_assigned} total</span>
                </div>
              </div>
              {/* Stacked bar */}
              <div style={{ height:6, borderRadius:3, background:'rgba(248,240,242,.06)', overflow:'hidden', width:barWidth, minWidth:20 }}>
                <div style={{ display:'flex', height:'100%' }}>
                  <div style={{ width:`${pctDone}%`, background:'var(--m)' }} />
                  <div style={{ width:`${pctInProgress}%`, background:'var(--c)' }} />
                  <div style={{ width:`${pctPending}%`, background:'rgba(248,240,242,.18)' }} />
                </div>
              </div>
            </div>
          )
        })}
        {/* Legend */}
        <div style={{ display:'flex', gap:12, fontSize:11, color:'var(--t1)', marginTop:2 }}>
          <span style={{ display:'flex', alignItems:'center', gap:3 }}><div style={{ width:6, height:6, borderRadius:2, background:'var(--m)' }} />Done</span>
          <span style={{ display:'flex', alignItems:'center', gap:3 }}><div style={{ width:6, height:6, borderRadius:2, background:'var(--c)' }} />In Progress</span>
          <span style={{ display:'flex', alignItems:'center', gap:3 }}><div style={{ width:6, height:6, borderRadius:2, background:'rgba(248,240,242,.18)' }} />Pending</span>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   INSIGHTS & TRENDS PANEL
   ═══════════════════════════════════════════════════════════════ */
function InsightsTrendsPanel({ insights }) {
  if (!insights || !insights.metrics) return null

  const { metrics, sentimentCounts = {}, priorityCounts = {}, statusCounts = {} } = insights

  // Sentiment donut data
  const sentimentTotal = (sentimentCounts.Positive || 0) + (sentimentCounts.Neutral || 0) + (sentimentCounts.Negative || 0)
  const sentimentSlices = [
    { label:'Positive', value:sentimentCounts.Positive || 0, color:'#00F5D4' },
    { label:'Neutral',  value:sentimentCounts.Neutral  || 0, color:'#968890' },
    { label:'Negative', value:sentimentCounts.Negative || 0, color:'#FF2D6B' },
  ]

  // Priority bar data — crimson→neutral ramp (amber/phosphor are reserved signals, not a priority scale)
  const maxPriority = Math.max(priorityCounts.high || 0, priorityCounts.medium || 0, priorityCounts.low || 0, 1)
  const priorityBars = [
    { label:'High',   value:priorityCounts.high   || 0, color:'#FF2D6B' },
    { label:'Medium', value:priorityCounts.medium || 0, color:'#FF6699' },
    { label:'Low',    value:priorityCounts.low    || 0, color:'#968890' },
  ]

  // Mini donut SVG helper
  const renderDonut = (slices, total, size = 60) => {
    if (total === 0) return null
    const r = (size / 2) - 5
    const circ = 2 * Math.PI * r
    let offset = 0

    return (
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(248,240,242,.06)" strokeWidth={5} />
        {slices.filter(s => s.value > 0).map((s, i) => {
          const pct = s.value / total
          const dash = pct * circ
          const el = (
            <circle
              key={i}
              cx={size/2} cy={size/2} r={r}
              fill="none" stroke={s.color} strokeWidth={5}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              style={{ filter:`drop-shadow(0 0 3px ${s.color}44)` }}
            />
          )
          offset += dash
          return el
        })}
      </svg>
    )
  }

  return (
    <div className="vc" style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--b0)', display:'flex', alignItems:'center', gap:8 }}>
        <BarChart3 style={{ width:13, height:13, color:'var(--c)' }} />
        <h3 style={{ fontFamily:'var(--font)', fontWeight:600, fontSize:13, color:'var(--t0)' }}>Insights & Trends</h3>
      </div>

      <div style={{ padding:'14px', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>
        {/* Sentiment Donut */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
          {renderDonut(sentimentSlices, sentimentTotal)}
          <span style={{ fontSize:11, fontWeight:700, color:'var(--t1)', letterSpacing:'.06em', textTransform:'uppercase' }}>Sentiment</span>
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            {sentimentSlices.map(s => (
              <div key={s.label} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--t1)' }}>
                <div style={{ width:5, height:5, borderRadius:'50%', background:s.color }} />
                {s.label}: {s.value}
              </div>
            ))}
          </div>
        </div>

        {/* Priority Bars */}
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <span style={{ fontSize:11, fontWeight:700, color:'var(--t1)', letterSpacing:'.06em', textTransform:'uppercase', textAlign:'center' }}>Priority</span>
          <div style={{ display:'flex', flexDirection:'column', gap:8, flex:1, justifyContent:'center' }}>
            {priorityBars.map(b => (
              <div key={b.label}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                  <span style={{ fontSize:11, color:'var(--t1)' }}>{b.label}</span>
                  <span style={{ fontSize:11, color:b.color, fontWeight:700, fontFamily:'var(--font-mono)' }}>{b.value}</span>
                </div>
                <div style={{ height:4, borderRadius:2, background:'rgba(248,240,242,.06)', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:'100%', background:b.color, borderRadius:2, transform:`scaleX(${(b.value / maxPriority) || 0})`, transformOrigin:'left', transition:'transform .8s cubic-bezier(0.22,1,0.36,1)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Completion Ring */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
          <RingGauge value={metrics.overallCompletion || 0} max={100} label="Complete" color="mint" size={60} />
          <div style={{ display:'flex', flexDirection:'column', gap:2, alignItems:'center' }}>
            <span style={{ fontSize:11, color:'var(--t1)' }}>{metrics.completedItems || 0}/{metrics.totalItems || 0} items</span>
            {(metrics.overdueItems || 0) > 0 && (
              <span style={{ fontSize:11, color:'var(--c)', fontWeight:700 }}>{metrics.overdueItems} overdue</span>
            )}
            <span style={{ fontSize:11, color:'var(--t1)' }}>Avg progress: {metrics.avgProgress || 0}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   AUTOMATION ACTIVITY FEED
   ═══════════════════════════════════════════════════════════════ */
function AutomationActivityFeed({ count, navigate }) {
  const [runs, setRuns] = useState([])
  const [loadingRuns, setLoadingRuns] = useState(true)

  useEffect(() => {
    const loadRuns = async () => {
      try {
        const res = await automationsApi.list({ limit: 5 })
        setRuns((res.automations || res.data?.automations || []).slice(0, 5))
      } catch {}
      setLoadingRuns(false)
    }
    loadRuns()
  }, [])

  return (
    <div className="vc" style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--b0)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Zap style={{ width:13, height:13, color:'var(--c)' }} />
          <h3 style={{ fontFamily:'var(--font)', fontWeight:600, fontSize:13, color:'var(--t0)' }}>Automations</h3>
          <VCBadge color="neutral">{count} active</VCBadge>
        </div>
        <button onClick={() => navigate('/automations')} style={{ fontSize:12, color:'var(--c)', display:'flex', alignItems:'center', gap:4, background:'none', border:'none', cursor:'pointer' }}>
          View all <ArrowRight style={{ width:12, height:12 }} />
        </button>
      </div>
      <div style={{ padding:'6px 8px', display:'flex', flexDirection:'column', gap:2 }}>
        {loadingRuns ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ height:32, borderRadius:8, background:'rgba(248,240,242,.04)', animation:'pulse 1.5s ease-in-out infinite' }} />
          ))
        ) : runs.length === 0 ? (
          <p style={{ fontSize:12, color:'var(--t1)', padding:'12px', textAlign:'center' }}>No automations configured</p>
        ) : (
          runs.map((auto) => (
            <div
              key={auto.id}
              style={{ padding:'7px 10px', borderRadius:8, display:'flex', alignItems:'center', gap:10 }}
              onMouseEnter={e => e.currentTarget.style.background='var(--b0)'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}
            >
              <div style={{ width:6, height:6, borderRadius:'50%', background: auto.enabled ? '#A0FF32' : 'var(--t2)', boxShadow: auto.enabled ? '0 0 5px rgba(160,255,50,.4)' : 'none', flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--t0)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{auto.name || auto.title}</div>
                <div style={{ fontSize:11, color:'var(--t1)' }}>{auto.trigger_type || auto.type || 'workflow'}</div>
              </div>
              <VCBadge color={auto.enabled ? 'mint' : 'neutral'}>{auto.enabled ? 'active' : 'paused'}</VCBadge>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const navigate = useNavigate()
  const recorderRef = useRef(null)
  const toast = useToast()

  const [stats, setStats]               = useState({ meetings: 0, tasks: 0, projects: 0, automations: 0 })
  const [recentMeetings, setRecentMeetings] = useState([])
  const [pendingTasks, setPendingTasks]     = useState([])
  const [overdueItems, setOverdueItems]     = useState([])
  const [teamWorkload, setTeamWorkload]     = useState([])
  const [insights, setInsights]             = useState(null)
  const [systemStatus, setSystemStatus]     = useState(null)
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState(null)
  const [learningInsights, setLearningInsights] = useState(null)

  const loadData = async () => {
    try {
      setError(null)
      setLoading(true)
      // Each panel degrades independently; record which ones failed so we can tell
      // the user instead of silently showing empty data as if it were real.
      const failed = []
      const track = (label, fallback) => (err) => { failed.push(label); console.warn(`Dashboard: ${label} failed to load`, err); return fallback }
      const [health, meetings, tasks, projects, automations, overdue, workload, insightsRes] = await Promise.all([
        checkHealth().catch(track('system status', { services: {} })),
        meetingsApi.list({ limit: 5 }).catch(track('meetings', { meetings: [], count: 0 })),
        tasksApi.list({ limit: 5, status: 'open' }).catch(track('tasks', { tasks: [], count: 0 })),
        projectsApi.list({ limit: 5 }).catch(track('projects', { projects: [], count: 0 })),
        automationsApi.list({ limit: 1 }).catch(track('automations', { count: 0 })),
        dashboardApi.getOverdue().catch(track('overdue items', { data: { overdue: [], count: 0 } })),
        dashboardApi.getTeamWorkload().catch(track('team workload', { data: { workload: [] } })),
        dashboardApi.getInsights().catch(track('insights', { data: null })),
      ])
      if (failed.length) {
        toast.info('Some panels are out of date', `Couldn't refresh: ${failed.join(', ')}.`)
      }
      setSystemStatus(health)
      setRecentMeetings(meetings.meetings || [])
      setPendingTasks(tasks.tasks || [])
      setOverdueItems((overdue.data || overdue).overdue || [])
      setTeamWorkload((workload.data || workload).workload || [])
      setInsights((insightsRes.data || insightsRes).metrics ? (insightsRes.data || insightsRes) : null)
      setStats({
        meetings:    meetings.count    || 0,
        tasks:       tasks.count       || 0,
        projects:    projects.count    || 0,
        automations: automations.count || 0,
      })

      try {
        const { data: ld } = await learningApi.getInsights()
        if (ld.success) setLearningInsights(ld.insights)
      } catch {}
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
      setError(err.message || 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // Keyboard shortcuts: R=refresh, N=new meeting, T=new task, K=search
  const [showShortcuts, setShowShortcuts] = useState(false)
  useKeyboardShortcuts({
    'r': { callback: () => { toast.info('Refreshing dashboard…'); loadData() }, requireMod: false },
    'n': { callback: () => recorderRef.current?.scrollIntoView({ behavior:'smooth', block:'center' }), requireMod: false },
    't': { callback: () => navigate('/tasks'), requireMod: false },
    'mod+k': { callback: () => navigate('/search'), allowInInput: true },
    '?': { callback: () => setShowShortcuts(s => !s), requireMod: false },
  })

  const handleReviewPatterns   = () => navigate('/settings', { state: { section: 'ai-learning' } })
  const handleNavigateToLearn  = () => navigate('/settings', { state: { section: 'ai-learning' } })

  if (error) return <ErrorState message={error} onRetry={loadData} />

  return (
    <div className="space-y-4">

      {/* ── Hero section ── */}
      <DashboardHero stats={stats} loading={loading} navigate={navigate} recorderRef={recorderRef} />

      {/* ── Overdue alert banner ── */}
      <OverdueAlertBanner items={overdueItems} navigate={navigate} />

      {/* ── Full intelligence dashboard ── */}
      <IntelligenceDashboard />

      {/* ── AI learning insights ── */}
      {learningInsights && (
        <LearningInsightsWidget
          insights={learningInsights}
          onReview={handleReviewPatterns}
          onNavigate={handleNavigateToLearn}
        />
      )}

      {/* ── Insights & Trends + Team Workload row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <InsightsTrendsPanel insights={insights} />
        <TeamWorkloadWidget workload={teamWorkload} />
      </div>

      {/* ── System status ── */}
      {systemStatus && <SystemStatus systemStatus={systemStatus} />}

      {/* ── Main content grid — recorder + recent meetings + tasks + automations ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Meeting Recorder */}
        <div className="lg:col-span-1 space-y-4" ref={recorderRef}>
          <MeetingRecorder onMeetingProcessed={loadData} />
          <AutomationActivityFeed count={stats.automations} navigate={navigate} />
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Recent Meetings */}
          <div className="vc" style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--b0)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <h3 style={{ fontFamily:'var(--font)', fontWeight:600, fontSize:13, color:'var(--t0)' }}>Recent Meetings</h3>
              <Link to="/meetings" style={{ fontSize:12, color:'var(--c)', display:'flex', alignItems:'center', gap:4, textDecoration:'none' }}>
                View all <ArrowRight style={{ width:12, height:12 }} />
              </Link>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:2, padding:'6px 8px' }}>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} style={{ height:36, borderRadius:8, background:'rgba(248,240,242,.04)', animation:'pulse 1.5s ease-in-out infinite' }} />
                  ))
                : recentMeetings.length === 0
                  ? <p style={{ fontSize:12, color:'var(--t1)', padding:'16px', textAlign:'center' }}>No recent meetings</p>
                  : recentMeetings.map((m) => {
                      const sc = m.sentiment_label === 'Positive' ? 'mint' : m.sentiment_label === 'Negative' ? 'crimson' : 'neutral'
                      return (
                        <div
                          key={m.id}
                          onClick={() => navigate(`/meetings/${m.id}`)}
                          style={{ padding:'8px 10px', borderRadius:8, display:'flex', alignItems:'center', gap:10, cursor:'pointer', transition:'background .15s' }}
                          onMouseEnter={e => e.currentTarget.style.background='var(--b0)'}
                          onMouseLeave={e => e.currentTarget.style.background='transparent'}
                        >
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:600, color:'var(--t0)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.title}</div>
                            <div style={{ fontSize:11, color:'var(--t1)', fontFamily:'var(--font-mono)' }}>{new Date(m.created_at).toLocaleString()}</div>
                          </div>
                          {m.sentiment && <SentimentTrendMini sentiment={m.sentiment} />}
                          <VCBadge color={sc}>{m.sentiment_label || 'N/A'}</VCBadge>
                        </div>
                      )
                    })
              }
            </div>
          </div>

          {/* Open Tasks */}
          <div className="vc" style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--b0)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <h3 style={{ fontFamily:'var(--font)', fontWeight:600, fontSize:13, color:'var(--t0)' }}>Open Tasks</h3>
              <Link to="/tasks" style={{ fontSize:12, color:'var(--c)', display:'flex', alignItems:'center', gap:4, textDecoration:'none' }}>
                View all <ArrowRight style={{ width:12, height:12 }} />
              </Link>
            </div>
            <div>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} style={{ height:36, margin:'2px 0', background:'rgba(248,240,242,.04)', animation:'pulse 1.5s ease-in-out infinite' }} />
                  ))
                : pendingTasks.length === 0
                  ? <p style={{ fontSize:12, color:'var(--t1)', padding:'16px', textAlign:'center' }}>No open tasks</p>
                  : pendingTasks.map((task) => (
                      <div key={task.id} style={{ padding:'8px 14px', display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid var(--b0)', cursor:'pointer' }}>
                        <input
                          type="checkbox"
                          onChange={async (e) => {
                            e.stopPropagation()
                            const checkbox = e.currentTarget
                            try {
                              await tasksApi.complete(task.id)
                              toast.success('Task completed', 'Reopen it any time from the Tasks page.')
                              loadData()
                            } catch (err) {
                              console.error('Failed to complete task:', err)
                              if (checkbox) checkbox.checked = false
                              toast.error('Could not complete task', err.message || 'Please try again.')
                            }
                          }}
                          style={{ width:13, height:13, accentColor:'var(--c)', flexShrink:0, cursor:'pointer' }}
                        />
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ fontSize:12, color:'var(--t0)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.title}</p>
                          {task.due_date && (
                            <p style={{ fontSize:11, fontFamily:'var(--font-mono)', color: new Date(task.due_date) < new Date() ? 'var(--c)' : 'var(--t1)' }}>
                              Due: {new Date(task.due_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <VCBadge color={task.priority === 'high' ? 'crimson' : 'neutral'}>
                          {task.priority}
                        </VCBadge>
                      </div>
                    ))
              }
            </div>
          </div>

        </div>
      </div>

      {/* ── Keyboard shortcuts overlay ── */}
      {showShortcuts && (
        <div
          className="vc"
          style={{
            position:'fixed', bottom:16, right:16, zIndex:50,
            padding:'12px 16px',
            fontSize:12, color:'var(--t1)', fontFamily:'var(--font-mono)',
          }}
        >
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <Keyboard style={{ width:13, height:13, color:'var(--c)' }} />
            <span style={{ fontWeight:700, color:'var(--t0)', fontFamily:'var(--font)', fontSize:12 }}>Keyboard Shortcuts</span>
            <button onClick={() => setShowShortcuts(false)} style={{ marginLeft:'auto', background:'none', border:'none', color:'var(--t1)', cursor:'pointer', fontSize:14, lineHeight:1 }}>&times;</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'40px 1fr', gap:'4px 10px' }}>
            <kbd style={{ background:'var(--b0)', borderRadius:3, padding:'1px 5px', fontSize:11, textAlign:'center', color:'var(--t0)' }}>R</kbd><span>Refresh dashboard</span>
            <kbd style={{ background:'var(--b0)', borderRadius:3, padding:'1px 5px', fontSize:11, textAlign:'center', color:'var(--t0)' }}>N</kbd><span>Start new meeting</span>
            <kbd style={{ background:'var(--b0)', borderRadius:3, padding:'1px 5px', fontSize:11, textAlign:'center', color:'var(--t0)' }}>T</kbd><span>New task</span>
            <kbd style={{ background:'var(--b0)', borderRadius:3, padding:'1px 5px', fontSize:11, textAlign:'center', color:'var(--t0)' }}>⌘K</kbd><span>Search</span>
            <kbd style={{ background:'var(--b0)', borderRadius:3, padding:'1px 5px', fontSize:11, textAlign:'center', color:'var(--t0)' }}>?</kbd><span>Toggle this panel</span>
          </div>
        </div>
      )}

      {/* ── Shortcuts hint footer ── */}
      <div style={{ textAlign:'center', padding:'4px 0' }}>
        <span style={{ fontSize:11, color:'var(--t1)', cursor:'pointer' }} onClick={() => setShowShortcuts(s => !s)}>
          Press <kbd style={{ background:'var(--b0)', borderRadius:2, padding:'0 3px', fontSize:11, color:'var(--t1)' }}>?</kbd> for keyboard shortcuts
        </span>
      </div>
    </div>
  )
}
