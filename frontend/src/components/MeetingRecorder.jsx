import React, { useState, useRef, useEffect } from 'react'
import { Mic, Square, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { meetingsApi } from '../services/api'
import { useTheme } from '../context/ThemeContext'

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

export default function MeetingRecorder({ onMeetingProcessed }) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState(null)
  const [title, setTitle] = useState('')

  const mediaRecorder = useRef(null)
  const audioChunks = useRef([])
  const timerInterval = useRef(null)
  const streamRef = useRef(null)

  const startRecording = async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
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
      
      const result = await meetingsApi.processAudio(formData)
      
      setTitle('')
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
    <div className="card p-4 space-y-3">
      <h3 className="font-semibold text-content-primary text-base">New Recording</h3>
      
      {error && (
        <div className="p-2 bg-semantic-error-dim border border-semantic-error rounded-md flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-semantic-error flex-shrink-0" />
          <p className="text-semantic-error font-medium text-xs">{error}</p>
        </div>
      )}

      <div>
        <label className="label !text-xs !mb-1">Title (Optional)</label>
        <input type="text" className="input !py-1.5" placeholder={`Meeting-${Date.now()}`} value={title} onChange={(e) => setTitle(e.target.value)} disabled={isRecording || isProcessing} />
      </div>

      <div className="flex flex-col items-center justify-center bg-surface-elevated border border-line-default rounded-md p-4 space-y-3">
        {(isRecording || (duration > 0 && !isProcessing)) && (
           <div className={`text-3xl font-mono font-bold ${isRecording ? 'text-semantic-error' : 'text-content-secondary'}`}>
            {formatDuration(duration)}
          </div>
        )}

        {isRecording && <AudioVisualizer stream={streamRef.current} isActive={isRecording} />}
        
        {isProcessing ? (
            <div className="flex items-center gap-2 text-sm text-content-secondary font-medium">
              <Loader2 className="w-4 h-4 text-accent-primary animate-spin" />
              <span>Processing...</span>
            </div>
          ) : isRecording ? (
            <button onClick={stopRecording} className="btn-highlight bg-semantic-error !shadow-red-500/20 w-full justify-center">
              <Square className="w-4 h-4" />
              <span>Stop Recording</span>
            </button>
          ) : (
            <button onClick={startRecording} className="btn-highlight w-full justify-center">
              <Mic className="w-4 h-4" />
              <span>Start Recording</span>
            </button>
          )}
      </div>
    </div>
  )
}