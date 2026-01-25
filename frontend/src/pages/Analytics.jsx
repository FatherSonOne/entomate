import { useState, useEffect } from 'react';
import {
  BarChart3, TrendingUp, Users, Clock,
  CheckCircle, Mic, Zap, Bot, Target,
  Calendar, Download, RefreshCw
} from 'lucide-react';
import api from '../services/api';

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
          <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-accent-primary" />
            Analytics
          </h1>
          <p className="text-content-tertiary mt-1">
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
          <button onClick={fetchData} className="btn btn-secondary">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-line-default pb-2">
        {['overview', 'meetings', 'tasks', 'ai', 'team'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
              activeTab === tab
                ? 'bg-primary-100 text-primary-700'
                : 'text-content-secondary hover:bg-surface-muted'
            }`}
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
            <div className="card p-6 bg-gradient-to-r from-primary-500 to-primary-700 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-primary-100 text-sm">Estimated Time Saved</p>
                  <p className="text-4xl font-bold mt-1">
                    {Math.round(aiEffectiveness.timeSaved.estimatedMinutes / 60)} hours
                  </p>
                  <p className="text-primary-200 text-sm mt-2">
                    Through AI transcription, summarization, and automations
                  </p>
                </div>
                <Clock className="h-16 w-16 text-primary-200" />
              </div>
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Task Completion */}
            <div className="card p-6">
              <h3 className="font-semibold text-content-primary mb-4">Task Status</h3>
              <div className="space-y-3">
                <StatusBar label="Completed" value={dashboard.tasks.completed} total={dashboard.tasks.total} color="green" />
                <StatusBar label="In Progress" value={dashboard.tasks.inProgress} total={dashboard.tasks.total} color="blue" />
                <StatusBar label="Open" value={dashboard.tasks.open} total={dashboard.tasks.total} color="gray" />
                <StatusBar label="Blocked" value={dashboard.tasks.blocked} total={dashboard.tasks.total} color="red" />
              </div>
            </div>

            {/* Meeting Sentiment */}
            <div className="card p-6">
              <h3 className="font-semibold text-content-primary mb-4">Meeting Sentiment</h3>
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-semantic-success-dim rounded-full flex items-center justify-center mb-2">
                    <span className="text-2xl">😊</span>
                  </div>
                  <p className="text-2xl font-bold text-semantic-success">{dashboard.meetings.sentiment.positive}</p>
                  <p className="text-sm text-content-tertiary">Positive</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-surface-muted rounded-full flex items-center justify-center mb-2">
                    <span className="text-2xl">😐</span>
                  </div>
                  <p className="text-2xl font-bold text-content-secondary">{dashboard.meetings.sentiment.neutral}</p>
                  <p className="text-sm text-content-tertiary">Neutral</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-semantic-error-dim rounded-full flex items-center justify-center mb-2">
                    <span className="text-2xl">😟</span>
                  </div>
                  <p className="text-2xl font-bold text-semantic-error">{dashboard.meetings.sentiment.negative}</p>
                  <p className="text-sm text-content-tertiary">Negative</p>
                </div>
              </div>
            </div>
          </div>

          {/* Projects Summary */}
          <div className="card p-6">
            <h3 className="font-semibold text-content-primary mb-4">Projects Overview</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-surface-muted rounded-lg">
                <p className="text-3xl font-bold text-content-primary">{dashboard.projects.total}</p>
                <p className="text-sm text-content-tertiary">Total</p>
              </div>
              <div className="text-center p-4 bg-semantic-info-dim rounded-lg">
                <p className="text-3xl font-bold text-semantic-info">{dashboard.projects.byStatus.active}</p>
                <p className="text-sm text-content-tertiary">Active</p>
              </div>
              <div className="text-center p-4 bg-semantic-success-dim rounded-lg">
                <p className="text-3xl font-bold text-semantic-success">{dashboard.projects.byStatus.completed}</p>
                <p className="text-sm text-content-tertiary">Completed</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-3xl font-bold text-yellow-600">{dashboard.projects.byStatus.planning}</p>
                <p className="text-sm text-content-tertiary">Planning</p>
              </div>
              <div className="text-center p-4 bg-accent-tertiary-dim rounded-lg">
                <p className="text-3xl font-bold text-accent-tertiary">
                  ${(dashboard.projects.totalDealValue / 1000).toFixed(0)}k
                </p>
                <p className="text-sm text-content-tertiary">Deal Value</p>
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
            <div className="card p-6">
              <h3 className="font-semibold text-content-primary mb-4">Meetings Over Time</h3>
              <div className="h-64 flex items-end gap-2">
                {trends.trends.map((point, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-primary-500 rounded-t hover:bg-accent-primary transition-colors relative group"
                    style={{
                      height: `${Math.max((point.count / Math.max(...trends.trends.map(t => t.count))) * 100, 5)}%`
                    }}
                  >
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {point.count} meetings
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-content-tertiary">
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
          <div className="card p-6">
            <h3 className="font-semibold text-content-primary mb-4">Tasks by Priority</h3>
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
          <div className="card p-6">
            <h3 className="font-semibold text-content-primary mb-4">Time Saved Breakdown</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-accent-tertiary-dim rounded-lg">
                <p className="text-2xl font-bold text-accent-tertiary">
                  {Math.round(aiEffectiveness.timeSaved.breakdown.transcription / 60)}h
                </p>
                <p className="text-sm text-content-tertiary">Transcription</p>
              </div>
              <div className="text-center p-4 bg-semantic-info-dim rounded-lg">
                <p className="text-2xl font-bold text-semantic-info">
                  {Math.round(aiEffectiveness.timeSaved.breakdown.summarization / 60)}h
                </p>
                <p className="text-sm text-content-tertiary">Summarization</p>
              </div>
              <div className="text-center p-4 bg-semantic-success-dim rounded-lg">
                <p className="text-2xl font-bold text-semantic-success">
                  {Math.round(aiEffectiveness.timeSaved.breakdown.actionItems / 60)}h
                </p>
                <p className="text-sm text-content-tertiary">Action Items</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">
                  {Math.round(aiEffectiveness.timeSaved.breakdown.automations / 60)}h
                </p>
                <p className="text-sm text-content-tertiary">Automations</p>
              </div>
            </div>
          </div>

          {/* Automation Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6">
              <h3 className="font-semibold text-content-primary mb-4">Automation Performance</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-content-secondary">Total Executions</span>
                  <span className="font-medium">{aiEffectiveness.automations.totalExecutions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-content-secondary">Successful</span>
                  <span className="font-medium text-semantic-success">{aiEffectiveness.automations.successful}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-content-secondary">Failed</span>
                  <span className="font-medium text-semantic-error">{aiEffectiveness.automations.failed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-content-secondary">Avg Duration</span>
                  <span className="font-medium">{aiEffectiveness.automations.avgDuration}ms</span>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <h3 className="font-semibold text-content-primary mb-4">AI Agents Performance</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-content-secondary">Total Executions</span>
                  <span className="font-medium">{aiEffectiveness.aiAgents.totalExecutions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-content-secondary">Successful</span>
                  <span className="font-medium text-semantic-success">{aiEffectiveness.aiAgents.successful}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-content-secondary">Success Rate</span>
                  <span className="font-medium">{aiEffectiveness.aiAgents.successRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-content-secondary">Avg Feedback Rating</span>
                  <span className="font-medium">
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
          <div className="card p-6">
            <h3 className="font-semibold text-content-primary mb-4">Team Performance</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-content-tertiary border-b">
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
                    <tr key={member.userId} className="border-b last:border-0">
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                            <span className="text-accent-primary font-medium text-sm">
                              {member.userName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-content-primary">{member.userName}</p>
                            <p className="text-xs text-content-tertiary">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-center">{member.tasksCreated}</td>
                      <td className="py-3 text-center text-semantic-success font-medium">
                        {member.tasksCompleted}
                      </td>
                      <td className="py-3 text-center">
                        <span className={`font-medium ${
                          member.completionRate >= 80 ? 'text-semantic-success' :
                          member.completionRate >= 50 ? 'text-yellow-600' : 'text-semantic-error'
                        }`}>
                          {member.completionRate}%
                        </span>
                      </td>
                      <td className="py-3 text-center text-semantic-error">
                        {member.highPriorityCompleted}
                      </td>
                      <td className="py-3 text-center text-content-secondary">
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
  const colors = {
    purple: 'bg-accent-tertiary-dim text-accent-tertiary',
    blue: 'bg-semantic-info-dim text-semantic-info',
    green: 'bg-semantic-success-dim text-semantic-success',
    yellow: 'bg-yellow-100 text-yellow-600',
    red: 'bg-semantic-error-dim text-semantic-error',
    gray: 'bg-surface-muted text-content-secondary'
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-content-tertiary">{label}</p>
          <p className="text-2xl font-bold text-content-primary">
            {value}
            {total !== undefined && (
              <span className="text-sm text-content-tertiary font-normal">/{total}</span>
            )}
          </p>
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

function StatusBar({ label, value, total, color }) {
  const percent = total > 0 ? (value / total) * 100 : 0;
  const colors = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    yellow: 'bg-yellow-500',
    red: 'bg-semantic-error',
    gray: 'bg-gray-500'
  };

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-content-secondary">{label}</span>
        <span className="text-content-primary font-medium">{value}</span>
      </div>
      <div className="w-full h-2 bg-surface-muted rounded-full">
        <div
          className={`h-full rounded-full ${colors[color]}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
