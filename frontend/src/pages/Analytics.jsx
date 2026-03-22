import { useState, useEffect } from 'react';
import {
  BarChart3, TrendingUp, Users, Clock,
  CheckCircle, Mic, Zap, Bot, Target,
  Calendar, Download, RefreshCw
} from 'lucide-react';
import api from '../services/api';
import { VCButton, VCBadge, VCIconBox } from '../components/vc';

export default function Analytics() {
  const [dashboard, setDashboard] = useState(null);
  const [trends, setTrends] = useState(null);
  const [teamPerformance, setTeamPerformance] = useState(null);
  const [aiEffectiveness, setAIEffectiveness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [dashboardRes, trendsRes, teamRes, aiRes] = await Promise.all([
        api.get('/analytics/dashboard'),
        api.get(`/analytics/trends?period=${period}`),
        api.get('/analytics/team-performance'),
        api.get('/analytics/ai-effectiveness')
      ]);
      setDashboard(dashboardRes.data.data);
      setTrends(trendsRes.data.data);
      setTeamPerformance(teamRes.data.data);
      setAIEffectiveness(aiRes.data.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
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
          <VCButton variant="ghost" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" />
          </VCButton>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-2 pb-2"
        style={{ borderBottom: '1px solid rgba(248,240,242,.08)' }}
      >
        {['overview', 'meetings', 'tasks', 'ai', 'team'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors"
            style={
              activeTab === tab
                ? { background: 'rgba(255,45,107,0.12)', color: 'var(--accent-primary)' }
                : { color: 'var(--text-secondary)' }
            }
          >
            {tab}
          </button>
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
                    <span className="text-2xl">😊</span>
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
                    style={{ background: 'rgba(248,240,242,0.06)' }}
                  >
                    <span className="text-2xl">😐</span>
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
                    <span className="text-2xl">😟</span>
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
                style={{ background: 'rgba(248,240,242,.06)' }}
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

          {/* Trends Chart */}
          {trends && trends.trends.length > 0 && (
            <div className="vc p-6">
              <h3
                className="font-semibold mb-4"
                style={{ color: 'var(--text-primary)' }}
              >
                Meetings Over Time
              </h3>
              <div className="h-64 flex items-end gap-2">
                {trends.trends.map((point, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t transition-colors relative group"
                    style={{
                      height: `${Math.max((point.count / Math.max(...trends.trends.map(t => t.count))) * 100, 5)}%`,
                      background: 'var(--accent-primary, #FF2D6B)',
                      opacity: 0.75,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '0.75' }}
                  >
                    <div
                      className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                      style={{ background: 'rgba(16,16,16,0.95)', border: '1px solid rgba(248,240,242,.1)' }}
                    >
                      {point.count} meetings
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                <span>{trends.trends[0]?.date}</span>
                <span>{trends.trends[trends.trends.length - 1]?.date}</span>
              </div>
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

          {/* Priority Distribution */}
          <div className="vc p-6">
            <h3
              className="font-semibold mb-4"
              style={{ color: 'var(--text-primary)' }}
            >
              Tasks by Priority
            </h3>
            <div className="space-y-3">
              <StatusBar
                label="High Priority"
                value={dashboard.tasks.byPriority.high}
                total={dashboard.tasks.total}
                color="red"
              />
              <StatusBar
                label="Medium Priority"
                value={dashboard.tasks.byPriority.medium}
                total={dashboard.tasks.total}
                color="yellow"
              />
              <StatusBar
                label="Low Priority"
                value={dashboard.tasks.byPriority.low}
                total={dashboard.tasks.total}
                color="green"
              />
            </div>
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
                    style={{ color: 'var(--text-tertiary)', borderColor: 'rgba(248,240,242,.08)' }}
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
                      style={{ borderColor: 'rgba(248,240,242,.08)' }}
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

function MetricCard({ icon: Icon, label, value, total, color }) {
  const iconColors = {
    purple: { bg: 'rgba(255,184,0,0.1)',  color: 'var(--accent-tertiary)' },
    blue:   { bg: 'rgba(0,245,212,0.1)',  color: 'var(--accent-secondary)' },
    green:  { bg: 'rgba(0,245,212,0.08)', color: 'var(--accent-secondary)' },
    yellow: { bg: 'rgba(255,184,0,0.08)', color: 'var(--accent-tertiary)' },
    red:    { bg: 'rgba(255,45,107,0.1)', color: 'var(--accent-primary)' },
    gray:   { bg: 'rgba(248,240,242,0.06)', color: 'var(--text-secondary)' },
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

function StatusBar({ label, value, total, color }) {
  const percent = total > 0 ? (value / total) * 100 : 0;
  const barColors = {
    green:  'var(--accent-secondary)',
    blue:   'var(--accent-secondary)',
    yellow: 'var(--accent-tertiary)',
    red:    'var(--accent-primary)',
    gray:   'rgba(248,240,242,0.3)',
  };

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{value}</span>
      </div>
      <div className="w-full h-2 rounded-full" style={{ background: 'rgba(248,240,242,0.08)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${percent}%`, background: barColors[color] || barColors.gray }}
        />
      </div>
    </div>
  );
}
