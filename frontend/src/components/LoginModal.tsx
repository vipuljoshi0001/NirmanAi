import React, { useState, useEffect } from 'react'
import { X, ShieldCheck, HardHat, Building2, CheckCircle2, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getContractors } from '../services/api'
import type { Contractor } from '../types'

export const LoginModal: React.FC = () => {
  const { isLoginModalOpen, setLoginModalOpen, login } = useAuth()
  const [activeTab, setActiveTab] = useState<'contractor' | 'admin'>('contractor')
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [selectedContractorId, setSelectedContractorId] = useState<string>('CNT-LT-01')
  const [customId, setCustomId] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isLoginModalOpen) {
      getContractors()
        .then((data) => {
          if (data && data.length > 0) {
            setContractors(data)
            if (!selectedContractorId) {
              setSelectedContractorId(data[0].contractor_id)
            }
          }
        })
        .catch((err) => console.warn('Failed to load contractors', err))
    }
  }, [isLoginModalOpen])

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

  const handleContractorLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      const cid = customId.trim() || selectedContractorId
      await login('contractor', cid)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleAdminLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      await login('admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin login failed')
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

      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-ink-800 bg-gradient-to-r from-slate-50 to-white dark:from-ink-900 dark:to-ink-850">
          <div>
            <h2 className="font-display font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-orange/10 text-brand-orange">
                <ShieldCheck size={18} />
              </span>
              Paimana Unified Access Portal
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sign in as Contractor to report work progress or as Oversight Admin
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
            onClick={() => { setActiveTab('contractor'); setError(null) }}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'contractor'
                ? 'bg-white dark:bg-ink-800 text-brand-orange dark:text-amber-400 shadow-sm border border-slate-200/80 dark:border-ink-700'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <HardHat size={16} />
            Contractor Portal
          </button>
          <button
            onClick={() => { setActiveTab('admin'); setError(null) }}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-white dark:bg-ink-800 text-cyan-600 dark:text-cyan-400 shadow-sm border border-slate-200/80 dark:border-ink-700'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Building2 size={16} />
            Director General / Admin
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {activeTab === 'contractor' ? (
            <div className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                <HardHat className="text-brand-orange shrink-0 mt-0.5" size={16} />
                <span>
                  Contractors can view their assigned packages, upload physical progress and on-site geotagged photos subject to automated <strong>construction lamina geofencing</strong>.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Select Registered Contractor Persona
                </label>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {contractors.map((c) => {
                    const isSelected = selectedContractorId === c.contractor_id && !customId.trim()
                    return (
                      <button
                        key={c.contractor_id}
                        type="button"
                        onClick={() => {
                          setSelectedContractorId(c.contractor_id)
                          setCustomId('')
                        }}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'border-brand-orange bg-amber-50/50 dark:bg-amber-950/20 shadow-sm'
                            : 'border-slate-200 dark:border-ink-800 hover:border-slate-300 dark:hover:border-ink-700 bg-white dark:bg-ink-850'
                        }`}
                      >
                        <div className="min-w-0 flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-ink-800 text-slate-700 dark:text-slate-300 font-bold text-xs">
                            {c.contractor_id.replace('CNT-', '')}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {c.company_name}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {c.contact_person} • {c.email}
                            </p>
                          </div>
                        </div>
                        {isSelected ? (
                          <CheckCircle2 size={16} className="text-brand-orange shrink-0 ml-2" />
                        ) : (
                          <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                            {c.contractor_id}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-ink-800">
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  Or enter custom Contractor ID:
                </label>
                <input
                  type="text"
                  placeholder="e.g. CNT-LT-01"
                  value={customId}
                  onChange={(e) => setCustomId(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-brand-orange"
                />
              </div>

              <button
                type="button"
                onClick={handleContractorLogin}
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-brand-orange hover:bg-brand-orangeDark text-white text-xs font-bold shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : 'Enter Contractor Portal'}
                <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 text-xs text-cyan-800 dark:text-cyan-300 flex items-start gap-2.5">
                <ShieldCheck className="text-cyan-500 shrink-0 mt-0.5" size={16} />
                <span>
                  Admin login provides ministerial oversight, compliance audits of all contractor geofence submissions, and manual override capabilities.
                </span>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-ink-800 bg-slate-50/50 dark:bg-ink-850 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 text-white font-bold text-sm shadow-md">
                    DG
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Director General
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      National Infrastructure Oversight Authority (Govt of India)
                    </p>
                  </div>
                </div>
                <div className="pt-2 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                  <p>• Full administrative authority over all 300+ monitored projects</p>
                  <p>• Audit log inspection for on-site geofence violations</p>
                  <p>• National capex velocity and ML risk overrides</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAdminLogin}
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs font-bold shadow-md shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : 'Enter as Director General'}
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Public view footnote */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-ink-950 border-t border-slate-100 dark:border-ink-800 text-[11px] text-slate-400 text-center">
          Note: Public national telemetry and data views remain open to all visitors without login.
        </div>
      </div>
    </div>
  )
}
