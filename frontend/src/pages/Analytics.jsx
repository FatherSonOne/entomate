import { useState, useEffect } from 'react';
import {
  BarChart3, TrendingUp, Users, Clock,
  CheckCircle, Mic, Zap, Bot, Target,
  Calendar, Download, RefreshCw
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import api from '../services/api';
import { reportsApi } from '../services/api';
import { VCButton, VCBadge, VCIconBox } from '../components/vc';
import ErrorState from '../components/vc/ErrorState';
import { AnalyticsSkeleton } from '../components/LoadingSkeletons';
import { SentimentPositive, SentimentNeutral, SentimentNegative } from '../components/icons/AnimatedIcons';

// ==================== TYPE DEFINITIONS ====================

/**
 * @typedef {{ meetingsProcessed: number, tasksCreated: number, tasksCompleted: number, actionItemsExtracted: number, automationsRun: number, activeProjects: number }} DashboardOverview
 * @typedef {{ total: number, totalDuration: number, avgDuration: number, sentiment: { positive: number, neutral: number, negative: number }, avgActionItemsPerMeeting: number }} MeetingMetrics
 * @typedef {{ total: number, completed: number, inProgress: number, open: number, blocked: number, completionRate: number, byPriority: { high: number, medium: number, low: number } }} TaskMetrics
 * @typedef {{ total: number, synced: number, pending: number, completed: number, syncRate: number }} ActionItemMetrics
 * @typedef {{ totalRuns: number, successful: number, failed: number, successRate: number }} AutomationMetrics
 * @typedef {{ total: number, byStatus: { planning: number, active: number, completed: number, archived: number }, totalDealValue: number }} ProjectMetrics
 *
 * @typedef {{
 *   period: { start: string, end: string },
 *   overview: DashboardOverview,
 *   meetings: MeetingMetrics,
 *   tasks: TaskMetrics,
 *   actionItems: ActionItemMetrics,
 *   automations: AutomationMetrics,
 *   projects: ProjectMetrics
 * }} DashboardData
 *
 * @typedef {{ date: string, count: number, totalDuration: number }} TrendPoint
 * @typedef {{ period: string, groupBy: string, startDate: string, endDate: string, trends: TrendPoint[] }} TrendsData
 *
 * @typedef {{ userId: string, userName: string, email: string, tasksCreated: number, tasksCompleted: number, completionRate: number, highPriorityCompleted: number, avgCompletionDays: number | null }} TeamMember
 * @typedef {{ period: { start: string, end: string }, teamMembers: TeamMember[] }} TeamPerformanceData
 *
 * @typedef {{
 *   transcription: { meetingsProcessed: number, successRate: number },
 *   summarization: { meetingsSummarized: number, avgKeyPoints: number },
 *   actionItemExtraction: { totalExtracted: number, avgPerMeeting: number },
 *   automations: { totalExecutions: number, successful: number, failed: number, successRate: number, avgDuration: number },
 *   aiAgents: { totalExecutions: number, successful: number, successRate: number, avgFeedbackRating: number | null },
 *   timeSaved: { estimatedMinutes: number, breakdown: { transcription: number, summarization: number, actionItems: number, automations: number } }
 * }} AIEffectivenessData
 *
 * @typedef {{ date: string, total_meetings: number, positive_count: number, neutral_count: number, negative_count: number, avg_sentiment_score: number }} SentimentTrendPoint
 */

// ==================== CONSTANTS ====================

const CHART_COLORS = {
  crimson: '#FF2D6B',
  mint: '#00F5D4',
  amber: '#FFB800',
  muted: 'var(--t2)',
};

export default function Analytics() {
  /** @type {[DashboardData | null, Function]} */
  const [dashboard, setDashboard] = useState(null);
  /** @type {[TrendsData | null, Function]} */
  const [trends, setTrends] = useState(null);
  /** @type {[TeamPerformanceData | null, Function]} */
  const [teamPerformance, setTeamPerformance] = useState(null);
  /** @type {[AIEffectivenessData | null, Function]} */
  const [aiEffectiveness, setAIEffectiveness] = useState(null);
  /** @type {[SentimentTrendPoint[] | null, Function]} */
  const [sentimentTrends, setSentimentTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  /** @type {['7d' | '30d' | '90d' | '1y', Function]} */
  const [period, setPeriod] = useState('30d');
  /** @type {['overview' | 'meetings' | 'tasks' | 'ai' | 'team', Function]} */
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const periodDays = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
      const days = periodDays[period] || 30;
      const end_date = new Date().toISOString();
      const start_date = new Date(Date.now() - days * 86400000).toISOString();

      const [dashboardRes, trendsRes, teamRes, aiRes] = await Promise.all([
        api.get('/analytics/dashboard', { params: { start_date, end_date } }),
        api.get('/analytics/trends', { params: { period, start_date, end_date } }),
        api.get('/analytics/team-performance', { params: { start_date, end_date } }),
        api.get('/analytics/ai-effectiveness', { params: { start_date, end_date } })
      ]);
      setDashboard(dashboardRes.data.data);
      setTrends(trendsRes.data.data);
      setTeamPerformance(teamRes.data.data);
      setAIEffectiveness(aiRes.data.data);

      // Fetch sentiment trends (non-blocking — don't fail the whole page)
      api.get('/analytics/sentiment-trends', { params: { start_date, end_date } })
        .then(res => setSentimentTrends(res.data.data))
        .catch(() => {});
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    const exportMap = {
      overview: () => reportsApi.downloadMeetingsCSV(),
      meetings: () => reportsApi.downloadMeetingsCSV(),
      tasks: () => reportsApi.downloadActionItemsCSV(),
      ai: () => reportsApi.downloadMeetingsCSV(),
      team: () => reportsApi.downloadActionItemsCSV(),
    };
    const download = exportMap[activeTab];
    if (!download) return;
    try {
      await download();
    } catch (error) {
      console.error('Failed to export:', error);
    }
  };

  if (loading) {
    return <AnalyticsSkeleton />;
  }

  if (!dashboard && !loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-bold flex items-center gap-2"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
            >
              <BarChart3 className="h-7 w-7" style={{ color: 'var(--accent-primary)' }} />
              Analytics
            </h1>
            <p style={{ color: 'var(--text-tertiary)' }} className="mt-1">
              Track performance and measure success
            </p>
          </div>
        </div>

        <div className="vc" style={{
          padding: '3rem 2rem',
          textAlign: 'center',
          maxWidth: 480,
          margin: '2rem auto'
        }}>
          <BarChart3 size={48} style={{ color: 'var(--c)', margin: '0 auto 1rem', opacity: 0.5 }} />
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            No analytics data yet
          </h2>
          <p style={{ color: 'var(--t1)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Record your first meeting to start seeing insights and performance metrics.
          </p>
          <VCButton variant="primary" onClick={() => window.location.href = '/meetings'}>
            Go to Meetings
          </VCButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold flex items-center gap-2"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
          >
            <BarChart3 className="h-7 w-7" style={{ color: 'var(--accent-primary)' }} />
            Analytics
          </h1>
          <p style={{ color: 'var(--text-tertiary)' }} className="mt-1">
            Track performance and measure success
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="input"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <VCButton variant="ghost" onClick={handleExport} aria-label="Export CSV">
            <Download className="h-4 w-4" />
          </VCButton>
          <VCButton variant="ghost" onClick={fetchData} aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </VCButton>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-2 pb-2"
        style={{ borderBottom: '1px solid var(--b1)' }}
      >
        {['overview', 'meetings', 'tasks', 'ai', 'team'].map((tab) => (
          <VCButton
            key={tab}
            variant={activeTab === tab ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(tab)}
            className="capitalize"
          >
            {tab}
          </VCButton>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && dashboard && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              icon={Mic}
              label="Meetings Processed"
              value={dashboard.overview.meetingsProcessed}
              color="purple"
            />
            <MetricCard
              icon={CheckCircle}
              label="Tasks Completed"
              value={dashboard.overview.tasksCompleted}
              total={dashboard.overview.tasksCreated}
              color="green"
            />
            <MetricCard
              icon={Target}
              label="Action Items"
              value={dashboard.overview.actionItemsExtracted}
              color="blue"
            />
            <MetricCard
              icon={Zap}
              label="Automations Run"
              value={dashboard.overview.automationsRun}
              color="yellow"
            />
          </div>

          {/* Time Saved Highlight */}
          {aiEffectiveness && (
            <div
              className="vc p-6"
              style={{ background: 'linear-gradient(135deg, var(--accent-primary, #FF2D6B) 0%, #c0134e 100%)' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>Estimated Time Saved</p>
                  <p
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: 36,
                      color: '#fff',
                    }}
                  >
                    {Math.round(aiEffectiveness.timeSaved.estimatedMinutes / 60)} hours
                  </p>
                  <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    Through AI transcription, summarization, and automations
                  </p>
                </div>
                <Clock className="h-16 w-16" style={{ color: 'rgba(255,255,255,0.4)' }} />
              </div>
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Task Completion */}
            <div className="vc p-6">
              <h3
                className="font-semibold mb-4"
                style={{ color: 'var(--text-primary)' }}
              >
                Task Status
              </h3>
              <div className="space-y-3">
                <StatusBar label="Completed" value={dashboard.tasks.completed} total={dashboard.tasks.total} color="green" />
                <StatusBar label="In Progress" value={dashboard.tasks.inProgress} total={dashboard.tasks.total} color="blue" />
                <StatusBar label="Open" value={dashboard.tasks.open} total={dashboard.tasks.total} color="gray" />
                <StatusBar label="Blocked" value={dashboard.tasks.blocked} total={dashboard.tasks.total} color="red" />
              </div>
            </div>

            {/* Meeting Sentiment */}
            <div className="vc p-6">
              <h3
                className="font-semibold mb-4"
                style={{ color: 'var(--text-primary)' }}
              >
                Meeting Sentiment
              </h3>
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mb-2"
                    style={{ background: 'rgba(0,245,212,0.12)' }}
                  >
                    <SentimentPositive size={28} />
                  </div>
                  <p
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: 24,
                      color: 'var(--accent-secondary)',
                    }}
                  >
                    {dashboard.meetings.sentiment.positive}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Positive</p>
                </div>
                <div className="text-center">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mb-2"
                    style={{ background: 'var(--b0)' }}
                  >
                    <SentimentNeutral size={28} />
                  </div>
                  <p
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: 24,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {dashboard.meetings.sentiment.neutral}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Neutral</p>
                </div>
                <div className="text-center">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mb-2"
                    style={{ background: 'rgba(255,45,107,0.12)' }}
                  >
                    <SentimentNegative size={28} />
                  </div>
                  <p
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: 24,
                      color: 'var(--accent-primary)',
                    }}
                  >
                    {dashboard.meetings.sentiment.negative}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Negative</p>
                </div>
              </div>
            </div>
          </div>

          {/* Projects Summary */}
          <div className="vc p-6">
            <h3
              className="font-semibold mb-4"
              style={{ color: 'var(--text-primary)' }}
            >
              Projects Overview
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div
                className="text-center p-4 rounded-lg"
                style={{ background: 'var(--b0)' }}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 24,
                    color: 'var(--text-primary)',
                  }}
                >
                  {dashboard.projects.total}
                </p>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Total</p>
              </div>
              <div
                className="text-center p-4 rounded-lg"
                style={{ background: 'rgba(0,245,212,0.08)' }}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 24,
                    color: 'var(--accent-secondary)',
                  }}
                >
                  {dashboard.projects.byStatus.active}
                </p>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Active</p>
              </div>
              <div
                className="text-center p-4 rounded-lg"
                style={{ background: 'rgba(0,245,212,0.06)' }}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 24,
                    color: 'var(--accent-secondary)',
                  }}
                >
                  {dashboard.projects.byStatus.completed}
                </p>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Completed</p>
              </div>
              <div
                className="text-center p-4 rounded-lg"
                style={{ background: 'rgba(255,184,0,0.08)' }}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 24,
                    color: 'var(--accent-tertiary)',
                  }}
                >
                  {dashboard.projects.byStatus.planning}
                </p>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Planning</p>
              </div>
              <div
                className="text-center p-4 rounded-lg"
                style={{ background: 'rgba(255,184,0,0.06)' }}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 24,
                    color: 'var(--accent-tertiary)',
                  }}
                >
                  ${(dashboard.projects.totalDealValue / 1000).toFixed(0)}k
                </p>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Deal Value</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Meetings Tab */}
      {activeTab === 'meetings' && dashboard && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              icon={Mic}
              label="Total Meetings"
              value={dashboard.meetings.total}
              color="purple"
            />
            <MetricCard
              icon={Clock}
              label="Total Duration"
              value={`${Math.round(dashboard.meetings.totalDuration / 60)}h`}
              color="blue"
            />
            <MetricCard
              icon={Clock}
              label="Avg Duration"
              value={`${dashboard.meetings.avgDuration}m`}
              color="green"
            />
            <MetricCard
              icon={Target}
              label="Avg Action Items"
              value={dashboard.meetings.avgActionItemsPerMeeting}
              color="yellow"
            />
          </div>

          {/* Sentiment Trends — Area Chart */}
          {sentimentTrends && sentimentTrends.length > 0 && (
            <div className="vc p-6">
              <h3
                className="font-semibold mb-4"
                style={{ color: 'var(--text-primary)' }}
              >
                Sentiment Over Time
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={sentimentTrends} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--b0)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                    tickFormatter={(d) => {
                      const dt = new Date(d);
                      return `${dt.getMonth() + 1}/${dt.getDate()}`;
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <RTooltip
                    contentStyle={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--b1)',
                      borderRadius: 8,
                      color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                    labelFormatter={(d) => new Date(d).toLocaleDateString()}
                  />
                  <Area type="monotone" dataKey="positive_count" stackId="1" stroke={CHART_COLORS.mint} fill={CHART_COLORS.mint} fillOpacity={0.3} name="Positive" />
                  <Area type="monotone" dataKey="neutral_count" stackId="1" stroke={CHART_COLORS.amber} fill={CHART_COLORS.amber} fillOpacity={0.2} name="Neutral" />
                  <Area type="monotone" dataKey="negative_count" stackId="1" stroke={CHART_COLORS.crimson} fill={CHART_COLORS.crimson} fillOpacity={0.2} name="Negative" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Meetings Over Time — Recharts */}
          {trends && trends.trends.length > 0 && (
            <div className="vc p-6">
              <h3
                className="font-semibold mb-4"
                style={{ color: 'var(--text-primary)' }}
              >
                Meetings Over Time
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={trends.trends} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--b0)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                    tickFormatter={(d) => {
                      const dt = new Date(d);
                      return `${dt.getMonth() + 1}/${dt.getDate()}`;
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <RTooltip
                    contentStyle={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--b1)',
                      borderRadius: 8,
                      color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                    labelFormatter={(d) => new Date(d).toLocaleDateString()}
                    formatter={(v) => [`${v} meetings`, 'Count']}
                  />
                  <Bar dataKey="count" fill={CHART_COLORS.crimson} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Tasks Tab */}
      {activeTab === 'tasks' && dashboard && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              icon={CheckCircle}
              label="Total Tasks"
              value={dashboard.tasks.total}
              color="blue"
            />
            <MetricCard
              icon={CheckCircle}
              label="Completed"
              value={dashboard.tasks.completed}
              color="green"
            />
            <MetricCard
              icon={TrendingUp}
              label="Completion Rate"
              value={`${dashboard.tasks.completionRate}%`}
              color="purple"
            />
            <MetricCard
              icon={Target}
              label="High Priority"
              value={dashboard.tasks.byPriority.high}
              color="red"
            />
          </div>

          {/* Priority Distribution — Pie Chart */}
          <div className="vc p-6">
            <h3
              className="font-semibold mb-4"
              style={{ color: 'var(--text-primary)' }}
            >
              Tasks by Priority
            </h3>
            {dashboard.tasks.total > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'High', value: dashboard.tasks.byPriority.high },
                        { name: 'Medium', value: dashboard.tasks.byPriority.medium },
                        { name: 'Low', value: dashboard.tasks.byPriority.low },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      <Cell fill={CHART_COLORS.crimson} />
                      <Cell fill={CHART_COLORS.amber} />
                      <Cell fill={CHART_COLORS.mint} />
                    </Pie>
                    <RTooltip
                      contentStyle={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--b1)',
                        borderRadius: 8,
                        color: 'var(--text-primary)',
                        fontSize: 13,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3">
                  <StatusBar label="High Priority" value={dashboard.tasks.byPriority.high} total={dashboard.tasks.total} color="red" />
                  <StatusBar label="Medium Priority" value={dashboard.tasks.byPriority.medium} total={dashboard.tasks.total} color="yellow" />
                  <StatusBar label="Low Priority" value={dashboard.tasks.byPriority.low} total={dashboard.tasks.total} color="green" />
                </div>
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No tasks in this period</p>
            )}
          </div>
        </div>
      )}

      {/* AI Tab */}
      {activeTab === 'ai' && aiEffectiveness && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              icon={Mic}
              label="Transcription Rate"
              value={`${aiEffectiveness.transcription.successRate}%`}
              color="purple"
            />
            <MetricCard
              icon={Target}
              label="Action Items/Meeting"
              value={aiEffectiveness.actionItemExtraction.avgPerMeeting}
              color="blue"
            />
            <MetricCard
              icon={Zap}
              label="Automation Success"
              value={`${aiEffectiveness.automations.successRate}%`}
              color="green"
            />
            <MetricCard
              icon={Bot}
              label="Agent Success"
              value={`${aiEffectiveness.aiAgents.successRate}%`}
              color="yellow"
            />
          </div>

          {/* Time Saved Breakdown */}
          <div className="vc p-6">
            <h3
              className="font-semibold mb-4"
              style={{ color: 'var(--text-primary)' }}
            >
              Time Saved Breakdown
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div
                className="text-center p-4 rounded-lg"
                style={{ background: 'rgba(255,184,0,0.08)' }}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 24,
                    color: 'var(--accent-tertiary)',
                  }}
                >
                  {Math.round(aiEffectiveness.timeSaved.breakdown.transcription / 60)}h
                </p>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Transcription</p>
              </div>
              <div
                className="text-center p-4 rounded-lg"
                style={{ background: 'rgba(0,245,212,0.08)' }}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 24,
                    color: 'var(--accent-secondary)',
                  }}
                >
                  {Math.round(aiEffectiveness.timeSaved.breakdown.summarization / 60)}h
                </p>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Summarization</p>
              </div>
              <div
                className="text-center p-4 rounded-lg"
                style={{ background: 'rgba(0,245,212,0.06)' }}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 24,
                    color: 'var(--accent-secondary)',
                  }}
                >
                  {Math.round(aiEffectiveness.timeSaved.breakdown.actionItems / 60)}h
                </p>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Action Items</p>
              </div>
              <div
                className="text-center p-4 rounded-lg"
                style={{ background: 'rgba(255,184,0,0.06)' }}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 24,
                    color: 'var(--accent-tertiary)',
                  }}
                >
                  {Math.round(aiEffectiveness.timeSaved.breakdown.automations / 60)}h
                </p>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Automations</p>
              </div>
            </div>
          </div>

          {/* Automation Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="vc p-6">
              <h3
                className="font-semibold mb-4"
                style={{ color: 'var(--text-primary)' }}
              >
                Automation Performance
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Total Executions</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{aiEffectiveness.automations.totalExecutions}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Successful</span>
                  <span className="font-medium" style={{ color: 'var(--accent-secondary)' }}>{aiEffectiveness.automations.successful}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Failed</span>
                  <span className="font-medium" style={{ color: 'var(--accent-primary)' }}>{aiEffectiveness.automations.failed}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Avg Duration</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{aiEffectiveness.automations.avgDuration}ms</span>
                </div>
              </div>
            </div>

            <div className="vc p-6">
              <h3
                className="font-semibold mb-4"
                style={{ color: 'var(--text-primary)' }}
              >
                AI Agents Performance
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Total Executions</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{aiEffectiveness.aiAgents.totalExecutions}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Successful</span>
                  <span className="font-medium" style={{ color: 'var(--accent-secondary)' }}>{aiEffectiveness.aiAgents.successful}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Success Rate</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{aiEffectiveness.aiAgents.successRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Avg Feedback Rating</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {aiEffectiveness.aiAgents.avgFeedbackRating
                      ? `${aiEffectiveness.aiAgents.avgFeedbackRating}/5`
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Team Tab */}
      {activeTab === 'team' && teamPerformance && (
        <div className="space-y-6">
          <div className="vc p-6">
            <h3
              className="font-semibold mb-4"
              style={{ color: 'var(--text-primary)' }}
            >
              Team Performance
            </h3>
            <div className="vtbl-wrap overflow-x-auto">
              <table className="vtbl w-full">
                <thead>
                  <tr
                    className="text-left text-sm"
                    style={{ color: 'var(--text-tertiary)', borderColor: 'var(--b1)' }}
                  >
                    <th className="pb-3">Team Member</th>
                    <th className="pb-3 text-center">Tasks Created</th>
                    <th className="pb-3 text-center">Completed</th>
                    <th className="pb-3 text-center">Completion Rate</th>
                    <th className="pb-3 text-center">High Priority</th>
                    <th className="pb-3 text-center">Avg Days</th>
                  </tr>
                </thead>
                <tbody>
                  {teamPerformance.teamMembers.map((member) => (
                    <tr
                      key={member.userId}
                      style={{ borderColor: 'var(--b1)' }}
                      className="border-b last:border-0"
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ background: 'rgba(255,45,107,0.12)' }}
                          >
                            <span
                              className="font-medium text-sm"
                              style={{ color: 'var(--accent-primary)' }}
                            >
                              {member.userName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{member.userName}</p>
                            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-center" style={{ color: 'var(--text-primary)' }}>{member.tasksCreated}</td>
                      <td className="py-3 text-center font-medium" style={{ color: 'var(--accent-secondary)' }}>
                        {member.tasksCompleted}
                      </td>
                      <td className="py-3 text-center">
                        <VCBadge
                          color={
                            member.completionRate >= 80 ? 'mint' :
                            member.completionRate >= 50 ? 'amber' : 'crimson'
                          }
                        >
                          {member.completionRate}%
                        </VCBadge>
                      </td>
                      <td className="py-3 text-center" style={{ color: 'var(--accent-primary)' }}>
                        {member.highPriorityCompleted}
                      </td>
                      <td className="py-3 text-center" style={{ color: 'var(--text-secondary)' }}>
                        {member.avgCompletionDays !== null ? `${member.avgCompletionDays}d` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * @param {{ icon: import('lucide-react').LucideIcon, label: string, value: string | number, total?: number, color: 'purple' | 'blue' | 'green' | 'yellow' | 'red' | 'gray' }} props
 */
function MetricCard({ icon: Icon, label, value, total, color }) {
  const iconColors = {
    purple: { bg: 'rgba(255,184,0,0.1)',  color: 'var(--accent-tertiary)' },
    blue:   { bg: 'rgba(0,245,212,0.1)',  color: 'var(--accent-secondary)' },
    green:  { bg: 'rgba(0,245,212,0.08)', color: 'var(--accent-secondary)' },
    yellow: { bg: 'rgba(255,184,0,0.08)', color: 'var(--accent-tertiary)' },
    red:    { bg: 'rgba(255,45,107,0.1)', color: 'var(--accent-primary)' },
    gray:   { bg: 'var(--b0)', color: 'var(--text-secondary)' },
  };

  const scheme = iconColors[color] || iconColors.gray;

  return (
    <div className="vc p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 24,
              color: 'var(--text-primary)',
            }}
          >
            {value}
            {total !== undefined && (
              <span className="text-sm font-normal" style={{ color: 'var(--text-tertiary)' }}>/{total}</span>
            )}
          </p>
        </div>
        <div
          className="p-3 rounded-lg"
          style={{ background: scheme.bg }}
        >
          <Icon className="h-6 w-6" style={{ color: scheme.color }} />
        </div>
      </div>
    </div>
  );
}

/**
 * @param {{ label: string, value: number, total: number, color: 'green' | 'blue' | 'yellow' | 'red' | 'gray' }} props
 */
function StatusBar({ label, value, total, color }) {
  const percent = total > 0 ? (value / total) * 100 : 0;
  const barColors = {
    green:  'var(--accent-secondary)',
    blue:   'var(--accent-secondary)',
    yellow: 'var(--accent-tertiary)',
    red:    'var(--accent-primary)',
    gray:   'var(--t2)',
  };

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{value}</span>
      </div>
      <div className="w-full h-2 rounded-full" style={{ background: 'var(--b1)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${percent}%`, background: barColors[color] || barColors.gray }}
        />
      </div>
    </div>
  );
}
