import React, { useState, useEffect } from 'react'
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  getTasksByProject,
  createProjectTask,
  updateProjectTask,
  deleteProjectTask,
  updateTaskStatus,
  getProjectStats
} from '../services/projectService'
import { LinkedRecordsPanel } from './LinkedRecordsPanel'
import { TaskEtaBadge } from './PredictionBadge'
import { useTaskEta } from '../hooks/usePredictions'
import type { EntoamateProject, EntoamateProjectTask } from '../lib/supabase'

// ==================== TYPES ====================

interface ProjectStats {
  total: number
  todo: number
  inProgress: number
  done: number
  progress: number
}

interface TaskRowProps {
  task: EntoamateProjectTask
  onStatusChange: (taskId: string, status: 'todo' | 'in_progress' | 'done') => void
  onEdit: (task: EntoamateProjectTask) => void
  onDelete: (taskId: string) => void
  getTaskStatusColor: (status: string) => string
  getPriorityColor: (priority: string) => string
}

/**
 * Individual task row with ETA prediction
 */
const TaskRow: React.FC<TaskRowProps> = ({
  task,
  onStatusChange,
  onEdit,
  onDelete,
  getTaskStatusColor,
  getPriorityColor
}) => {
  // Only fetch ETA for non-completed tasks
  const showEta = task.status !== 'done'
  const { prediction, loading } = useTaskEta(showEta ? task.id : null)

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg group">
      <select
        value={task.status}
        onChange={(e) => onStatusChange(task.id, e.target.value as any)}
        className={`px-2 py-1 rounded text-xs font-bold ${getTaskStatusColor(task.status)}`}
      >
        <option value="todo">To Do</option>
        <option value="in_progress">In Progress</option>
        <option value="done">Done</option>
      </select>

      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className={`font-medium ${task.status === 'done' ? 'line-through text-gray-400' : ''}`}>
            {task.title}
          </p>
          {showEta && (
            <TaskEtaBadge prediction={prediction} loading={loading} compact />
          )}
        </div>
        <div className="flex gap-3 text-xs text-gray-500 mt-1">
          {task.assigned_to && <span>→ {task.assigned_to}</span>}
          {task.due_date && <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>}
          <span className={`px-2 py-0.5 rounded ${getPriorityColor(task.priority)}`}>
            {task.priority}
          </span>
        </div>
      </div>

      <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
        <button
          onClick={() => onEdit(task)}
          className="p-1 text-gray-400 hover:text-gray-600"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button
          onClick={() => onDelete(task.id)}
          className="p-1 text-gray-400 hover:text-red-500"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    </div>
  )
}

// ==================== COMPONENT ====================

export const ProjectsView: React.FC = () => {
  // Projects state
  const [projects, setProjects] = useState<EntoamateProject[]>([])
  const [selectedProject, setSelectedProject] = useState<EntoamateProject | null>(null)
  const [projectStats, setProjectStats] = useState<Map<string, ProjectStats>>(new Map())

  // Tasks state
  const [tasks, setTasks] = useState<EntoamateProjectTask[]>([])

  // UI state
  const [viewMode, setViewMode] = useState<'list' | 'detail' | 'create'>('list')
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'on_hold'>('all')
  const [loading, setLoading] = useState(false)

  // Form state
  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    status: 'active' as 'active' | 'completed' | 'on_hold',
    start_date: '',
    end_date: ''
  })

  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    assigned_to: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    due_date: ''
  })

  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<EntoamateProjectTask | null>(null)

  // ==================== EFFECTS ====================

  useEffect(() => {
    loadProjects()
  }, [filter])

  useEffect(() => {
    if (selectedProject) {
      loadTasks(selectedProject.id)
    }
  }, [selectedProject])

  // ==================== DATA LOADING ====================

  const loadProjects = async () => {
    setLoading(true)
    const status = filter === 'all' ? undefined : filter
    const data = await getProjects(status)
    setProjects(data)

    // Load stats for each project
    const statsMap = new Map<string, ProjectStats>()
    for (const project of data) {
      const stats = await getProjectStats(project.id)
      statsMap.set(project.id, stats)
    }
    setProjectStats(statsMap)
    setLoading(false)
  }

  const loadTasks = async (projectId: string) => {
    const data = await getTasksByProject(projectId)
    setTasks(data)
  }

  // ==================== PROJECT ACTIONS ====================

  const handleCreateProject = async () => {
    if (!projectForm.name.trim()) return

    const newProject = await createProject({
      name: projectForm.name,
      description: projectForm.description,
      status: projectForm.status,
      start_date: projectForm.start_date || undefined,
      end_date: projectForm.end_date || undefined
    })

    if (newProject) {
      setProjects([newProject, ...projects])
      setProjectForm({ name: '', description: '', status: 'active', start_date: '', end_date: '' })
      setViewMode('list')
    }
  }

  const handleUpdateProjectStatus = async (projectId: string, status: 'active' | 'completed' | 'on_hold') => {
    const updated = await updateProject(projectId, { status })
    if (updated) {
      setProjects(projects.map(p => p.id === projectId ? updated : p))
      if (selectedProject?.id === projectId) {
        setSelectedProject(updated)
      }
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Delete this project and all its tasks?')) return

    const success = await deleteProject(projectId)
    if (success) {
      setProjects(projects.filter(p => p.id !== projectId))
      if (selectedProject?.id === projectId) {
        setSelectedProject(null)
        setViewMode('list')
      }
    }
  }

  // ==================== TASK ACTIONS ====================

  const handleCreateTask = async () => {
    if (!taskForm.title.trim() || !selectedProject) return

    const newTask = await createProjectTask({
      project_id: selectedProject.id,
      title: taskForm.title,
      description: taskForm.description,
      assigned_to: taskForm.assigned_to || undefined,
      priority: taskForm.priority,
      due_date: taskForm.due_date || undefined
    })

    if (newTask) {
      setTasks([...tasks, newTask])
      setTaskForm({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '' })
      setShowTaskForm(false)

      // Update stats
      const stats = await getProjectStats(selectedProject.id)
      setProjectStats(new Map(projectStats).set(selectedProject.id, stats))
    }
  }

  const handleUpdateTask = async () => {
    if (!editingTask || !taskForm.title.trim()) return

    const updated = await updateProjectTask(editingTask.id, {
      title: taskForm.title,
      description: taskForm.description,
      assigned_to: taskForm.assigned_to || undefined,
      priority: taskForm.priority,
      due_date: taskForm.due_date || undefined
    })

    if (updated) {
      setTasks(tasks.map(t => t.id === editingTask.id ? updated : t))
      setTaskForm({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '' })
      setEditingTask(null)
      setShowTaskForm(false)
    }
  }

  const handleTaskStatusChange = async (taskId: string, status: 'todo' | 'in_progress' | 'done') => {
    const success = await updateTaskStatus(taskId, status)
    if (success) {
      setTasks(tasks.map(t => t.id === taskId ? { ...t, status } : t))

      // Update stats
      if (selectedProject) {
        const stats = await getProjectStats(selectedProject.id)
        setProjectStats(new Map(projectStats).set(selectedProject.id, stats))
      }
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    const success = await deleteProjectTask(taskId)
    if (success) {
      setTasks(tasks.filter(t => t.id !== taskId))

      // Update stats
      if (selectedProject) {
        const stats = await getProjectStats(selectedProject.id)
        setProjectStats(new Map(projectStats).set(selectedProject.id, stats))
      }
    }
  }

  const startEditTask = (task: EntoamateProjectTask) => {
    setEditingTask(task)
    setTaskForm({
      title: task.title,
      description: task.description || '',
      assigned_to: task.assigned_to || '',
      priority: task.priority,
      due_date: task.due_date || ''
    })
    setShowTaskForm(true)
  }

  // ==================== RENDER HELPERS ====================

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700'
      case 'completed': return 'bg-blue-100 text-blue-700'
      case 'on_hold': return 'bg-yellow-100 text-yellow-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-600'
      case 'medium': return 'bg-yellow-100 text-yellow-600'
      case 'low': return 'bg-gray-100 text-gray-600'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'todo': return 'bg-gray-100 text-gray-600'
      case 'in_progress': return 'bg-blue-100 text-blue-600'
      case 'done': return 'bg-green-100 text-green-600'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  // ==================== RENDER ====================

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          {viewMode !== 'list' && (
            <button
              onClick={() => { setViewMode('list'); setSelectedProject(null) }}
              className="px-3 py-2 text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
              Back
            </button>
          )}
          <h2 className="text-2xl font-bold">
            {viewMode === 'create' ? 'New Project' :
             viewMode === 'detail' ? selectedProject?.name : 'Projects'}
          </h2>
        </div>

        {viewMode === 'list' && (
          <div className="flex gap-3">
            {/* Filter */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="all">All Projects</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
            </select>

            <button
              onClick={() => setViewMode('create')}
              className="px-4 py-2 bg-[#2563EB] text-white rounded-full font-bold flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              New Project
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : projects.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-400">
              <p>No projects found</p>
              <button
                onClick={() => setViewMode('create')}
                className="mt-4 text-[#2563EB] font-bold"
              >
                Create your first project
              </button>
            </div>
          ) : (
            projects.map(project => {
              const stats = projectStats.get(project.id)
              return (
                <div
                  key={project.id}
                  onClick={() => { setSelectedProject(project); setViewMode('detail') }}
                  className="bg-white border border-gray-100 rounded-2xl p-6 hover:border-gray-300 transition-all cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-lg">{project.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(project.status)}`}>
                      {project.status.replace('_', ' ')}
                    </span>
                  </div>

                  {project.description && (
                    <p className="text-gray-500 text-sm mb-4 line-clamp-2">{project.description}</p>
                  )}

                  {stats && stats.total > 0 && (
                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>{stats.done}/{stats.total} tasks</span>
                        <span>{stats.progress}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#2563EB] transition-all"
                          style={{ width: `${stats.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 mt-4 text-xs text-gray-400">
                    {project.start_date && (
                      <span>Started: {new Date(project.start_date).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {viewMode === 'create' && (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 max-w-2xl">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2">Project Name *</label>
              <input
                value={projectForm.name}
                onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                placeholder="Q1 Marketing Campaign"
                className="w-full border rounded-xl p-3 focus:ring-1 focus:ring-[#2563EB] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2">Description</label>
              <textarea
                value={projectForm.description}
                onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                placeholder="Project description..."
                rows={3}
                className="w-full border rounded-xl p-3 focus:ring-1 focus:ring-[#2563EB] outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">Start Date</label>
                <input
                  type="date"
                  value={projectForm.start_date}
                  onChange={(e) => setProjectForm({ ...projectForm, start_date: e.target.value })}
                  className="w-full border rounded-xl p-3 focus:ring-1 focus:ring-[#2563EB] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">End Date</label>
                <input
                  type="date"
                  value={projectForm.end_date}
                  onChange={(e) => setProjectForm({ ...projectForm, end_date: e.target.value })}
                  className="w-full border rounded-xl p-3 focus:ring-1 focus:ring-[#2563EB] outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setViewMode('list')}
                className="px-6 py-2 text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                disabled={!projectForm.name.trim()}
                className="px-6 py-2 bg-[#2563EB] text-white rounded-full font-bold disabled:opacity-50"
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'detail' && selectedProject && (
        <div className="flex flex-col gap-6">
          {/* Project Info Card */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <div className="flex justify-between items-start">
              <div>
                {selectedProject.description && (
                  <p className="text-gray-500 mb-4">{selectedProject.description}</p>
                )}
                <div className="flex gap-4 text-sm text-gray-400">
                  {selectedProject.start_date && (
                    <span>Start: {new Date(selectedProject.start_date).toLocaleDateString()}</span>
                  )}
                  {selectedProject.end_date && (
                    <span>End: {new Date(selectedProject.end_date).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedProject.status}
                  onChange={(e) => handleUpdateProjectStatus(selectedProject.id, e.target.value as any)}
                  className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(selectedProject.status)}`}
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                </select>
                <button
                  onClick={() => handleDeleteProject(selectedProject.id)}
                  className="p-2 text-red-400 hover:text-red-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            </div>

            {/* Progress */}
            {projectStats.get(selectedProject.id) && (
              <div className="mt-6 pt-6 border-t">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-bold text-gray-700">Progress</span>
                  <span className="text-sm text-gray-500">
                    {projectStats.get(selectedProject.id)!.done} of {projectStats.get(selectedProject.id)!.total} tasks completed
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#2563EB] transition-all"
                    style={{ width: `${projectStats.get(selectedProject.id)!.progress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Knowledge Graph - Linked Records */}
            <div className="mt-6 pt-6 border-t">
              <LinkedRecordsPanel
                entityType="project"
                entityId={selectedProject.id}
                title="Linked Records"
              />
            </div>
          </div>

          {/* Tasks Section */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">Tasks</h3>
              <button
                onClick={() => { setShowTaskForm(true); setEditingTask(null); setTaskForm({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '' }) }}
                className="px-3 py-1 text-[#2563EB] text-sm font-bold flex items-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Add Task
              </button>
            </div>

            {/* Task Form */}
            {showTaskForm && (
              <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                <div className="space-y-3">
                  <input
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    placeholder="Task title"
                    className="w-full border rounded-lg p-2 text-sm focus:ring-1 focus:ring-[#2563EB] outline-none"
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <input
                      value={taskForm.assigned_to}
                      onChange={(e) => setTaskForm({ ...taskForm, assigned_to: e.target.value })}
                      placeholder="Assigned to"
                      className="border rounded-lg p-2 text-sm focus:ring-1 focus:ring-[#2563EB] outline-none"
                    />
                    <select
                      value={taskForm.priority}
                      onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as any })}
                      className="border rounded-lg p-2 text-sm focus:ring-1 focus:ring-[#2563EB] outline-none"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                    <input
                      type="date"
                      value={taskForm.due_date}
                      onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                      className="border rounded-lg p-2 text-sm focus:ring-1 focus:ring-[#2563EB] outline-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => { setShowTaskForm(false); setEditingTask(null) }}
                      className="px-3 py-1 text-gray-500 text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={editingTask ? handleUpdateTask : handleCreateTask}
                      disabled={!taskForm.title.trim()}
                      className="px-4 py-1 bg-[#2563EB] text-white rounded-full text-sm font-bold disabled:opacity-50"
                    >
                      {editingTask ? 'Update' : 'Add'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Task List */}
            {tasks.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No tasks yet</p>
            ) : (
              <div className="space-y-2">
                {tasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onStatusChange={handleTaskStatusChange}
                    onEdit={startEditTask}
                    onDelete={handleDeleteTask}
                    getTaskStatusColor={getTaskStatusColor}
                    getPriorityColor={getPriorityColor}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ProjectsView
