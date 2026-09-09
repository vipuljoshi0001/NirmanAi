import React, { useState, useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Search, Bell, Moon, Sun, ChevronDown, X } from 'lucide-react'
import NotificationCenter from './NotificationCenter'
import paimanaLogo from '../assests/paimana-logo.png'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/projects', label: 'Projects' },
  { to: '/map', label: 'Project Map' },
  { to: '/intelligence', label: 'Intelligence' },
  { to: '/state-analysis', label: 'State Analysis' },
  { to: '/reports', label: 'Reports' },
]

interface LayoutProps {
  darkMode: boolean
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>
}

export default function Layout({ darkMode, setDarkMode }: LayoutProps) {
  const [notifOpen, setNotifOpen] = useState(false)
  // 1. STATE TO TRACK SEARCH OVERLAY POPUP VISIBILITY
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // 2. LISTEN FOR ⌘K KEYBOARD COMMAND SHORTCUT TO TRIGGER OPENING
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="min-h-screen bg-[#f7f8fa] dark:bg-ink-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 overflow-x-hidden">
      
      {/* Floating Header Spacer - Fixed padding constraints on mobile layouts */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 pt-4 sticky top-0 z-40">
        
        {/* Navigation Header Panel - Made shape, height, and content flexible on small screens */}
        <header className="rounded-2xl sm:rounded-full shadow-[0_4px_20px_rgba(15,20,32,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] border border-white/50 dark:border-ink-800 bg-gradient-to-r from-amber-500/10 via-white/95 to-emerald-500/10 dark:from-amber-600/10 dark:via-ink-900/95 dark:to-emerald-600/10 backdrop-blur px-4 sm:px-8 h-16 flex items-center justify-between transition-all duration-300">
          
          <div className="flex items-center gap-3 md:gap-6 min-w-0">
            {/* Logo Wrapper Container - Scaled down image footprint to prevent cutting off on mobile */}
            <a href="/" className="flex flex-col items-center justify-center select-none group min-w-[100px] sm:min-w-[150px] lg:min-w-[200px]">
              <img 
                src={paimanaLogo} 
                alt="Paimana Logo" 
                className="h-7 sm:h-10 w-auto object-contain dark:brightness-110 transition-all duration-200"
              />
              <span className="block text-[6px] sm:text-[8px] font-bold tracking-[0.12em] sm:tracking-[0.18em] text-slate-400 dark:text-slate-500 mt-1 leading-none text-center">
                NATIONAL MONITORING DASHBOARD
              </span>
            </a>
            
            {/* Desktop Navigation Menu (hidden on mobile devices) */}
            <nav className="hidden md:flex items-center gap-4 lg:gap-6 overflow-x-auto whitespace-nowrap">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
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
          <div className="flex items-center gap-2 sm:dark:gap-4">
            
            {/* 3. INTERACTIVE SEARCH TRIGGER BUTTON */}
            <button 
              onClick={() => setSearchOpen(true)}
              className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200 dark:border-ink-700 bg-white/50 dark:bg-ink-950/40 px-4 py-1.5 text-sm text-slate-400 hover:border-slate-300 dark:hover:border-ink-600 transition-colors cursor-pointer"
            >
              <Search size={14} />
              <span>Search</span>
              <span className="ml-4 text-[10px] text-slate-300 dark:text-slate-600 font-mono">⌘K</span>
            </button>

            {/* Mobile-only icon-only search button trigger layout fallback block */}
            <button 
              onClick={() => setSearchOpen(true)}
              className="flex sm:hidden text-slate-500 dark:text-slate-400 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-ink-800"
              aria-label="Search"
            >
              <Search size={16} />
            </button>

            {/* Theme Toggle Button */}
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-full bg-white/60 dark:bg-ink-800/60 border border-slate-200/60 dark:border-ink-700/60 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-700 transition-all shadow-sm" 
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} />}
            </button>

            {/* Notification Center */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative text-slate-500 dark:text-slate-400 p-2 rounded-full bg-white/60 dark:bg-ink-800/60 border border-slate-200/60 dark:border-ink-700/60 shadow-sm"
                aria-label="Notifications"
              >
                <Bell size={16} />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand-orange " />
              </button>
              {notifOpen && <NotificationCenter onClose={() => setNotifOpen(false)} />}
            </div>
            
            {/* User Profile - Scaled text away on mobile so it stays inside container slots */}
            <button className="flex items-center gap-2 pl-2 pr-1 py-1 sm:pl-3 rounded-full border border-slate-200/60 dark:border-ink-700/60 bg-white/40 dark:bg-ink-800/40">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-white text-xs font-bold shadow-sm">
                DG
              </span>
              <span className="hidden lg:block text-left leading-tight pr-1">
                <span className="block text-xs font-bold text-ink-950 dark:text-white">Director General</span>
              </span>
              <ChevronDown size={12} className="text-slate-400 dark:text-slate-500 hidden lg:block mr-1" />
            </button>
          </div>

        </header>
      </div>

      {/* 
        MOBILE HAMBURGER DRAWER SYSTEM:
        Sticky floating strip visible only on phone layout views to jump pages without changing code blocks!
      */}
      <div className="md:hidden fixed bottom-4 inset-x-4 z-40 bg-white/90 dark:bg-ink-900/90 backdrop-blur border border-slate-200 dark:border-ink-800 shadow-2xl rounded-xl p-2 flex items-center justify-around gap-1 overflow-x-auto transition-all duration-300">
        {navItems.map((item) => (
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
            {item.label.split(' ')[0]} {/* Shortens text names down to single strings */}
          </NavLink>
        ))}
      </div>


      {/* 4. THE LIVE SEARCH MODAL POPUP WRAPPER */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-slate-900/40 backdrop-blur-sm transition-opacity">
          {/* Backdrop Click Closer Rule */}
          <div className="fixed inset-0" onClick={() => setSearchOpen(false)} />
          
          {/* Modal Container Workspace */}
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-2xl p-4 overflow-hidden transition-all transform animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-ink-800 pb-3">
              <Search className="text-slate-400 dark:text-slate-500" size={20} />
              <input
                type="text"
                autoFocus
                placeholder="Search infrastructure projects, sector data, intelligence maps..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-slate-900 dark:text-white placeholder-slate-400 outline-none font-sans text-base"
              />
              <button 
                onClick={() => setSearchOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick Suggestions / Filter Results Panel List */}
            <div className="mt-4 max-h-[300px] overflow-y-auto">
              {searchQuery ? (
                <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
                  Searching for <span className="font-semibold text-brand-orange">"{searchQuery}"</span> across MoSPI project grids...
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase px-2">Recent Hotkeys & Targets</p>
                  <button className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-ink-800 flex items-center justify-between group">
                    <span>↗ View Infrastructure Cost Exposures</span>
                    <span className="text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">Jump to page ›</span>
                  </button>
                  <button className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-ink-800 flex items-center justify-between group">
                    <span>↗ AI Risk Forecast Models</span>
                    <span className="text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">Jump to page ›</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Page Routing workspace */}
      <main className="mx-auto max-w-[1440px] px-6 py-8">
        <Outlet />
      </main>

    </div>
  )
}
