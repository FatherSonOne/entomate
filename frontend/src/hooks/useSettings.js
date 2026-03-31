import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'
import { settingsApi } from '../services/api'

const SettingsContext = createContext(null)

/**
 * Debounce helper — delays backend writes so rapid UI changes
 * (e.g. slider drags) don't fire dozens of API calls.
 */
function useDebouncedSave(delay = 600) {
  const timer = useRef(null)
  const save = useCallback((fn) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(fn, delay)
  }, [delay])
  useEffect(() => () => clearTimeout(timer.current), [])
  return save
}

/**
 * SettingsProvider — wraps the app (or Settings page) and provides
 * user settings via context.
 *
 * Usage:
 *   <SettingsProvider>
 *     <Settings />
 *   </SettingsProvider>
 *
 *   const { settings, updateSetting, updateJsonSetting } = useSettings()
 */
export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const debouncedSave = useDebouncedSave()

  // Fetch settings on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const res = await settingsApi.getUser()
        if (!cancelled) setSettings(res.settings)
      } catch (err) {
        console.error('[useSettings] Failed to load:', err.message)
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  /**
   * Update a top-level setting column (theme_mode, reduce_motion, etc.)
   * Optimistically updates local state, then persists to backend.
   */
  const updateSetting = useCallback((key, value) => {
    setSettings(prev => prev ? { ...prev, [key]: value } : prev)
    debouncedSave(async () => {
      try {
        await settingsApi.updateUser({ [key]: value })
      } catch (err) {
        console.error(`[useSettings] Failed to save ${key}:`, err.message)
      }
    })
  }, [debouncedSave])

  /**
   * Update a key inside a JSONB column (e.g. meetings_json.audioInputDeviceId).
   * Merges the new key into the existing JSON object.
   */
  const updateJsonSetting = useCallback((column, key, value) => {
    setSettings(prev => {
      if (!prev) return prev
      const current = prev[column] || {}
      const merged = { ...current, [key]: value }
      return { ...prev, [column]: merged }
    })
    debouncedSave(async () => {
      try {
        // Re-read current to avoid race conditions
        const current = settings?.[column] || {}
        const merged = { ...current, [key]: value }
        await settingsApi.updateUser({ [column]: merged })
      } catch (err) {
        console.error(`[useSettings] Failed to save ${column}.${key}:`, err.message)
      }
    })
  }, [debouncedSave, settings])

  /**
   * Bulk-update an entire JSONB column.
   */
  const updateJsonColumn = useCallback((column, data) => {
    setSettings(prev => {
      if (!prev) return prev
      const merged = { ...(prev[column] || {}), ...data }
      return { ...prev, [column]: merged }
    })
    debouncedSave(async () => {
      try {
        const current = settings?.[column] || {}
        const merged = { ...current, ...data }
        await settingsApi.updateUser({ [column]: merged })
      } catch (err) {
        console.error(`[useSettings] Failed to save ${column}:`, err.message)
      }
    })
  }, [debouncedSave, settings])

  /**
   * Force-reload settings from backend.
   */
  const reload = useCallback(async () => {
    try {
      setLoading(true)
      const res = await settingsApi.getUser()
      setSettings(res.settings)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const value = {
    settings,
    loading,
    error,
    updateSetting,
    updateJsonSetting,
    updateJsonColumn,
    reload
  }

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

/**
 * useSettings — access user settings anywhere inside SettingsProvider.
 */
export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return ctx
}

export default useSettings
