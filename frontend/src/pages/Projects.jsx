import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, FolderKanban, Calendar, DollarSign, Trash2, Target, TrendingUp, Archive } from 'lucide-react'
import { projectsApi } from '../services/api'
import { GuideCard, PageHeader, Skeleton } from '../components/SharedUI'
import { VCButton } from '../components/vc'
import { getStatusBadge } from '../utils/badges'
import { useConfirm } from '../components/vc/ConfirmDialog'
import ErrorState from '../components/vc/ErrorState'
import { ProjectCardSkeleton } from '../components/LoadingSkeletons'

export default function Projects() {
  const confirm = useConfirm()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', description: '', startDate: '', endDate: '', tags: '', status: 'planning' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [wizardStep, setWizardStep] = useState(0) // 0: Create, 1: Organize, 2: Track
  const [formErrors, setFormErrors] = useState({})
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const PAGE_SIZE = 20

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      setError(null)
      setLoading(true)
      const data = await projectsApi.list({ limit: PAGE_SIZE, offset: 0 })
      setProjects(data.projects || [])
      setHasMore(data.hasMore || false)
      if (data.projects && data.projects.length > 0) {
        setWizardStep(2)
      }
    } catch (err) {
      console.error('Failed to load projects:', err)
      setError(err.message || 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  const loadMore = async () => {
    try {
      setLoadingMore(true)
      const data = await projectsApi.list({ limit: PAGE_SIZE, offset: projects.length })
      setProjects(prev => [...prev, ...(data.projects || [])])
      setHasMore(data.hasMore || false)
    } catch (err) {
      console.error('Failed to load more projects:', err)
    } finally {
      setLoadingMore(false)
    }
  }

  const validate = () => {
    const errs = {}
    if (!newProject.name?.trim()) errs.name = 'Project name is required'
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!validate()) return

    try {
      setCreating(true)
      setCreateError(null)
      const payload = {
        name: newProject.name,
        description: newProject.description || undefined,
        startDate: newProject.startDate || undefined,
        endDate: newProject.endDate || undefined,
        tags: newProject.tags ? newProject.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined
      }
      await projectsApi.create(payload)
      setNewProject({ name: '', description: '', startDate: '', endDate: '', tags: '', status: 'planning' })
      setShowCreate(false)
      setWizardStep(1)
      loadProjects()
    } catch (error) {
      console.error('Failed to create project:', error)
      setCreateError(error.message || 'Failed to create project. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id, e) => {
    e.preventDefault()
    e.stopPropagation()

    const ok = await confirm({ title: 'Delete Project', message: 'Are you sure you want to delete this project?', confirmLabel: 'Delete', variant: 'danger' })
    if (!ok) return

    try {
      await projectsApi.delete(id)
      setProjects(projects.filter(p => p.id !== id))
    } catch (error) {
      console.error('Failed to delete project:', error)
    }
  }

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return <TrendingUp size={14} />
      case 'planning': return <Target size={14} />
      case 'completed': return <Archive size={14} />
      case 'archived': return <Archive size={14} />
      default: return <FolderKanban size={14} />
    }
  }

  if (error) return (
    <div className="animate-fade-in max-w-7xl mx-auto">
      <ErrorState message={error} onRetry={loadProjects} />
    </div>
  )

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
              setFormErrors({})
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
              {formErrors.name && <span style={{ color: 'var(--c)', fontSize: 12, marginTop: 2, display: 'block' }}>{formErrors.name}</span>}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Start Date</label>
                <input
                  type="date"
                  className="input"
                  value={newProject.startDate}
                  onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="label">End Date</label>
                <input
                  type="date"
                  className="input"
                  value={newProject.endDate}
                  onChange={(e) => setNewProject({ ...newProject, endDate: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">Tags</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., marketing, q1, client-a (comma-separated)"
                value={newProject.tags}
                onChange={(e) => setNewProject({ ...newProject, tags: e.target.value })}
              />
            </div>
            {createError && (
              <div
                className="p-3 rounded-lg text-sm"
                style={{ background: 'rgba(239,68,68,.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,.2)' }}
              >
                {createError}
              </div>
            )}
            <div className="flex gap-3">
              <VCButton type="submit" variant="primary" disabled={creating}>
                {creating ? 'Creating...' : 'Create Project'}
              </VCButton>
              <VCButton
                type="button"
                variant="secondary"
                onClick={() => { setShowCreate(false); setCreateError(null) }}
              >
                Cancel
              </VCButton>
            </div>
          </form>
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
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
        <select
          className="input w-40"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="planning">Planning</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Projects grid */}
      {loading ? (
        <ProjectCardSkeleton count={6} />
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
        <>
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
                style={{ borderColor: 'var(--b1)' }}
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
                <VCButton
                  variant="danger"
                  size="sm"
                  onClick={(e) => handleDelete(project.id, e)}
                  className="p-1.5 opacity-0 group-hover:opacity-100 transition-all"
                  title="Delete project"
                  aria-label="Delete project"
                >
                  <Trash2 size={14} />
                </VCButton>
              </div>
            </Link>
          ))}
        </div>

        {/* Load More */}
        {hasMore && !searchQuery && statusFilter === 'all' && (
          <div className="text-center mt-6">
            <VCButton
              variant="secondary"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading...' : 'Load More Projects'}
            </VCButton>
          </div>
        )}
        </>
      )}
    </div>
  )
}
