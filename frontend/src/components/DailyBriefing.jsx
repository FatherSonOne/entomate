import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, AlertTriangle, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react'
import { meetingsApi, tasksApi } from '../services/api'

// Dev-Core Briefing: Compact, data-driven, like a startup log
export default function DailyBriefing() {
  const [briefing, setBriefing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadBriefing = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);

      const [meetings, tasks] = await Promise.all([
        meetingsApi.list({ limit: 10, days: 7 }).catch(() => ({ meetings: [] })),
        tasksApi.list({ limit: 50 }).catch(() => ({ tasks: [] })),
      ]);

      const today = new Date();
      const openTasks = tasks.tasks.filter(t => t.status !== 'done' && t.status !== 'completed');
      const overdueTasks = openTasks.filter(t => t.due_date && new Date(t.due_date) < today);
      const dueTodayTasks = openTasks.filter(t => t.due_date?.startsWith(today.toISOString().split('T')[0]));
      
      let summary;
      if (overdueTasks.length > 0) {
        summary = `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''} require attention.`;
      } else if (dueTodayTasks.length > 0) {
        summary = `${dueTodayTasks.length} task${dueTodayTasks.length > 1 ? 's' : ''} due today.`;
      } else if (openTasks.length > 0) {
        summary = `${openTasks.length} open task${openTasks.length > 1 ? 's' : ''}.`;
      } else {
        summary = "All clear. No pending tasks.";
      }

      setBriefing({
        summary,
        stats: [
          { label: 'Open', value: openTasks.length },
          { label: 'Overdue', value: overdueTasks.length, isError: overdueTasks.length > 0 },
          { label: 'Due Today', value: dueTodayTasks.length, isWarning: dueTodayTasks.length > 0 },
          { label: 'Meetings (7d)', value: meetings.meetings.length },
        ],
        topTasks: [...overdueTasks, ...dueTodayTasks].filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i).slice(0, 3),
      });

    } catch (error) {
      console.error('Failed to load briefing:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadBriefing() }, []);

  if (loading) {
    return (
      <div className="card p-3 animate-pulse">
        <div className="h-4 bg-surface-elevated rounded w-3/4 mb-3"></div>
        <div className="grid grid-cols-4 gap-2">
          <div className="h-10 bg-surface-elevated rounded"></div>
          <div className="h-10 bg-surface-elevated rounded"></div>
          <div className="h-10 bg-surface-elevated rounded"></div>
          <div className="h-10 bg-surface-elevated rounded"></div>
        </div>
      </div>
    );
  }

  if (!briefing) return null;

  return (
    <div className="card">
      <div className="p-3 border-b border-line-default">
        <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-content-primary flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent-tertiary" />
              <span>AI Daily Briefing</span>
            </h3>
            <button
              onClick={() => loadBriefing(true)}
              disabled={refreshing}
              className="p-1 text-content-tertiary hover:text-content-primary"
              title="Refresh briefing"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
        </div>
        <p className="text-sm text-content-secondary mt-1">{briefing.summary}</p>
      </div>
      
      <div className="grid grid-cols-4 divide-x divide-line-default bg-surface-elevated">
        {briefing.stats.map(stat => (
          <div key={stat.label} className="p-2 text-center">
            <p className={`text-xl font-mono font-bold ${stat.isError ? 'text-semantic-error' : stat.isWarning ? 'text-semantic-warning' : 'text-content-primary'}`}>
              {stat.value}
            </p>
            <p className="text-xs text-content-tertiary uppercase tracking-wider">{stat.label}</p>
          </div>
        ))}
      </div>

      {briefing.topTasks.length > 0 && (
        <div className="p-3 border-t border-line-default">
           <h4 className="text-xs font-semibold text-content-secondary mb-2 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-semantic-warning" />
            Priority Focus
          </h4>
          <div className="space-y-1">
            {briefing.topTasks.map((task) => (
              <div key={task.id} className="p-1.5 rounded-md flex items-center justify-between bg-surface-elevated hover:bg-surface-muted">
                <span className="text-sm text-content-primary truncate flex-1">{task.title}</span>
                <span className="text-xs font-mono text-semantic-error font-medium">{new Date(task.due_date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}