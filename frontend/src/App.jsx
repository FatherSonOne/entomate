import React, { Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import OrgSetupGate from './components/teams/OrgSetupGate'
import Layout from './components/Layout'
import PageLoader from './components/PageLoader'
import BootLoader from './components/BootLoader'
import NavTrailRecorder from './components/NavTrailRecorder'

// Lazy-loaded pages (code splitting)
const Dashboard = React.lazy(() => import('./pages/Dashboard'))
const Meetings = React.lazy(() => import('./pages/Meetings'))
const MeetingStart = React.lazy(() => import('./pages/MeetingStart'))
const MeetingDetail = React.lazy(() => import('./pages/MeetingDetail'))
const LiveMeetingRoom = React.lazy(() => import('./pages/LiveMeetingRoom'))
const Projects = React.lazy(() => import('./pages/Projects'))
const ProjectDetail = React.lazy(() => import('./pages/ProjectDetail'))
const Tasks = React.lazy(() => import('./pages/Tasks'))
const Automations = React.lazy(() => import('./pages/Automations'))
const Insights = React.lazy(() => import('./pages/Insights'))
const Search = React.lazy(() => import('./pages/Search'))
const Settings = React.lazy(() => import('./pages/Settings'))
const Bot = React.lazy(() => import('./pages/Bot'))
const WorkflowBuilder = React.lazy(() => import('./pages/WorkflowBuilder'))
const UsersGuide = React.lazy(() => import('./components/UsersGuide/UsersGuide'))
const EntoAiHistoryPage = React.lazy(() => import('./components/EntoAssistant/history/EntoAiHistoryPage'))
const SignIn = React.lazy(() => import('./pages/SignIn'))
const AuthCallback = React.lazy(() => import('./pages/AuthCallback'))
const ResetPassword = React.lazy(() => import('./pages/ResetPassword'))
const LandingPage = React.lazy(() => import('./pages/LandingPage'))
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy'))
const Terms = React.lazy(() => import('./pages/Terms'))
const OptOut = React.lazy(() => import('./pages/OptOut'))
const DataDeletion = React.lazy(() => import('./pages/DataDeletion'))
const NotFound = React.lazy(() => import('./pages/NotFound'))

// The Calendar page was retired (surface audit 2026-11-22): Today shows the schedule and
// Settings › Recording holds the Google connection. Old links and OAuth returns to
// /calendar land on Today with their query intact.
function CalendarMoved() {
  const location = useLocation()
  return <Navigate to={{ pathname: '/dashboard', search: location.search }} replace />
}

function MeetingsEntry() {
  const { search } = useLocation()
  const query = new URLSearchParams(search)
  const legacyTab = query.get('tab')
  if (legacyTab === 'upcoming' || legacyTab === 'past') {
    query.delete('tab')
    return <Navigate replace to={{ pathname: '/meetings/' + (legacyTab === 'upcoming' ? 'upcoming' : 'workspace'), search: query.toString() }} />
  }
  return <MeetingStart />
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <NavTrailRecorder />
      <BootLoader />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/opt-out/:token" element={<OptOut />} />
          <Route path="/data-deletion" element={<DataDeletion />} />
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/meet/:id" element={<LiveMeetingRoom guest />} />

          {/* Protected routes */}
          <Route path="/" element={<ProtectedRoute><OrgSetupGate><Layout /></OrgSetupGate></ProtectedRoute>}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="meetings" element={<MeetingsEntry />} />
            <Route path="meetings/workspace" element={<Meetings />} />
            <Route path="meetings/upcoming" element={<Meetings upcoming />} />
            <Route path="meetings/room" element={<LiveMeetingRoom />} />
            <Route path="meetings/room/:id" element={<LiveMeetingRoom />} />
            <Route path="meetings/:id" element={<MeetingDetail />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="projects/:id/dashboard" element={<Navigate to=".." relative="path" replace />} />
            <Route path="project-dashboard" element={<Navigate to="/tasks?view=lanes" replace />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="automations" element={<Automations />} />
            {/* Workflows and Agents merged into Automations (2026-11-22). The builder stays at /workflows/:id. */}
            <Route path="workflows" element={<Navigate to="/automations" replace />} />
            <Route path="agents" element={<Navigate to="/settings" replace state={{ section: 'meeting-agents' }} />} />
            <Route path="goals" element={<Navigate to="/projects" replace />} />
            <Route path="analytics" element={<Insights />} />
            <Route path="insights" element={<Navigate to="/analytics" replace />} />
            <Route path="reports" element={<Navigate to="/analytics?export=" replace />} />
            <Route path="calendar" element={<CalendarMoved />} />
            <Route path="search" element={<Search />} />
            <Route path="settings" element={<Settings />} />
            <Route path="bot" element={<Bot />} />
            <Route path="bot-launcher" element={<Navigate to="/bot" replace />} />
            <Route path="guide" element={<UsersGuide />} />
            {/* Ask Entomate: every saved conversation, the rail's "View all" (EAI-02c slice 4). */}
            <Route path="assistant/history" element={<EntoAiHistoryPage />} />
          </Route>

          {/* Workflow builder - full screen, outside Layout */}
          <Route path="workflows/:id" element={<ProtectedRoute><WorkflowBuilder /></ProtectedRoute>} />

          {/* Catch-all 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
