import React, { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Mic, Video } from 'lucide-react'
import { Display, Key, Section, Signal, TitleRule } from '../components/bench'
import { MeetingNavigation, ROOM, WORKSPACE } from '../components/meetings/MeetingNavigation'
import SendBotKey from '../components/bot/SendBotKey'
import { liveRoomsApi, meetingsApi } from '../services/api'
import { formatLength, meetingDate, meetingLengthMs, meetingStatus } from '../services/meetingView'

export default function MeetingStart() {
  const { openRecorder, quickRecord, recorderActive, recordingVersion } = useOutletContext()
  const [recent, setRecent] = useState([])
  const [rooms, setRooms] = useState([])
  const [recentError, setRecentError] = useState(false)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    setRecentError(false)
    meetingsApi.list({ limit: 5 }).then(
      ({ meetings }) => { if (active) { setRecent(meetings); setLoading(false) } },
      () => { if (active) { setRecentError(true); setLoading(false) } },
    )
    liveRoomsApi.status().then(({ configured }) => {
      if (configured && active) return liveRoomsApi.hosted().then(({ rooms: next }) => { if (active) setRooms(next) })
    }).catch(() => {})
    return () => { active = false }
  }, [recordingVersion])

  return (
    <div className="bs-meeting-workspace">
      <MeetingNavigation />
      <TitleRule title="Meetings" />
      <Display className="bs-meeting-launcher">
        <div>
          <Signal tone={recorderActive ? 'live' : 'off'}>Browser microphone</Signal>
          <h2>{recorderActive ? 'Recorder in use' : 'Ready to record'}</h2>
          <p id="meeting-record-confirmation">{recorderActive ? 'Open the recorder to check its status.' : 'By choosing Record, you confirm everyone knows and agrees to being recorded.'}</p>
        </div>
        <div className="bs-meeting-launch-actions">
          <Key onDisplay variant="primary" aria-describedby="meeting-record-confirmation" onClick={recorderActive ? openRecorder : quickRecord} icon={<Mic aria-hidden="true" />}>
            {recorderActive ? 'Open recorder' : 'Record'}
          </Key>
          {!recorderActive && <Key onDisplay onClick={openRecorder}>Recording options</Key>}
          <Link className="bs-key on-display" to={ROOM}><Video aria-hidden="true" />Start live room</Link>
          <SendBotKey />
        </div>
      </Display>
      {rooms.length > 0 && <section className="bs-meeting-recent">
        <Section title="Your live rooms" />
        <ul className="bs-meeting-recent-list">{rooms.map(room => (
          <li key={room.id}><Link to={`${ROOM}/${room.id}`}>
            <span>{room.title}</span><Signal tone={room.available ? 'live' : 'brand'}>{room.available ? 'Return to room' : 'Finish room'}</Signal>
          </Link></li>
        ))}</ul>
      </section>}
      <section className="bs-meeting-recent">
        <Section title="Recent meetings" aside={<Link className="bs-key sm" to={WORKSPACE}>Browse all meetings</Link>} />
        {loading && <p role="status">Loading meetings…</p>}
        {recentError && <p role="alert">Recent meetings could not be loaded.</p>}
        {!loading && !recentError && recent.length === 0 && <p className="bs-mut">Your saved meetings will appear here.</p>}
        <ul className="bs-meeting-recent-list">{recent.map(row => (
          <li key={row.id}><Link to={`/meetings/${row.id}`}>
            <time>{meetingDate(row).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>
            <span>{row.title || 'Untitled meeting'}</span><span>{formatLength(meetingLengthMs(row))}</span>
            <Signal tone={meetingStatus(row).tone}>{meetingStatus(row).word}</Signal>
          </Link></li>
        ))}</ul>
      </section>
    </div>
  )
}
