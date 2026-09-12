import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ShieldCheck, HardHat, Building2, ArrowRight, KeyRound, UserCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export const LoginModal: React.FC = () => {
  const { isLoginModalOpen, setLoginModalOpen, login } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'contractor' | 'admin'>('contractor')
  
  // Contractor login fields
  const [contractorId, setContractorId] = useState<string>('CNT-LT-01')
  const [contractorPassword, setContractorPassword] = useState<string>('contractor123')
  
  // Admin login fields
  const [adminId, setAdminId] = useState<string>('admin')
  const [adminPassword, setAdminPassword] = useState<string>('admin123')
  
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isLoginModalOpen) {
        setLoginModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isLoginModalOpen, setLoginModalOpen])

  if (!isLoginModalOpen) return null

  const handleContractorSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contractorId.trim()) {
      setError('Please enter your Contractor ID')
      return
    }
    if (!contractorPassword) {
      setError('Please enter your password')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await login('contractor', contractorId.trim(), contractorPassword)
      navigate('/contractor')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adminId.trim()) {
      setError('Please enter your Admin ID')
      return
    }
    if (!adminPassword) {
      setError('Please enter your admin password')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await login('admin', adminId.trim(), adminPassword)
      navigate('/admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="fixed inset-0" 
        onClick={() => setLoginModalOpen(false)} 
        aria-hidden="true" 
      />

      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-ink-800 bg-gradient-to-r from-slate-50 to-white dark:from-ink-900 dark:to-ink-850">
          <div>
            <h2 className="font-display font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-orange/10 text-brand-orange">
                <ShieldCheck size={18} />
              </span>
              Paimana Portal Login
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Secure credential-based authentication for Contractors & Admin
            </p>
          </div>
          <button
            onClick={() => setLoginModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-ink-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Role Tabs */}
        <div className="flex border-b border-slate-200 dark:border-ink-800 bg-slate-50/50 dark:bg-ink-950/40 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => { setActiveTab('contractor'); setError(null) }}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'contractor'
                ? 'bg-white dark:bg-ink-800 text-brand-orange dark:text-amber-400 shadow-sm border border-slate-200/80 dark:border-ink-700'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <HardHat size={16} />
            Contractor Sign In
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('admin'); setError(null) }}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-white dark:bg-ink-800 text-cyan-600 dark:text-cyan-400 shadow-sm border border-slate-200/80 dark:border-ink-700'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Building2 size={16} />
            Admin Panel Login
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          {activeTab === 'contractor' ? (
            <form onSubmit={handleContractorSubmit} className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                <HardHat className="text-brand-orange shrink-0 mt-0.5" size={16} />
                <span>
                  Contractors must sign in with their assigned <strong>Contractor ID & Password</strong> to submit on-site progress, photos, and access assigned packages.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Contractor ID
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <UserCheck size={16} />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CNT-LT-01"
                    value={contractorId}
                    onChange={(e) => setContractorId(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Contractor Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <KeyRound size={16} />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="Enter password"
                    value={contractorPassword}
                    onChange={(e) => setContractorPassword(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange"
                  />
                </div>
              </div>

              {/* Demo Quick-Fill Chips */}
              <div className="pt-1">
                <p className="text-[11px] text-slate-400 mb-1.5">Quick demo credentials:</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'L&T', id: 'CNT-LT-01' },
                    { label: 'Afcons', id: 'CNT-AF-02' },
                    { label: 'Tata', id: 'CNT-TP-03' },
                    { label: 'Dilip', id: 'CNT-DB-04' },
                    { label: 'MEIL', id: 'CNT-ME-05' },
                  ].map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => {
                        setContractorId(chip.id)
                        setContractorPassword('contractor123')
                        setError(null)
                      }}
                      className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-amber-950/40 hover:text-brand-orange transition-colors cursor-pointer"
                    >
                      {chip.label} ({chip.id})
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-brand-orange hover:bg-brand-orangeDark text-white text-xs font-bold shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
              >
                {loading ? 'Verifying Credentials...' : 'Sign In as Contractor'}
                <ArrowRight size={14} />
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 text-xs text-cyan-800 dark:text-cyan-300 flex items-start gap-2.5">
                <ShieldCheck className="text-cyan-500 shrink-0 mt-0.5" size={16} />
                <span>
                  Admin login provides ministerial access to the dedicated <strong>Admin Panel</strong> for project registration, geofence definitions, and state package assignments.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Admin Username / ID
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <UserCheck size={16} />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="admin or ADM-DG-01"
                    value={adminId}
                    onChange={(e) => setAdminId(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Admin Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <KeyRound size={16} />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="Enter admin password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              {/* Demo Quick-Fill */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setAdminId('admin')
                    setAdminPassword('admin123')
                    setError(null)
                  }}
                  className="px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-slate-300 hover:bg-cyan-100 dark:hover:bg-cyan-950/40 hover:text-cyan-600 transition-colors cursor-pointer"
                >
                  Quick Demo: admin / admin123
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs font-bold shadow-md shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
              >
                {loading ? 'Verifying Admin Credentials...' : 'Sign In as Oversight Admin'}
                <ArrowRight size={14} />
              </button>
            </form>
          )}
        </div>

        {/* Public view footnote */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-ink-950 border-t border-slate-100 dark:border-ink-800 text-[11px] text-slate-400 text-center">
          Public national telemetry and data views remain accessible to all visitors without login.
        </div>
      </div>
    </div>
  )
}
