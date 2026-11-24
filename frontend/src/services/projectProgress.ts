import { useCallback, useEffect, useRef, useState } from 'react'
import { projectsApi } from './api'

export interface Milestone {
  id: string
  title: string
  dueDate: string
  ownerId: string | null
  ownerName: string | null
  completedAt: string | null
}

type MilestoneFields = Pick<Milestone, 'title' | 'dueDate' | 'ownerId'>
export type ProjectHealth = 'on_track' | 'at_risk' | 'off_track'
export interface StatusUpdate {
  id: string
  health: ProjectHealth
  note: string
  authorName: string
  postedAt: string
  counts: { total: number; done: number; late: number; milestones: number; milestonesDone: number }
}

interface ProgressSnapshot {
  milestones: Milestone[]
  updates: StatusUpdate[]
  members: { id: string; name: string }[]
  canEdit: boolean
  version: string | null
}

export type ProgressChange =
  | ({ operation: 'addMilestone' } & MilestoneFields)
  | ({ operation: 'editMilestone'; id: string } & MilestoneFields)
  | { operation: 'setMilestoneDone'; id: string; done: boolean }
  | { operation: 'postUpdate'; health: ProjectHealth; note: string }

function asSnapshot(value: unknown): ProgressSnapshot {
  const data = value as Partial<ProgressSnapshot> | undefined
  if (!data || !Array.isArray(data.milestones) || !Array.isArray(data.updates) || !Array.isArray(data.members)) {
    throw new Error('Invalid project progress response')
  }
  return data as ProgressSnapshot
}

export function useProjectProgress(projectId: string) {
  const [result, setResult] = useState<{ projectId: string; data: ProgressSnapshot | null; error: boolean } | null>(null)
  const request = useRef(0)
  const current = result?.projectId === projectId ? result : null

  const reload = useCallback(async () => {
    const token = ++request.current
    try {
      const data = asSnapshot(await projectsApi.getProgress(projectId))
      if (token !== request.current) return false
      setResult({ projectId, data, error: false })
      return true
    } catch {
      if (token === request.current) setResult((previous) => ({ projectId, data: previous?.projectId === projectId ? previous.data : null, error: true }))
      return false
    }
  }, [projectId])

  useEffect(() => {
    if (projectId) void reload()
    return () => { request.current++ }
  }, [projectId, reload])

  const save = async (change: ProgressChange) => {
    if (!current?.data?.canEdit) throw new Error('Project progress is read only')
    const token = ++request.current
    const data = asSnapshot(await projectsApi.saveProgress(projectId, { ...change, version: current.data.version }))
    if (token === request.current) setResult({ projectId, data, error: false })
  }

  return { data: current?.data ?? null, error: current?.error ?? false, reload, save }
}

export type ProjectProgressState = ReturnType<typeof useProjectProgress>
