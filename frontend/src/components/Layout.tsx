import React, { useState, useEffect, useMemo, useRef } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Search,
  Bell,
  Moon,
  Sun,
  X,
  ArrowRight,
  TrendingUp,
  FolderKanban,
  MapPin,
  Compass,
  Layers,
  FileText,
  LogIn,
  LogOut,
  HardHat,
  ShieldCheck,
  User,
  Building2,
} from 'lucide-react'
import NotificationCenter from './NotificationCenter'
import { LoginModal } from './LoginModal'
import { useAuth } from '../context/AuthContext'
import paimanaLogo from '../assests/paimana-logo.png'
import { getProjects } from '../services/api'
import type { Project } from '../types'


const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/projects', label: 'Projects' },
  { to: '/map', label: 'Project Map' },
  { to: '/intelligence', label: 'Intelligence' },
  { to: '/state-analysis', label: 'State Analysis' },
  { to: '/reports', label: 'Reports' },
]

const quickPages = [
  { to: '/', label: 'Executive Dashboard', description: 'National infrastructure health, capex velocity, and risk summaries', icon: TrendingUp },
  { to: '/projects', label: 'Projects Explorer', description: 'Search and inspect multi-source project telemetry and risk signals', icon: FolderKanban },
  { to: '/map', label: 'Project Map', description: 'Geospatial satellite GIS map with state-level distribution and pins', icon: MapPin },
  { to: '/intelligence', label: 'Intelligence Layer', description: 'ML synthesis, SHAP root causes, and telemetry early warnings', icon: Compass },
  { to: '/state-analysis', label: 'State Analysis', description: 'Cross-state capital expenditure rates, local execution gaps, and key hubs', icon: Layers },
  { to: '/reports', label: 'Reports Digest', description: 'Inter-ministerial delivery reviews and statutory clearance audits', icon: FileText },
]

const popularFilters = [
  'Railways',
  'Roads & Highways',
  'Urban Transport',
  'Power & RE',
  'Maharashtra',
  'Uttar Pradesh',
  'Gujarat',
]

interface LayoutProps {
  darkMode: boolean
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>
}

export default function Layout({ darkMode, setDarkMode }: LayoutProps) {
  const navigate = useNavigate()
  const { user, role, logout, setLoginModalOpen } = useAuth()
  const [notifOpen, setNotifOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const currentNavItems = useMemo(() => {
    if (role === 'admin') {
      return [
        { to: '/admin', label: 'Admin Workspace' },
        { to: '/projects', label: 'Projects' },
        { to: '/map', label: 'Project Map' },
        { to: '/intelligence', label: 'Intelligence' },
        { to: '/state-analysis', label: 'State Analysis' },
        { to: '/reports', label: 'Reports' },
      ]
    }
    if (role === 'contractor') {
      return [
        { to: '/projects', label: 'Projects' },
        { to: '/map', label: 'Projects Map' },
        { to: '/contractor', label: 'Submitted Reports' },
      ]
    }
    return navItems
  }, [role])


  // Preload projects when search modal is opened
  useEffect(() => {
    if (searchOpen && projects.length === 0) {
      setLoadingProjects(true)
      getProjects()
        .then((data) => setProjects(data))
        .catch((err) => console.warn('Search failed to load projects', err))
        .finally(() => setLoadingProjects(false))
    }
    if (searchOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    }
  }, [searchOpen, projects.length])

  // Listen for ⌘K and Escape shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((prev) => !prev)
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchOpen])

  const queryTrim = searchQuery.trim().toLowerCase()

  const matchingPages = useMemo(() => {
    if (!queryTrim) return []
    return quickPages.filter(
      (p) =>
        p.label.toLowerCase().includes(queryTrim) ||
        p.description.toLowerCase().includes(queryTrim)
    )
  }, [queryTrim])

  const matchingProjects = useMemo(() => {
    if (!queryTrim) return []
    return projects.filter((p) => {
      const nameMatch = p.name?.toLowerCase().includes(queryTrim)
      const idMatch = p.id?.toLowerCase().includes(queryTrim)
      const sectorMatch = p.sector?.toLowerCase().includes(queryTrim)
      const stateMatch = p.state?.toLowerCase().includes(queryTrim)
      const ministryMatch = p.ministry?.toLowerCase().includes(queryTrim)
      return nameMatch || idMatch || sectorMatch || stateMatch || ministryMatch
    })
  }, [projects, queryTrim])

  const handleSelectPage = (to: string) => {
    navigate(to)
    setSearchOpen(false)
    setSearchQuery('')
  }

  const handleSelectProject = (projectId: string) => {
    navigate(`/projects/${projectId}`)
    setSearchOpen(false)
    setSearchQuery('')
  }

  const handleViewAllInRegistry = () => {
    navigate(`/projects?q=${encodeURIComponent(searchQuery.trim())}`)
    setSearchOpen(false)
    setSearchQuery('')
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (matchingProjects.length > 0) {
        handleSelectProject(matchingProjects[0].id)
      } else if (matchingPages.length > 0) {
        handleSelectPage(matchingPages[0].to)
      } else if (searchQuery.trim()) {
        handleViewAllInRegistry()
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] dark:bg-ink-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 overflow-x-hidden">
      
      {/* Floating Header Spacer */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 pt-4 sticky top-0 z-40">
        
        {/* Navigation Header Panel */}
        <header className="rounded-2xl sm:rounded-full shadow-[0_4px_20px_rgba(15,20,32,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] border border-white/50 dark:border-ink-800 bg-gradient-to-r from-amber-500/10 via-white/95 to-emerald-500/10 dark:from-amber-600/10 dark:via-ink-900/95 dark:to-emerald-600/10 backdrop-blur px-4 sm:px-8 h-16 flex items-center justify-between transition-all duration-300">
          
          <div className="flex items-center gap-3 md:gap-6 min-w-0">
            {/* Logo Wrapper Container */}
            <NavLink 
              to={role === 'admin' ? '/admin' : role === 'contractor' ? '/contractor' : '/'} 
              className="flex flex-col items-center justify-center select-none group min-w-[100px] sm:min-w-[150px] lg:min-w-[200px]"
            >
              <img 
                src={paimanaLogo} 
                alt="Paimana Logo" 
                className="h-7 sm:h-10 w-auto object-contain dark:brightness-110 transition-all duration-200"
              />
              <span className="block text-[6px] sm:text-[8px] font-bold tracking-[0.12em] sm:tracking-[0.18em] text-slate-400 dark:text-slate-500 mt-1 leading-none text-center">
                NATIONAL MONITORING DASHBOARD
              </span>
            </NavLink>
            
            {/* Desktop Navigation Menu (hidden on mobile devices) */}
            <nav className="hidden md:flex items-center gap-4 lg:gap-6 overflow-x-auto whitespace-nowrap">
              {currentNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/' || item.to === '/admin' || item.to === '/contractor'}
                  className={({ isActive }) =>
                    `text-sm font-semibold transition-all px-2.5 py-1.5 rounded-full ${
                      isActive 
                        ? 'text-brand-orange bg-amber-500/10 dark:bg-amber-500/20 shadow-sm' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-ink-950 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-ink-800/50'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Action Tools Section */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Search Trigger Button (button only) */}
            <button 
              onClick={() => setSearchOpen(true)}
              className="p-2 rounded-full bg-white/60 dark:bg-ink-800/60 border border-slate-200/60 dark:border-ink-700/60 text-slate-500 dark:text-slate-400 hover:text-ink-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-ink-700 transition-all shadow-sm cursor-pointer"
              title="Search projects & pages (Ctrl/⌘+K)"
              aria-label="Search"
            >
              <Search size={16} />
            </button>

            {/* Theme Toggle Button */}
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-full bg-white/60 dark:bg-ink-800/60 border border-slate-200/60 dark:border-ink-700/60 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-700 transition-all shadow-sm cursor-pointer" 
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} />}
            </button>

            {/* Notification Center - Hidden for public guests */}
            {role !== 'guest' && (
              <div className="relative">
                <button
                  onClick={() => setNotifOpen((v) => !v)}
                  className="relative text-slate-500 dark:text-slate-400 p-2 rounded-full bg-white/60 dark:bg-ink-800/60 border border-slate-200/60 dark:border-ink-700/60 shadow-sm hover:bg-slate-100 dark:hover:bg-ink-700 transition-all cursor-pointer"
                  aria-label="Notifications"
                >
                  <Bell size={16} />
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand-orange" />
                </button>
                {notifOpen && <NotificationCenter onClose={() => setNotifOpen(false)} />}
              </div>
            )}
            
            {/* Unified User Authentication Controls */}
            {role === 'guest' ? (
              <button
                onClick={() => setLoginModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-brand-orange hover:from-amber-600 hover:to-brand-orangeDark text-white text-xs font-bold shadow-sm shadow-amber-500/20 transition-all cursor-pointer"
              >
                <LogIn size={13} />
                <span>Login / Portal</span>
              </button>
            ) : role === 'contractor' ? (
              <div className="relative">
                <div className="flex items-center gap-1.5">
                  <NavLink
                    to="/contractor"
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 dark:bg-amber-500/20 text-brand-orange border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
                  >
                    <HardHat size={14} />
                    <span className="truncate max-w-[120px]">
                      {user?.company ? user.company.split(' ')[0] : 'Contractor'}
                    </span>
                  </NavLink>
                  <button
                    onClick={() => setUserMenuOpen((v) => !v)}
                    className="p-1 rounded-full border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900 transition-all shadow-sm cursor-pointer"
                    title={user?.company || 'Contractor Profile'}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-brand-orange text-white text-xs font-bold shadow-sm">
                      {user?.company ? user.company.substring(0, 2).toUpperCase() : 'CP'}
                    </span>
                  </button>
                </div>

                {userMenuOpen && (
                  <div className="absolute right-0 top-12 w-64 rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-xl p-3 z-50 text-xs space-y-2.5 animate-in fade-in zoom-in-95 duration-100">
                    <div className="border-b border-slate-100 dark:border-ink-800 pb-2">
                      <p className="font-bold text-slate-900 dark:text-white truncate">
                        {user?.company}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {user?.name} (Contractor)
                      </p>
                      <span className="inline-block mt-1 font-mono text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-slate-300">
                        ID: {user?.id}
                      </span>
                    </div>
                    <NavLink
                      to="/contractor"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-ink-800 text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      <HardHat size={14} className="text-brand-orange" />
                      <span>Contractor Workspace</span>
                    </NavLink>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false)
                        setLoginModalOpen(true)
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-ink-800 text-slate-700 dark:text-slate-300 transition-colors text-left cursor-pointer"
                    >
                      <User size={14} className="text-cyan-500" />
                      <span>Switch Account</span>
                    </button>
                    <button
                      onClick={() => {
                        logout()
                        setUserMenuOpen(false)
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors text-left cursor-pointer border-t border-slate-100 dark:border-ink-800 pt-2"
                    >
                      <LogOut size={14} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center gap-1.5">
                  <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
                    Admin
                  </span>
                  <button
                    onClick={() => setUserMenuOpen((v) => !v)}
                    className="p-1 rounded-full border border-slate-200/60 dark:border-ink-700/60 bg-white/40 dark:bg-ink-800/40 hover:bg-slate-100 dark:hover:bg-ink-700 transition-all shadow-sm cursor-pointer"
                    title="Director General (Admin)"
                    aria-label="Director General profile"
                  >
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-white text-xs font-bold shadow-sm">
                      DG
                    </span>
                  </button>
                </div>

                {userMenuOpen && (
                  <div className="absolute right-0 top-12 w-64 rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-xl p-3 z-50 text-xs space-y-2.5 animate-in fade-in zoom-in-95 duration-100">
                    <div className="border-b border-slate-100 dark:border-ink-800 pb-2">
                      <p className="font-bold text-slate-900 dark:text-white">
                        {user?.name || 'Director General'}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {user?.title || 'National Oversight Administrator'}
                      </p>
                    </div>
                    <NavLink
                      to="/admin"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-ink-800 text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      <Building2 size={14} className="text-cyan-500" />
                      <span>Admin Workspace</span>
                    </NavLink>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false)
                        setLoginModalOpen(true)
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-ink-800 text-slate-700 dark:text-slate-300 transition-colors text-left cursor-pointer"
                    >
                      <User size={14} className="text-cyan-500" />
                      <span>Switch Account</span>
                    </button>
                    <button
                      onClick={() => {
                        logout()
                        setUserMenuOpen(false)
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors text-left cursor-pointer border-t border-slate-100 dark:border-ink-800 pt-2"
                    >
                      <LogOut size={14} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>


        </header>
      </div>

      {/* 
        MOBILE HAMBURGER DRAWER SYSTEM:
        Sticky floating strip visible only on phone layout views to jump pages without changing code blocks!
      */}
      <div className="md:hidden fixed bottom-4 inset-x-4 z-40 bg-white/90 dark:bg-ink-900/90 backdrop-blur border border-slate-200 dark:border-ink-800 shadow-2xl rounded-xl p-2 flex items-center justify-around gap-1 overflow-x-auto transition-all duration-300">
        {currentNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `text-[10px] font-bold py-1.5 px-2.5 rounded-lg transition-all ${
                isActive 
                  ? 'bg-brand-orange text-white shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400'
              }`
            }
          >
            {item.label.split(' ')[0]}
          </NavLink>
        ))}
      </div>

      {/* 4. LIVE INTERACTIVE SEARCH MODAL */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] sm:pt-[14vh] px-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm transition-opacity">
          {/* Backdrop Click Closer */}
          <div className="fixed inset-0" onClick={() => setSearchOpen(false)} />
          
          {/* Modal Container Workspace */}
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-2xl p-4 overflow-hidden transition-all transform animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[80vh]">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-ink-800 pb-3">
              <Search className="text-slate-400 dark:text-slate-500 shrink-0" size={20} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search projects (name, ID, state, sector) or jump to pages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                className="w-full bg-transparent text-slate-900 dark:text-white placeholder-slate-400 outline-none font-sans text-base"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-ink-800"
                >
                  Clear
                </button>
              )}
              <button 
                onClick={() => setSearchOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                aria-label="Close search modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick Suggestions / Filter Results Panel List */}
            <div className="mt-3 overflow-y-auto space-y-3 flex-1 pr-1">
              {queryTrim ? (
                <>
                  {matchingProjects.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                        <span>Projects ({matchingProjects.length})</span>
                        <button
                          onClick={handleViewAllInRegistry}
                          className="text-cyan-600 dark:text-cyan-400 hover:underline normal-case font-medium flex items-center gap-1 text-xs cursor-pointer"
                        >
                          View all in registry <ArrowRight size={12} />
                        </button>
                      </div>
                      <div className="space-y-1 mt-1">
                        {matchingProjects.slice(0, 5).map((proj) => (
                          <button
                            key={proj.id}
                            onClick={() => handleSelectProject(proj.id)}
                            className="w-full text-left p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-ink-800/80 border border-transparent hover:border-slate-200 dark:hover:border-ink-700/60 flex items-center justify-between gap-3 group transition-all cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="font-mono text-[11px] px-2 py-1 rounded bg-slate-100 dark:bg-ink-950 text-slate-600 dark:text-slate-400 font-semibold border border-slate-200 dark:border-white/5 shrink-0">
                                {proj.id}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-brand-orange transition-colors">
                                  {proj.name}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate mt-0.5">
                                  <span>{proj.sector}</span>
                                  <span>•</span>
                                  <span className="flex items-center gap-0.5"><MapPin size={10} />{proj.state}</span>
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                                proj.status === 'On Track'
                                  ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                                  : proj.status === 'Watch'
                                  ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                                  : 'bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400'
                              }`}>
                                {proj.status}
                              </span>
                              <ArrowRight size={14} className="text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {matchingPages.length > 0 && (
                    <div>
                      <div className="px-2 py-1 text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                        Pages & Views ({matchingPages.length})
                      </div>
                      <div className="space-y-1 mt-1">
                        {matchingPages.map((page) => {
                          const Icon = page.icon
                          return (
                            <button
                              key={page.to}
                              onClick={() => handleSelectPage(page.to)}
                              className="w-full text-left p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-ink-800/80 border border-transparent hover:border-slate-200 dark:hover:border-ink-700/60 flex items-center justify-between gap-3 group transition-all cursor-pointer"
                            >
                              <div className="flex items-center gap-3">
                                <span className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400">
                                  <Icon size={16} />
                                </span>
                                <div>
                                  <p className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-brand-orange transition-colors">
                                    {page.label}
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                                    {page.description}
                                  </p>
                                </div>
                              </div>
                              <ArrowRight size={14} className="text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {matchingProjects.length === 0 && matchingPages.length === 0 && (
                    <div className="py-8 px-4 text-center">
                      <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 dark:bg-ink-800 flex items-center justify-center text-slate-400 mb-2">
                        <Search size={18} />
                      </div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        No projects or views found matching "{searchQuery}"
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                        Try searching by project ID (e.g. PRJ-0001), state name, ministry, or sector.
                      </p>
                      <button
                        onClick={handleViewAllInRegistry}
                        className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-brand-orange text-white hover:bg-brand-orangeDark transition-colors cursor-pointer"
                      >
                        Search full database in Explorer →
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  {/* Quick Jump Page Links */}
                  <div>
                    <p className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase px-2 mb-1.5">
                      System Views & Pages
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {quickPages.map((page) => {
                        const Icon = page.icon
                        return (
                          <button
                            key={page.to}
                            onClick={() => handleSelectPage(page.to)}
                            className="w-full text-left p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-ink-800/80 border border-transparent hover:border-slate-200 dark:hover:border-ink-700/60 flex items-center justify-between group transition-all cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="p-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 shrink-0">
                                <Icon size={14} />
                              </span>
                              <div className="min-w-0">
                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block truncate group-hover:text-brand-orange transition-colors">
                                  {page.label}
                                </span>
                                <span className="text-[11px] text-slate-400 truncate block">
                                  {page.description}
                                </span>
                              </div>
                            </div>
                            <ArrowRight size={12} className="text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Popular Filters / Sectors */}
                  <div className="pt-1 border-t border-slate-100 dark:border-ink-800">
                    <p className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase px-2 mb-2">
                      Popular Filter Targets
                    </p>
                    <div className="flex flex-wrap gap-1.5 px-2">
                      {popularFilters.map((term) => (
                        <button
                          key={term}
                          onClick={() => setSearchQuery(term)}
                          className="px-2.5 py-1 rounded-lg text-xs bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700 text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-white/5 transition-colors cursor-pointer"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer with Keyboard Shortcuts */}
            <div className="pt-3 mt-2 border-t border-slate-100 dark:border-ink-800 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 px-2">
              <div className="flex items-center gap-3">
                <span>Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-ink-800 font-mono text-[10px] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/5">↵ Enter</kbd> to select</span>
                <span><kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-ink-800 font-mono text-[10px] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/5">Esc</kbd> to close</span>
              </div>
              <span className="hidden sm:inline">Paimana Search Engine</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Page Routing workspace */}
      <main className="mx-auto max-w-[1440px] px-6 py-8">
        <Outlet />
      </main>

      {/* Unified Login Modal for Contractor & Admin */}
      <LoginModal />

    </div>
  )
}
