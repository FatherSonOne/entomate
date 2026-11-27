import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Link2, Mic, MicOff, MonitorUp, Video, VideoOff } from 'lucide-react'
import { Display, Drawer, Key, Section, Signal, TextInput, TitleRule } from '../components/bench'
import { MeetingNavigation, MeetingTrail, ROOM, START, WORKSPACE } from '../components/meetings/MeetingNavigation'
import { LiveMeetingInsights } from '../components/meetings/LiveMeetingInsights'
import { useAuth } from '../contexts/AuthContext'
import { liveRoomsApi, meetingsApi } from '../services/api'

function Track({ track, video, muted, className }) {
  const element = useRef(null)
  useEffect(() => {
    const media = element.current
    if (!media || !track) return undefined
    media.srcObject = new MediaStream([track])
    return () => { media.srcObject = null }
  }, [track])
  return video ? <video ref={element} autoPlay playsInline muted={muted} className={className} /> : <audio ref={element} autoPlay />
}

function liveTrack(participant, kind) {
  const track = participant.tracks?.[kind]
  return track?.state === 'playable' ? track.persistentTrack || track.track : null
}

function Participant({ participant, active }) {
  const who = participant.user_name || 'Guest'
  const video = liveTrack(participant, 'video')
  const audio = !participant.local && liveTrack(participant, 'audio')
  return (
    <div className="bs-meeting-person" data-active={active || undefined}>
      {video ? <Track video muted track={video} /> : <span className="bs-meeting-initials" aria-hidden="true">{who.slice(0, 2).toUpperCase()}</span>}
      {audio && <Track track={audio} />}
      <span className="bs-meeting-person-label">
        <b>{who}</b>{participant.local && ' (you)'}{!participant.audio && <MicOff size={14} aria-label="Muted" />}
      </span>
    </div>
  )
}

export default function LiveMeetingRoom({ guest = false }) {
  const { id } = useParams()
  const { hash } = useLocation()
  const inviteKey = guest ? hash.slice(1) : ''
  const { user } = useAuth()
  const navigate = useNavigate()
  const [room, setRoom] = useState(null)
  const [title, setTitle] = useState('')
  const [name, setName] = useState('')
  const [withNotes, setWithNotes] = useState(false)
  const [acceptNotes, setAcceptNotes] = useState(false)
  const [audioOnly, setAudioOnly] = useState(false)
  const [mic, setMic] = useState(true)
  const [camera, setCamera] = useState(false)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [joined, setJoined] = useState(false)
  const [closing, setClosing] = useState(false)
  const [participants, setParticipants] = useState([])
  const [speaker, setSpeaker] = useState('')
  const [caption, setCaption] = useState(null)
  const [transcriptRevision, setTranscriptRevision] = useState(0)
  const [transcribing, setTranscribing] = useState(false)
  const [notesError, setNotesError] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState(false)
  const call = useRef(null)
  const checkpoint = useMemo(() => ({ pending: [], sending: null }), [id])
  const createId = useRef(null)
  const inAction = useRef(false)
  const mounted = useRef(false)
  const intentionalLeave = useRef(false)
  const cameraStream = useRef(null)
  const endingCall = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      const previous = call.current
      call.current = null
      if (previous) void previous.destroy().catch(() => {})
    }
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setRoom(null)
    setTranscriptRevision(0)
    if (!id) createId.current = null
    const request = !id ? liveRoomsApi.status() : guest ? liveRoomsApi.guest(id, inviteKey) : liveRoomsApi.host(id)
    request.then(data => {
      if (!active) return
      if (!id && !data.configured) {
        setError('Live rooms are unavailable on this Entomate installation.')
      } else {
        setRoom(data)
      }
    }).catch(err => {
      if (active) setError(guest ? 'This invitation has expired or is invalid. Ask your host for a new link.' : err.message)
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [guest, id, inviteKey])

  const audioMode = id ? room?.audioOnly : audioOnly
  useEffect(() => {
    if (!camera || joined || audioMode || !room?.available) return undefined
    if (!navigator.mediaDevices?.getUserMedia) return undefined
    let active = true
    navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
      if (!active) { stream.getTracks().forEach(track => track.stop()); return }
      cameraStream.current = stream
      setPreview(stream.getVideoTracks()[0] || null)
    }).catch(() => {
      if (active) {
        setCamera(false)
        setError('Camera access is unavailable. You can join with your camera off.')
      }
    })
    return () => {
      active = false
      cameraStream.current?.getTracks().forEach(track => track.stop())
      cameraStream.current = null
      setPreview(null)
    }
  }, [camera, joined, audioMode, room?.available])

  const flush = useCallback(() => {
    if (checkpoint.sending) return checkpoint.sending
    if (!checkpoint.pending.length) return Promise.resolve()
    checkpoint.sending = (async () => {
      while (checkpoint.pending.length) {
        const batch = checkpoint.pending.slice(0, 100)
        await liveRoomsApi.lines(id, batch)
        checkpoint.pending.splice(0, batch.length)
      }
    })().finally(() => { checkpoint.sending = null })
    return checkpoint.sending
  }, [id, checkpoint])

  useEffect(() => {
    if (!joined || guest || !room?.withNotes) return undefined
    const persist = () => {
      if (!endingCall.current) void flush().catch(() => setNotesError('Transcript sync paused. Entomate will retry.'))
    }
    const timer = window.setInterval(persist, 5000)
    const warn = event => { if (checkpoint.pending.length) event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('beforeunload', warn)
      if (!endingCall.current) void flush().catch(() => {})
    }
  }, [checkpoint, flush, guest, joined, room?.withNotes])

  async function create(event) {
    event.preventDefault()
    if (inAction.current) return
    inAction.current = true
    setError('')
    setBusy(true)
    createId.current ||= crypto.randomUUID()
    try {
      const result = await liveRoomsApi.create({ id: createId.current, title, withNotes, audioOnly })
      navigate(`${ROOM}/${result.id}`, { replace: true })
    } catch (err) {
      setError(err.status === 502 ? 'The video service could not create this room. Try again.' : err.message)
    } finally {
      inAction.current = false
      setBusy(false)
    }
  }

  async function join(event) {
    event.preventDefault()
    if (inAction.current || !room?.available) return
    inAction.current = true
    setError('')
    setNotice('')
    setBusy(true)
    intentionalLeave.current = false
    endingCall.current = false
    cameraStream.current?.getTracks().forEach(track => track.stop())
    try {
      const [{ default: Daily }, access] = await Promise.all([
        import('@daily-co/daily-js'),
        liveRoomsApi.join(id, !guest, { name: name.trim() || user?.name || 'Host', ...(guest ? { inviteKey, acceptNotes } : {}) }),
      ])
      if (!mounted.current) return
      const connection = Daily.createCallObject()
      call.current = connection
      const sync = () => {
        if (call.current === connection) setParticipants(Object.values(connection.participants()))
      }
      const updateSpeaker = event => setSpeaker(event.activeSpeaker.peerId)
      const onLine = event => {
        if (call.current !== connection || event.rawResponse?.is_final === false || !event.text?.trim()) return
        const who = Object.values(connection.participants()).find(person => person.session_id === event.participantId)
        const stamp = new Date(event.timestamp).getTime()
        const elapsed = (Number.isFinite(stamp) ? stamp : Date.now()) - Date.parse(access.openedAt)
        const line = {
          id: crypto.randomUUID(), speaker: (who?.user_name || 'Guest').slice(0, 120), text: event.text.trim().slice(0, 3000),
          atMs: Math.min(14_400_000, Math.max(0, Math.round(elapsed))),
        }
        setCaption(line)
        if (access.host && access.withNotes) {
          checkpoint.pending.push(line)
          setTranscriptRevision(previous => previous + 1)
        }
      }
      connection.on('participant-joined', sync).on('participant-updated', sync).on('participant-left', sync)
        .on('track-started', sync).on('track-stopped', sync)
        .on('active-speaker-change', updateSpeaker)
        .on('transcription-message', onLine)
        .on('transcription-started', () => { setTranscribing(true); setNotesError('') })
        .on('transcription-stopped', () => setTranscribing(false))
        .on('transcription-error', () => setNotesError('Live transcription is unavailable. You can continue the call.'))
        .on('camera-error', () => setError('A microphone or camera could not start. Check your browser permissions.'))
        .on('nonfatal-error', event => {
          if (event.type === 'screen-share-error') setError('Screen sharing could not start. Check your browser permissions.')
        })
        .on('error', () => {
          if (!endingCall.current && !intentionalLeave.current) {
            setError('The video service reported a connection problem. You can rejoin if you were disconnected.')
          }
        })
        .on('left-meeting', () => {
          if (call.current !== connection) return
          call.current = null
          setJoined(false)
          setTranscribing(false)
          void connection.destroy().catch(() => {})
          if (!intentionalLeave.current && !endingCall.current) {
            setNotice('You left the call. Rejoin if the room is still open.')
            if (!guest) void flush().catch(() => setNotesError('Some transcript lines have not synced.'))
            else void liveRoomsApi.guest(id, inviteKey).catch(err => {
              if (mounted.current && !call.current && [404, 410].includes(err.status)) {
                setRoom(previous => ({ ...previous, available: false }))
                setError('')
                setNotice('The host ended this room.')
              }
            })
          }
        })
      await connection.join({
        url: access.url, token: access.token,
        startAudioOff: !mic, startVideoOff: audioMode || !camera,
      })
      if (call.current !== connection) return
      sync()
      setJoined(true)
      if (access.host && access.withNotes) {
        try { connection.startTranscription() } catch { setNotesError('Live transcription could not start.') }
      }
    } catch (err) {
      const failed = call.current
      call.current = null
      if (failed) void failed.destroy().catch(() => {})
      if (mounted.current) {
        setCamera(false)
        setError(err.status === 410 ? 'This live room has ended.' : 'Could not join the room. Check your device permissions and connection, then try again.')
      }
    } finally {
      inAction.current = false
      if (mounted.current) setBusy(false)
    }
  }

  async function leave() {
    intentionalLeave.current = true
    try {
      if (!guest) await flush()
      if (call.current) await call.current.leave()
      setNotice('You left the call.')
    } catch {
      intentionalLeave.current = false
      setError('Could not leave cleanly. Try again to finish syncing your transcript.')
    }
  }

  async function end() {
    if (inAction.current) return
    inAction.current = true
    endingCall.current = true
    setBusy(true)
    setError('')
    try {
      if (transcribing) {
        try { call.current?.stopTranscription() } catch { /* Closing the room also stops transcription. */ }
      }
      await flush()
      const { meetingId } = await liveRoomsApi.end(id)
      setError('')
      const connection = call.current
      call.current = null
      if (connection) void connection.destroy().catch(() => {})
      if (meetingId) {
        navigate(`/meetings/${meetingId}`, { replace: true, state: { writeMinutes: true } })
      } else {
        setJoined(false)
        setRoom(previous => ({ ...previous, available: false, finished: true }))
        setNotice(room.withNotes ? 'Room ended. There were no saved transcript lines.' : 'Room ended for everyone.')
      }
    } catch {
      setError('The room could not be finished. Try End room again to finish saving.')
    } finally {
      endingCall.current = false
      inAction.current = false
      if (mounted.current) setBusy(false)
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/meet/${id}#${room.inviteKey}`)
      setCopied(true)
    } catch {
      setError('Clipboard access was blocked. Copy the guest link below.')
    }
  }

  const local = participants.find(person => person.local)
  const shared = participants.find(person => liveTrack(person, 'screenVideo'))
  const showLobby = id && room?.available && !joined
  const guestUrl = room?.inviteKey ? `${window.location.origin}/meet/${id}#${room.inviteKey}` : ''
  const pageTitle = room?.title || (guest ? 'Join a meeting' : 'Start live room')
  return (
    <div className={guest ? 'bs-tokens bs-skin bs-meeting-guest' : 'bs-meeting-workspace'}>
      {!guest && <MeetingNavigation back={{ to: START, label: 'Start' }} />}
      <TitleRule title={pageTitle} crumbs={!guest && <MeetingTrail current="Live room" />} />
      {loading && <p role="status">Loading live room…</p>}
      {error && <p className="bs-meeting-error" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {!guest && id && room && !room.finished && <div className="bs-meeting-room-actions">
        {room.available && <Key onClick={copyInvite} icon={<Link2 aria-hidden="true" />}>{copied ? 'Link copied' : 'Copy guest link'}</Key>}
        <Key variant="danger" disabled={busy} onClick={() => setClosing(true)}>End room</Key>
        {error?.includes('Clipboard') && <TextInput aria-label="Guest link" value={guestUrl} readOnly onFocus={event => event.target.select()} />}
      </div>}
      {!loading && !id && room?.configured && <form className="bs-meeting-lobby" onSubmit={create}>
        <Section title="Set up your room" />
        <label className="bs-meeting-field"><span>Meeting title</span><TextInput value={title} onChange={event => setTitle(event.target.value)} maxLength={160} required /></label>
        <label className="bs-meeting-check"><input type="checkbox" checked={audioOnly} onChange={event => setAudioOnly(event.target.checked)} />Start in audio-only mode</label>
        <label className="bs-meeting-check"><input type="checkbox" checked={withNotes} onChange={event => setWithNotes(event.target.checked)} />Transcribe the call and save minutes</label>
        {withNotes && <p className="bs-mut">Guests acknowledge transcription before joining. Entomate saves the transcript and minutes in your workspace.</p>}
        <Key variant="primary" type="submit" disabled={busy || !title.trim()}>{busy ? 'Creating room…' : 'Create room'}</Key>
      </form>}
      {showLobby && <form className="bs-meeting-lobby" onSubmit={join}>
        <Section title={guest ? 'Join this room' : 'Check your setup'} />
        <Display className="bs-meeting-camera-preview">
          {preview ? <Track video muted track={preview} /> : <VideoOff aria-label="Camera off" />}
        </Display>
        <label className="bs-meeting-field"><span>Display name</span><TextInput value={name} placeholder={guest ? '' : user?.name || 'Host'} onChange={event => setName(event.target.value)} maxLength={120} required={guest} /></label>
        <div className="bs-meeting-controls">
          <Key aria-pressed={mic} onClick={() => setMic(!mic)} icon={mic ? <Mic aria-hidden="true" /> : <MicOff aria-hidden="true" />}>Mic {mic ? 'on' : 'off'}</Key>
          {!audioMode && <Key aria-pressed={camera} onClick={() => setCamera(!camera)} icon={camera ? <Video aria-hidden="true" /> : <VideoOff aria-hidden="true" />}>Camera {camera ? 'on' : 'off'}</Key>}
        </div>
        {guest && room.withNotes && <label className="bs-meeting-check">
          <input type="checkbox" checked={acceptNotes} onChange={event => setAcceptNotes(event.target.checked)} required />
          I agree to have this call transcribed and saved in the host’s workspace.
        </label>}
        <Key variant="primary" type="submit" disabled={busy || (guest && (!name.trim() || (room.withNotes && !acceptNotes)))}>
          {busy ? 'Joining…' : guest ? 'Join room' : 'Enter room'}
        </Key>
      </form>}
      {joined && <section aria-label="Live call" className="bs-meeting-call">
        <div className="bs-meeting-call-status">
          <Signal tone="live">Live · {participants.length} {participants.length === 1 ? 'person' : 'people'}</Signal>
          {room.withNotes && <Signal tone={transcribing ? 'brand' : 'off'}>{transcribing ? 'Transcribing' : 'Live transcription enabled'}</Signal>}
        </div>
        <div className="bs-meeting-controls">
          <Key aria-pressed={Boolean(local?.audio)} onClick={() => call.current?.setLocalAudio(!local?.audio)} icon={local?.audio ? <Mic aria-hidden="true" /> : <MicOff aria-hidden="true" />}>Mic {local?.audio ? 'on' : 'off'}</Key>
          {!audioMode && <Key aria-pressed={Boolean(local?.video)} onClick={() => call.current?.setLocalVideo(!local?.video)} icon={local?.video ? <Video aria-hidden="true" /> : <VideoOff aria-hidden="true" />}>Camera {local?.video ? 'on' : 'off'}</Key>}
          <Key disabled={!navigator.mediaDevices?.getDisplayMedia} aria-pressed={Boolean(local?.screen)} onClick={() => {
            try {
              if (local?.screen) call.current?.stopScreenShare()
              else call.current?.startScreenShare()
            } catch { setError('Screen sharing could not start in this browser.') }
          }} icon={<MonitorUp aria-hidden="true" />}>{local?.screen ? 'Stop sharing' : 'Share screen'}</Key>
          <Key onClick={leave} disabled={busy}>Leave room</Key>
        </div>
        {shared && <div className="bs-meeting-share"><Track video muted track={liveTrack(shared, 'screenVideo')} />
          {!shared.local && liveTrack(shared, 'screenAudio') && <Track track={liveTrack(shared, 'screenAudio')} />}
          <span>{shared.user_name || 'Guest'} is sharing</span>
        </div>}
        <div className="bs-meeting-tiles">{participants.map(p => <Participant key={p.session_id} participant={p} active={p.session_id === speaker} />)}</div>
        {caption && <p className="bs-meeting-caption"><b>{caption.speaker}</b> {caption.text}</p>}
      </section>}
      {!guest && joined && room?.withNotes && <LiveMeetingInsights key={id} roomId={id} live
        transcriptRevision={transcriptRevision} beforeRefresh={flush} disabled={busy} />}
      {notesError && <p role="status" className="bs-mut">{notesError}</p>}
      {!guest && <Drawer open={closing && !room?.finished} onClose={() => setClosing(false)} dismissible={!busy} label="End live room"
        footer={<>
          <Key disabled={busy} onClick={() => setClosing(false)}>Cancel</Key>
          <Key variant="danger" onClick={end} disabled={busy}>{busy ? 'Ending room…' : 'End room for everyone'}</Key>
        </>}>
        <p className="bs-para">Everyone will be disconnected.</p>
        {error && <p className="bs-meeting-error" role="alert">{error}</p>}
      </Drawer>}
      {!guest && room?.finished && <Link className="bs-key" to={room.meetingId ? `/meetings/${room.meetingId}` : WORKSPACE}>Open {room.meetingId ? 'saved meeting' : 'meeting workspace'}</Link>}
    </div>
  )
}
