import { useCallback, useEffect, useRef, useState } from 'react'
import { captureErrorMessage } from '../../services/meetingRecorderService'
import { captureMicCheck, type MicMode } from '../../services/recordingMicrophone'

interface MicCheckPlayback {
  url: string
  label: string
  mode: MicMode | null
}

export function useMicCheck(mode: MicMode, deviceId: string | undefined, enabled: boolean) {
  const [playback, setPlayback] = useState<MicCheckPlayback | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)

  const clear = useCallback(() => {
    request.current?.abort()
    request.current = null
    setRunning(false)
    setPlayback(null)
    setError('')
  }, [])
  useEffect(() => { clear() }, [mode, deviceId, enabled, clear])
  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    if (playback) return () => URL.revokeObjectURL(playback.url)
  }, [playback])

  const start = async () => {
    if (!enabled || request.current) return
    const controller = new AbortController()
    request.current = controller
    setRunning(true)
    setPlayback(null)
    setError('')
    try {
      const { sample, label, mode: active } = await captureMicCheck(mode, deviceId, controller.signal)
      if (!controller.signal.aborted) setPlayback({ url: URL.createObjectURL(sample), label, mode: active })
    } catch (err) {
      if (!controller.signal.aborted) setError(captureErrorMessage(err, 'mic'))
    } finally {
      if (request.current === controller) {
        request.current = null
        setRunning(false)
      }
    }
  }
  return { playback, running, error, start, clear, pending: () => request.current !== null }
}
