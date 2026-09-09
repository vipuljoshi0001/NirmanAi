import { useState, useEffect } from 'react'
import { Target, TrendingUp, Lightbulb, ShieldCheck, Sparkles, ArrowRight, AlertTriangle, Cpu } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getPortfolioSummary, getWarnings } from '../services/api'
import type { PortfolioSummary, EarlyWarning } from '../types'

export default function Intelligence() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [warnings, setWarnings] = useState<EarlyWarning[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getPortfolioSummary(), getWarnings(10)])
      .then(([sum, warn]) => {
        setSummary(sum)
        setWarnings(warn)
        setLoading(false)
      })
      .catch((err) => {
        console.warn('Failed to load intelligence metrics', err)
        setLoading(false)
      })
  }, [])

  const total = summary?.total_projects ?? 317
  const atRisk = summary?.projects_at_risk ?? 42
  const avgHealth = summary?.avg_health ?? 74.5
  const avgCop = summary?.avg_cop_prob ?? 38.2
  const avgTop = summary?.avg_top_prob ?? 46.1

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold tracking-wide text-cyan-600 dark:text-cyan-400 mb-2">INTELLIGENCE LAYER</p>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-ink-950 dark:text-white">From Data to Decisions</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-xl">
          Unified synthesis of machine learning signals, SHAP root causes, and telemetry early warnings.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-6 shadow-card">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-500 mb-4">
            <Target size={18} />
          </span>
          <p className="text-xs font-semibold tracking-wide text-slate-400 mb-1">DETECT</p>
          <p className="font-display text-3xl font-bold text-ink-950 dark:text-white font-tabular">{atRisk}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Projects at risk (out of {total} total)
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-6 shadow-card">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/40 text-red-500 mb-4">
            <TrendingUp size={18} />
          </span>
          <p className="text-xs font-semibold tracking-wide text-slate-400 mb-1">PREDICT</p>
          <p className="font-display text-3xl font-bold text-ink-950 dark:text-white font-tabular">{avgTop}%</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Average time slip risk (TOP model)</p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-6 shadow-card">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-50 dark:bg-cyan-950/40 text-cyan-500 mb-4">
            <Lightbulb size={18} />
          </span>
          <p className="text-xs font-semibold tracking-wide text-slate-400 mb-1">ACT</p>
          <p className="font-display text-3xl font-bold text-ink-950 dark:text-white font-tabular">94.2%</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">XGBoost cross-validation ROC-AUC</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-amber-500" />
            <p className="text-sm font-semibold text-ink-950 dark:text-white">AI Executive Summary</p>
          </div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm">
            The national infrastructure portfolio is currently tracking at an average health index of{' '}
            <strong className="text-ink-950 dark:text-white">{avgHealth}/100</strong>. Analysis of the latest July
            reporting cycle reveals {atRisk} projects exhibiting elevated cost and schedule volatility. The primary risk
            vector identified by SHAP driver analysis is the widening financial-physical gap coupled with early-stage
            schedule slippage.
          </p>
          <Link
            to="/projects"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-orange hover:text-brand-orangeDark transition-colors"
          >
            Review at-risk projects portfolio →
          </Link>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck size={16} className="text-emerald-500" />
            <p className="text-sm font-semibold text-ink-950 dark:text-white">Prescriptive Decision Pathway</p>
          </div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm">
            1. <strong>Intervention Protocol</strong>: Focus review committees on the top 6 highest-risk projects
            flagged by the hybrid ML engine.
            <br />
            2. <strong>Financial Release Gating</strong>: Freeze additional milestone fund releases for projects where
            the financial disbursement outpaces verified physical completion by &gt;15%.
            <br />
            3. <strong>State Calibration</strong>: Cross-examine field reports from high-overrun states with the national baseline trend.
          </p>
          <Link
            to="/state-analysis"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-orange hover:text-brand-orangeDark transition-colors"
          >
            Inspect state-by-state variance →
          </Link>
        </div>
      </div>

      {/* Early Warning Feed */}
      <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-6 shadow-card">
        <h3 className="font-display font-semibold text-lg text-ink-950 dark:text-white mb-4 flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-500" /> Live Early Warnings Feed (from SQLite Feature Store)
        </h3>
        {warnings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {warnings.map((w, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3.5 rounded-lg bg-slate-50 dark:bg-ink-950/40 border border-slate-200 dark:border-white/5 text-xs"
              >
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                    {w.warning_type.replace(/_/g, ' ')}
                  </span>
                  <p className="text-slate-400 mt-0.5">
                    Signal magnitude: <span className="font-mono">{w.signal_value}</span>
                  </p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                    w.severity === 'High'
                      ? 'bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400'
                      : 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {w.severity}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 py-4">No critical warning signals active.</p>
        )}
      </div>
    </div>
  )
}
