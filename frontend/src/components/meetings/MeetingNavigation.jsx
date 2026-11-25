import React from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import './meetingWorkspace.css'

export const START = '/meetings'
export const WORKSPACE = '/meetings/workspace'
export const UPCOMING = '/meetings/upcoming'
export const ROOM = '/meetings/room'

export function MeetingNavigation({ back }) {
  const { pathname } = useLocation()
  const workspaceDetail = /^\/meetings\/(?!room(?:\/|$)|upcoming$|workspace$)[^/]+$/.test(pathname)
  return (
    <div className="bs-meeting-nav">
      <nav aria-label="Meetings navigation">
        <NavLink to={START} end>Start</NavLink>
        <NavLink to={WORKSPACE} data-parent={workspaceDetail || undefined} end>Meeting workspace</NavLink>
        <NavLink to={UPCOMING} end>Upcoming</NavLink>
      </nav>
      {back && <Link className="bs-key sm" to={back.to} state={{ crumb: true }} title={`Back to ${back.label}`}>
        <ArrowLeft aria-hidden="true" /><span className="bs-meeting-back-label">Back to {back.label}</span>
      </Link>}
    </div>
  )
}

export function MeetingTrail({ current, workspace }) {
  return (
    <nav className="bs-crumbs" aria-label="Breadcrumb">
      <ol>
        <li className={workspace ? undefined : 'bs-crumbs-up'}>
          <Link className="bs-crumbs-link" to={START}><span className="bs-crumbs-label">Meetings</span></Link>
          <span className="bs-crumbs-sep" aria-hidden="true">/</span>
        </li>
        {workspace && <li className="bs-crumbs-up">
          <Link className="bs-crumbs-link" to={workspace}><span className="bs-crumbs-label">Meeting workspace</span></Link>
          <span className="bs-crumbs-sep" aria-hidden="true">/</span>
        </li>}
        <li className="bs-crumbs-here" aria-current="page"><span className="bs-crumbs-label">{current}</span></li>
      </ol>
    </nav>
  )
}
