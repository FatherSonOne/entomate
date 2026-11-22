import React, { Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import OrgSetupGate from './components/teams/OrgSetupGate'
import Layout from './components/Layout'
import PageLoader from './components/PageLoader'

// Lazy-loaded pages (code splitting)
const Dashboard = React.lazy(() => import('./pages/Dashboard'))
const Meetings = React.lazy(() => import('./pages/Meetings'))
const MeetingDetail = React.lazy(() => import('./pages/MeetingDetail'))
const Projects = React.lazy(() => import('./pages/Projects'))
const ProjectDetail = React.lazy(() => import('./pages/ProjectDetail'))
const Tasks = React.lazy(() => import('./pages/Tasks'))
const Automations = React.lazy(() => import('./pages/Automations'))
const Insights = React.lazy(() => import('./pages/Insights'))
const Search = React.lazy(() => import('./pages/Search'))
const Settings = React.lazy(() => import('./pages/Settings'))
const BotLauncher = React.lazy(() => import('./pages/BotLauncher'))
const ProjectDashboard = React.lazy(() => import('./pages/ProjectDashboard'))
const Calendar = React.lazy(() => import('./pages/Calendar'))
const WorkflowBuilder = React.lazy(() => import('./pages/WorkflowBuilder'))
const UsersGuide = React.lazy(() => import('./components/UsersGuide/UsersGuide'))
const SignIn = React.lazy(() => import('./pages/SignIn'))
const AuthCallback = React.lazy(() => import('./pages/AuthCallback'))
const LandingPage = React.lazy(() => import('./pages/LandingPage'))
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy'))
const Terms = React.lazy(() => import('./pages/Terms'))
const OptOut = React.lazy(() => import('./pages/OptOut'))
const DataDeletion = React.lazy(() => import('./pages/DataDeletion'))
const NotFound = React.lazy(() => import('./pages/NotFound'))

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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

          {/* Protected routes */}
          <Route path="/" element={<ProtectedRoute><OrgSetupGate><Layout /></OrgSetupGate></ProtectedRoute>}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="meetings" element={<Meetings />} />
            <Route path="meetings/:id" element={<MeetingDetail />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="projects/:id/dashboard" element={<ProjectDashboard />} />
            <Route path="project-dashboard" element={<Navigate to="/projects?view=board" replace />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="automations" element={<Automations />} />
            {/* Workflows and Agents merged into Automations (2026-11-22). The builder stays at /workflows/:id. */}
            <Route path="workflows" element={<Navigate to="/automations" replace />} />
            <Route path="agents" element={<Navigate to="/settings" replace state={{ section: 'meeting-agents' }} />} />
            <Route path="goals" element={<Navigate to="/projects" replace />} />
            <Route path="analytics" element={<Insights />} />
            <Route path="insights" element={<Navigate to="/analytics" replace />} />
            <Route path="reports" element={<Navigate to="/analytics?export=" replace />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="search" element={<Search />} />
            <Route path="settings" element={<Settings />} />
            <Route path="bot-launcher" element={<BotLauncher />} />
            <Route path="guide" element={<UsersGuide />} />
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
