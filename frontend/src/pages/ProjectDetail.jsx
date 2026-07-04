import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Plus, CheckSquare, Calendar, Clock, Users,
  Trash2, BarChart3, Pencil, X, Save, RotateCcw, ChevronDown, ChevronRight, Tag
} from 'lucide-react'
import { projectsApi, tasksApi } from '../services/api'
import { VCButton, VCInput, VCSelect } from '../components/vc'
import { getStatusBadge, getPriorityBadge } from '../utils/badges'
import { useConfirm } from '../components/vc/ConfirmDialog'
import { useToast } from '../components/vc/ToastProvider'

export default function ProjectDetail() {
  const { id } = useParams()
  const confirm = useConfirm()
  const toast = useToast()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium', assignedTo: '', dueDate: '' })
  const [creating, setCreating] = useState(false)
  // Task edit modal
  const [editingTask, setEditingTask] = useState(null)
  const [taskForm, setTaskForm] = useState({})
  const [savingTask, setSavingTask] = useState(false)
  // Project edit
  const [editingProject, setEditingProject] = useState(false)
  const [projectForm, setProjectForm] = useState({})
  const [savingProject, setSavingProject] = useState(false)
  // Subtask expansion
  const [expandedTasks, setExpandedTasks] = useState(new Set())

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
        description: newTask.description || undefined,
        priority: newTask.priority,
        assignedTo: newTask.assignedTo || undefined,
        dueDate: newTask.dueDate || undefined
      })
      setNewTask({ title: '', description: '', priority: 'medium', assignedTo: '', dueDate: '' })
      setShowAddTask(false)
      toast.success('Created', 'Task added')
      loadProject()
    } catch (error) {
      console.error('Failed to create task:', error)
      toast.error('Error', error.message || 'Failed to create task')
    } finally {
      setCreating(false)
    }
  }

  // Derive stats from task list (replaces fragile manual stat adjustments)
  const computeStats = (tasks) => ({
    totalTasks: tasks.length,
    completedTasks: tasks.filter(t => t.status === 'done').length,
    openTasks: tasks.filter(t => t.status === 'open').length,
    inProgressTasks: tasks.filter(t => t.status === 'in_progress').length
  })

  const optimisticUpdate = (newTasks, prevTasks, apiFn) => {
    setProject(prev => ({ ...prev, tasks: newTasks, stats: computeStats(newTasks) }))
    apiFn().catch(error => {
      console.error(error)
      setProject(prev => ({ ...prev, tasks: prevTasks, stats: computeStats(prevTasks) }))
    })
  }

  const handleCompleteTask = (taskId) => {
    const prevTasks = project.tasks
    const newTasks = prevTasks.map(t =>
      t.id === taskId ? { ...t, status: 'done', completed_at: new Date().toISOString() } : t
    )
    optimisticUpdate(newTasks, prevTasks, () => tasksApi.complete(taskId))
  }

  const handleReopenTask = (taskId) => {
    const prevTasks = project.tasks
    const newTasks = prevTasks.map(t =>
      t.id === taskId ? { ...t, status: 'open', completed_at: null } : t
    )
    optimisticUpdate(newTasks, prevTasks, () => tasksApi.reopen(taskId))
  }

  const handleDeleteTask = async (taskId) => {
    const ok = await confirm({ title: 'Delete Task', message: 'Delete this task?', confirmLabel: 'Delete', variant: 'danger' })
    if (!ok) return

    const prevTasks = project.tasks
    const newTasks = prevTasks.filter(t => t.id !== taskId)
    optimisticUpdate(newTasks, prevTasks, () => tasksApi.delete(taskId))
  }

  // --- Task Edit Modal ---
  const openTaskEdit = (task) => {
    setTaskForm({
      title: task.title || '',
      description: task.description || '',
      priority: task.priority || 'medium',
      status: task.status || 'open',
      assigned_to: task.assigned_to || '',
      due_date: task.due_date ? task.due_date.split('T')[0] : '',
      tags: Array.isArray(task.tags) ? task.tags.join(', ') : ''
    })
    setEditingTask(task)
  }

  const handleSaveTask = async (e) => {
    e.preventDefault()
    if (!taskForm.title.trim()) {
      toast.warning('Required', 'Task title cannot be empty')
      return
    }
    const parsedTags = taskForm.tags ? taskForm.tags.split(',').map(t => t.trim()).filter(Boolean) : []
    setSavingTask(true)
    try {
      await tasksApi.update(editingTask.id, {
        title: taskForm.title,
        description: taskForm.description || null,
        priority: taskForm.priority,
        status: taskForm.status,
        assigned_to: taskForm.assigned_to || null,
        due_date: taskForm.due_date || null,
        tags: parsedTags
      })
      toast.success('Saved', 'Task updated')
      setEditingTask(null)
      loadProject()
    } catch (error) {
      console.error('Failed to update task:', error)
      toast.error('Error', error.message || 'Failed to update task')
    } finally {
      setSavingTask(false)
    }
  }

  // --- Project Edit ---
  const startProjectEdit = () => {
    setProjectForm({
      name: project.name || '',
      description: project.description || '',
      status: project.status || 'planning',
      start_date: project.start_date ? project.start_date.split('T')[0] : '',
      end_date: project.end_date ? project.end_date.split('T')[0] : ''
    })
    setEditingProject(true)
  }

  const handleSaveProject = async (e) => {
    e.preventDefault()
    if (!projectForm.name.trim()) {
      toast.warning('Required', 'Project name cannot be empty')
      return
    }
    setSavingProject(true)
    try {
      await projectsApi.update(id, {
        name: projectForm.name,
        description: projectForm.description || null,
        status: projectForm.status,
        start_date: projectForm.start_date || null,
        end_date: projectForm.end_date || null
      })
      toast.success('Saved', 'Project updated')
      setEditingProject(false)
      loadProject()
    } catch (error) {
      console.error('Failed to update project:', error)
      toast.error('Error', error.message || 'Failed to update project')
    } finally {
      setSavingProject(false)
    }
  }

  // --- Inline Status Change ---
  const handleStatusChange = async (taskId, newStatus) => {
    const prevTasks = project.tasks
    setProject(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === taskId ? { ...t, status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null } : t)
    }))
    try {
      await tasksApi.update(taskId, { status: newStatus })
    } catch (error) {
      console.error('Failed to update status:', error)
      toast.error('Error', 'Failed to update task status')
      setProject(prev => ({ ...prev, tasks: prevTasks }))
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

  // Separate parent tasks from subtasks
  const allTasks = project.tasks || []
  const parentTasks = allTasks.filter(t => !t.parent_task_id)
  const getSubtasks = (parentId) => allTasks.filter(t => t.parent_task_id === parentId)
  const toggleExpand = (taskId) => {
    setExpandedTasks(prev => {
      const next = new Set(prev)
      next.has(taskId) ? next.delete(taskId) : next.add(taskId)
      return next
    })
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
          {editingProject ? (
            <form onSubmit={handleSaveProject} className="space-y-3">
              <div className="flex items-center gap-3">
                <VCInput
                  value={projectForm.name}
                  onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                  placeholder="Project name"
                  style={{ fontSize: 20, fontWeight: 700 }}
                  required
                />
              </div>
              <textarea
                className="vinput"
                rows={2}
                value={projectForm.description}
                onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                placeholder="Description..."
              />
              <div className="flex gap-3 flex-wrap">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Status</label>
                  <VCSelect
                    value={projectForm.status}
                    onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })}
                  >
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </VCSelect>
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Start Date</label>
                  <VCInput
                    type="date"
                    value={projectForm.start_date}
                    onChange={(e) => setProjectForm({ ...projectForm, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>End Date</label>
                  <VCInput
                    type="date"
                    value={projectForm.end_date}
                    onChange={(e) => setProjectForm({ ...projectForm, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <VCButton type="submit" variant="primary" disabled={savingProject}>
                  <Save className="w-4 h-4" />
                  {savingProject ? 'Saving...' : 'Save'}
                </VCButton>
                <VCButton type="button" variant="ghost" onClick={() => setEditingProject(false)}>
                  Cancel
                </VCButton>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h1
                    className="text-2xl"
                    style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}
                  >
                    {project.name}
                  </h1>
                  <button
                    onClick={startProjectEdit}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--text-tertiary)' }}
                    title="Edit project"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
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
            </>
          )}
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
          style={{ borderColor: 'var(--b1)' }}
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
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--b1)' }}
          >
            <form onSubmit={handleAddTask} className="space-y-3">
              <div className="flex gap-3">
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
              </div>
              <textarea
                className="input min-h-[60px]"
                placeholder="Description (optional)..."
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              />
              <div className="flex gap-3">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="Assigned to..."
                  value={newTask.assignedTo}
                  onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                />
                <input
                  type="date"
                  className="input w-44"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                />
              </div>
              <div className="flex gap-3">
                <VCButton type="submit" variant="primary" disabled={creating}>
                  {creating ? 'Adding...' : 'Add Task'}
                </VCButton>
                <VCButton
                  type="button"
                  variant="secondary"
                  onClick={() => setShowAddTask(false)}
                >
                  Cancel
                </VCButton>
              </div>
            </form>
          </div>
        )}

        {/* Task list */}
        {parentTasks.length === 0 ? (
          <div className="p-8 text-center">
            <CheckSquare className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
            <p style={{ color: 'var(--text-tertiary)' }}>No tasks yet</p>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Add a task to get started</p>
          </div>
        ) : (
          <div className="divide-y" style={{ '--tw-divide-opacity': 1 }}>
            {parentTasks.map((task) => {
              const subtasks = getSubtasks(task.id)
              const isExpanded = expandedTasks.has(task.id)

              return (
                <div key={task.id}>
                  {/* Parent task row */}
                  <div
                    className="p-4 flex items-center gap-3"
                    style={task.status === 'done' ? { background: 'var(--bg-elevated)' } : {}}
                  >
                    {/* Subtask expand toggle */}
                    {subtasks.length > 0 ? (
                      <button
                        onClick={() => toggleExpand(task.id)}
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    ) : (
                      <span className="w-4 flex-shrink-0" />
                    )}

                    {task.status === 'done' ? (
                      <button
                        onClick={() => handleReopenTask(task.id)}
                        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 vc-bg-success vc-border-success"
                        title="Reopen task"
                      >
                        <RotateCcw className="w-3 h-3" style={{ color: 'var(--accent-secondary)' }} />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCompleteTask(task.id)}
                        className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 border-line-strong hover:border-primary-500"
                        title="Mark complete"
                      >
                        <CheckSquare className="w-3 h-3" style={{ opacity: 0 }} />
                      </button>
                    )}

                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => openTaskEdit(task)}
                        className={`font-medium text-left hover:underline ${task.status === 'done' ? 'line-through' : ''}`}
                        style={{
                          color: task.status === 'done' ? 'var(--text-tertiary)' : 'var(--text-primary)',
                          background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit'
                        }}
                      >
                        {task.title}
                      </button>
                      <div className="flex items-center gap-3 mt-1 text-xs flex-wrap" style={{ color: 'var(--text-tertiary)' }}>
                        {task.due_date && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(task.due_date).toLocaleDateString()}
                          </span>
                        )}
                        {task.assigned_to && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {task.assigned_to}
                          </span>
                        )}
                        {subtasks.length > 0 && (
                          <span style={{ color: 'var(--accent-secondary)' }}>
                            {subtasks.filter(s => s.status === 'done').length}/{subtasks.length} subtasks
                          </span>
                        )}
                        {/* Tags */}
                        {task.tags && task.tags.length > 0 && task.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(255,45,107,.08)', color: 'var(--accent-primary)', fontSize: 10 }}
                          >
                            <Tag className="w-2.5 h-2.5" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Status dropdown */}
                    <select
                      className="input"
                      value={task.status}
                      onChange={(e) => handleStatusChange(task.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: 'auto', fontSize: 11, padding: '4px 8px', minWidth: 100 }}
                    >
                      <option value="open">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="review">Review</option>
                      <option value="done">Done</option>
                      <option value="blocked">Blocked</option>
                    </select>

                    {getPriorityBadge(task.priority)}

                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-1.5 rounded transition-colors hover:bg-semantic-error-dim hover:text-semantic-error"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Subtasks (collapsible) */}
                  {isExpanded && subtasks.map(sub => (
                    <div
                      key={sub.id}
                      className="p-3 pl-14 flex items-center gap-3 border-t"
                      style={{ borderColor: 'var(--b0)', background: sub.status === 'done' ? 'var(--bg-elevated)' : 'var(--b0)' }}
                    >
                      {sub.status === 'done' ? (
                        <button
                          onClick={() => handleReopenTask(sub.id)}
                          className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 vc-bg-success"
                          title="Reopen"
                        >
                          <RotateCcw className="w-2.5 h-2.5" style={{ color: 'var(--accent-secondary)' }} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleCompleteTask(sub.id)}
                          className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 border-line-strong"
                          title="Complete"
                        />
                      )}
                      <button
                        onClick={() => openTaskEdit(sub)}
                        className={`flex-1 text-left text-sm hover:underline ${sub.status === 'done' ? 'line-through' : ''}`}
                        style={{
                          color: sub.status === 'done' ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                          background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit'
                        }}
                      >
                        {sub.title}
                      </button>
                      {getPriorityBadge(sub.priority)}
                      <button
                        onClick={() => handleDeleteTask(sub.id)}
                        className="p-1 rounded transition-colors hover:bg-semantic-error-dim hover:text-semantic-error"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Related Meetings */}
      {project.meetings?.length > 0 && (
        <div className="vc" style={{ background: 'var(--bg-elevated)' }}>
          <div
            className="p-4 border-b"
            style={{ borderColor: 'var(--b1)' }}
          >
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Related Meetings</h2>
          </div>
          <div>
            {project.meetings.map((meeting) => (
              <Link
                key={meeting.id}
                to={`/meetings/${meeting.id}`}
                className="block p-4 transition-colors"
                style={{ borderBottom: '1px solid var(--b1)' }}
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

      {/* Task Edit Modal */}
      {editingTask && createPortal(
        <div className="vc-confirm-overlay" onClick={() => setEditingTask(null)}>
          <div
            className="vc"
            style={{ maxWidth: 520, width: '90%', padding: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
                <Pencil className="w-4 h-4 inline-block mr-2" style={{ color: 'var(--accent-primary)' }} />
                Edit Task
              </h3>
              <button
                onClick={() => setEditingTask(null)}
                style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-4">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>Title</label>
                <VCInput
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>Description</label>
                <textarea
                  className="vinput"
                  rows={3}
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  placeholder="What needs to be done..."
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>Priority</label>
                  <VCSelect
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </VCSelect>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>Status</label>
                  <VCSelect
                    value={taskForm.status}
                    onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                  >
                    <option value="open">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="done">Done</option>
                    <option value="blocked">Blocked</option>
                  </VCSelect>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>Assignee</label>
                  <VCInput
                    value={taskForm.assigned_to}
                    onChange={(e) => setTaskForm({ ...taskForm, assigned_to: e.target.value })}
                    placeholder="Assigned to..."
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>Due Date</label>
                  <VCInput
                    type="date"
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>Tags</label>
                <VCInput
                  value={taskForm.tags}
                  onChange={(e) => setTaskForm({ ...taskForm, tags: e.target.value })}
                  placeholder="e.g., frontend, urgent, design (comma-separated)"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <VCButton type="button" variant="ghost" onClick={() => setEditingTask(null)}>
                  Cancel
                </VCButton>
                <VCButton type="submit" variant="primary" disabled={savingTask}>
                  <Save className="w-4 h-4" />
                  {savingTask ? 'Saving...' : 'Save Changes'}
                </VCButton>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
