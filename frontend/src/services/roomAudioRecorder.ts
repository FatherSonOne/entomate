import { liveRoomsApi } from './api'
import { PieceUploader, PIECE_MS, baseMime, pickAudioMime, recorderOptions, sendPieceTo } from './meetingRecorderService'
import { ROOM_PARTICIPANT_TRACKS, type RoomParticipantTrack } from './recordingAudioTracks'

export interface RoomAudioInput {
  id: string
  name: string
  audio: MediaStreamTrack | null
}

type RoomLane = {
  recorder: MediaRecorder
  uploader: PieceUploader
  durations: number[]
  failed: boolean
}

function stopRecorder(recorder: MediaRecorder): Promise<void> {
  if (recorder.state === 'inactive') return Promise.resolve()
  return new Promise(resolve => {
    recorder.addEventListener('stop', () => resolve(), { once: true })
    recorder.stop()
  })
}

export class RoomAudioRecorder {
  private readonly context = new AudioContext()
  private readonly mix = this.context.createMediaStreamDestination()
  private readonly combined: RoomLane
  private readonly tracks
  private readonly lanes: RoomLane[]
  private readonly devices = new Map<string, { track: MediaStreamTrack; source: MediaStreamAudioSourceNode }>()
  private startedAt = 0
  private throughMs = 0
  private timer: number | undefined
  private stopped: Promise<void> | undefined

  private constructor(private readonly roomId: string, mimeType: string) {
    const options = recorderOptions('audio', mimeType)
    // Keep empty destinations producing audio samples until a microphone joins.
    const silence = this.context.createConstantSource()
    silence.offset.value = 0
    silence.connect(this.mix)
    const makeLane = (stream: MediaStream, track?: RoomParticipantTrack): RoomLane => {
      const recorder = new MediaRecorder(stream, options)
      const uploader = new PieceUploader(sendPieceTo(roomId, baseMime(mimeType), track))
      const lane: RoomLane = { recorder, uploader, durations: [], failed: false }
      recorder.ondataavailable = event => {
        const duration = lane.durations.shift()
        if (duration === undefined || lane.failed) return
        if (event.data.size) uploader.add(event.data, duration)
        else lane.failed = true
      }
      recorder.onerror = () => { lane.failed = true }
      return lane
    }
    this.combined = makeLane(this.mix.stream)
    // Silent slots start on the combined clock so a late join keeps the same
    // time origin. Empty slots never appear in the recap.
    this.tracks = ROOM_PARTICIPANT_TRACKS.map(key => {
      const destination = this.context.createMediaStreamDestination()
      silence.connect(destination)
      return { key, destination, lane: makeLane(destination.stream, key), participant: null as RoomAudioInput | null }
    })
    silence.start()
    this.lanes = [this.combined, ...this.tracks.map(slot => slot.lane)]
  }

  static async start(roomId: string, participants: RoomAudioInput[]): Promise<RoomAudioRecorder> {
    const mimeType = typeof MediaRecorder !== 'undefined' && pickAudioMime(type => MediaRecorder.isTypeSupported(type))
    if (!mimeType) throw new Error('This browser does not support room audio recording.')
    const capture = new RoomAudioRecorder(roomId, mimeType)
    try {
      await capture.context.resume()
      await liveRoomsApi.startAudio(roomId, mimeType)
      capture.update(participants)
      capture.startedAt = performance.now()
      for (const lane of capture.lanes) lane.recorder.start()
      capture.timer = window.setInterval(() => capture.flush(), PIECE_MS)
      return capture
    } catch (error) {
      capture.cancel()
      throw error
    }
  }

  update(participants: RoomAudioInput[]): void {
    if (this.stopped) return
    const incoming = new Map(participants.map(person => [person.id, person]))
    for (const [id, input] of this.devices) {
      if (incoming.get(id)?.audio === input.track) continue
      input.source.disconnect()
      this.devices.delete(id)
    }
    for (const person of participants) {
      if (!person.audio || this.devices.has(person.id)) continue
      const slot = this.tracks.find(track => track.participant?.id === person.id)
        ?? this.tracks.find(track => !track.participant)
      const source = this.context.createMediaStreamSource(new MediaStream([person.audio]))
      source.connect(this.mix)
      if (slot) {
        slot.participant = person
        source.connect(slot.destination)
      }
      this.devices.set(person.id, { source, track: person.audio })
    }
  }

  async finish(): Promise<void> {
    this.stopped ??= this.stop()
    await this.stopped
    await this.combined.uploader.drain()
    await Promise.allSettled(this.tracks.map(slot => slot.lane.uploader.drain()))
    if (!this.combined.uploader.state.recorded) throw new Error('There is no room audio to save.')
    const labels: Partial<Record<RoomParticipantTrack, string>> = {}
    for (const slot of this.tracks) if (slot.participant) labels[slot.key] = slot.participant.name
    await liveRoomsApi.finishAudio(this.roomId, this.combined.uploader.state.recorded, labels)
  }

  private pieceDuration(): number {
    const through = Math.round(performance.now() - this.startedAt)
    const duration = Math.max(1, through - this.throughMs)
    this.throughMs = through
    return duration
  }

  private flush(): void {
    const duration = this.pieceDuration()
    for (const lane of this.lanes) {
      if (lane.failed || lane.recorder.state === 'inactive') continue
      lane.durations.push(duration)
      try { lane.recorder.requestData() } catch { lane.failed = true }
    }
  }

  private async stop(): Promise<void> {
    window.clearInterval(this.timer)
    const duration = this.pieceDuration()
    await Promise.all(this.lanes.map(lane => {
      lane.durations.push(duration)
      return stopRecorder(lane.recorder)
    }))
    await this.context.close().catch(() => {})
  }

  cancel(): void {
    for (const lane of this.lanes) lane.uploader.cancel()
    this.stopped ??= this.stop()
  }
}
