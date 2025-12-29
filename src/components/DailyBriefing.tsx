import React, { useState, useEffect } from 'react';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: 'high' | 'medium' | 'low';
  due_date?: string;
}

interface Meeting {
  id: string;
  title: string;
  summary?: string;
  created_at: string;
  duration_minutes?: number;
  sentiment_label?: 'Positive' | 'Neutral' | 'Negative';
}

interface BriefingData {
  greeting: string;
  greetingIcon: 'sun' | 'cloud-sun' | 'moon';
  date: string;
  summary: string;
  stats: {
    openTasks: number;
    dueTodayTasks: number;
    overdueTasks: number;
    highPriorityTasks: number;
    dueThisWeekTasks: number;
    meetingsThisWeek: number;
  };
  topTasks: Task[];
  recentMeeting: Meeting | null;
  sentimentTrend: string;
}

interface DailyBriefingProps {
  onNavigate: (tab: string) => void;
}

// Icon components
const SunIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </svg>
);

const CloudSunIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M12 2v2"></path>
    <path d="m4.93 4.93 1.41 1.41"></path>
    <path d="M20 12h2"></path>
    <path d="m19.07 4.93-1.41 1.41"></path>
    <path d="M15.947 12.65a4 4 0 0 0-5.925-4.128"></path>
    <path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"></path>
  </svg>
);

const MoonIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </svg>
);

const RefreshIcon = ({ spinning }: { spinning: boolean }) => (
  <svg className={`w-5 h-5 ${spinning ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M23 4v6h-6"></path>
    <path d="M1 20v-6h6"></path>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
  </svg>
);

export function DailyBriefing({ onNavigate }: DailyBriefingProps) {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadBriefing();
  }, []);

  const loadBriefing = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      // For now, use mock data - in production, this would call your API
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      // Generate greeting based on time
      const hour = today.getHours();
      let greeting: string;
      let greetingIcon: 'sun' | 'cloud-sun' | 'moon';

      if (hour < 12) {
        greeting = 'Good morning';
        greetingIcon = 'sun';
      } else if (hour < 17) {
        greeting = 'Good afternoon';
        greetingIcon = 'cloud-sun';
      } else {
        greeting = 'Good evening';
        greetingIcon = 'moon';
      }

      // Mock stats - replace with actual API calls
      const mockStats = {
        openTasks: 0,
        dueTodayTasks: 0,
        overdueTasks: 0,
        highPriorityTasks: 0,
        dueThisWeekTasks: 0,
        meetingsThisWeek: 0
      };

      // Generate summary
      let summaryParts: string[] = [];
      if (mockStats.overdueTasks > 0) {
        summaryParts.push(`${mockStats.overdueTasks} overdue task${mockStats.overdueTasks > 1 ? 's' : ''}`);
      }
      if (mockStats.dueTodayTasks > 0) {
        summaryParts.push(`${mockStats.dueTodayTasks} due today`);
      }
      if (summaryParts.length === 0) {
        summaryParts.push("You're all caught up!");
      }

      setBriefing({
        greeting,
        greetingIcon,
        date: today.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric'
        }),
        summary: summaryParts.join(' • '),
        stats: mockStats,
        topTasks: [],
        recentMeeting: null,
        sentimentTrend: 'Neutral'
      });

    } catch (error) {
      console.error('Failed to load briefing:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="cmf-card p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!briefing) return null;

  const { greeting, greetingIcon, date, summary, stats, topTasks, recentMeeting } = briefing;

  const GreetingIcon = greetingIcon === 'sun' ? SunIcon : greetingIcon === 'cloud-sun' ? CloudSunIcon : MoonIcon;

  return (
    <div className="cmf-card overflow-hidden">
      {/* Header with gradient - using blue accent */}
      <div className="bg-gradient-to-r from-[#2563EB] to-[#1d4ed8] p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <GreetingIcon />
              <span className="text-blue-100 text-sm">{date}</span>
            </div>
            <h2 className="text-2xl font-bold">{greeting}!</h2>
            <p className="text-blue-100 mt-1 flex items-center gap-1">
              <span>✨</span>
              {summary}
            </p>
          </div>
          <button
            onClick={() => loadBriefing(true)}
            disabled={refreshing}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Refresh briefing"
          >
            <RefreshIcon spinning={refreshing} />
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
        <div className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{stats.openTasks}</p>
          <p className="text-xs text-gray-500">Open Tasks</p>
        </div>
        <div className="p-4 text-center">
          <p className={`text-2xl font-bold ${stats.overdueTasks > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {stats.overdueTasks}
          </p>
          <p className="text-xs text-gray-500">Overdue</p>
        </div>
        <div className="p-4 text-center">
          <p className={`text-2xl font-bold ${stats.dueTodayTasks > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
            {stats.dueTodayTasks}
          </p>
          <p className="text-xs text-gray-500">Due Today</p>
        </div>
        <div className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{stats.meetingsThisWeek}</p>
          <p className="text-xs text-gray-500">This Week</p>
        </div>
      </div>

      {/* Priority tasks */}
      {topTasks.length > 0 && (
        <div className="p-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="text-amber-500">⚠️</span>
            Priority Focus
          </h3>
          <div className="space-y-2">
            {topTasks.map((task) => {
              const isOverdue = task.due_date && new Date(task.due_date) < new Date();
              return (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 p-2 rounded-lg ${
                    isOverdue ? 'bg-red-50' : 'bg-gray-50'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${
                    task.priority === 'high' ? 'bg-red-500' :
                    task.priority === 'medium' ? 'bg-amber-500' : 'bg-green-500'
                  }`} />
                  <span className="flex-1 text-sm text-gray-700 truncate">
                    {task.title}
                  </span>
                  {task.due_date && (
                    <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                      {isOverdue ? 'Overdue' : new Date(task.due_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => onNavigate('inbox')}
            className="inline-flex items-center gap-1 text-sm text-[#2563EB] hover:text-[#1d4ed8] mt-3"
          >
            View all tasks →
          </button>
        </div>
      )}

      {/* Recent meeting insight */}
      {recentMeeting && (
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="text-[#2563EB]">📈</span>
            Latest Meeting Insight
          </h3>
          <button
            onClick={() => onNavigate('meetings')}
            className="block w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{recentMeeting.title}</p>
                <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                  {recentMeeting.summary || 'No summary available'}
                </p>
              </div>
              <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                recentMeeting.sentiment_label === 'Positive' ? 'bg-green-100 text-green-700' :
                recentMeeting.sentiment_label === 'Negative' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {recentMeeting.sentiment_label === 'Positive' ? '😊' :
                 recentMeeting.sentiment_label === 'Negative' ? '😟' : '😐'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
              <span>🕐</span>
              {new Date(recentMeeting.created_at).toLocaleDateString()}
              {recentMeeting.duration_minutes && (
                <span>• {recentMeeting.duration_minutes} min</span>
              )}
            </div>
          </button>
        </div>
      )}

      {/* Empty state */}
      {topTasks.length === 0 && !recentMeeting && (
        <div className="p-6 text-center">
          <div className="w-10 h-10 mx-auto mb-2 text-green-500 flex items-center justify-center">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-600 font-medium">All caught up!</p>
          <p className="text-sm text-gray-400">Record a meeting or create tasks to get started</p>
        </div>
      )}
    </div>
  );
}

export default DailyBriefing;
