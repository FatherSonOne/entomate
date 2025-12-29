import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, FolderKanban, Calendar, DollarSign, Trash2 } from 'lucide-react'
import { projectsApi } from '../services/api'

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', description: '' })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      setLoading(true)
      const data = await projectsApi.list({ limit: 50 })
      setProjects(data.projects || [])
    } catch (error) {
      console.error('Failed to load projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newProject.name.trim()) return

    try {
      setCreating(true)
      await projectsApi.create(newProject)
      setNewProject({ name: '', description: '' })
      setShowCreate(false)
      loadProjects()
    } catch (error) {
      console.error('Failed to create project:', error)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id, e) => {
    e.preventDefault()
    e.stopPropagation()

    if (!confirm('Are you sure you want to delete this project?')) return

    try {
      await projectsApi.delete(id)
      setProjects(projects.filter(p => p.id !== id))
    } catch (error) {
      console.error('Failed to delete project:', error)
    }
  }

  const filteredProjects = projects.filter(project =>
    project.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'badge-success'
      case 'planning': return 'badge-info'
      case 'completed': return 'badge-gray'
      case 'archived': return 'badge-gray'
      default: return 'badge-gray'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600">Manage your projects and track progress</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Create New Project</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="label">Project Name</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., Q1 Marketing Campaign"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                className="input min-h-[100px]"
                placeholder="Project description..."
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={creating} className="btn btn-primary">
                {creating ? 'Creating...' : 'Create Project'}
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search projects..."
          className="input pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Projects grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner" />
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="card p-8 text-center">
          <FolderKanban className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No projects found</h3>
          <p className="text-gray-500">
            {searchQuery ? 'Try a different search term' : 'Create your first project to get started'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="card p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-accent-100 flex items-center justify-center">
                  <FolderKanban className="w-5 h-5 text-accent-600" />
                </div>
                <span className={`badge ${getStatusColor(project.status)}`}>
                  {project.status}
                </span>
              </div>

              <h3 className="font-semibold text-gray-900 mb-1">{project.name}</h3>
              {project.description && (
                <p className="text-sm text-gray-500 line-clamp-2 mb-3">{project.description}</p>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {project.deal_value && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      {project.deal_value.toLocaleString()}
                    </span>
                  )}
                  {project.end_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(project.end_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => handleDelete(project.id, e)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
