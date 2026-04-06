import React, { Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
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
const Agents = React.lazy(() => import('./pages/Agents'))
const Goals = React.lazy(() => import('./pages/Goals'))
const Analytics = React.lazy(() => import('./pages/Analytics'))
const Search = React.lazy(() => import('./pages/Search'))
const Settings = React.lazy(() => import('./pages/Settings'))
const ProjectDashboard = React.lazy(() => import('./pages/ProjectDashboard'))
const Reports = React.lazy(() => import('./pages/Reports'))
const Calendar = React.lazy(() => import('./pages/Calendar'))
const Workflows = React.lazy(() => import('./pages/Workflows'))
const WorkflowBuilder = React.lazy(() => import('./pages/WorkflowBuilder'))
const UsersGuide = React.lazy(() => import('./components/UsersGuide/UsersGuide'))
const SignIn = React.lazy(() => import('./pages/SignIn'))
const AuthCallback = React.lazy(() => import('./pages/AuthCallback'))
const LandingPage = React.lazy(() => import('./pages/LandingPage'))
const NotFound = React.lazy(() => import('./pages/NotFound'))

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
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
            <Route path="project-dashboard" element={<ProjectDashboard />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="automations" element={<Automations />} />
            <Route path="workflows" element={<Workflows />} />
            <Route path="agents" element={<Agents />} />
            <Route path="goals" element={<Goals />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="reports" element={<Reports />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="search" element={<Search />} />
            <Route path="settings" element={<Settings />} />
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
