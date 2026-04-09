// LoadingContext.jsx — Centralized Loading State Management
// Tracks loading stages and progress for Entomate's enhanced loading screen

import React, { createContext, useContext, useState } from 'react'

const DEFAULT_LOADING_STAGES = [
  { id: 'auth', label: 'Authenticating...', weight: 20, status: 'pending' },
  { id: 'session', label: 'Restoring session...', weight: 15, status: 'pending' },
  { id: 'data', label: 'Loading intelligence...', weight: 25, status: 'pending' },
  { id: 'sync', label: 'Syncing services...', weight: 25, status: 'pending' },
  { id: 'ready', label: 'Almost ready...', weight: 15, status: 'pending' },
]

const LoadingContext = createContext(undefined)

export function useLoading() {
  const context = useContext(LoadingContext)
  if (!context) {
    // Return safe defaults when used outside provider (e.g. PageLoader in Suspense)
    return {
      isLoading: true,
      currentStage: 'auth',
      currentStageLabel: 'Loading...',
      progress: 0,
      stages: DEFAULT_LOADING_STAGES,
      setLoading: () => {},
      setStage: () => {},
      setProgress: () => {},
      completeStage: () => {},
      resetLoading: () => {},
    }
  }
  return context
}

export function LoadingProvider({ children }) {
  const [isLoading, setIsLoading] = useState(true)
  const [stages, setStages] = useState(DEFAULT_LOADING_STAGES)
  const [currentStage, setCurrentStageId] = useState('auth')
  const [progress, setProgressValue] = useState(0)

  const setLoading = (loading) => {
    setIsLoading(loading)
    if (!loading) {
      setStages((prev) => prev.map((s) => ({ ...s, status: 'complete' })))
      setProgressValue(100)
    }
  }

  const setStage = (stageId) => {
    setCurrentStageId(stageId)
    setStages((prev) =>
      prev.map((stage) => {
        const stageIdx = prev.findIndex((s) => s.id === stage.id)
        const currentIdx = prev.findIndex((s) => s.id === stageId)
        if (stage.id === stageId) return { ...stage, status: 'active' }
        return { ...stage, status: stageIdx < currentIdx ? 'complete' : 'pending' }
      })
    )
    const currentIdx = stages.findIndex((s) => s.id === stageId)
    let calc = 0
    for (let i = 0; i < currentIdx; i++) calc += stages[i].weight
    setProgressValue(calc)
  }

  const setProgress = (value) => setProgressValue(Math.min(100, Math.max(0, value)))

  const completeStage = (stageId) => {
    setStages((prev) =>
      prev.map((s) => (s.id === stageId ? { ...s, status: 'complete' } : s))
    )
    const idx = stages.findIndex((s) => s.id === stageId)
    if (idx < stages.length - 1) {
      setStage(stages[idx + 1].id)
    } else {
      setProgressValue(100)
    }
  }

  const resetLoading = () => {
    setIsLoading(true)
    setStages(DEFAULT_LOADING_STAGES)
    setCurrentStageId('auth')
    setProgressValue(0)
  }

  const currentStageObj = stages.find((s) => s.id === currentStage)
  const currentStageLabel = currentStageObj?.label || 'Loading...'

  return (
    <LoadingContext.Provider
      value={{
        isLoading,
        currentStage,
        currentStageLabel,
        progress,
        stages,
        setLoading,
        setStage,
        setProgress,
        completeStage,
        resetLoading,
      }}
    >
      {children}
    </LoadingContext.Provider>
  )
}
