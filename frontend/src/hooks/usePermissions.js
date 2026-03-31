import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Browser permissions Entomate may request.
 */
const PERMISSION_DEFS = [
  {
    id: 'microphone',
    label: 'Microphone',
    description: 'Required for meeting recording and voice input',
    permissionName: 'microphone',
    requestFn: () => navigator.mediaDevices.getUserMedia({ audio: true }),
    required: true
  },
  {
    id: 'camera',
    label: 'Camera',
    description: 'Optional for video meetings and profile photos',
    permissionName: 'camera',
    requestFn: () => navigator.mediaDevices.getUserMedia({ video: true }),
    required: false
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Desktop alerts for meeting reminders and action items',
    permissionName: null, // handled manually via Notification API
    requestFn: () => Notification.requestPermission(),
    required: false
  },
  {
    id: 'clipboard',
    label: 'Clipboard',
    description: 'Copy meeting summaries, tokens, and share links',
    permissionName: 'clipboard-read',
    requestFn: async () => {
      try { await navigator.clipboard.readText() } catch { /* expected */ }
    },
    required: false
  }
]

/**
 * Query a single permission's current state.
 */
async function queryOne(def) {
  try {
    // Notifications have their own API
    if (def.id === 'notifications') {
      if (!('Notification' in window)) return 'unavailable'
      const p = Notification.permission
      return p === 'default' ? 'prompt' : p
    }

    // Permissions API
    if (navigator.permissions && def.permissionName) {
      const result = await navigator.permissions.query({ name: def.permissionName })
      return result.state // 'granted' | 'denied' | 'prompt'
    }
  } catch {
    // Query name not supported in this browser
  }
  return 'prompt'
}

/**
 * usePermissions — query and manage browser permissions.
 */
export function usePermissions() {
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)
  const statusRefs = useRef([]) // hold PermissionStatus objects for cleanup

  const refreshAll = useCallback(async () => {
    setLoading(true)
    const results = await Promise.all(
      PERMISSION_DEFS.map(async (def) => ({
        id: def.id,
        label: def.label,
        description: def.description,
        state: await queryOne(def),
        required: def.required
      }))
    )
    setPermissions(results)
    setLoading(false)
  }, [])

  // Query on mount + subscribe to changes
  useEffect(() => {
    let cancelled = false

    async function init() {
      // Initial query
      const results = await Promise.all(
        PERMISSION_DEFS.map(async (def) => ({
          id: def.id,
          label: def.label,
          description: def.description,
          state: await queryOne(def),
          required: def.required
        }))
      )
      if (!cancelled) {
        setPermissions(results)
        setLoading(false)
      }

      // Subscribe to change events where supported
      const refs = []
      for (const def of PERMISSION_DEFS) {
        if (!navigator.permissions || !def.permissionName) continue
        try {
          const status = await navigator.permissions.query({ name: def.permissionName })
          status.onchange = () => {
            if (!cancelled) refreshAll()
          }
          refs.push(status)
        } catch {
          // Not supported for this permission name
        }
      }
      statusRefs.current = refs
    }

    init()

    return () => {
      cancelled = true
      // Detach listeners
      statusRefs.current.forEach(s => { s.onchange = null })
      statusRefs.current = []
    }
  }, [refreshAll])

  /**
   * Request a specific permission — opens the browser dialog.
   */
  const requestPermission = useCallback(async (id) => {
    const def = PERMISSION_DEFS.find(d => d.id === id)
    if (!def || !def.requestFn) return

    try {
      const result = await def.requestFn()
      // For getUserMedia, stop the stream immediately
      if (result && typeof result.getTracks === 'function') {
        result.getTracks().forEach(t => t.stop())
      }
    } catch (err) {
      console.warn(`[usePermissions] ${id} request failed:`, err.message)
    }

    // Re-query all after granting/denying
    await refreshAll()
  }, [refreshAll])

  return { permissions, loading, requestPermission, refreshAll }
}

export default usePermissions
