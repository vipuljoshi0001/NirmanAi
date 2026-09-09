import React, { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Intelligence from './pages/Intelligence'
import MapView from './pages/MapView'
import StateAnalysis from './pages/StateAnalysis'
import Reports from './pages/Reports'

export default function App() {
  // 1. Initialize theme checking system memory (localStorage) or browser defaults
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme')
    return savedTheme === 'dark' || 
      (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
  })

  // 2. Add or remove the 'dark' global modifier class on the main root document
  useEffect(() => {
    const root = window.document.documentElement
    if (darkMode) {
      root.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [darkMode])

  return (
    <Routes>
      {/* 3. Pass dark mode state down as props so the toggle button can live inside Layout */}
      <Route element={<Layout darkMode={darkMode} setDarkMode={setDarkMode} />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/intelligence" element={<Intelligence />} />
        <Route path="/state-analysis" element={<StateAnalysis />} />
        <Route path="/map" element={<MapView />} />
        <Route path="/reports" element={<Reports />} />
      </Route>
    </Routes>
  )
}
