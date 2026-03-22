import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Meetings from './pages/Meetings'
import MeetingDetail from './pages/MeetingDetail'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Tasks from './pages/Tasks'
import Automations from './pages/Automations'
import Agents from './pages/Agents'
import Goals from './pages/Goals'
import Analytics from './pages/Analytics'
import Search from './pages/Search'
import Settings from './pages/Settings'
import ProjectDashboard from './pages/ProjectDashboard'
import Reports from './pages/Reports'
import Calendar from './pages/Calendar'
import Workflows from './pages/Workflows'
import WorkflowBuilder from './pages/WorkflowBuilder'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import LandingPage from './pages/LandingPage'

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/sign-up" element={<SignUp />} />

        {/* Protected routes */}
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
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
        </Route>

        {/* Workflow builder - full screen, outside Layout */}
        <Route path="workflows/:id" element={<ProtectedRoute><WorkflowBuilder /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
