import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Plus, CheckSquare, Calendar, Clock, Users,
  MoreVertical, Trash2, BarChart3
} from 'lucide-react'
import { projectsApi, tasksApi } from '../services/api'

export default function ProjectDetail() {
  const { id } = useParams()
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
    if (!confirm('Delete this task?')) return

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
        <h2 className="text-xl font-semibold text-gray-900">Project not found</h2>
        <Link to="/projects" className="text-primary-600 hover:underline mt-2 inline-block">
          Back to projects
        </Link>
      </div>
    )
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'done': return 'bg-green-100 text-green-800'
      case 'in_progress': return 'bg-yellow-100 text-yellow-800'
      case 'blocked': return 'bg-red-100 text-red-800'
      default: return 'bg-blue-100 text-blue-800'
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
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <Link
              to={`/projects/${id}/dashboard`}
              className="btn btn-secondary"
            >
              <BarChart3 className="w-4 h-4" />
              View Dashboard
            </Link>
          </div>
          {project.description && (
            <p className="text-gray-600 mt-1">{project.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span className={`badge ${
              project.status === 'active' ? 'badge-success' :
              project.status === 'completed' ? 'badge-gray' :
              'badge-info'
            }`}>
              {project.status}
            </span>
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
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{project.stats.totalTasks}</div>
            <div className="text-sm text-gray-500">Total Tasks</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{project.stats.completedTasks}</div>
            <div className="text-sm text-gray-500">Completed</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{project.stats.inProgressTasks}</div>
            <div className="text-sm text-gray-500">In Progress</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{project.stats.openTasks}</div>
            <div className="text-sm text-gray-500">Open</div>
          </div>
        </div>
      )}

      {/* Tasks */}
      <div className="card">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Tasks</h2>
          <button
            onClick={() => setShowAddTask(!showAddTask)}
            className="btn btn-primary btn-sm"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
        </div>

        {/* Add task form */}
        {showAddTask && (
          <div className="p-4 bg-gray-50 border-b border-gray-200">
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
              <button type="submit" disabled={creating} className="btn btn-primary">
                {creating ? 'Adding...' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddTask(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </form>
          </div>
        )}

        {/* Task list */}
        {project.tasks?.length === 0 ? (
          <div className="p-8 text-center">
            <CheckSquare className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No tasks yet</p>
            <p className="text-sm text-gray-400">Add a task to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {project.tasks?.map((task) => (
              <div
                key={task.id}
                className={`p-4 flex items-center gap-3 ${
                  task.status === 'done' ? 'bg-gray-50' : ''
                }`}
              >
                <button
                  onClick={() => handleCompleteTask(task.id)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    task.status === 'done'
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-gray-300 hover:border-primary-500'
                  }`}
                >
                  {task.status === 'done' && (
                    <CheckSquare className="w-3 h-3" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${
                    task.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900'
                  }`}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
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

                <span className={`badge ${
                  task.priority === 'high' ? 'badge-error' :
                  task.priority === 'medium' ? 'badge-warning' :
                  'badge-success'
                }`}>
                  {task.priority}
                </span>

                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
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
        <div className="card">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Related Meetings</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {project.meetings.map((meeting) => (
              <Link
                key={meeting.id}
                to={`/meetings/${meeting.id}`}
                className="block p-4 hover:bg-gray-50"
              >
                <h4 className="font-medium text-gray-900">{meeting.title}</h4>
                <p className="text-sm text-gray-500 mt-0.5">
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
