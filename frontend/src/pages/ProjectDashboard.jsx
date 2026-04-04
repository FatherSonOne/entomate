import React, { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, FolderKanban, BarChart3, Users, CheckCircle2,
  Clock, AlertTriangle, TrendingUp, RefreshCw,
  PieChart, Activity
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, Legend
} from 'recharts'
import { dashboardApi, projectsApi } from '../services/api'
import KanbanBoard from '../components/KanbanBoard'
import { VCButton, VCBadge } from '../components/vc'

const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#6366F1', '#8B5CF6']
const STATUS_COLORS = {
  open: '#6B7280',
  in_progress: '#3B82F6',
  review: '#8B5CF6',
  done: '#10B981',
  blocked: '#EF4444'
}

export default function ProjectDashboard() {
  const { id } = useParams()
  const [project, setProject] = useState(null)
  const [dashboardData, setDashboardData] = useState(null)
  const [teamWorkload, setTeamWorkload] = useState([])
  const [insights, setInsights] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (id) {
      loadProjectDashboard()
    } else {
      loadGlobalDashboard()
    }
  }, [id])

  const loadProjectDashboard = async () => {
    try {
      setLoading(true)
      const dashData = await projectsApi.getDashboard(id).catch(() => null)

      if (dashData) {
        setProject(dashData.project)
        setDashboardData({
          taskStats: dashData.taskStats,
          priorityStats: dashData.priorityStats,
          overdueCount: dashData.overdueCount,
          completionRate: dashData.completionRate,
          totalTasks: dashData.totalTasks
        })
        setTeamWorkload(dashData.teamWorkload || [])
      } else {
        // Fallback: load project directly
        const projectData = await projectsApi.get(id).catch(() => null)
        setProject(projectData)
      }
    } catch (error) {
      console.error('Failed to load project dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadGlobalDashboard = async () => {
    try {
      setLoading(true)
      const data = await dashboardApi.getProjectInsights().catch(() => null)

      if (data) {
        setDashboardData({
          taskStats: data.statusCounts || { open: 0, in_progress: 0, done: 0 },
          priorityStats: data.priorityCounts || { high: 0, medium: 0, low: 0 },
          overdueCount: data.metrics?.overdueItems || 0
        })
        setTeamWorkload(data.teamWorkload || [])
        setInsights(data.insights || [])
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    if (id) {
      await loadProjectDashboard()
    } else {
      await loadGlobalDashboard()
    }
    setRefreshing(false)
  }

  // Prepare chart data
  const getTaskStatusData = () => {
    if (!dashboardData?.taskStats) return []
    const stats = dashboardData.taskStats
    return [
      { name: 'To Do', value: stats.open || 0, color: STATUS_COLORS.open },
      { name: 'In Progress', value: stats.in_progress || 0, color: STATUS_COLORS.in_progress },
      { name: 'Review', value: stats.review || 0, color: STATUS_COLORS.review },
      { name: 'Done', value: stats.done || 0, color: STATUS_COLORS.done },
      { name: 'Blocked', value: stats.blocked || 0, color: STATUS_COLORS.blocked }
    ].filter(item => item.value > 0)
  }

  const getPriorityData = () => {
    if (!dashboardData?.priorityStats) return []
    const stats = dashboardData.priorityStats
    return [
      { name: 'High', value: stats.high || 0, color: '#EF4444' },
      { name: 'Medium', value: stats.medium || 0, color: '#F59E0B' },
      { name: 'Low', value: stats.low || 0, color: '#10B981' }
    ]
  }

  const getTeamWorkloadData = () => {
    return teamWorkload.map(member => ({
      name: member.team_member || 'Unassigned',
      tasks: member.total_assigned || 0,
      completed: member.completed_items || 0,
      pending: (member.pending_items || 0) + (member.in_progress_items || 0)
    }))
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 rounded w-48 mb-4" style={{ background: 'var(--bg-elevated)' }}></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 rounded" style={{ background: 'var(--bg-elevated)' }}></div>
            ))}
          </div>
          <div className="h-64 rounded" style={{ background: 'var(--bg-elevated)' }}></div>
        </div>
      </div>
    )
  }

  const taskStatusData = getTaskStatusData()
  const priorityData = getPriorityData()
  const workloadData = getTeamWorkloadData()
  const totalTasks = taskStatusData.reduce((sum, item) => sum + item.value, 0)
  const completionRate = totalTasks > 0
    ? Math.round((taskStatusData.find(s => s.name === 'Done')?.value || 0) / totalTasks * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          {id && (
            <Link
              to="/projects"
              className="p-2 rounded-lg transition-colors"
              style={{ background: 'var(--bg-elevated)' }}
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          )}
          <div>
            <h1
              className="text-2xl"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}
            >
              {id ? (project?.name || 'Project Dashboard') : 'Project Dashboard'}
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              {id ? 'Project analytics and task management' : 'Overview of all projects and tasks'}
            </p>
          </div>
        </div>
        <VCButton
          variant="secondary"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </VCButton>
      </div>

      {/* Tabs */}
      <div className="border-b" style={{ borderColor: 'rgba(248,240,242,.08)' }}>
        <nav className="flex gap-4">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'kanban', label: 'Kanban Board', icon: FolderKanban },
            { id: 'team', label: 'Team Workload', icon: Users }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500'
                  : 'border-transparent'
              }`}
              style={{
                color: activeTab === tab.id
                  ? 'var(--accent-primary)'
                  : 'var(--text-tertiary)'
              }}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="vc p-5" style={{ background: 'var(--bg-elevated)' }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Total Tasks</p>
                  <p
                    className="text-2xl mt-1"
                    style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}
                  >
                    {totalTasks}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-semantic-info-dim">
                  <CheckCircle2 className="w-5 h-5 text-semantic-info" />
                </div>
              </div>
            </div>

            <div className="vc p-5" style={{ background: 'var(--bg-elevated)' }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Completion Rate</p>
                  <p
                    className="text-2xl mt-1"
                    style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}
                  >
                    {completionRate}%
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-semantic-success-dim">
                  <TrendingUp className="w-5 h-5 text-semantic-success" />
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${completionRate}%`,
                    background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))'
                  }}
                />
              </div>
            </div>

            <div className="vc p-5" style={{ background: 'var(--bg-elevated)' }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>In Progress</p>
                  <p
                    className="text-2xl mt-1"
                    style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}
                  >
                    {taskStatusData.find(s => s.name === 'In Progress')?.value || 0}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-semantic-info-dim">
                  <Activity className="w-5 h-5 text-semantic-info" />
                </div>
              </div>
            </div>

            <div className="vc p-5" style={{ background: 'var(--bg-elevated)' }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Overdue</p>
                  <p
                    className="text-2xl mt-1"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      color: (dashboardData?.overdueCount || 0) > 0
                        ? 'var(--accent-primary)'
                        : 'var(--text-primary)'
                    }}
                  >
                    {dashboardData?.overdueCount || 0}
                  </p>
                </div>
                <div className={`p-2 rounded-lg ${
                  (dashboardData?.overdueCount || 0) > 0 ? 'bg-semantic-error-dim' : ''
                }`} style={(dashboardData?.overdueCount || 0) === 0 ? { background: 'var(--bg-elevated)' } : {}}>
                  <AlertTriangle className={`w-5 h-5 ${
                    (dashboardData?.overdueCount || 0) > 0 ? 'text-semantic-error' : ''
                  }`} style={(dashboardData?.overdueCount || 0) === 0 ? { color: 'var(--text-secondary)' } : {}} />
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Task Status Pie Chart */}
            <div className="vc p-5" style={{ background: 'var(--bg-elevated)' }}>
              <h3
                className="font-semibold mb-4 flex items-center gap-2"
                style={{ color: 'var(--text-primary)' }}
              >
                <PieChart className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                Task Status Distribution
              </h3>
              {taskStatusData.length > 0 && totalTasks > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <RechartsPie>
                    <Pie
                      data={taskStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {taskStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPie>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center" style={{ color: 'var(--text-tertiary)' }}>
                  No task data available
                </div>
              )}
            </div>

            {/* Priority Distribution */}
            <div className="vc p-5" style={{ background: 'var(--bg-elevated)' }}>
              <h3
                className="font-semibold mb-4 flex items-center gap-2"
                style={{ color: 'var(--text-primary)' }}
              >
                <AlertTriangle className="w-5 h-5" style={{ color: 'var(--accent-tertiary)' }} />
                Tasks by Priority
              </h3>
              {priorityData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={priorityData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={80} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {priorityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center" style={{ color: 'var(--text-tertiary)' }}>
                  No priority data available
                </div>
              )}
            </div>
          </div>

          {/* AI Insights */}
          {!id && insights.length > 0 && (
            <div className="vc p-5" style={{ background: 'var(--bg-elevated)' }}>
              <h3
                className="font-semibold mb-4 flex items-center gap-2"
                style={{ color: 'var(--text-primary)' }}
              >
                <TrendingUp className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                AI Insights
              </h3>
              <div className="space-y-3">
                {insights.map((insight, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg ${
                      insight.type === 'warning' ? 'bg-semantic-warning-dim border border-semantic-warning' :
                      insight.type === 'success' ? 'bg-semantic-success-dim border border-semantic-success' :
                      'bg-semantic-info-dim border border-semantic-info'
                    }`}
                  >
                    <p className={`text-sm ${
                      insight.type === 'warning' ? 'text-semantic-warning' :
                      insight.type === 'success' ? 'text-semantic-success' :
                      'text-semantic-info'
                    }`}>
                      {insight.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Kanban Tab */}
      {activeTab === 'kanban' && (
        <KanbanBoard projectId={id} onTaskUpdate={handleRefresh} />
      )}

      {/* Team Workload Tab */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          {/* Team Workload Chart */}
          <div className="vc p-5" style={{ background: 'var(--bg-elevated)' }}>
            <h3
              className="font-semibold mb-4 flex items-center gap-2"
              style={{ color: 'var(--text-primary)' }}
            >
              <Users className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
              Team Task Distribution
            </h3>
            {workloadData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={workloadData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="pending" name="Pending" fill="#F59E0B" stackId="stack" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="completed" name="Completed" fill="#10B981" stackId="stack" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center" style={{ color: 'var(--text-tertiary)' }}>
                No team workload data available
              </div>
            )}
          </div>

          {/* Team Members Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamWorkload.map((member, index) => {
              const memberCompletionRate = member.total_assigned > 0
                ? Math.round((member.completed_items || 0) / member.total_assigned * 100)
                : 0

              return (
                <div key={index} className="vc p-5" style={{ background: 'var(--bg-elevated)' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold">
                      {(member.team_member || 'U')[0].toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {member.team_member || 'Unassigned'}
                      </h4>
                      <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                        {member.total_assigned} tasks
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span style={{ color: 'var(--text-tertiary)' }}>Completion</span>
                      <span
                        className="font-medium"
                        style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
                      >
                        {memberCompletionRate}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${memberCompletionRate}%`,
                          background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))'
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2">
                      <div
                        className="text-center p-2 rounded"
                        style={{ background: 'var(--bg-elevated)' }}
                      >
                        <p
                          className="text-lg"
                          style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-secondary)' }}
                        >
                          {member.pending_items || 0}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>To Do</p>
                      </div>
                      <div className="text-center p-2 bg-semantic-info-dim rounded">
                        <p
                          className="text-lg font-semibold text-semantic-info"
                          style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
                        >
                          {member.in_progress_items || 0}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Active</p>
                      </div>
                      <div className="text-center p-2 bg-semantic-success-dim rounded">
                        <p
                          className="text-lg font-semibold text-semantic-success"
                          style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
                        >
                          {member.completed_items || 0}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Done</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {teamWorkload.length === 0 && (
              <div className="col-span-full vc p-8 text-center" style={{ background: 'var(--bg-elevated)' }}>
                <Users className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
                <h3
                  className="text-lg font-medium mb-1"
                  style={{ color: 'var(--text-primary)' }}
                >
                  No team data
                </h3>
                <p style={{ color: 'var(--text-tertiary)' }}>
                  Assign tasks to team members to see workload distribution
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
