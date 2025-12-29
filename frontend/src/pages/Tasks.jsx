import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Search, Filter, CheckSquare, Clock, AlertCircle, Trash2
} from 'lucide-react'
import { tasksApi } from '../services/api'

export default function Tasks() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', priority: 'medium', dueDate: '' })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadTasks()
  }, [statusFilter])

  const loadTasks = async () => {
    try {
      setLoading(true)
      const params = { limit: 100 }
      if (statusFilter !== 'all') {
        params.status = statusFilter
      }
      const data = await tasksApi.list(params)
      setTasks(data.tasks || [])
    } catch (error) {
      console.error('Failed to load tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newTask.title.trim()) return

    try {
      setCreating(true)
      await tasksApi.create(newTask)
      setNewTask({ title: '', priority: 'medium', dueDate: '' })
      setShowCreate(false)
      loadTasks()
    } catch (error) {
      console.error('Failed to create task:', error)
    } finally {
      setCreating(false)
    }
  }

  const handleComplete = async (id) => {
    try {
      await tasksApi.complete(id)
      loadTasks()
    } catch (error) {
      console.error('Failed to complete task:', error)
    }
  }

  const handleReopen = async (id) => {
    try {
      await tasksApi.reopen(id)
      loadTasks()
    } catch (error) {
      console.error('Failed to reopen task:', error)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this task?')) return

    try {
      await tasksApi.delete(id)
      setTasks(tasks.filter(t => t.id !== id))
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }

  const filteredTasks = tasks.filter(task =>
    task.title?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const isOverdue = (dueDate) => {
    if (!dueDate) return false
    return new Date(dueDate) < new Date()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-600">Manage all your tasks in one place</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" />
          New Task
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Create New Task</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="label">Task Title</label>
              <input
                type="text"
                className="input"
                placeholder="What needs to be done?"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Priority</label>
                <select
                  className="input"
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="label">Due Date</label>
                <input
                  type="date"
                  className="input"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={creating} className="btn btn-primary">
                {creating ? 'Creating...' : 'Create Task'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search tasks..."
            className="input pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {['all', 'open', 'in_progress', 'done'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`btn ${
                statusFilter === status ? 'btn-primary' : 'btn-secondary'
              }`}
            >
              {status === 'all' ? 'All' :
               status === 'in_progress' ? 'In Progress' :
               status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks list */}
      <div className="card">
        {loading ? (
          <div className="p-8 text-center">
            <div className="spinner mx-auto mb-4" />
            <p className="text-gray-500">Loading tasks...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-8 text-center">
            <CheckSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No tasks found</h3>
            <p className="text-gray-500">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first task to get started'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className={`p-4 flex items-center gap-4 ${
                  task.status === 'done' ? 'bg-gray-50' : ''
                }`}
              >
                <button
                  onClick={() => task.status === 'done' ? handleReopen(task.id) : handleComplete(task.id)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    task.status === 'done'
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-gray-300 hover:border-primary-500'
                  }`}
                >
                  {task.status === 'done' && (
                    <CheckSquare className="w-4 h-4" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-medium ${
                      task.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900'
                    }`}>
                      {task.title}
                    </p>
                    {task.due_date && isOverdue(task.due_date) && task.status !== 'done' && (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                    {task.due_date && (
                      <span className={`flex items-center gap-1 ${
                        isOverdue(task.due_date) && task.status !== 'done' ? 'text-red-500' : ''
                      }`}>
                        <Clock className="w-4 h-4" />
                        {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    )}
                    {task.project_id && (
                      <Link
                        to={`/projects/${task.project_id}`}
                        className="text-primary-600 hover:underline"
                      >
                        View Project
                      </Link>
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

                <span className={`badge ${
                  task.status === 'done' ? 'badge-success' :
                  task.status === 'in_progress' ? 'badge-warning' :
                  task.status === 'blocked' ? 'badge-error' :
                  'badge-info'
                }`}>
                  {task.status === 'in_progress' ? 'In Progress' :
                   task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                </span>

                <button
                  onClick={() => handleDelete(task.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
