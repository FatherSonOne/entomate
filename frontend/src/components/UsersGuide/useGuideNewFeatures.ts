import { useCallback, useEffect, useState } from 'react'
import { GUIDE_CHANGES, GUIDE_VERSION_KEY, guideUpdated, guideVersion } from './guideData'
import { changedSince } from '../../services/guideView'

/** The guide version this browser last opened, or null. Storage can be missing or throw. */
export function readSeenVersion(): string | null {
  try { return localStorage.getItem(GUIDE_VERSION_KEY) } catch { return null }
}

export function markGuideSeen(): void {
  try { localStorage.setItem(GUIDE_VERSION_KEY, guideVersion) } catch { /* private mode: nothing to keep */ }
}

/** Drives the rail's NEW note on User Guide. Opening the guide (or dismiss) clears it. */
export function useGuideNewFeatures(): { hasNew: boolean; dismiss: () => void; newCount: number } {
  const [seen, setSeen] = useState<string | null>(guideVersion)

  useEffect(() => { setSeen(readSeenVersion()) }, [])

  const dismiss = useCallback(() => {
    markGuideSeen()
    setSeen(guideVersion)
  }, [])

  const changed = changedSince(GUIDE_CHANGES, seen, guideVersion, guideUpdated)
  return { hasNew: seen !== guideVersion, dismiss, newCount: changed.size }
}
