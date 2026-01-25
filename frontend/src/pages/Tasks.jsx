import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Search, Filter, CheckSquare, Clock, AlertCircle, Trash2, Circle, CheckCircle2, Target
} from 'lucide-react'
import { tasksApi } from '../services/api'
import { GuideCard, PageHeader, Skeleton } from '../components/SharedUI'
import { AgentRecommendationPanel } from '../components/intelligence'
import { ExplanationModal } from '../components/explainability'

export default function Tasks() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', priority: 'medium', dueDate: '' })
  const [creating, setCreating] = useState(false)
  const [wizardStep, setWizardStep] = useState(0) // 0: Create, 1: Prioritize, 2: Complete

  // AI Recommendations state
  const [recommendations, setRecommendations] = useState(null)
  const [loadingRecommendations, setLoadingRecommendations] = useState(false)
  const [showExplanation, setShowExplanation] = useState(false)
  const [explanationData, setExplanationData] = useState(null)

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
      if (data.tasks && data.tasks.length > 0) {
        setWizardStep(2) // If tasks exist, show complete step
      }
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
      setWizardStep(1)
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

  // Fetch AI recommendations when title changes
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!newTask.title || newTask.title.length < 5) {
        setRecommendations(null)
        return
      }

      try {
        setLoadingRecommendations(true)
        // Call the agent recommendations API
        const response = await fetch('/api/agents/recommendations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskTitle: newTask.title,
            context: { existingTasks: tasks.length }
          })
        })
        const data = await response.json()
        if (data.success) {
          setRecommendations(data.recommendations)
        }
      } catch (error) {
        console.error('Failed to fetch recommendations:', error)
      } finally {
        setLoadingRecommendations(false)
      }
    }

    // Debounce the API call
    const timeoutId = setTimeout(fetchRecommendations, 800)
    return () => clearTimeout(timeoutId)
  }, [newTask.title, tasks.length])

  const handleAcceptRecommendation = (type, value) => {
    if (type === 'assignment') {
      setNewTask({ ...newTask, assignedTo: value })
    } else if (type === 'priority') {
      setNewTask({ ...newTask, priority: value })
    } else if (type === 'deadline') {
      setNewTask({ ...newTask, dueDate: value })
    }
  }

  const handleOverrideRecommendation = async (type, aiValue, userValue, reason) => {
    // Capture feedback for the learning system
    try {
      await fetch('/api/learning/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: type === 'assignment' ? 'assignment' : type === 'priority' ? 'priority' : 'deadline',
          recommendation: aiValue,
          userChoice: userValue,
          reason,
          context: { taskTitle: newTask.title }
        })
      })
    } catch (error) {
      console.error('Failed to capture feedback:', error)
    }
  }

  const handleShowExplanation = (type, data) => {
    setExplanationData({
      agentType: type,
      recommendation: data.value,
      confidence: data.confidence,
      factors: data.factors || []
    })
    setShowExplanation(true)
  }

  const filteredTasks = tasks.filter(task =>
    task.title?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const isOverdue = (dueDate) => {
    if (!dueDate) return false
    return new Date(dueDate) < new Date()
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-semantic-error bg-semantic-error/10 border-red-500/20'
      case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'
      case 'low': return 'text-green-500 bg-green-500/10 border-green-500/20'
      default: return 'text-content-tertiary bg-surface-muted border-line-subtle'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'done': return 'text-green-500 bg-green-500/10 border-green-500/20'
      case 'in_progress': return 'text-accent-primary bg-accent-primary/10 border-accent-primary/20'
      case 'blocked': return 'text-semantic-error bg-semantic-error/10 border-red-500/20'
      default: return 'text-content-tertiary bg-surface-muted border-line-subtle'
    }
  }

  return (
    <div className="animate-fade-in max-w-7xl mx-auto">
      <PageHeader 
        title="Task Management" 
        subtitle="Create, prioritize, and track all your tasks in one place."
        actions={
          <button
            onClick={() => {
              setShowCreate(!showCreate)
              setWizardStep(0)
            }}
            className="btn btn-primary"
          >
            <Plus size={16} />
            New Task
          </button>
        }
      />

      <GuideCard 
        title="Task Workflow" 
        steps={['Create Task', 'Set Priority', 'Complete & Review']} 
        activeStep={wizardStep} 
      />

      {/* Create form */}
      {showCreate && (
        <div className="card p-6 mb-6 animate-fade-in">
          <h3 className="font-bold text-content-primary text-lg mb-4">Create New Task</h3>
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

            {/* AI Recommendations Panel */}
            {(recommendations || loadingRecommendations) && newTask.title.length >= 5 && (
              <div className="animate-fade-in">
                {loadingRecommendations ? (
                  <div className="bg-surface-muted border border-line-default rounded-lg p-6 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
                    <p className="mt-2 text-sm text-content-secondary">Getting AI recommendations...</p>
                  </div>
                ) : recommendations ? (
                  <AgentRecommendationPanel
                    recommendations={recommendations}
                    onAccept={handleAcceptRecommendation}
                    onOverride={handleOverrideRecommendation}
                    onExplain={handleShowExplanation}
                    taskData={newTask}
                  />
                ) : null}
              </div>
            )}

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
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary" />
          <input
            type="text"
            placeholder="Search tasks by title..."
            className="input pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'open', 'in_progress', 'done'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`btn btn-sm ${
                statusFilter === status ? 'btn-primary' : 'btn-ghost'
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
          <Skeleton className="h-16" count={8} />
        ) : filteredTasks.length === 0 ? (
          <div className="p-12 text-center border-dashed border-2 m-4 rounded-lg">
            <CheckSquare className="w-16 h-16 text-content-muted mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-content-primary mb-2">No tasks found</h3>
            <p className="text-content-secondary mb-6">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first task to get started'
              }
            </p>
            <button
              onClick={() => {
                setShowCreate(true)
                setWizardStep(0)
              }}
              className="btn btn-primary"
            >
              <Plus size={16} />
              Create Task
            </button>
          </div>
        ) : (
          <div className="divide-y divide-line-subtle">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className={`p-4 flex items-center gap-4 hover:bg-surface-muted transition-colors group ${
                  task.status === 'done' ? 'opacity-60' : ''
                }`}
              >
                <button
                  onClick={() => task.status === 'done' ? handleReopen(task.id) : handleComplete(task.id)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    task.status === 'done'
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-content-muted hover:border-accent-primary'
                  }`}
                >
                  {task.status === 'done' ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <Circle size={16} className="opacity-0 group-hover:opacity-100" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={`font-medium ${
                      task.status === 'done' ? 'text-content-tertiary line-through' : 'text-content-primary'
                    }`}>
                      {task.title}
                    </p>
                    {task.due_date && isOverdue(task.due_date) && task.status !== 'done' && (
                      <AlertCircle size={16} className="text-semantic-error" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-content-tertiary font-mono">
                    {task.due_date && (
                      <span className={`flex items-center gap-1 ${
                        isOverdue(task.due_date) && task.status !== 'done' ? 'text-semantic-error' : ''
                      }`}>
                        <Clock size={12} />
                        {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    )}
                    {task.project_id && (
                      <Link
                        to={`/projects/${task.project_id}`}
                        className="text-accent-primary hover:underline"
                      >
                        View Project
                      </Link>
                    )}
                  </div>
                </div>

                <span className={`text-xs px-2 py-1 rounded-sm border font-mono ${getPriorityColor(task.priority)}`}>
                  {task.priority}
                </span>

                <span className={`text-xs px-2 py-1 rounded-sm border font-mono ${getStatusColor(task.status)}`}>
                  {task.status === 'in_progress' ? 'In Progress' :
                   task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                </span>

                <button
                  onClick={() => handleDelete(task.id)}
                  className="p-2 opacity-0 group-hover:opacity-100 hover:bg-semantic-error/10 hover:text-semantic-error rounded-md transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Explanation Modal */}
      {showExplanation && explanationData && (
        <ExplanationModal
          isOpen={showExplanation}
          onClose={() => setShowExplanation(false)}
          explanation={{
            agentType: explanationData.agentType,
            recommendation: explanationData.recommendation,
            confidence: explanationData.confidence,
            factors: explanationData.factors,
            timestamp: new Date().toISOString()
          }}
        />
      )}
    </div>
  )
}
