import React, { useState, useRef, useEffect } from 'react'
import { Mic, Square, Loader2, AlertCircle } from 'lucide-react'
import { meetingsApi } from '../services/api'
import { useTheme } from '../context/ThemeContext'
import { VCButton } from './vc'

// Dev-Core Audio Visualizer
function AudioVisualizer({ stream, isActive }) {
  const canvasRef = useRef(null)
  const { isDark } = useTheme()

  useEffect(() => {
    if (!stream || !isActive) return

    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const analyser = audioContext.createAnalyser()
    const source = audioContext.createMediaStreamSource(stream)
    analyser.fftSize = 256
    source.connect(analyser)

    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animationFrameId

    const draw = () => {
      animationFrameId = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(dataArray)
      ctx.clearRect(0, 0, canvas.width, canvas.height) // Use clearRect for transparency

      const barCount = 32
      const barWidth = (canvas.width / barCount)
      
      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * Math.floor(dataArray.length / barCount)]
        const percent = value / 255
        const barHeight = percent * canvas.height
        
        const x = i * barWidth
        const y = canvas.height - barHeight

        ctx.fillStyle = `rgba(255, 45, 107, ${0.1 + percent * 0.9})`
        ctx.fillRect(x, y, barWidth - 1, barHeight)
      }
    }
    draw()
    return () => cancelAnimationFrame(animationFrameId)
  }, [stream, isActive, isDark])

  return <canvas ref={canvasRef} width={300} height={30} className="w-full rounded" />
}

export default function MeetingRecorder({ onMeetingProcessed, audioInputDeviceId }) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState(null)
  const [title, setTitle] = useState('')
  const [attendeesInput, setAttendeesInput] = useState('')

  const mediaRecorder = useRef(null)
  const audioChunks = useRef([])
  const timerInterval = useRef(null)
  const streamRef = useRef(null)

  const startRecording = async () => {
    try {
      setError(null)
      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        ...(audioInputDeviceId ? { deviceId: { exact: audioInputDeviceId } } : {})
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints })
      streamRef.current = stream
      mediaRecorder.current = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      audioChunks.current = []
      mediaRecorder.current.ondataavailable = (event) => event.data.size > 0 && audioChunks.current.push(event.data)
      mediaRecorder.current.onstop = handleRecordingComplete
      mediaRecorder.current.start()
      setIsRecording(true)
      setDuration(0)
      timerInterval.current = setInterval(() => setDuration(prev => prev + 1), 1000)
    } catch (err) {
      setError(err.name === 'NotAllowedError' ? 'Mic access denied.' : 'No microphone found.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorder.current?.state !== 'inactive') mediaRecorder.current.stop()
    streamRef.current?.getTracks().forEach(track => track.stop())
    if (timerInterval.current) clearInterval(timerInterval.current)
    setIsRecording(false)
  }

  const handleRecordingComplete = async () => {
    try {
      setIsProcessing(true)
      setError(null)
      const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' })
      const formData = new FormData()
      formData.append('audio', audioBlob, 'meeting.webm')
      formData.append('title', title || `Meeting-${Date.now()}`)
      formData.append('duration', Math.ceil(duration / 60))
      if (attendeesInput.trim()) {
        formData.append('attendees', attendeesInput.trim())
      }

      const result = await meetingsApi.processAudio(formData)

      setTitle('')
      setAttendeesInput('')
      setDuration(0)
      if (onMeetingProcessed) onMeetingProcessed(result)

    } catch (err) {
      setError(`Processing failed: ${err.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  return (
    <div className="vc p-4 space-y-3">
      <h3
        className="font-semibold text-base"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
      >
        New Recording
      </h3>

      {error && (
        <div
          className="p-2 rounded-md flex items-center gap-2"
          style={{
            background: 'rgba(255,45,107,.08)',
            border: '1px solid var(--accent-primary)'
          }}
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />
          <p className="font-medium text-xs" style={{ color: 'var(--accent-primary)' }}>{error}</p>
        </div>
      )}

      <div>
        <label
          className="block text-xs font-medium mb-1"
          style={{ color: 'var(--text-secondary)' }}
        >
          Title (Optional)
        </label>
        <input
          type="text"
          className="input"
          style={{ padding: '6px 12px' }}
          placeholder={`Meeting-${Date.now()}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isRecording || isProcessing}
        />
      </div>

      <div>
        <label
          className="block text-xs font-medium mb-1"
          style={{ color: 'var(--text-secondary)' }}
        >
          Attendees (Optional)
        </label>
        <input
          type="text"
          className="input"
          style={{ padding: '6px 12px' }}
          placeholder="Comma-separated names or emails"
          value={attendeesInput}
          onChange={(e) => setAttendeesInput(e.target.value)}
          disabled={isRecording || isProcessing}
        />
      </div>

      <div
        className="flex flex-col items-center justify-center rounded-lg p-4 space-y-3"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
      >
        {(isRecording || (duration > 0 && !isProcessing)) && (
          <div
            className="text-3xl font-bold"
            style={{
              fontFamily: 'var(--font-mono)',
              color: isRecording ? 'var(--accent-primary)' : 'var(--text-secondary)'
            }}
          >
            {formatDuration(duration)}
          </div>
        )}

        {isRecording && <AudioVisualizer stream={streamRef.current} isActive={isRecording} />}

        {isProcessing ? (
          <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent-primary)' }} />
            <span>Processing...</span>
          </div>
        ) : isRecording ? (
          <VCButton variant="primary" onClick={stopRecording} className="w-full justify-center">
            <Square className="w-4 h-4" />
            Stop Recording
          </VCButton>
        ) : (
          <VCButton variant="primary" onClick={startRecording} className="w-full justify-center">
            <Mic className="w-4 h-4" />
            Start Recording
          </VCButton>
        )}
      </div>
    </div>
  )
}