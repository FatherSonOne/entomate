/**
 * Settings › Recording (Ledger pass, 2026-11-22): the microphone the browser recorder
 * uses (meetings_json.audioInputDeviceId, read by Meetings), the mic permission beside
 * it, calendar sync after processing (read by routes/meetings.js), and bot auto-join.
 * Recording quality, speaker output and transcription language were cut: nothing read them.
 */
import React from 'react'
import { useAudioDevices } from '../../hooks/useAudioDevices'
import { usePermissions } from '../../hooks/usePermissions'
import CalendarAutoJoinSettings from './CalendarAutoJoinSettings'
import { Key, Signal, Toggle } from '../bench'

interface AudioDevice { deviceId: string; label: string }
interface AudioDevicesApi {
  audioInputs: AudioDevice[]
  selectedInput: string
  setSelectedInput: (id: string) => void
  refreshDevices: () => void
  error: string | null
}
interface Permission { id: string; state: 'granted' | 'denied' | 'prompt' | 'unavailable' }
interface PermissionsApi { permissions: Permission[]; requestPermission: (id: string) => Promise<void> }

export interface MeetingsJson {
  audioInputDeviceId?: string
  auto_sync_meetings_to_calendar?: boolean
}

export interface RecordingSettingsProps {
  meetingsJson: MeetingsJson | undefined
  onUpdate: (key: keyof MeetingsJson, value: string | boolean) => void
}

export function permissionSignal(state: Permission['state'] | undefined): { tone: 'live' | 'brand' | 'off'; word: string } {
  if (state === 'granted') return { tone: 'live', word: 'Allowed' }
  if (state === 'denied') return { tone: 'brand', word: 'Blocked' }
  if (state === 'unavailable') return { tone: 'off', word: 'Unavailable' }
  return { tone: 'off', word: 'Not allowed yet' }
}

export default function RecordingSettings({ meetingsJson, onUpdate }: RecordingSettingsProps): React.ReactElement {
  const m = meetingsJson ?? {}
  const audio = useAudioDevices({ initialInput: m.audioInputDeviceId || '', initialOutput: '' }) as unknown as AudioDevicesApi
  const { permissions, requestPermission } = usePermissions() as unknown as PermissionsApi
  const mic = permissions.find((p) => p.id === 'microphone')
  const micSig = permissionSignal(mic?.state)

  return (
    <>
      <div className="bs-set-row">
        <div className="bs-set-l">
          <b id="set-mic">Microphone</b>
          <span>Used when you record in the browser.{mic?.state === 'denied' && ' It’s blocked: allow it from the lock icon in the address bar, then press Check.'}</span>
        </div>
        <div className="bs-set-c">
          <select
            className="bs-input bs-set-select"
            aria-labelledby="set-mic"
            value={audio.selectedInput}
            onChange={(e) => { audio.setSelectedInput(e.target.value); onUpdate('audioInputDeviceId', e.target.value) }}
          >
            <option value="">System default</option>
            {audio.audioInputs.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone'}</option>)}
          </select>
          <Signal tone={micSig.tone}>{micSig.word}</Signal>
          {mic?.state === 'prompt' && <Key size="sm" onClick={() => { void requestPermission('microphone').then(() => audio.refreshDevices()) }}>Allow</Key>}
          {mic?.state === 'denied' && <Key size="sm" onClick={() => audio.refreshDevices()}>Check</Key>}
        </div>
      </div>

      <div className="bs-set-row bs-set-row--tg">
        <div className="bs-set-l">
          <b>Add meetings to Google Calendar</b>
          <span>After a meeting is processed, put it on your calendar with the summary.</span>
        </div>
        <div className="bs-set-c">
          <Toggle
            label="Add meetings to Google Calendar"
            checked={!!m.auto_sync_meetings_to_calendar}
            onChange={(on) => onUpdate('auto_sync_meetings_to_calendar', on)}
          />
        </div>
      </div>

      <div className="bs-set-sub"><span className="bs-h3">Bot auto-join</span></div>
      <CalendarAutoJoinSettings />
    </>
  )
}
