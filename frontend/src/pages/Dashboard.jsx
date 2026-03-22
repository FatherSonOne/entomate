import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mic, FolderKanban, CheckSquare, Zap, ArrowRight, Server, BrainCircuit } from 'lucide-react'
import MeetingRecorder from '../components/MeetingRecorder'
import IntelligenceDashboard from '../components/intelligence/IntelligenceDashboard'
import { LearningInsightsWidget } from '../components/intelligence'
import { meetingsApi, tasksApi, projectsApi, checkHealth } from '../services/api'
import { VCMetricCard, VCMeetingCard, VCBadge } from '../components/vc'

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ meetings: 0, tasks: 0, projects: 0 })
  const [recentMeetings, setRecentMeetings] = useState([])
  const [pendingTasks, setPendingTasks] = useState([])
  const [systemStatus, setSystemStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [learningInsights, setLearningInsights] = useState(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [health, meetings, tasks, projects] = await Promise.all([
          checkHealth().catch(() => ({ services: {} })),
          meetingsApi.list({ limit: 5 }).catch(() => ({ meetings: [], count: 0 })),
          tasksApi.list({ limit: 5, status: 'open' }).catch(() => ({ tasks: [], count: 0 })),
          projectsApi.list({ limit: 5 }).catch(() => ({ projects: [], count: 0 })),
        ]);
        setSystemStatus(health);
        setRecentMeetings(meetings.meetings || []);
        setPendingTasks(tasks.tasks || []);
        setStats({
          meetings: meetings.count || 0,
          tasks: tasks.count || 0,
          projects: projects.count || 0,
        });

        // Fetch learning insights
        try {
          const learningResponse = await fetch('/api/learning/insights');
          if (learningResponse.ok) {
            const learningData = await learningResponse.json();
            if (learningData.success) {
              setLearningInsights(learningData.insights);
            }
          }
        } catch (error) {
          console.error('Failed to load learning insights:', error);
        }
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const metricCards = [
    { label: 'Meetings',    value: stats.meetings, icon: <Mic className="w-4 h-4" />,          color: 'crimson',  href: '/meetings',    delta: 'View all →' },
    { label: 'Projects',    value: stats.projects, icon: <FolderKanban className="w-4 h-4" />, color: 'mint',     href: '/projects',    delta: null },
    { label: 'Open Tasks',  value: stats.tasks,    icon: <CheckSquare className="w-4 h-4" />,  color: 'amber',    href: '/tasks',       delta: null },
    { label: 'Automations', value: '3',            icon: <Zap className="w-4 h-4" />,          color: 'phosphor', href: '/automations', delta: null },
  ]

  const getServiceStatus = (service) => {
    const status = systemStatus?.services?.[service] || 'checking...';
    const isConnected = status.includes('connected');
    return { status, isConnected };
  };

  const handleReviewPatterns = () => {
    navigate('/settings', { state: { section: 'ai-learning' } });
  };

  const handleNavigateToLearning = () => {
    navigate('/settings', { state: { section: 'ai-learning' } });
  };

  return (
    <div className="space-y-4">
      {/* Enhanced Intelligence Dashboard - AI-powered meeting prep, deal risks, action items, and relationships */}
      <IntelligenceDashboard />

      {/* VC Metric grid — Neo+Cinema style */}
      <div className="vc-grid-4">
        {metricCards.map(card => (
          <VCMetricCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            color={card.color}
            delta={card.delta}
            href={card.href}
          />
        ))}
      </div>

      {/* AI Learning Insights Widget */}
      {learningInsights && (
        <LearningInsightsWidget
          insights={learningInsights}
          onReview={handleReviewPatterns}
          onNavigate={handleNavigateToLearning}
        />
      )}

      {systemStatus && (
        <div className="vc" style={{ padding: '10px 14px', borderLeft: '2px solid rgba(248,240,242,.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
            <div className="flex items-center gap-2" title={getServiceStatus('gemini').status}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: getServiceStatus('gemini').isConnected ? 'var(--accent-secondary, #00F5D4)' : 'rgba(255,184,0,.8)', boxShadow: getServiceStatus('gemini').isConnected ? '0 0 4px var(--accent-secondary)' : 'none' }} />
              <span style={{ color: 'var(--text-tertiary)' }}>AI:</span>
              <span style={{ color: 'var(--text-primary)' }}>{getServiceStatus('gemini').status}</span>
            </div>
            <div className="flex items-center gap-2" title={getServiceStatus('database').status}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: getServiceStatus('database').isConnected ? 'var(--accent-secondary, #00F5D4)' : 'rgba(255,184,0,.8)', boxShadow: getServiceStatus('database').isConnected ? '0 0 4px var(--accent-secondary)' : 'none' }} />
              <span style={{ color: 'var(--text-tertiary)' }}>DB:</span>
              <span style={{ color: 'var(--text-primary)' }}>{getServiceStatus('database').status}</span>
            </div>
          </div>
        </div>
      )}

      {/* Dev-Core: Main grid with different column split for density */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <MeetingRecorder onMeetingProcessed={() => loadData()} />
        </div>
        
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="vc" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
              <h3 className="font-semibold text-sm" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>Recent Meetings</h3>
              <Link to="/meetings" className="text-xs flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}>
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 8px' }}>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 rounded animate-pulse" style={{ background: 'var(--bg-elevated)' }} />
                ))
              ) : recentMeetings.length === 0 ? (
                <p className="text-sm p-4 text-center" style={{ color: 'var(--text-tertiary)' }}>No recent meetings</p>
              ) : (
                recentMeetings.map((meeting) => {
                  const sentimentColor = meeting.sentiment_label === 'Positive' ? 'mint' : meeting.sentiment_label === 'Negative' ? 'error' : 'neutral'
                  return (
                    <VCMeetingCard
                      key={meeting.id}
                      title={meeting.title}
                      meta={new Date(meeting.created_at).toLocaleString()}
                      badge={<VCBadge color={sentimentColor}>{meeting.sentiment_label || 'N/A'}</VCBadge>}
                      onClick={() => navigate(`/meetings/${meeting.id}`)}
                    />
                  )
                })
              )}
            </div>
          </div>
          
          <div className="vc">
            <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(248,240,242,.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>Open Tasks</h3>
              <Link to="/tasks" style={{ fontSize: 11, color: 'var(--accent-primary, #FF2D6B)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div>
               {loading ? (
                 Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ height: 36, background: 'rgba(248,240,242,.04)', animation: 'pulse 1.5s ease-in-out infinite' }}></div>)
              ) : pendingTasks.length === 0 ? (
                <p className="text-sm text-content-tertiary p-4 text-center">No open tasks</p>
              ) : (
                pendingTasks.map((task) => (
                  <div key={task.id} style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(248,240,242,.04)', cursor: 'pointer' }}>
                    <input type="checkbox" style={{ width: 14, height: 14, accentColor: 'var(--accent-primary, #FF2D6B)', background: 'transparent', borderColor: 'rgba(248,240,242,.2)', borderRadius: 3 }} />
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</p>
                      {task.due_date && <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: new Date(task.due_date) < new Date() ? 'var(--accent-primary, #FF2D6B)' : 'var(--text-tertiary)' }}>Due: {new Date(task.due_date).toLocaleDateString()}</p>}
                    </div>
                    <VCBadge color={task.priority === 'high' ? 'crimson' : task.priority === 'medium' ? 'amber' : 'neutral'}>{task.priority}</VCBadge>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}