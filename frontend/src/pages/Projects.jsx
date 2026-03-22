import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, FolderKanban, Calendar, DollarSign, Trash2, Target, TrendingUp, Archive } from 'lucide-react'
import { projectsApi } from '../services/api'
import { GuideCard, PageHeader, Skeleton } from '../components/SharedUI'
import { VCButton, VCBadge } from '../components/vc'

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', description: '' })
  const [creating, setCreating] = useState(false)
  const [wizardStep, setWizardStep] = useState(0) // 0: Create, 1: Organize, 2: Track

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      setLoading(true)
      const data = await projectsApi.list({ limit: 50 })
      setProjects(data.projects || [])
      if (data.projects && data.projects.length > 0) {
        setWizardStep(2) // If projects exist, show track step
      }
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
      setWizardStep(1)
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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':    return <VCBadge color="mint">{status}</VCBadge>
      case 'planning':  return <VCBadge color="amber">{status}</VCBadge>
      case 'completed': return <VCBadge color="neutral">{status}</VCBadge>
      case 'archived':  return <VCBadge color="neutral">{status}</VCBadge>
      default:          return <VCBadge color="neutral">{status}</VCBadge>
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return <TrendingUp size={14} />
      case 'planning': return <Target size={14} />
      case 'completed': return <Archive size={14} />
      case 'archived': return <Archive size={14} />
      default: return <FolderKanban size={14} />
    }
  }

  return (
    <div className="animate-fade-in max-w-7xl mx-auto">
      <PageHeader
        title="Project Portfolio"
        subtitle="Organize work into projects, track progress, and manage deliverables."
        actions={
          <VCButton
            variant="primary"
            onClick={() => {
              setShowCreate(!showCreate)
              setWizardStep(0)
            }}
          >
            <Plus size={16} />
            New Project
          </VCButton>
        }
      />

      <GuideCard
        title="Project Workflow"
        steps={['Create Project', 'Organize Tasks', 'Track Progress']}
        activeStep={wizardStep}
      />

      {/* Create form */}
      {showCreate && (
        <div className="vc p-6 mb-6 animate-fade-in" style={{ background: 'var(--bg-elevated)' }}>
          <h3
            className="font-bold text-lg mb-4"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}
          >
            Create New Project
          </h3>
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
                placeholder="Project description and goals..."
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              />
            </div>
            <div className="flex gap-3">
              <VCButton type="submit" variant="primary" disabled={creating}>
                {creating ? 'Creating...' : 'Create Project'}
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

      {/* Search */}
      <div className="relative mb-6">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
          style={{ color: 'var(--text-tertiary)' }}
        />
        <input
          type="text"
          placeholder="Search projects by name..."
          className="input pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Projects grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-40" count={6} />
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="vc p-12 text-center border-dashed border-2" style={{ background: 'var(--bg-elevated)' }}>
          <FolderKanban className="w-16 h-16 mx-auto mb-4 opacity-50" style={{ color: 'var(--text-tertiary)' }} />
          <h3
            className="text-xl mb-2"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}
          >
            No projects yet
          </h3>
          <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
            {searchQuery ? 'Try a different search term' : 'Create your first project to organize your work'}
          </p>
          <VCButton
            variant="primary"
            onClick={() => {
              setShowCreate(true)
              setWizardStep(0)
            }}
          >
            <Plus size={16} />
            Create Project
          </VCButton>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="vc p-5 hover:border-accent-primary group transition-all"
              style={{ background: 'var(--bg-elevated)', display: 'block' }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-accent-primary/10 rounded-md group-hover:bg-accent-primary group-hover:text-white transition-colors">
                  <FolderKanban size={20} />
                </div>
                {getStatusBadge(project.status)}
              </div>

              <h3
                className="mb-2 line-clamp-1 group-hover:transition-colors"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}
              >
                {project.name}
              </h3>
              {project.description && (
                <p className="text-sm line-clamp-2 mb-4" style={{ color: 'var(--text-secondary)' }}>
                  {project.description}
                </p>
              )}

              <div
                className="flex items-center justify-between pt-3 border-t"
                style={{ borderColor: 'rgba(248,240,242,.08)' }}
              >
                <div
                  className="flex items-center gap-3 text-xs"
                  style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
                >
                  {project.deal_value && (
                    <span className="flex items-center gap-1">
                      <DollarSign size={12} />
                      {project.deal_value.toLocaleString()}
                    </span>
                  )}
                  {project.end_date && (
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {new Date(project.end_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => handleDelete(project.id, e)}
                  className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-semantic-error/10 hover:text-semantic-error rounded-md transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
