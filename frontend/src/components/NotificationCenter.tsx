import React, { useState, useEffect } from 'react'
import { X, CheckCircle2, AlertTriangle, ShieldCheck, HardHat, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getNotifications } from '../services/api'

interface NotificationItem {
  id: string
  submission_id?: string
  project_id: string
  contractor_id?: string
  contractor_name?: string
  title: string
  message: string
  status: 'approved' | 'not_approved'
  tone: 'green' | 'red' | 'cyan'
  time: string
  progress?: number
}

export default function NotificationCenter({ onClose }: { onClose: () => void }) {
  const { user, role } = useAuth()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotifs = () => {
    if (role === 'guest') {
      setNotifications([])
      setLoading(false)
      return
    }
    setLoading(true)
    getNotifications(role, user?.id)
      .then((data) => {
        setNotifications(data.notifications || [])
      })
      .catch((err) => console.warn('Failed to load notifications', err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchNotifs()
  }, [role, user?.id])

  return (
    <div className="absolute right-0 top-12 w-96 rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-[80vh]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-ink-800 bg-slate-50/70 dark:bg-ink-950/60">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-display font-bold text-sm text-slate-900 dark:text-white">
              {role === 'admin' ? 'National Audit Stream' : 'Submitted Report Updates'}
            </p>
            <span className="flex h-5 px-1.5 items-center justify-center rounded-full text-[10px] font-bold bg-amber-500/10 text-brand-orange">
              {notifications.length}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {role === 'admin'
              ? 'On-site photo submissions & geofence audit flags'
              : 'Status of your submitted work progress reports'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={fetchNotifs}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-ink-800 transition-colors"
            title="Refresh"
            aria-label="Refresh notifications"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-ink-800 transition-colors"
            aria-label="Close notifications"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-ink-800">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-orange border-t-transparent" />
            <span>Loading telemetry notifications...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <ShieldCheck size={28} className="text-slate-300 dark:text-ink-700" />
            <p className="font-semibold text-slate-600 dark:text-slate-400">All submissions up to date</p>
            <p className="text-[11px] text-slate-400">New reports submitted via contractor portal will appear here.</p>
          </div>
        ) : (
          notifications.map((n) => {
            const isApproved = n.status === 'approved'
            return (
              <div
                key={n.id}
                className={`p-4 transition-colors hover:bg-slate-50 dark:hover:bg-ink-850/50 ${
                  !isApproved ? 'bg-rose-50/30 dark:bg-rose-950/10' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      isApproved
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {isApproved ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {n.title}
                      </p>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          isApproved
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {isApproved ? 'APPROVED' : 'NOT APPROVED'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-1.5">
                      {n.message}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>Project: {n.project_id}</span>
                      <span>{n.time ? n.time.split('T')[0] : 'Today'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 bg-slate-50 dark:bg-ink-950 border-t border-slate-100 dark:border-ink-800 text-[11px] text-slate-400 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          {role === 'admin' ? <ShieldCheck size={12} /> : <HardHat size={12} />}
          {role === 'admin' ? 'Oversight Stream' : `Contractor ${user?.id || ''}`}
        </span>
        <span className="text-[10px] text-slate-400">Automated Geofence Engine</span>
      </div>
    </div>
  )
}
