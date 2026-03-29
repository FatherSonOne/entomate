import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Plus, CheckSquare, Calendar, Clock, Users,
  MoreVertical, Trash2, BarChart3
} from 'lucide-react'
import { projectsApi, tasksApi } from '../services/api'
import { VCButton, VCBadge } from '../components/vc'
import { useConfirm } from '../components/vc/ConfirmDialog'

export default function ProjectDetail() {
  const { id } = useParams()
  const confirm = useConfirm()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', priority: 'medium' })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadProject()
  }, [id])

  const loadProject = async () => {
    try {
      setLoading(true)
      const data = await projectsApi.get(id)
      setProject(data)
    } catch (error) {
      console.error('Failed to load project:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddTask = async (e) => {
    e.preventDefault()
    if (!newTask.title.trim()) return

    try {
      setCreating(true)
      await tasksApi.create({
        projectId: id,
        title: newTask.title,
        priority: newTask.priority
      })
      setNewTask({ title: '', priority: 'medium' })
      setShowAddTask(false)
      loadProject()
    } catch (error) {
      console.error('Failed to create task:', error)
    } finally {
      setCreating(false)
    }
  }

  const handleCompleteTask = async (taskId) => {
    try {
      await tasksApi.complete(taskId)
      loadProject()
    } catch (error) {
      console.error('Failed to complete task:', error)
    }
  }

  const handleDeleteTask = async (taskId) => {
    const ok = await confirm({ title: 'Delete Task', message: 'Delete this task?', confirmLabel: 'Delete', variant: 'danger' })
    if (!ok) return

    try {
      await tasksApi.delete(taskId)
      loadProject()
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Project not found
        </h2>
        <Link
          to="/projects"
          className="hover:underline mt-2 inline-block"
          style={{ color: 'var(--accent-primary)' }}
        >
          Back to projects
        </Link>
      </div>
    )
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':    return <VCBadge color="mint">{status}</VCBadge>
      case 'planning':  return <VCBadge color="amber">{status}</VCBadge>
      case 'completed': return <VCBadge color="neutral">{status}</VCBadge>
      default:          return <VCBadge color="neutral">{status}</VCBadge>
    }
  }

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'high':   return <VCBadge color="crimson">{priority}</VCBadge>
      case 'medium': return <VCBadge color="amber">{priority}</VCBadge>
      default:       return <VCBadge color="mint">{priority}</VCBadge>
    }
  }

  const tasksByStatus = {
    open: project.tasks?.filter(t => t.status === 'open') || [],
    in_progress: project.tasks?.filter(t => t.status === 'in_progress') || [],
    done: project.tasks?.filter(t => t.status === 'done') || []
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link
          to="/projects"
          className="p-2 rounded-lg transition-colors"
          style={{ background: 'var(--bg-elevated)' }}
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h1
              className="text-2xl"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}
            >
              {project.name}
            </h1>
            <VCButton variant="secondary" as={Link} to={`/projects/${id}/dashboard`}>
              <BarChart3 className="w-4 h-4" />
              View Dashboard
            </VCButton>
          </div>
          {project.description && (
            <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>{project.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {getStatusBadge(project.status)}
            {project.start_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Started {new Date(project.start_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      {project.stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="vc p-4 text-center" style={{ background: 'var(--bg-elevated)' }}>
            <div
              className="text-2xl"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}
            >
              {project.stats.totalTasks}
            </div>
            <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Total Tasks</div>
          </div>
          <div className="vc p-4 text-center" style={{ background: 'var(--bg-elevated)' }}>
            <div
              className="text-2xl text-semantic-success"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
            >
              {project.stats.completedTasks}
            </div>
            <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Completed</div>
          </div>
          <div className="vc p-4 text-center" style={{ background: 'var(--bg-elevated)' }}>
            <div
              className="text-2xl"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent-tertiary)' }}
            >
              {project.stats.inProgressTasks}
            </div>
            <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>In Progress</div>
          </div>
          <div className="vc p-4 text-center" style={{ background: 'var(--bg-elevated)' }}>
            <div
              className="text-2xl text-semantic-info"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
            >
              {project.stats.openTasks}
            </div>
            <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Open</div>
          </div>
        </div>
      )}

      {/* Tasks */}
      <div className="vc" style={{ background: 'var(--bg-elevated)' }}>
        <div
          className="p-4 border-b flex items-center justify-between"
          style={{ borderColor: 'rgba(248,240,242,.08)' }}
        >
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Tasks</h2>
          <VCButton
            variant="primary"
            size="sm"
            onClick={() => setShowAddTask(!showAddTask)}
          >
            <Plus className="w-4 h-4" />
            Add Task
          </VCButton>
        </div>

        {/* Add task form */}
        {showAddTask && (
          <div
            className="p-4 border-b"
            style={{ background: 'var(--bg-elevated)', borderColor: 'rgba(248,240,242,.08)' }}
          >
            <form onSubmit={handleAddTask} className="flex gap-3">
              <input
                type="text"
                className="input flex-1"
                placeholder="Task title..."
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                autoFocus
              />
              <select
                className="input w-32"
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <VCButton type="submit" variant="primary" disabled={creating}>
                {creating ? 'Adding...' : 'Add'}
              </VCButton>
              <VCButton
                type="button"
                variant="secondary"
                onClick={() => setShowAddTask(false)}
              >
                Cancel
              </VCButton>
            </form>
          </div>
        )}

        {/* Task list */}
        {project.tasks?.length === 0 ? (
          <div className="p-8 text-center">
            <CheckSquare className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
            <p style={{ color: 'var(--text-tertiary)' }}>No tasks yet</p>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Add a task to get started</p>
          </div>
        ) : (
          <div className="divide-y" style={{ '--tw-divide-opacity': 1 }}>
            {project.tasks?.map((task) => (
              <div
                key={task.id}
                className="p-4 flex items-center gap-3"
                style={task.status === 'done' ? { background: 'var(--bg-elevated)' } : {}}
              >
                <button
                  onClick={() => handleCompleteTask(task.id)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    task.status === 'done'
                      ? 'vc-bg-success vc-border-success vc-text-primary'
                      : 'border-line-strong hover:border-primary-500'
                  }`}
                >
                  {task.status === 'done' && (
                    <CheckSquare className="w-3 h-3" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <p
                    className={`font-medium ${task.status === 'done' ? 'line-through' : ''}`}
                    style={{
                      color: task.status === 'done'
                        ? 'var(--text-tertiary)'
                        : 'var(--text-primary)'
                    }}
                  >
                    {task.title}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {task.due_date && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    )}
                    {task.assigned_to && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Assigned
                      </span>
                    )}
                  </div>
                </div>

                {getPriorityBadge(task.priority)}

                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="p-1.5 rounded transition-colors hover:bg-semantic-error-dim hover:text-semantic-error"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Related Meetings */}
      {project.meetings?.length > 0 && (
        <div className="vc" style={{ background: 'var(--bg-elevated)' }}>
          <div
            className="p-4 border-b"
            style={{ borderColor: 'rgba(248,240,242,.08)' }}
          >
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Related Meetings</h2>
          </div>
          <div>
            {project.meetings.map((meeting) => (
              <Link
                key={meeting.id}
                to={`/meetings/${meeting.id}`}
                className="block p-4 transition-colors"
                style={{ borderBottom: '1px solid rgba(248,240,242,.08)' }}
              >
                <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>{meeting.title}</h4>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  {new Date(meeting.created_at).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
