import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Search, CheckSquare, Clock, AlertCircle, Trash2, Circle, CheckCircle2,
  LayoutList, Kanban, ChevronLeft, ChevronRight, Edit3, ArrowUpDown, ArrowUp, ArrowDown,
  X, CheckCheck
} from 'lucide-react'
import { tasksApi } from '../services/api'
import { PageHeader, Skeleton } from '../components/SharedUI'
import { VCButton, VCBadge } from '../components/vc'
import { useConfirm } from '../components/vc/ConfirmDialog'
import { useToast } from '../components/vc/ToastProvider'
import ErrorState from '../components/vc/ErrorState'
import KanbanBoard from '../components/KanbanBoard'
import TaskEditModal from '../components/TaskEditModal'

const PAGE_SIZE = 25

const STATUS_LABELS = {
  all: 'All',
  open: 'Open',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
  blocked: 'Blocked'
}

const SORT_OPTIONS = [
  { value: 'created_at', label: 'Created' },
  { value: 'due_date', label: 'Due Date' },
  { value: 'priority', label: 'Priority' },
  { value: 'status', label: 'Status' },
  { value: 'title', label: 'Title' }
]

export default function Tasks() {
  const confirm = useConfirm()
  const toast = useToast()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium', dueDate: '', tags: '' })
  const [creating, setCreating] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  const [viewMode, setViewMode] = useState('list')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [editingTask, setEditingTask] = useState(null)
  const [sortBy, setSortBy] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkAction, setBulkAction] = useState(false)
  const searchTimerRef = useRef(null)

  // Debounce search input
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setPage(0)
    }, 300)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [searchQuery])

  useEffect(() => {
    if (viewMode === 'list') loadTasks()
  }, [statusFilter, debouncedSearch, page, viewMode, sortBy, sortDir])

  const loadTasks = async () => {
    try {
      setError(null)
      setLoading(true)
      const params = { limit: PAGE_SIZE, offset: page * PAGE_SIZE, sortBy, sortDir }
      if (statusFilter !== 'all') params.status = statusFilter
      if (debouncedSearch) params.search = debouncedSearch
      const data = await tasksApi.list(params)
      setTasks(data.tasks || [])
      setHasMore(data.hasMore || false)
      setTotalCount(data.count || 0)
      setSelectedIds(new Set())
    } catch (err) {
      console.error('Failed to load tasks:', err)
      setError(err.message || 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }

  // Collect all unique tags from loaded tasks for filtering
  const allTags = useMemo(() => {
    const tagSet = new Set()
    tasks.forEach(t => (t.tags || []).forEach(tag => tagSet.add(tag)))
    return [...tagSet].sort()
  }, [tasks])

  // Filter by tag (client-side, on loaded page)
  const displayedTasks = tagFilter
    ? tasks.filter(t => (t.tags || []).includes(tagFilter))
    : tasks

  const validate = () => {
    const errs = {}
    if (!newTask.title?.trim()) errs.title = 'Title is required'
    if (newTask.dueDate && isNaN(new Date(newTask.dueDate).getTime())) errs.dueDate = 'Invalid date format'
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!validate()) return

    try {
      setCreating(true)
      const payload = {
        title: newTask.title,
        priority: newTask.priority,
        dueDate: newTask.dueDate || undefined,
        description: newTask.description || undefined,
        tags: newTask.tags ? newTask.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined
      }
      await tasksApi.create(payload)
      setNewTask({ title: '', description: '', priority: 'medium', dueDate: '', tags: '' })
      setShowCreate(false)
      loadTasks()
      toast.success('Created', 'Task created successfully')
    } catch (error) {
      console.error('Failed to create task:', error)
      toast.error('Error', error.message || 'Failed to create task')
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
      toast.error('Error', 'Failed to complete task')
    }
  }

  const handleReopen = async (id) => {
    try {
      await tasksApi.reopen(id)
      loadTasks()
    } catch (error) {
      console.error('Failed to reopen task:', error)
      toast.error('Error', 'Failed to reopen task')
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm({ title: 'Delete Task', message: 'Delete this task?', confirmLabel: 'Delete', variant: 'danger' })
    if (!ok) return

    try {
      await tasksApi.delete(id)
      setTasks(tasks.filter(t => t.id !== id))
      toast.success('Deleted', 'Task deleted')
    } catch (error) {
      console.error('Failed to delete task:', error)
      toast.error('Error', 'Failed to delete task')
    }
  }

  // Bulk operations
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === displayedTasks.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(displayedTasks.map(t => t.id)))
    }
  }

  const handleBulkStatus = async (status) => {
    if (selectedIds.size === 0) return
    const ok = await confirm({
      title: 'Bulk Update',
      message: `Mark ${selectedIds.size} task(s) as "${status}"?`,
      confirmLabel: 'Update',
      variant: 'primary'
    })
    if (!ok) return

    try {
      await tasksApi.bulkUpdateStatus([...selectedIds], status)
      toast.success('Updated', `${selectedIds.size} task(s) updated to ${status}`)
      setSelectedIds(new Set())
      loadTasks()
    } catch (error) {
      console.error('Bulk status update failed:', error)
      toast.error('Error', 'Bulk update failed')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    const ok = await confirm({
      title: 'Delete Tasks',
      message: `Delete ${selectedIds.size} task(s)? This cannot be undone.`,
      confirmLabel: 'Delete All',
      variant: 'danger'
    })
    if (!ok) return

    try {
      let deleted = 0
      for (const id of selectedIds) {
        await tasksApi.delete(id)
        deleted++
      }
      toast.success('Deleted', `${deleted} task(s) deleted`)
      setSelectedIds(new Set())
      loadTasks()
    } catch (error) {
      console.error('Bulk delete failed:', error)
      toast.error('Error', 'Some tasks could not be deleted')
      loadTasks()
    }
  }

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir(field === 'title' ? 'asc' : 'desc')
    }
    setPage(0)
  }

  const isOverdue = (dueDate) => {
    if (!dueDate) return false
    return new Date(dueDate) < new Date()
  }

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'high':   return <VCBadge color="crimson">{priority}</VCBadge>
      case 'medium': return <VCBadge color="amber">{priority}</VCBadge>
      case 'low':    return <VCBadge color="mint">{priority}</VCBadge>
      default:       return <VCBadge color="neutral">{priority}</VCBadge>
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'done':        return <VCBadge color="mint">Done</VCBadge>
      case 'in_progress': return <VCBadge color="amber">In Progress</VCBadge>
      case 'review':      return <VCBadge color="phosphor">Review</VCBadge>
      case 'blocked':     return <VCBadge color="crimson">Blocked</VCBadge>
      case 'open':        return <VCBadge color="neutral">Open</VCBadge>
      default:            return <VCBadge color="neutral">{status}</VCBadge>
    }
  }

  const SortIcon = ({ field }) => {
    if (sortBy !== field) return <ArrowUpDown size={12} style={{ opacity: 0.3 }} />
    return sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
  }

  if (error) return (
    <div className="animate-fade-in max-w-7xl mx-auto">
      <ErrorState message={error} onRetry={loadTasks} />
    </div>
  )

  return (
    <div className="animate-fade-in max-w-7xl mx-auto">
      <PageHeader
        title="Task Management"
        subtitle="Create, prioritize, and track all your tasks in one place."
        actions={
          <VCButton
            variant="primary"
            onClick={() => {
              setShowCreate(!showCreate)
              setFormErrors({})
            }}
          >
            <Plus size={16} />
            New Task
          </VCButton>
        }
      />

      {/* Create form */}
      {showCreate && (
        <div className="vc p-6 mb-6 animate-fade-in">
          <h3
            className="font-bold text-lg mb-4"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
          >
            Create New Task
          </h3>
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
              {formErrors.title && <span style={{ color: 'var(--c)', fontSize: 12, marginTop: 2, display: 'block' }}>{formErrors.title}</span>}
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                className="input"
                placeholder="Add details about this task..."
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                rows={3}
                style={{ resize: 'vertical', minHeight: 60 }}
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
                {formErrors.dueDate && <span style={{ color: 'var(--c)', fontSize: 12, marginTop: 2, display: 'block' }}>{formErrors.dueDate}</span>}
              </div>
            </div>
            <div>
              <label className="label">Tags</label>
              <input
                type="text"
                className="input"
                placeholder="Comma-separated tags (e.g. urgent, design, backend)"
                value={newTask.tags}
                onChange={(e) => setNewTask({ ...newTask, tags: e.target.value })}
              />
            </div>

            <div className="flex gap-3">
              <VCButton type="submit" variant="primary" disabled={creating}>
                {creating ? 'Creating...' : 'Create Task'}
              </VCButton>
              <VCButton
                type="button"
                variant="secondary"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </VCButton>
            </div>
          </form>
        </div>
      )}

      {/* Filters + View Toggle */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--text-tertiary)' }}
          />
          <input
            type="text"
            placeholder="Search tasks..."
            className="input pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 items-center">
          {/* Sort dropdown */}
          {viewMode === 'list' && (
            <select
              className="input"
              value={sortBy}
              onChange={(e) => handleSort(e.target.value)}
              style={{ fontSize: 13, padding: '6px 10px', width: 'auto', minWidth: 120 }}
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  Sort: {opt.label} {sortBy === opt.value ? (sortDir === 'asc' ? '\u2191' : '\u2193') : ''}
                </option>
              ))}
            </select>
          )}

          <div className="flex border rounded-lg overflow-hidden" style={{ borderColor: 'var(--b1)' }}>
            <button
              onClick={() => setViewMode('list')}
              className="p-2 transition-colors"
              style={{
                background: viewMode === 'list' ? 'var(--accent-primary)' : 'transparent',
                color: viewMode === 'list' ? '#fff' : 'var(--text-tertiary)'
              }}
              title="List view"
            >
              <LayoutList size={16} />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className="p-2 transition-colors"
              style={{
                background: viewMode === 'kanban' ? 'var(--accent-primary)' : 'transparent',
                color: viewMode === 'kanban' ? '#fff' : 'var(--text-tertiary)'
              }}
              title="Board view"
            >
              <Kanban size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Status filters (list view only) */}
      {viewMode === 'list' && (
        <div className="flex gap-2 flex-wrap mb-4">
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <VCButton
              key={value}
              onClick={() => { setStatusFilter(value); setPage(0) }}
              variant={statusFilter === value ? 'primary' : 'ghost'}
              size="sm"
            >
              {label}
            </VCButton>
          ))}
        </div>
      )}

      {/* Tag filter chips */}
      {viewMode === 'list' && allTags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-4 items-center">
          <span className="text-xs mr-1" style={{ color: 'var(--text-tertiary)' }}>Tags:</span>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
              className="px-2 py-0.5 rounded-full text-xs transition-colors"
              style={{
                background: tagFilter === tag ? 'var(--accent-primary)' : 'var(--b1)',
                color: tagFilter === tag ? '#fff' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: tagFilter === tag ? 'var(--accent-primary)' : 'var(--b1)'
              }}
            >
              {tag}
            </button>
          ))}
          {tagFilter && (
            <button
              onClick={() => setTagFilter(null)}
              className="text-xs flex items-center gap-1 px-1.5 py-0.5"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div
          className="flex items-center gap-3 p-3 rounded-lg mb-4 animate-fade-in"
          style={{ background: 'rgba(255,45,107,.08)', border: '1px solid rgba(255,45,107,.2)' }}
        >
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {selectedIds.size} selected
          </span>
          <div className="flex gap-2 ml-auto">
            <VCButton size="sm" variant="ghost" onClick={() => handleBulkStatus('done')}>
              <CheckCheck size={14} /> Mark Done
            </VCButton>
            <VCButton size="sm" variant="ghost" onClick={() => handleBulkStatus('in_progress')}>
              In Progress
            </VCButton>
            <VCButton size="sm" variant="ghost" onClick={() => handleBulkStatus('blocked')}>
              Blocked
            </VCButton>
            <VCButton size="sm" variant="danger" onClick={handleBulkDelete}>
              <Trash2 size={14} /> Delete
            </VCButton>
            <VCButton size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              <X size={14} /> Cancel
            </VCButton>
          </div>
        </div>
      )}

      {/* Kanban View */}
      {viewMode === 'kanban' ? (
        <KanbanBoard onTaskUpdate={loadTasks} />
      ) : (
        <>
          {/* Tasks list */}
          <div className="vc">
            {loading ? (
              <Skeleton className="h-16" count={8} />
            ) : displayedTasks.length === 0 ? (
              <div
                className="p-12 text-center border-dashed border-2 m-4 rounded-lg"
                style={{ borderColor: 'var(--b1)' }}
              >
                <CheckSquare className="w-16 h-16 mx-auto mb-4 opacity-50" style={{ color: 'var(--text-tertiary)' }} />
                <h3
                  className="text-xl font-bold mb-2"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                >
                  No tasks found
                </h3>
                <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
                  {debouncedSearch || statusFilter !== 'all' || tagFilter
                    ? 'Try adjusting your filters'
                    : 'Create your first task to get started'
                  }
                </p>
                <VCButton
                  variant="primary"
                  onClick={() => setShowCreate(true)}
                >
                  <Plus size={16} />
                  Create Task
                </VCButton>
              </div>
            ) : (
              <>
                {/* Column header with select-all */}
                <div
                  className="px-4 py-2 flex items-center gap-4 text-xs border-b"
                  style={{ color: 'var(--text-tertiary)', borderColor: 'var(--b1)', fontFamily: 'var(--font-mono)' }}
                >
                  <button
                    onClick={toggleSelectAll}
                    className="w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{
                      borderColor: selectedIds.size > 0 ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                      background: selectedIds.size === displayedTasks.length && displayedTasks.length > 0 ? 'var(--accent-primary)' : 'transparent',
                      color: selectedIds.size === displayedTasks.length && displayedTasks.length > 0 ? '#fff' : 'var(--text-tertiary)'
                    }}
                    title="Select all"
                  >
                    {selectedIds.size === displayedTasks.length && displayedTasks.length > 0 && <CheckCircle2 size={12} />}
                  </button>
                  <span className="w-6" /> {/* spacer for complete button */}
                  <button onClick={() => handleSort('title')} className="flex items-center gap-1 flex-1 hover:opacity-80">
                    Task <SortIcon field="title" />
                  </button>
                  <button onClick={() => handleSort('priority')} className="flex items-center gap-1 hover:opacity-80" style={{ width: 80 }}>
                    Priority <SortIcon field="priority" />
                  </button>
                  <button onClick={() => handleSort('status')} className="flex items-center gap-1 hover:opacity-80" style={{ width: 90 }}>
                    Status <SortIcon field="status" />
                  </button>
                  <span style={{ width: 64 }} />
                </div>

                <div className="divide-y" style={{ borderColor: 'var(--b1)' }}>
                  {displayedTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`p-4 flex items-center gap-4 transition-colors group ${
                        task.status === 'done' ? 'opacity-60' : ''
                      } ${selectedIds.has(task.id) ? '' : ''}`}
                      style={selectedIds.has(task.id) ? { background: 'rgba(255,45,107,.04)' } : {}}
                      onMouseEnter={e => { if (!selectedIds.has(task.id)) e.currentTarget.style.background = 'var(--bg-elevated)' }}
                      onMouseLeave={e => { if (!selectedIds.has(task.id)) e.currentTarget.style.background = '' }}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleSelect(task.id)}
                        className="w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors"
                        style={{
                          borderColor: selectedIds.has(task.id) ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                          background: selectedIds.has(task.id) ? 'var(--accent-primary)' : 'transparent',
                          color: '#fff'
                        }}
                      >
                        {selectedIds.has(task.id) && <CheckCircle2 size={12} />}
                      </button>

                      {/* Complete toggle */}
                      <button
                        onClick={() => task.status === 'done' ? handleReopen(task.id) : handleComplete(task.id)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          task.status === 'done' ? 'text-white' : ''
                        }`}
                        style={task.status === 'done'
                          ? { background: 'var(--m)', borderColor: 'var(--m)' }
                          : { borderColor: 'var(--text-tertiary)' }
                        }
                        aria-label={task.status === 'done' ? 'Reopen task' : 'Complete task'}
                      >
                        {task.status === 'done' ? (
                          <CheckCircle2 size={16} />
                        ) : (
                          <Circle size={16} className="opacity-0 group-hover:opacity-100" />
                        )}
                      </button>

                      {/* Task content */}
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => setEditingTask(task)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <p
                            className={`font-medium ${task.status === 'done' ? 'line-through' : ''}`}
                            style={{ color: task.status === 'done' ? 'var(--text-tertiary)' : 'var(--text-primary)' }}
                          >
                            {task.title}
                          </p>
                          {task.due_date && isOverdue(task.due_date) && task.status !== 'done' && (
                            <AlertCircle size={16} style={{ color: 'var(--accent-primary)' }} />
                          )}
                        </div>
                        <div
                          className="flex items-center gap-3 text-xs"
                          style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
                        >
                          {task.due_date && (
                            <span
                              className="flex items-center gap-1"
                              style={isOverdue(task.due_date) && task.status !== 'done'
                                ? { color: 'var(--accent-primary)' }
                                : {}
                              }
                            >
                              <Clock size={12} />
                              {new Date(task.due_date).toLocaleDateString()}
                            </span>
                          )}
                          {task.tags && task.tags.length > 0 && (
                            <span className="flex items-center gap-1">
                              {task.tags.slice(0, 3).map((tag, i) => (
                                <span
                                  key={i}
                                  className="px-1.5 py-0.5 rounded text-xs cursor-pointer"
                                  style={{
                                    background: tagFilter === tag ? 'var(--accent-primary)' : 'var(--b1)',
                                    color: tagFilter === tag ? '#fff' : 'var(--text-secondary)'
                                  }}
                                  onClick={(e) => { e.stopPropagation(); setTagFilter(tagFilter === tag ? null : tag) }}
                                >
                                  {tag}
                                </span>
                              ))}
                              {task.tags.length > 3 && (
                                <span style={{ color: 'var(--text-tertiary)' }}>+{task.tags.length - 3}</span>
                              )}
                            </span>
                          )}
                          {task.project_id && (
                            <Link
                              to={`/projects/${task.project_id}`}
                              style={{ color: 'var(--accent-primary)' }}
                              className="hover:underline"
                              onClick={e => e.stopPropagation()}
                            >
                              View Project
                            </Link>
                          )}
                        </div>
                      </div>

                      {getPriorityBadge(task.priority)}
                      {getStatusBadge(task.status)}

                      <button
                        onClick={() => setEditingTask(task)}
                        className="p-2 opacity-0 group-hover:opacity-100 transition-all rounded"
                        style={{ color: 'var(--text-tertiary)' }}
                        title="Edit task"
                        aria-label="Edit task"
                      >
                        <Edit3 size={16} />
                      </button>

                      <VCButton
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(task.id)}
                        className="p-2 opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete task"
                        aria-label="Delete task"
                      >
                        <Trash2 size={16} />
                      </VCButton>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Pagination */}
          {!loading && tasks.length > 0 && (
            <div className="flex items-center justify-between mt-4 px-2">
              <span className="text-sm" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                {totalCount > 0 ? `${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, totalCount)} of ${totalCount}` : ''}
              </span>
              <div className="flex gap-2">
                <VCButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft size={16} />
                  Prev
                </VCButton>
                <VCButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={!hasMore}
                >
                  Next
                  <ChevronRight size={16} />
                </VCButton>
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit Modal */}
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSaved={() => {
            setEditingTask(null)
            loadTasks()
          }}
        />
      )}
    </div>
  )
}
