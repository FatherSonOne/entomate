import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Mic, FolderKanban, CheckSquare, Zap, ArrowRight, Server, BrainCircuit } from 'lucide-react'
import MeetingRecorder from '../components/MeetingRecorder'
import DailyBriefing from '../components/DailyBriefing'
import { meetingsApi, tasksApi, projectsApi, checkHealth } from '../services/api'

// Dev-Core Stat Card: Emphasizes mono font and high contrast
const StatCard = ({ label, value, icon: Icon, href, accent }) => {
  const accentClasses = {
    primary: 'text-accent-primary',
    blue: 'text-accent-secondary',
    purple: 'text-accent-tertiary',
    yellow: 'text-semantic-warning',
  };

  return (
    <Link
      to={href}
      className="card p-4 group transition-all duration-200 hover:bg-surface-elevated hover:border-accent-primary hover:shadow-glow"
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <p className="text-sm font-medium text-content-secondary uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-mono font-bold text-content-primary mt-1">{value}</p>
        </div>
        <Icon className={`w-6 h-6 flex-shrink-0 ${accentClasses[accent] || 'text-content-tertiary'}`} />
      </div>
    </Link>
  );
};

export default function Dashboard() {
  const [stats, setStats] = useState({ meetings: 0, tasks: 0, projects: 0 })
  const [recentMeetings, setRecentMeetings] = useState([])
  const [pendingTasks, setPendingTasks] = useState([])
  const [systemStatus, setSystemStatus] = useState(null)
  const [loading, setLoading] = useState(true)

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
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const statCardsData = [
    { label: 'Meetings', value: stats.meetings, icon: Mic, href: '/meetings', accent: 'primary' },
    { label: 'Projects', value: stats.projects, icon: FolderKanban, href: '/projects', accent: 'blue' },
    { label: 'Open Tasks', value: stats.tasks, icon: CheckSquare, href: '/tasks', accent: 'yellow' },
    { label: 'Automations', value: '3', icon: Zap, href: '/automations', accent: 'purple' },
  ];

  const getServiceStatus = (service) => {
    const status = systemStatus?.services?.[service] || 'checking...';
    const isConnected = status.includes('connected');
    return { status, isConnected };
  };

  return (
    <div className="space-y-4">
      {/* Dev-Core: Briefing is more compact and integrated */}
      <DailyBriefing />
      
      {/* Dev-Core: High-density stat grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {statCardsData.map(card => <StatCard key={card.label} {...card} />)}
      </div>

      {systemStatus && (
        <div className="card p-2 border-l-2 border-line-default">
          <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs font-mono">
            <div className="flex items-center gap-2" title={getServiceStatus('gemini').status}>
              <div className={`w-1.5 h-1.5 rounded-full ${getServiceStatus('gemini').isConnected ? 'bg-semantic-success animate-pulse' : 'bg-semantic-warning'}`} />
              <span className="text-content-secondary">AI:</span>
              <span className="text-content-primary">{getServiceStatus('gemini').status}</span>
            </div>
            <div className="flex items-center gap-2" title={getServiceStatus('database').status}>
              <div className={`w-1.5 h-1.5 rounded-full ${getServiceStatus('database').isConnected ? 'bg-semantic-success animate-pulse' : 'bg-semantic-warning'}`} />
              <span className="text-content-secondary">DB:</span>
               <span className="text-content-primary">{getServiceStatus('database').status}</span>
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
          <div className="card">
            <div className="p-3 border-b border-line-strong flex items-center justify-between">
              <h3 className="font-semibold text-content-primary text-sm">Recent Meetings</h3>
              <Link to="/meetings" className="text-xs text-accent-primary hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {/* Dev-Core: Use a table-like structure for dense lists */}
            <div className="divide-y divide-line-default">
              {loading ? (
                 Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-surface-elevated animate-pulse"></div>)
              ) : recentMeetings.length === 0 ? (
                <p className="text-sm text-content-tertiary p-4 text-center">No recent meetings</p>
              ) : (
                recentMeetings.map((meeting) => (
                  <Link key={meeting.id} to={`/meetings/${meeting.id}`} className="p-2 flex items-center justify-between group hover:bg-surface-elevated">
                    <div>
                      <p className="font-medium text-sm text-content-primary group-hover:text-accent-primary truncate">{meeting.title}</p>
                      <p className="text-xs text-content-tertiary font-mono">{new Date(meeting.created_at).toLocaleString()}</p>
                    </div>
                     <span className={`badge text-xs ${ meeting.sentiment_label === 'Positive' ? 'badge-success' : meeting.sentiment_label === 'Negative' ? 'badge-error' : 'badge-gray'}`}>
                        {meeting.sentiment_label || 'N/A'}
                      </span>
                  </Link>
                ))
              )}
            </div>
          </div>
          
          <div className="card">
            <div className="p-3 border-b border-line-strong flex items-center justify-between">
              <h3 className="font-semibold text-content-primary text-sm">Open Tasks</h3>
              <Link to="/tasks" className="text-xs text-accent-primary hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-line-default">
               {loading ? (
                 Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-surface-elevated animate-pulse"></div>)
              ) : pendingTasks.length === 0 ? (
                <p className="text-sm text-content-tertiary p-4 text-center">No open tasks</p>
              ) : (
                pendingTasks.map((task) => (
                  <div key={task.id} className="p-2 flex items-center gap-3 group hover:bg-surface-elevated">
                    <input type="checkbox" className="w-4 h-4 text-accent-primary bg-surface border-line-strong rounded focus:ring-accent-primary focus:ring-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-content-primary group-hover:text-accent-primary truncate">{task.title}</p>
                      {task.due_date && <p className={`text-xs font-mono ${new Date(task.due_date) < new Date() ? 'text-semantic-error' : 'text-content-tertiary'}`}>Due: {new Date(task.due_date).toLocaleDateString()}</p>}
                    </div>
                    <span className={`badge text-xs ${ task.priority === 'high' ? 'badge-error' : task.priority === 'medium' ? 'badge-warning' : 'badge-gray'}`}>
                      {task.priority}
                    </span>
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