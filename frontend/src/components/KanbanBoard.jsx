import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  GripVertical, Clock, User, AlertTriangle, CheckCircle2,
  Circle, ArrowRight, Plus, MoreHorizontal
} from 'lucide-react'
import { dashboardApi, tasksApi } from '../services/api'

const COLUMNS = [
  { id: 'open', title: 'To Do', color: 'gray', icon: Circle },
  { id: 'in_progress', title: 'In Progress', color: 'blue', icon: ArrowRight },
  { id: 'done', title: 'Done', color: 'green', icon: CheckCircle2 }
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

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50'
      case 'medium': return 'text-amber-600 bg-amber-50'
      case 'low': return 'text-green-600 bg-green-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const isOverdue = (dueDate) => {
    if (!dueDate) return false
    return new Date(dueDate) < new Date()
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map(col => (
          <div key={col.id} className="bg-gray-50 rounded-lg p-4">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-24 mb-4"></div>
              <div className="space-y-3">
                <div className="h-24 bg-gray-200 rounded"></div>
                <div className="h-24 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {COLUMNS.map(column => {
        const Icon = column.icon
        const columnTasks = getTasksByStatus(column.id)
        const isOver = dragOverColumn === column.id

        return (
          <div
            key={column.id}
            className={`bg-gray-50 rounded-lg transition-colors ${
              isOver ? 'bg-blue-50 ring-2 ring-blue-300' : ''
            }`}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 text-${column.color}-500`} />
                  <h3 className="font-semibold text-gray-900">{column.title}</h3>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full bg-${column.color}-100 text-${column.color}-700`}>
                    {columnTasks.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Tasks */}
            <div className="p-2 min-h-[300px] space-y-2">
              {columnTasks.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  {isOver ? 'Drop here' : 'No tasks'}
                </div>
              ) : (
                columnTasks.map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    onDragEnd={handleDragEnd}
                    className={`bg-white rounded-lg border border-gray-200 p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
                      draggedTask?.id === task.id ? 'ring-2 ring-primary-500' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/tasks/${task.id}`}
                          className="font-medium text-gray-900 hover:text-primary-600 line-clamp-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {task.title}
                        </Link>

                        {task.description && (
                          <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {/* Priority badge */}
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>

                          {/* Due date */}
                          {task.due_date && (
                            <span className={`flex items-center gap-1 text-xs ${
                              isOverdue(task.due_date) && task.status !== 'done'
                                ? 'text-red-600 font-medium'
                                : 'text-gray-400'
                            }`}>
                              {isOverdue(task.due_date) && task.status !== 'done' && (
                                <AlertTriangle className="w-3 h-3" />
                              )}
                              <Clock className="w-3 h-3" />
                              {new Date(task.due_date).toLocaleDateString()}
                            </span>
                          )}

                          {/* Assignee */}
                          {task.assigned_to && (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <User className="w-3 h-3" />
                              {task.assigned_to}
                            </span>
                          )}
                        </div>

                        {/* Meeting link */}
                        {task.meeting_id && (
                          <Link
                            to={`/meetings/${task.meeting_id}`}
                            className="text-xs text-primary-500 hover:text-primary-600 mt-2 inline-block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            From meeting
                          </Link>
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
