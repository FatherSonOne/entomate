import React, { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { loadRecordingAudio } from '../../services/meetingRecorderService'
import type { RoomParticipantTrack } from '../../services/recordingAudioTracks'

interface Props {
  meetingId: string
  track: RoomParticipantTrack
  label: string
  masterRef: RefObject<HTMLAudioElement>
  muted: boolean
  volume: number
}

/** The muted Combined element supplies the transport for the audible participant tracks. */
export function RoomAudioStem({ meetingId, track, label, masterRef, muted, volume }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  useLayoutEffect(() => {
    const master = masterRef.current
    const audio = audioRef.current
    if (!master || !audio) return
    const controller = new AbortController()
    let blobUrl: string | undefined
    let playing = !master.paused && !master.ended && master.readyState >= 3

    const align = () => {
      audio.playbackRate = master.playbackRate
      if (!audio.readyState || audio.seeking) return
      const target = Math.min(master.currentTime, audio.duration)
      if (Number.isFinite(target) && Math.abs(audio.currentTime - target) > 0.08) audio.currentTime = target
    }
    const fail = () => {
      if (!controller.signal.aborted) setStatus('unavailable')
    }
    const follow = () => {
      align()
      if (playing && !master.seeking && audio.readyState >= 3 && audio.paused && !audio.ended) {
        void audio.play().then(() => {
          if (!controller.signal.aborted) setStatus('ready')
        }).catch(error => {
          if (error?.name !== 'AbortError') fail()
        })
      }
    }
    const start = () => {
      playing = true
      follow()
    }
    const stop = () => {
      playing = false
      audio.pause()
    }
    const seeked = () => {
      playing = !master.paused && !master.ended && master.readyState >= 3
      follow()
    }
    const ready = () => {
      setStatus('ready')
      follow()
    }

    master.addEventListener('playing', start)
    master.addEventListener('pause', stop)
    master.addEventListener('waiting', stop)
    master.addEventListener('ended', stop)
    master.addEventListener('seeking', stop)
    master.addEventListener('seeked', seeked)
    master.addEventListener('ratechange', align)
    master.addEventListener('timeupdate', align)
    audio.addEventListener('canplay', ready)
    audio.addEventListener('error', fail)
    void loadRecordingAudio(meetingId, fetch, undefined, controller.signal, track).then(recording => {
      if (controller.signal.aborted) return
      audio.src = recording.url ?? (blobUrl = URL.createObjectURL(recording.blob!))
    }).catch(fail)

    return () => {
      controller.abort()
      master.removeEventListener('playing', start)
      master.removeEventListener('pause', stop)
      master.removeEventListener('waiting', stop)
      master.removeEventListener('ended', stop)
      master.removeEventListener('seeking', stop)
      master.removeEventListener('seeked', seeked)
      master.removeEventListener('ratechange', align)
      master.removeEventListener('timeupdate', align)
      audio.removeEventListener('canplay', ready)
      audio.removeEventListener('error', fail)
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [meetingId, track, masterRef])

  return (
    <>
      <audio ref={audioRef} hidden preload="auto" muted={muted} data-participant-audio={track} />
      {status !== 'ready' && <span role="status" className="bs-recording-stem-status">
        {status === 'loading' ? `Loading ${label} audio…` : `${label} audio is unavailable in this mix.`}
      </span>}
    </>
  )
}
