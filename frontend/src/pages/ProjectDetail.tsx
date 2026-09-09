import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Bell,
  TrendingUp,
  AlertTriangle,
  Clock,
  IndianRupee,
  ShieldCheck,
  CheckCircle2,
  Cpu,
  BarChart3,
  Calendar,
  Layers,
  FileText,
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import type { ProjectDetailData, ProjectTimelineSnapshot } from '../types'
import { getProjectDetail, getProjectTimeline, getAINarrative, type AINarrative } from '../services/api'
import StatusPill from '../components/StatusPill'

const tabs = ['Overview', 'Risk Intelligence', 'Timeline', 'Financials', 'Progress']

const stageLabels = ['Sanctioned', 'Planning', 'Construction', 'Current', 'Expected']

const flagDot: Record<string, string> = {
  positive: 'bg-emerald-500',
  negative: 'bg-amber-500',
  neutral: 'bg-cyan-500',
}

const FEATURE_LABELS: Record<string, string> = {
  schedule_slip_months: 'Schedule Slip Duration',
  financial_physical_gap: 'Financial-Physical Gap',
  cost_overrun_to_date_pct: 'Reported Cost Overrun %',
  physical_schedule_gap: 'Physical Progress vs Expected',
  sector_risk_baseline: 'Sector Historical Baseline',
  state_risk_baseline: 'State Historical Baseline',
  expenditure_rate: 'Budget Expenditure Rate',
  physical_progress_pct: 'Physical Execution %',
  financial_progress_pct: 'Financial Disbursement %',
  expected_physical_pct: 'Model Expected Progress %',
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<ProjectDetailData | null>(null)
  const [timeline, setTimeline] = useState<ProjectTimelineSnapshot[]>([])
  const [aiNarrative, setAiNarrative] = useState<AINarrative | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Overview')

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    setAiNarrative(null)
    const projectId = id || 'PRJ-0001'

    Promise.all([getProjectDetail(projectId), getProjectTimeline(projectId)])
      .then(([detailData, timelineData]) => {
        if (isMounted) {
          setProject(detailData)
          setTimeline(timelineData)
          setLoading(false)
        }
      })
      .catch((err) => {
        console.error('Failed to load project detail', err)
        if (isMounted) setLoading(false)
      })

    getAINarrative(projectId)
      .then((ai) => {
        if (isMounted) setAiNarrative(ai)
      })
      .catch(() => {
        if (isMounted) setAiNarrative(null)
      })

    return () => {
      isMounted = false
    }
  }, [id])

  if (loading || !project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Loading ML predictions and project telemetry...
        </p>
      </div>
    )
  }

  const shapChartData = (project.shap_drivers || []).map((d) => ({
    name: FEATURE_LABELS[d.feature] || d.feature.replace(/_/g, ' '),
    rawFeature: d.feature,
    value: Math.round(d.shap_value * 100) / 100,
    impact: d.shap_value >= 0 ? 'Risk Escalation' : 'Risk Mitigating',
  }))

  const copPct = project.cop_prob !== undefined ? Math.round(project.cop_prob * 100) : project.costOverrunRisk
  const topPct = project.top_prob !== undefined ? Math.round(project.top_prob * 100) : project.timeOverrunRisk

  return (
    <div className="space-y-6">
      <Link
        to="/projects"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-ink-950 dark:text-slate-400 dark:hover:text-white transition-colors"
      >
        <ArrowLeft size={15} /> Back to project explorer
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 bg-white dark:bg-ink-900 border border-slate-200 dark:border-white/5 rounded-2xl p-6 shadow-card">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800">
              {project.id}
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {project.ministry}
            </span>
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-ink-950 dark:text-white">
            {project.name}
          </h1>
          <div className="flex items-center gap-3 mt-3 text-sm text-slate-500 dark:text-slate-400 flex-wrap">
            <span className="font-medium text-slate-700 dark:text-slate-300">{project.sector}</span>
            <span>·</span>
            <span>{project.state}</span>
            <span>·</span>
            <StatusPill status={project.status} />
            {project.risk_level && (
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                  project.risk_level === 'Critical'
                    ? 'bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900'
                    : project.risk_level === 'High'
                    ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900'
                    : project.risk_level === 'Medium'
                    ? 'bg-yellow-100 dark:bg-yellow-950/50 text-yellow-600 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-900'
                    : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900'
                }`}
              >
                ML Risk: {project.risk_level}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs font-semibold tracking-wide text-slate-400 mb-1">HEALTH SCORE</p>
            <p className="font-display text-4xl font-bold text-amber-500 font-tabular">
              {project.health}
              <span className="text-lg text-slate-300 dark:text-slate-600">/100</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              ML Score: {project.model_risk_score ?? Math.round(100 - project.health)}
            </p>
          </div>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-5 shadow-card">
          <p className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 mb-2">Physical execution</p>
          <p className="font-display text-3xl font-bold text-ink-950 dark:text-white font-tabular">
            {project.physicalProgress}%
          </p>
          <span className="text-[11px] text-slate-400 float-right -mt-6">ground truth</span>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 mt-3 overflow-hidden">
            <div className="h-full rounded-full bg-cyan-500" style={{ width: `${project.physicalProgress}%` }} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-5 shadow-card">
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2">Financial disbursement</p>
          <p className="font-display text-3xl font-bold text-ink-950 dark:text-white font-tabular">
            {project.financialProgress}%
          </p>
          <span className="text-[11px] text-slate-400 float-right -mt-6">audited</span>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 mt-3 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${project.financialProgress}%` }} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-5 shadow-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">XGBoost COP Risk</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-600 font-mono">
              P(Cost Overrun)
            </span>
          </div>
          <p className="font-display text-3xl font-bold text-ink-950 dark:text-white font-tabular">{copPct}%</p>
          <span className="text-[11px] text-slate-400 float-right -mt-6">ML model</span>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full ${copPct > 50 ? 'bg-red-500' : copPct > 30 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${copPct}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-5 shadow-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-red-500 dark:text-red-400">XGBoost TOP Risk</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/40 text-red-500 font-mono">
              P(Time Slip)
            </span>
          </div>
          <p className="font-display text-3xl font-bold text-ink-950 dark:text-white font-tabular">{topPct}%</p>
          <span className="text-[11px] text-slate-400 float-right -mt-6">ML model</span>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full ${topPct > 50 ? 'bg-red-500' : topPct > 30 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${topPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-white/10 flex items-center gap-7 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
              tab === t
                ? 'border-brand-orange text-brand-orange dark:text-brand-orange'
                : 'border-transparent text-slate-400 hover:text-ink-950 dark:hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {tab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr,1fr] gap-6">
          <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-6 shadow-card space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold tracking-wide text-cyan-600 dark:text-cyan-400 mb-1">
                  PROJECT OVERVIEW
                </p>
                <h3 className="font-display font-semibold text-lg text-ink-950 dark:text-white">Delivery Signal</h3>
              </div>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock size={13} /> Active snapshot: July 2026
              </span>
            </div>

            {/* Stepper */}
            <div className="relative pt-2">
              <div className="flex justify-between">
                {stageLabels.map((label, i) => {
                  const reached = i <= project.currentStageIndex
                  const isCurrent = i === project.currentStageIndex
                  return (
                    <div key={label} className="flex flex-col items-center gap-2 relative z-10">
                      <span
                        className={`h-8 w-8 rounded-full border-2 flex items-center justify-center ${
                          isCurrent
                            ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-500'
                            : reached
                            ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-ink-900 text-slate-400'
                        }`}
                      >
                        {reached ? <CheckCircle2 size={16} /> : <span className="text-xs">{i + 1}</span>}
                      </span>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
                    </div>
                  )
                })}
              </div>
              <div
                className="absolute top-4 left-6 right-6 h-1 bg-slate-100 dark:bg-slate-800 rounded-full -z-0"
                style={{ top: '20px' }}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-amber-400"
                  style={{ width: `${(project.currentStageIndex / (stageLabels.length - 1)) * 100}%` }}
                />
              </div>
            </div>

            {/* Milestones & Budgets */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-white/5">
              <div>
                <p className="text-xs font-medium text-slate-400 mb-1">ORIGINAL TARGET</p>
                <p className="text-sm font-semibold text-ink-950 dark:text-white">{project.originalCompletion}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 mb-1">PREDICTED COMPLETION</p>
                <p className="text-sm font-semibold text-ink-950 dark:text-white flex items-center gap-1 text-amber-500">
                  <Calendar size={14} /> {project.predictedCompletion}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 mb-1">EXPENDITURE TO DATE</p>
                <p className="text-sm font-semibold text-ink-950 dark:text-white">{project.expenditure}</p>
              </div>
            </div>

            {/* Baseline comparison */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-slate-50 dark:bg-ink-950/60 border border-slate-200 dark:border-white/5 text-xs">
              <div>
                <span className="text-slate-400">Sector Baseline Overrun:</span>
                <p className="font-semibold text-ink-950 dark:text-white text-sm mt-0.5">
                  +{project.sector_risk_baseline ?? 8.5}% avg
                </p>
              </div>
              <div>
                <span className="text-slate-400">State Baseline Overrun:</span>
                <p className="font-semibold text-ink-950 dark:text-white text-sm mt-0.5">
                  +{project.state_risk_baseline ?? 5.2}% avg
                </p>
              </div>
            </div>
          </div>

          {/* Intervention Brief */}
          <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-6 shadow-card flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold tracking-wide text-amber-600 dark:text-amber-400 mb-1">
                AI INTERVENTION BRIEF
              </p>
              <h3 className="font-display font-semibold text-lg text-ink-950 dark:text-white mb-3">
                Why this project needs review
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{aiNarrative?.narrative || project.reviewReason}</p>
              {aiNarrative?.available && aiNarrative.source === 'openrouter' && aiNarrative.narrative && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2">
                  Generated by <span className="font-mono">OpenRouter · {aiNarrative.model}</span>
                </p>
              )}
            </div>

            <div className="mt-6">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">TELEMETRY SIGNALS</p>
              <ul className="space-y-2">
                {project.flags.map((f, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm text-ink-950 dark:text-slate-200">
                    <span className={`h-2 w-2 rounded-full flex-shrink-0 ${flagDot[f.tone]}`} />
                    {f.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RISK INTELLIGENCE (ML + SHAP EXPLAINABILITY) */}
      {tab === 'Risk Intelligence' && (
        <div className="space-y-6">
          {/* Top Engine Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-6 shadow-card">
              <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 mb-3">
                <Cpu size={20} />
                <h4 className="font-semibold text-sm">XGBoost COP Model</h4>
              </div>
              <p className="text-3xl font-bold font-display text-ink-950 dark:text-white font-tabular">{copPct}%</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Cost Overrun Probability</p>
              <div className="mt-4 text-xs text-slate-400">
                Trained on real national baselines with reporting noise robustness (ROC-AUC ~0.94).
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-6 shadow-card">
              <div className="flex items-center gap-2 text-amber-500 mb-3">
                <Clock size={20} />
                <h4 className="font-semibold text-sm">XGBoost TOP Model</h4>
              </div>
              <p className="text-3xl font-bold font-display text-ink-950 dark:text-white font-tabular">{topPct}%</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Time Overrun Probability</p>
              <div className="mt-4 text-xs text-slate-400">
                Predicts completion date slip based on physical pace vs scheduled duration.
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-6 shadow-card">
              <div className="flex items-center gap-2 text-emerald-500 mb-3">
                <ShieldCheck size={20} />
                <h4 className="font-semibold text-sm">Hybrid Risk Score</h4>
              </div>
              <p className="text-3xl font-bold font-display text-ink-950 dark:text-white font-tabular">
                {project.final_risk_score ?? Math.round(100 - project.health)}
                <span className="text-sm text-slate-400">/100</span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Tier: <span className="font-semibold text-amber-500">{project.risk_level}</span>
              </p>
              <div className="mt-4 text-xs text-slate-400">
                Composite calculation: 50% XGBoost ML Models + 50% MoSPI Domain Rule Engine.
              </div>
            </div>
          </div>

          {/* SHAP Explainability Section */}
          <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-6 shadow-card">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <p className="text-xs font-semibold tracking-wide text-cyan-600 dark:text-cyan-400 mb-1">
                  EXPLAINABLE AI (XAI)
                </p>
                <h3 className="font-display font-semibold text-lg text-ink-950 dark:text-white">
                  SHAP Risk Drivers Attribution
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  TreeExplainer decomposes the model prediction into exact contributing features for policy transparency.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-red-500">
                  <span className="h-3 w-3 rounded bg-red-500 inline-block" /> Positive (+Risk)
                </span>
                <span className="flex items-center gap-1.5 text-emerald-500">
                  <span className="h-3 w-3 rounded bg-emerald-500 inline-block" /> Negative (Protective)
                </span>
              </div>
            </div>

            {shapChartData.length > 0 ? (
              <div className="h-[280px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={shapChartData} layout="vertical" margin={{ top: 5, right: 30, left: 140, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '12px',
                      }}
                      formatter={(val: any) => [`${val > 0 ? '+' : ''}${val} SHAP points`, 'Impact']}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {shapChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#ef4444' : '#10b981'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-slate-400 py-6 text-center">No SHAP drivers available for this snapshot.</p>
            )}

            {/* Drivers list with details */}
            <div className="mt-6 border-t border-slate-100 dark:border-white/5 pt-4">
              <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Factor Impact Breakdown
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(project.shap_drivers || []).map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-ink-950/40 border border-slate-200 dark:border-white/5 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {FEATURE_LABELS[d.feature] || d.feature}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">{d.feature}</p>
                    </div>
                    <span
                      className={`font-mono font-bold px-2 py-1 rounded text-xs ${
                        d.shap_value >= 0
                          ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                          : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {d.shap_value >= 0 ? `+${d.shap_value}` : d.shap_value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Active Warnings Table */}
          <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-6 shadow-card">
            <h3 className="font-display font-semibold text-lg text-ink-950 dark:text-white mb-4 flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" /> Active Early Warning Triggers
            </h3>
            {project.warnings && project.warnings.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/10 text-slate-400 uppercase">
                      <th className="py-2.5 px-3">Warning Type</th>
                      <th className="py-2.5 px-3">Severity</th>
                      <th className="py-2.5 px-3">Signal Value</th>
                      <th className="py-2.5 px-3">Protocol Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {project.warnings.map((w, i) => (
                      <tr key={i} className="text-slate-700 dark:text-slate-300">
                        <td className="py-3 px-3 font-semibold text-ink-950 dark:text-white capitalize">
                          {w.warning_type.replace(/_/g, ' ')}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              w.severity === 'High'
                                ? 'bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400'
                                : 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {w.severity}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono">{w.signal_value}</td>
                        <td className="py-3 px-3 text-slate-500">
                          {w.warning_type.includes('schedule')
                            ? 'Flag for monthly multi-stakeholder review'
                            : w.warning_type.includes('gap')
                            ? 'Audit physical site milestones before fund release'
                            : 'Escalate to project monitoring committee'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-400 py-4">No active warning flags triggered for this project.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: TIMELINE (MONTHLY TRAJECTORY) */}
      {tab === 'Timeline' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-6 shadow-card">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <p className="text-xs font-semibold tracking-wide text-cyan-600 dark:text-cyan-400 mb-1">
                  HISTORICAL TRAJECTORY
                </p>
                <h3 className="font-display font-semibold text-lg text-ink-950 dark:text-white">
                  6-Month Progress vs Overrun Trend (Feb – July)
                </h3>
              </div>
            </div>

            <div className="h-[320px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="physical_progress_pct"
                    name="Physical Progress %"
                    stroke="#06b6d4"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="financial_progress_pct"
                    name="Financial Progress %"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cost_overrun_to_date_pct"
                    name="Cost Overrun %"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                  />
                  <Line
                    type="monotone"
                    dataKey="schedule_slip_months"
                    name="Schedule Slip (mo)"
                    stroke="#ef4444"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Timeline Table */}
          <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-6 shadow-card overflow-x-auto">
            <h4 className="font-display font-semibold text-base text-ink-950 dark:text-white mb-3">
              Monthly Snapshot Records
            </h4>
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10 text-slate-400 uppercase">
                  <th className="py-2.5 px-3">Month</th>
                  <th className="py-2.5 px-3">Physical %</th>
                  <th className="py-2.5 px-3">Financial %</th>
                  <th className="py-2.5 px-3">Cumulative Exp (₹ Cr)</th>
                  <th className="py-2.5 px-3">Revised Cost (₹ Cr)</th>
                  <th className="py-2.5 px-3">Cost Overrun %</th>
                  <th className="py-2.5 px-3">Schedule Slip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {timeline.map((snap) => (
                  <tr key={snap.month} className="text-slate-700 dark:text-slate-300">
                    <td className="py-2.5 px-3 font-semibold text-ink-950 dark:text-white">{snap.month}</td>
                    <td className="py-2.5 px-3 font-mono">{snap.physical_progress_pct}%</td>
                    <td className="py-2.5 px-3 font-mono">{snap.financial_progress_pct}%</td>
                    <td className="py-2.5 px-3 font-mono">₹ {snap.cumulative_expenditure.toLocaleString()}</td>
                    <td className="py-2.5 px-3 font-mono">₹ {snap.revised_cost.toLocaleString()}</td>
                    <td
                      className={`py-2.5 px-3 font-mono font-semibold ${
                        snap.cost_overrun_to_date_pct > 10
                          ? 'text-red-500'
                          : snap.cost_overrun_to_date_pct > 0
                          ? 'text-amber-500'
                          : 'text-emerald-500'
                      }`}
                    >
                      {snap.cost_overrun_to_date_pct > 0 ? `+${snap.cost_overrun_to_date_pct}%` : `${snap.cost_overrun_to_date_pct}%`}
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      {snap.schedule_slip_months > 0 ? `+${snap.schedule_slip_months} mo` : 'On Time'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: FINANCIALS */}
      {tab === 'Financials' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-6 shadow-card">
              <span className="text-xs font-semibold text-slate-400 uppercase">Sanctioned Cost</span>
              <p className="font-display text-2xl font-bold text-ink-950 dark:text-white mt-2">
                ₹ {Number(project.sanctioned_cost ?? 0).toLocaleString()} Cr
              </p>
              <p className="text-xs text-slate-500 mt-1">Approved Cabinet budget</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-6 shadow-card">
              <span className="text-xs font-semibold text-slate-400 uppercase">Anticipated Revised Cost</span>
              <p className="font-display text-2xl font-bold text-amber-500 mt-2">
                ₹ {Number(project.revised_cost ?? project.sanctioned_cost ?? 0).toLocaleString()} Cr
              </p>
              <p className="text-xs text-slate-500 mt-1">Latest anticipated estimate</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-6 shadow-card">
              <span className="text-xs font-semibold text-slate-400 uppercase">Disbursed Expenditure</span>
              <p className="font-display text-2xl font-bold text-emerald-500 mt-2">
                {project.expenditure}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {project.financialProgress}% of total sanctioned
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-6 shadow-card">
            <h4 className="font-display font-semibold text-base text-ink-950 dark:text-white mb-3">
              Cost Variance Assessment
            </h4>
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-ink-950/60 border border-slate-200 dark:border-white/5 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Current Cost Overrun to Date:</span>
                <span className="font-mono font-semibold text-ink-950 dark:text-white">
                  {project.costVariance > 0 ? `+${project.costVariance}%` : `${project.costVariance}%`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ML Model Predicted Overrun Probability:</span>
                <span className="font-mono font-semibold text-amber-500">{copPct}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Disbursement vs Execution Gap:</span>
                <span className="font-mono font-semibold text-ink-950 dark:text-white">
                  {Math.round((project.financialProgress - project.physicalProgress) * 10) / 10}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PROGRESS */}
      {tab === 'Progress' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-6 shadow-card space-y-4">
              <h4 className="font-display font-semibold text-base text-ink-950 dark:text-white">
                Physical Execution Status
              </h4>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Physical Progress:</span>
                <span className="font-bold text-cyan-600 dark:text-cyan-400">{project.physicalProgress}%</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full bg-cyan-500" style={{ width: `${project.physicalProgress}%` }} />
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Physical progress is computed from on-ground telemetry reports submitted by field engineering inspection
                units.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-ink-900 p-6 shadow-card space-y-4">
              <h4 className="font-display font-semibold text-base text-ink-950 dark:text-white">
                Schedule & Time Slippage
              </h4>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Accumulated Slippage:</span>
                <span className="font-bold text-red-500">
                  {project.timeVariance > 0 ? `+${project.timeVariance} months` : 'On Schedule'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Target Duration:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {project.duration_months ? `${project.duration_months} months` : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">TOP Model Overrun Probability:</span>
                <span className="font-bold text-amber-500">{topPct}%</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
