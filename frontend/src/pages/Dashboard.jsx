import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Mic, FolderKanban, CheckSquare, Zap, ArrowRight,
  BrainCircuit, Plus, Sparkles, Target, Play,
} from 'lucide-react'
import MeetingRecorder from '../components/MeetingRecorder'
import IntelligenceDashboard from '../components/intelligence/IntelligenceDashboard'
import { LearningInsightsWidget } from '../components/intelligence'
import { meetingsApi, tasksApi, projectsApi, learningApi, checkHealth } from '../services/api'
import { VCBadge } from '../components/vc'
import ErrorState from '../components/vc/ErrorState'

/* ═══════════════════════════════════════════════════════════════
   TYPEWRITER HOOK
   ═══════════════════════════════════════════════════════════════ */
function useTypewriter(phrases, speed = 58, pause = 2600) {
  const [display, setDisplay] = useState('')
  const [phase, setPhase] = useState(0)   // 0=typing 1=hold 2=deleting
  const [pIdx, setPIdx] = useState(0)
  const [cIdx, setCIdx] = useState(0)

  useEffect(() => {
    const current = phrases[pIdx]
    if (phase === 0) {
      if (cIdx < current.length) {
        const t = setTimeout(() => { setDisplay(current.slice(0, cIdx + 1)); setCIdx(c => c + 1) }, speed)
        return () => clearTimeout(t)
      } else {
        const t = setTimeout(() => setPhase(1), pause)
        return () => clearTimeout(t)
      }
    }
    if (phase === 1) {
      const t = setTimeout(() => setPhase(2), 300)
      return () => clearTimeout(t)
    }
    if (phase === 2) {
      if (cIdx > 0) {
        const t = setTimeout(() => { setDisplay(current.slice(0, cIdx - 1)); setCIdx(c => c - 1) }, speed / 2.2)
        return () => clearTimeout(t)
      } else {
        setPIdx(p => (p + 1) % phrases.length)
        setPhase(0)
      }
    }
  }, [phase, cIdx, pIdx, phrases, speed, pause])

  return display
}

/* ═══════════════════════════════════════════════════════════════
   RING GAUGE
   ═══════════════════════════════════════════════════════════════ */
const RING_COLORS = {
  crimson:  { stroke: '#FF2D6B', glow: 'rgba(255,45,107,.4)',  bg: 'rgba(255,45,107,.10)', text: '#FF2D6B' },
  mint:     { stroke: '#00F5D4', glow: 'rgba(0,245,212,.35)',  bg: 'rgba(0,245,212,.10)',  text: '#00F5D4' },
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
        <span style={{ fontSize:8, color:'var(--t2)', fontFamily:'var(--font)', letterSpacing:'.04em', textTransform:'uppercase' }}>{label}</span>
      </div>

      {/* Icon dot bottom-right */}
      <div style={{ position:'absolute', bottom:8, right:8, width:18, height:18, borderRadius:5, background:c.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <span style={{ color:c.text, display:'flex' }}>{icon}</span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   INTELLIGENCE BRIEF CARD
   ═══════════════════════════════════════════════════════════════ */
function IntelligenceBriefCard({ meetings, tasks, projects }) {
  const items = [
    meetings > 0
      ? { dot:'var(--c)',  text:`${meetings} meeting${meetings !== 1 ? 's' : ''} recorded — summaries & action items extracted` }
      : { dot:'var(--t2)', text:'No meetings yet — start your first recording below' },
    tasks > 0
      ? { dot:'var(--a)',  text:`${tasks} open task${tasks !== 1 ? 's' : ''} pending — AI priority ranking active` }
      : { dot:'var(--t2)', text:'Task queue clear — all action items resolved' },
    projects > 0
      ? { dot:'var(--m)',  text:`${projects} active project${projects !== 1 ? 's' : ''} tracked — relationship graphs updating` }
      : { dot:'var(--t2)', text:'No projects yet — create one to enable deal intelligence' },
    { dot:'var(--p)', text:'3 automation workflows running — follow-up detection enabled' },
  ]

  return (
    <div className="vc" style={{ flex:1, padding:'16px 18px', borderLeft:'2px solid var(--c)', display:'flex', flexDirection:'column', gap:12 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ width:26, height:26, borderRadius:6, background:'var(--ad)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <BrainCircuit style={{ width:13, height:13, color:'var(--a)' }} />
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, fontWeight:700, fontFamily:'var(--font)', color:'var(--t0)', letterSpacing:'.04em' }}>Intelligence Briefing</div>
          <div style={{ fontSize:9, color:'var(--t2)' }}>Live system snapshot · {new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' })}</div>
        </div>
        <span style={{ background:'var(--ad)', border:'1px solid rgba(255,184,0,.3)', color:'var(--a)', fontSize:8, fontWeight:800, padding:'2px 6px', borderRadius:3, letterSpacing:'.06em', fontFamily:'var(--font)' }}>AI</span>
      </div>

      {/* Bullet items */}
      <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:9 }}>
            <div style={{ width:5, height:5, borderRadius:'50%', background:item.dot, marginTop:5, flexShrink:0, boxShadow:`0 0 5px ${item.dot}` }} />
            <span style={{ fontSize:11, color:'var(--t1)', lineHeight:1.55 }}>{item.text}</span>
          </div>
        ))}
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
    { label:'AI Insights',   icon:<Sparkles style={{ width:13, height:13 }} />,      cls:'vbtn-mint',      action:() => navigate('/reports') },
    { label:'Automations',   icon:<Zap style={{ width:13, height:13 }} />,           cls:'vbtn-amber',     action:() => navigate('/automations') },
  ]

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:8, flexWrap:'wrap',
      padding:'10px 14px',
      background:'var(--neo-base, #141414)',
      border:'1px solid rgba(255,45,107,.14)',
      borderRadius:'var(--vc-rad, 13px)',
      boxShadow:'7px 7px 14px var(--neo-d,#0C0C0C), -7px -7px 14px var(--neo-l,#1E1E1E), 0 0 20px rgba(255,45,107,.06)',
    }}>
      <span style={{ fontSize:9, fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--t2)', marginRight:2, whiteSpace:'nowrap' }}>Quick Actions</span>
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
  const hour = new Date().getHours()
  const timeGreet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const phrases = [
    `${timeGreet}, Aegis.`,
    'Your AI is standing by.',
    'Intelligence dashboard active.',
    'All agents operational.',
    'Meeting memory is running.',
  ]
  const greeting = useTypewriter(phrases, 55, 2400)

  const rings = [
    { label:'Meetings',  value:stats.meetings,  max:Math.max(stats.meetings, 15),  color:'crimson',  icon:<Mic style={{ width:9, height:9 }} />,          href:'/meetings' },
    { label:'Tasks',     value:stats.tasks,     max:Math.max(stats.tasks, 20),     color:'amber',    icon:<CheckSquare style={{ width:9, height:9 }} />,   href:'/tasks' },
    { label:'Projects',  value:stats.projects,  max:Math.max(stats.projects, 10),  color:'mint',     icon:<FolderKanban style={{ width:9, height:9 }} />,  href:'/projects' },
    { label:'Auto',      value:3,               max:10,                            color:'phosphor', icon:<Zap style={{ width:9, height:9 }} />,           href:'/automations' },
  ]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {/* ── 2-col hero split ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 196px', gap:10, alignItems:'stretch', minHeight:220 }}>

        {/* LEFT: greeting + intelligence brief */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {/* Greeting panel */}
          <div className="vc" style={{ padding:'20px 22px', minHeight:80 }}>
            <div style={{ fontSize:20, fontWeight:700, fontFamily:'var(--font)', color:'var(--t0)', lineHeight:1.3, letterSpacing:'-.01em', minHeight:26 }}>
              {greeting}
              <span style={{
                display:'inline-block', width:2, height:'1em', background:'var(--c)',
                marginLeft:2, verticalAlign:'text-bottom',
                animation:'vc-cursor-blink 1s step-end infinite',
              }} />
            </div>
            <div style={{ marginTop:6, fontSize:11, color:'var(--t2)' }}>
              {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}
            </div>
          </div>

          {/* Intelligence brief card — grows to fill space */}
          {loading ? (
            <div className="vc" style={{ flex:1, padding:'16px 18px' }}>
              {[80, 65, 90, 55].map((w, i) => (
                <div key={i} style={{ height:12, marginBottom:10, borderRadius:6, background:'rgba(248,240,242,.06)', width:`${w}%`, animation:'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          ) : (
            <IntelligenceBriefCard meetings={stats.meetings} tasks={stats.tasks} projects={stats.projects} />
          )}
        </div>

        {/* RIGHT: 2×2 ring gauge grid */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gridTemplateRows:'1fr 1fr', gap:8 }}>
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
      </div>

      {/* ── Docked quick actions bar ── */}
      <QuickActionsBar navigate={navigate} recorderRef={recorderRef} />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   SYSTEM STATUS BAR
   ═══════════════════════════════════════════════════════════════ */
function SystemStatus({ systemStatus }) {
  const svc = (key) => {
    const s = systemStatus?.services?.[key] || 'checking...'
    return { status: s, ok: s.includes('connected') }
  }
  return (
    <div className="vc" style={{ padding:'8px 14px', borderLeft:'2px solid rgba(248,240,242,.08)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap', fontSize:10, fontFamily:'var(--font-mono, JetBrains Mono, monospace)' }}>
        {[['AI', 'gemini'], ['DB', 'database']].map(([label, key]) => {
          const { status, ok } = svc(key)
          return (
            <div key={key} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:5, height:5, borderRadius:'50%', background: ok ? 'var(--m)' : 'var(--a)', boxShadow: ok ? '0 0 6px var(--m)' : 'none' }} />
              <span style={{ color:'var(--t2)' }}>{label}:</span>
              <span style={{ color:'var(--t0)' }}>{status}</span>
            </div>
          )
        })}
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

  const [stats, setStats]               = useState({ meetings: 0, tasks: 0, projects: 0 })
  const [recentMeetings, setRecentMeetings] = useState([])
  const [pendingTasks, setPendingTasks]     = useState([])
  const [systemStatus, setSystemStatus]     = useState(null)
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState(null)
  const [learningInsights, setLearningInsights] = useState(null)

  const loadData = async () => {
    try {
      setError(null)
      setLoading(true)
      const [health, meetings, tasks, projects] = await Promise.all([
        checkHealth().catch(() => ({ services: {} })),
        meetingsApi.list({ limit: 5 }).catch(() => ({ meetings: [], count: 0 })),
        tasksApi.list({ limit: 5, status: 'open' }).catch(() => ({ tasks: [], count: 0 })),
        projectsApi.list({ limit: 5 }).catch(() => ({ projects: [], count: 0 })),
      ])
      setSystemStatus(health)
      setRecentMeetings(meetings.meetings || [])
      setPendingTasks(tasks.tasks || [])
      setStats({
        meetings: meetings.count || 0,
        tasks:    tasks.count    || 0,
        projects: projects.count || 0,
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

  const handleReviewPatterns   = () => navigate('/settings', { state: { section: 'ai-learning' } })
  const handleNavigateToLearn  = () => navigate('/settings', { state: { section: 'ai-learning' } })

  if (error) return <ErrorState message={error} onRetry={loadData} />

  return (
    <div className="space-y-4">

      {/* ── Hero section ── */}
      <DashboardHero stats={stats} loading={loading} navigate={navigate} recorderRef={recorderRef} />

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

      {/* ── System status ── */}
      {systemStatus && <SystemStatus systemStatus={systemStatus} />}

      {/* ── Main content grid — recorder + recent meetings + tasks ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Meeting Recorder */}
        <div className="lg:col-span-1" ref={recorderRef}>
          <MeetingRecorder onMeetingProcessed={loadData} />
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Recent Meetings */}
          <div className="vc" style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--b0)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <h3 style={{ fontFamily:'var(--font)', fontWeight:600, fontSize:13, color:'var(--t0)' }}>Recent Meetings</h3>
              <Link to="/meetings" style={{ fontSize:11, color:'var(--c)', display:'flex', alignItems:'center', gap:4, textDecoration:'none' }}>
                View all <ArrowRight style={{ width:12, height:12 }} />
              </Link>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:2, padding:'6px 8px' }}>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} style={{ height:36, borderRadius:8, background:'rgba(248,240,242,.04)', animation:'pulse 1.5s ease-in-out infinite' }} />
                  ))
                : recentMeetings.length === 0
                  ? <p style={{ fontSize:12, color:'var(--t2)', padding:'16px', textAlign:'center' }}>No recent meetings</p>
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
                            <div style={{ fontSize:10, color:'var(--t2)', fontFamily:'var(--font-mono)' }}>{new Date(m.created_at).toLocaleString()}</div>
                          </div>
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
              <Link to="/tasks" style={{ fontSize:11, color:'var(--c)', display:'flex', alignItems:'center', gap:4, textDecoration:'none' }}>
                View all <ArrowRight style={{ width:12, height:12 }} />
              </Link>
            </div>
            <div>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} style={{ height:36, margin:'2px 0', background:'rgba(248,240,242,.04)', animation:'pulse 1.5s ease-in-out infinite' }} />
                  ))
                : pendingTasks.length === 0
                  ? <p style={{ fontSize:12, color:'var(--t2)', padding:'16px', textAlign:'center' }}>No open tasks</p>
                  : pendingTasks.map((task) => (
                      <div key={task.id} style={{ padding:'8px 14px', display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid var(--b0)', cursor:'pointer' }}>
                        <input
                          type="checkbox"
                          style={{ width:13, height:13, accentColor:'var(--c)', flexShrink:0 }}
                        />
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ fontSize:12, color:'var(--t0)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.title}</p>
                          {task.due_date && (
                            <p style={{ fontSize:10, fontFamily:'var(--font-mono)', color: new Date(task.due_date) < new Date() ? 'var(--c)' : 'var(--t2)' }}>
                              Due: {new Date(task.due_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <VCBadge color={task.priority === 'high' ? 'crimson' : task.priority === 'medium' ? 'amber' : 'neutral'}>
                          {task.priority}
                        </VCBadge>
                      </div>
                    ))
              }
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
