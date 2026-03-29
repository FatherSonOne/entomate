import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  GripVertical, Clock, User, AlertTriangle, CheckCircle2,
  Circle, ArrowRight, Plus, MoreHorizontal
} from 'lucide-react'
import { dashboardApi, tasksApi } from '../services/api'
import { VCBadge } from './vc'

// VC Design System color mapping per column status
const COLUMN_VC_COLOR = {
  open:        'var(--text-tertiary)',
  in_progress: 'var(--accent-tertiary, #FFB800)',
  review:      'var(--accent-secondary, #00F5D4)',
  done:        'var(--accent-primary, #FF2D6B)',
}

const COLUMN_COUNT_BADGE_COLOR = {
  open:        'rgba(248,240,242,.08)',
  in_progress: 'rgba(255,184,0,.12)',
  review:      'rgba(0,245,212,.12)',
  done:        'rgba(255,45,107,.12)',
}

const COLUMN_COUNT_TEXT_COLOR = {
  open:        'var(--text-tertiary)',
  in_progress: 'var(--accent-tertiary, #FFB800)',
  review:      'var(--accent-secondary, #00F5D4)',
  done:        'var(--accent-primary, #FF2D6B)',
}

const COLUMNS = [
  { id: 'open', title: 'To Do', icon: Circle },
  { id: 'in_progress', title: 'In Progress', icon: ArrowRight },
  { id: 'done', title: 'Done', icon: CheckCircle2 }
]

export default function KanbanBoard({ projectId, onTaskUpdate }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [draggedTask, setDraggedTask] = useState(null)
  const [dragOverColumn, setDragOverColumn] = useState(null)

  useEffect(() => {
    loadTasks()
  }, [projectId])

  const loadTasks = async () => {
    try {
      setLoading(true)
      const params = projectId ? { project_id: projectId } : {}
      const data = await tasksApi.list(params)
      setTasks(data.tasks || [])
    } catch (error) {
      console.error('Failed to load tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDragStart = (e, task) => {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', task.id)
    // Add dragging class after a brief delay for visual feedback
    setTimeout(() => {
      e.target.classList.add('opacity-50')
    }, 0)
  }

  const handleDragEnd = (e) => {
    e.target.classList.remove('opacity-50')
    setDraggedTask(null)
    setDragOverColumn(null)
  }

  const handleDragOver = (e, columnId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(columnId)
  }

  const handleDragLeave = () => {
    setDragOverColumn(null)
  }

  const handleDrop = async (e, newStatus) => {
    e.preventDefault()
    setDragOverColumn(null)

    if (!draggedTask || draggedTask.status === newStatus) return

    const taskId = draggedTask.id
    const oldStatus = draggedTask.status

    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: newStatus } : t
    ))

    try {
      await tasksApi.update(taskId, { status: newStatus })
      if (onTaskUpdate) onTaskUpdate()
    } catch (error) {
      console.error('Failed to update task:', error)
      // Revert on error
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, status: oldStatus } : t
      ))
    }
  }

  const getTasksByStatus = (status) => {
    return tasks.filter(t => t.status === status)
  }

  const getPriorityVCColor = (priority) => {
    switch (priority) {
      case 'high':   return 'crimson'
      case 'medium': return 'amber'
      case 'low':    return 'neutral'
      default:       return 'neutral'
    }
  }

  const isOverdue = (dueDate) => {
    if (!dueDate) return false
    return new Date(dueDate) < new Date()
  }

  if (loading) {
    return (
      <div className="kanban">
        {COLUMNS.map(col => (
          <div
            key={col.id}
            className="kanban-col bg-surface-muted rounded-lg p-4"
          >
            <div className="animate-pulse">
              <div className="h-6 bg-surface-muted rounded w-24 mb-4"></div>
              <div className="space-y-3">
                <div className="h-24 bg-surface-muted rounded"></div>
                <div className="h-24 bg-surface-muted rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="kanban">
      {COLUMNS.map(column => {
        const Icon = column.icon
        const columnTasks = getTasksByStatus(column.id)
        const isOver = dragOverColumn === column.id
        const headerColor = COLUMN_VC_COLOR[column.id] || 'var(--text-tertiary)'
        const countBg     = COLUMN_COUNT_BADGE_COLOR[column.id] || 'rgba(248,240,242,.08)'
        const countColor  = COLUMN_COUNT_TEXT_COLOR[column.id]  || 'var(--text-tertiary)'

        return (
          <div
            key={column.id}
            className={`kanban-col bg-surface-muted rounded-lg transition-colors ${
              isOver ? 'bg-semantic-info-dim ring-2' : ''
            }`}
            style={{
              outline: isOver ? `2px solid ${headerColor}` : 'none',
            }}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column Header */}
            <div className="kanban-header">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon
                    className="w-4 h-4"
                    style={{ color: headerColor }}
                  />
                  <h3
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '.08em',
                      color: headerColor,
                      margin: 0,
                    }}
                  >
                    {column.title}
                  </h3>
                  <span
                    className="kanban-count"
                    style={{
                      background: countBg,
                      color: countColor,
                    }}
                  >
                    {columnTasks.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Tasks */}
            <div className="p-2 min-h-[300px] space-y-2">
              {columnTasks.length === 0 ? (
                <div
                  className="text-center py-8 text-sm"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {isOver ? 'Drop here' : 'No tasks'}
                </div>
              ) : (
                columnTasks.map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    onDragEnd={handleDragEnd}
                    className={`vc kcard cursor-grab active:cursor-grabbing ${
                      draggedTask?.id === task.id ? 'ring-2' : ''
                    }`}
                    style={
                      draggedTask?.id === task.id
                        ? { outline: `2px solid var(--accent-primary, #FF2D6B)` }
                        : undefined
                    }
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical
                        className="w-4 h-4 mt-0.5 flex-shrink-0"
                        style={{ color: 'var(--text-muted)' }}
                      />
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/tasks/${task.id}`}
                          className="kcard-title line-clamp-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {task.title}
                        </Link>

                        {task.description && (
                          <p className="kcard-meta line-clamp-2 mt-1">
                            {task.description}
                          </p>
                        )}

                        <div className="kcard-meta flex items-center gap-2 mt-2 flex-wrap">
                          {/* Priority badge — VCBadge with VC color mapping */}
                          {task.priority && (
                            <VCBadge color={getPriorityVCColor(task.priority)}>
                              {task.priority}
                            </VCBadge>
                          )}

                          {/* Due date */}
                          {task.due_date && (
                            <span
                              className="flex items-center gap-1"
                              style={{
                                fontSize: 11,
                                fontWeight: isOverdue(task.due_date) && task.status !== 'done' ? 600 : 400,
                                color: isOverdue(task.due_date) && task.status !== 'done'
                                  ? 'var(--accent-primary, #FF2D6B)'
                                  : 'var(--text-tertiary)',
                              }}
                            >
                              {isOverdue(task.due_date) && task.status !== 'done' && (
                                <AlertTriangle className="w-3 h-3" />
                              )}
                              <Clock className="w-3 h-3" />
                              {new Date(task.due_date).toLocaleDateString()}
                            </span>
                          )}

                          {/* Assignee */}
                          {task.assigned_to && (
                            <span
                              className="flex items-center gap-1"
                              style={{ fontSize: 11, color: 'var(--text-tertiary)' }}
                            >
                              <User className="w-3 h-3" />
                              {task.assigned_to}
                            </span>
                          )}
                        </div>

                        {/* Meeting link */}
                        {task.meeting_id && (
                          <div className="kcard-footer">
                            <Link
                              to={`/meetings/${task.meeting_id}`}
                              style={{
                                fontSize: 11,
                                color: 'var(--accent-secondary, #00F5D4)',
                                textDecoration: 'none',
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              From meeting
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
