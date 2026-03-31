import { useState, useEffect, useCallback } from 'react'

/**
 * useAudioDevices — enumerate audio input/output devices,
 * manage selection, and react to device changes (plug/unplug).
 *
 * Returns:
 *   audioInputs      — [{deviceId, label}]  available microphones
 *   audioOutputs     — [{deviceId, label}]  available speakers / headphones
 *   selectedInput    — deviceId string
 *   selectedOutput   — deviceId string
 *   setSelectedInput — (deviceId) => void
 *   setSelectedOutput— (deviceId) => void
 *   refreshDevices   — () => Promise<void>
 *   permissionGranted— boolean (whether we've obtained mic permission)
 *   error            — string | null
 */
export function useAudioDevices({ initialInput, initialOutput } = {}) {
  const [audioInputs, setAudioInputs] = useState([])
  const [audioOutputs, setAudioOutputs] = useState([])
  const [selectedInput, setSelectedInput] = useState(initialInput || '')
  const [selectedOutput, setSelectedOutput] = useState(initialOutput || '')
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [error, setError] = useState(null)

  const enumerateDevices = useCallback(async () => {
    try {
      setError(null)

      // We need at least temporary mic access to get labeled devices.
      // Without permission, browsers return deviceId="" and label="" for all devices.
      let stream = null
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        setPermissionGranted(true)
      } catch (err) {
        // Permission denied or no mic — we can still list devices (unlabeled)
        if (err.name === 'NotAllowedError') {
          setError('Microphone permission denied. Grant access to see device names.')
        }
      }

      const devices = await navigator.mediaDevices.enumerateDevices()

      const inputs = devices
        .filter(d => d.kind === 'audioinput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${i + 1}`
        }))

      const outputs = devices
        .filter(d => d.kind === 'audiooutput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Speaker ${i + 1}`
        }))

      setAudioInputs(inputs)
      setAudioOutputs(outputs)

      // If the previously selected device is no longer available, fall back to default
      if (selectedInput && !inputs.find(d => d.deviceId === selectedInput)) {
        setSelectedInput(inputs[0]?.deviceId || '')
      }
      if (selectedOutput && !outputs.find(d => d.deviceId === selectedOutput)) {
        setSelectedOutput(outputs[0]?.deviceId || '')
      }

      // Release the temporary stream
      if (stream) {
        stream.getTracks().forEach(t => t.stop())
      }
    } catch (err) {
      console.error('[useAudioDevices] Enumeration failed:', err)
      setError('Failed to list audio devices.')
    }
  }, [selectedInput, selectedOutput])

  // Enumerate on mount
  useEffect(() => {
    enumerateDevices()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for device changes (plug/unplug headset, etc.)
  useEffect(() => {
    const handler = () => enumerateDevices()
    navigator.mediaDevices?.addEventListener('devicechange', handler)
    return () => navigator.mediaDevices?.removeEventListener('devicechange', handler)
  }, [enumerateDevices])

  return {
    audioInputs,
    audioOutputs,
    selectedInput,
    selectedOutput,
    setSelectedInput,
    setSelectedOutput,
    refreshDevices: enumerateDevices,
    permissionGranted,
    error
  }
}

export default useAudioDevices
