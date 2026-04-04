/**
 * AudioSettings — Audio input/output device selection and recording preferences
 * Persists to user_settings.meetings_json via parent callback
 */

import React, { useEffect } from 'react'
import { Mic, Volume2, RefreshCw, AlertCircle, Settings2, CalendarPlus } from 'lucide-react'
import { VCButton, VCSelect, VCIconBox } from '../vc'
import { useAudioDevices } from '../../hooks/useAudioDevices'

export default function AudioSettings({ meetingsJson, onUpdateJson }) {
  const m = meetingsJson || {}

  const {
    audioInputs,
    audioOutputs,
    selectedInput,
    selectedOutput,
    setSelectedInput,
    setSelectedOutput,
    refreshDevices,
    permissionGranted,
    error
  } = useAudioDevices({
    initialInput: m.audioInputDeviceId || '',
    initialOutput: m.audioOutputDeviceId || ''
  })

  // When user changes device, persist to settings
  const handleInputChange = (deviceId) => {
    setSelectedInput(deviceId)
    onUpdateJson('audioInputDeviceId', deviceId)
  }

  const handleOutputChange = (deviceId) => {
    setSelectedOutput(deviceId)
    onUpdateJson('audioOutputDeviceId', deviceId)
  }

  return (
    <div className="space-y-4">
      {/* Permission / Error Banner */}
      {error && (
        <div
          className="flex items-center gap-2 p-3 rounded-lg text-sm"
          style={{
            background: 'rgba(255,184,0,.06)',
            border: '1px solid rgba(255,184,0,.15)',
            color: 'var(--accent-tertiary)'
          }}
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Audio Input (Microphone) */}
      <div
        className="p-4 rounded-lg"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--b1)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <VCIconBox color="crimson">
              <Mic className="w-5 h-5" />
            </VCIconBox>
            <div>
              <span
                className="text-sm font-medium block"
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
              >
                Microphone
              </span>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Select the input device for meeting recordings
              </span>
            </div>
          </div>
          <VCButton variant="ghost" size="sm" onClick={refreshDevices}>
            <RefreshCw className="w-3.5 h-3.5" />
          </VCButton>
        </div>

        <VCSelect
          value={selectedInput}
          onChange={e => handleInputChange(e.target.value)}
        >
          <option value="">System Default</option>
          {audioInputs.map(d => (
            <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
          ))}
        </VCSelect>

        {audioInputs.length === 0 && !error && (
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            {permissionGranted
              ? 'No microphones detected.'
              : 'Click the refresh button to detect microphones (requires mic permission).'}
          </p>
        )}
      </div>

      {/* Audio Output (Speakers) */}
      <div
        className="p-4 rounded-lg"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--b1)' }}
      >
        <div className="flex items-center gap-3 mb-3">
          <VCIconBox color="mint">
            <Volume2 className="w-5 h-5" />
          </VCIconBox>
          <div>
            <span
              className="text-sm font-medium block"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
            >
              Speakers / Headphones
            </span>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Select the output device for playback
            </span>
          </div>
        </div>

        <VCSelect
          value={selectedOutput}
          onChange={e => handleOutputChange(e.target.value)}
        >
          <option value="">System Default</option>
          {audioOutputs.map(d => (
            <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
          ))}
        </VCSelect>
      </div>

      {/* Recording Quality */}
      <div
        className="p-4 rounded-lg"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--b1)' }}
      >
        <div className="flex items-center gap-3 mb-3">
          <VCIconBox color="amber">
            <Settings2 className="w-5 h-5" />
          </VCIconBox>
          <div>
            <span
              className="text-sm font-medium block"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
            >
              Recording Quality
            </span>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Higher quality = larger file size and upload time
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {['standard', 'high', 'max'].map(q => {
            const current = m.recordingQuality || 'high'
            const isSelected = current === q
            const labels = { standard: 'Standard', high: 'High', max: 'Maximum' }
            const descs = { standard: '64 kbps', high: '128 kbps', max: '256 kbps' }
            return (
              <button
                key={q}
                onClick={() => onUpdateJson('recordingQuality', q)}
                className="flex flex-col items-center gap-1 p-3 rounded-lg transition-all"
                style={{
                  background: isSelected ? 'rgba(255,45,107,.08)' : 'var(--b0)',
                  border: `1.5px solid ${isSelected ? 'var(--accent-primary)' : 'var(--b1)'}`,
                  cursor: 'pointer',
                  color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)'
                }}
              >
                <span className="text-sm font-medium">{labels[q]}</span>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{descs[q]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Transcription Language */}
      <div
        className="p-4 rounded-lg"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--b1)' }}
      >
        <label
          className="text-sm font-medium block mb-1"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
        >
          Transcription Language
        </label>
        <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
          The AI will prioritize this language when transcribing. "Auto" lets the AI detect automatically.
        </p>
        <VCSelect
          value={m.transcriptionLanguage || 'auto'}
          onChange={e => onUpdateJson('transcriptionLanguage', e.target.value)}
        >
          <option value="auto">Auto-detect</option>
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="pt">Portuguese</option>
          <option value="it">Italian</option>
          <option value="nl">Dutch</option>
          <option value="ja">Japanese</option>
          <option value="ko">Korean</option>
          <option value="zh">Chinese (Mandarin)</option>
          <option value="ar">Arabic</option>
          <option value="hi">Hindi</option>
          <option value="ru">Russian</option>
        </VCSelect>
      </div>

      {/* Auto-Sync to Calendar */}
      <div
        className="p-4 rounded-lg"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--b1)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <VCIconBox color="mint">
              <CalendarPlus className="w-5 h-5" />
            </VCIconBox>
            <div>
              <span
                className="text-sm font-medium block"
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
              >
                Auto-Sync to Calendar
              </span>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Automatically add new meetings to Google Calendar after processing
              </span>
            </div>
          </div>
          <button
            role="switch"
            aria-checked={!!m.auto_sync_meetings_to_calendar}
            onClick={() => onUpdateJson('auto_sync_meetings_to_calendar', !m.auto_sync_meetings_to_calendar)}
            className="relative w-11 h-6 rounded-full transition-colors"
            style={{
              background: m.auto_sync_meetings_to_calendar
                ? 'var(--accent-secondary)'
                : 'rgba(248,240,242,.15)'
            }}
          >
            <span
              className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform"
              style={{
                transform: m.auto_sync_meetings_to_calendar ? 'translateX(20px)' : 'translateX(0)'
              }}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
