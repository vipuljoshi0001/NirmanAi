import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Intelligence from './pages/Intelligence'
import MapView from './pages/MapView'
import StateAnalysis from './pages/StateAnalysis'
import Reports from './pages/Reports'
import ContractorPanel from './pages/ContractorPanel'
import AdminPanel from './pages/AdminPanel'
import { AuthProvider, useAuth } from './context/AuthContext'

function RootRoute() {
  const { role } = useAuth()
  if (role === 'admin') {
    return <Navigate to="/admin" replace />
  }
  if (role === 'contractor') {
    return <Navigate to="/contractor" replace />
  }
  return <Dashboard />
}

function AdminRoute() {
  const { role } = useAuth()
  if (role !== 'admin') {
    return <Navigate to="/" replace />
  }
  return <AdminPanel />
}

function ContractorRestrictedRoute({ children }: { children: React.ReactNode }) {
  const { role } = useAuth()
  if (role === 'contractor') {
    return <Navigate to="/contractor" replace />
  }
  return <>{children}</>
}

export default function App() {
  // 1. Default loading mode is light mode unless user explicitly chose dark mode
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme_preference')
    if (savedTheme) {
      return savedTheme === 'dark'
    }
    // Default to light mode (false)
    return false
  })

  // 2. Add or remove the 'dark' global modifier class on the main root document
  useEffect(() => {
    const root = window.document.documentElement
    if (darkMode) {
      root.classList.add('dark')
      localStorage.setItem('theme', 'dark')
      localStorage.setItem('theme_preference', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('theme', 'light')
      localStorage.setItem('theme_preference', 'light')
    }
  }, [darkMode])

  return (
    <AuthProvider>
      <Routes>
        {/* Pass dark mode state down as props so the toggle button can live inside Layout */}
        <Route element={<Layout darkMode={darkMode} setDarkMode={setDarkMode} />}>
          <Route path="/" element={<RootRoute />} />
          <Route path="/admin" element={<AdminRoute />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/map" element={<MapView />} />
          <Route path="/contractor" element={<ContractorPanel />} />
          <Route
            path="/intelligence"
            element={
              <ContractorRestrictedRoute>
                <Intelligence />
              </ContractorRestrictedRoute>
            }
          />
          <Route
            path="/state-analysis"
            element={
              <ContractorRestrictedRoute>
                <StateAnalysis />
              </ContractorRestrictedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ContractorRestrictedRoute>
                <Reports />
              </ContractorRestrictedRoute>
            }
          />
        </Route>
      </Routes>
    </AuthProvider>
  )
}


