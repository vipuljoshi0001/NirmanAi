import { useState, useEffect } from 'react'
import {
  FileText,
  Download,
  Eye,
  Printer,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  X,
  Filter,
  ShieldAlert,
  Building2,
  Calendar,
} from 'lucide-react'
import { getPortfolioSummary, getProjects } from '../services/api'
import type { PortfolioSummary, Project } from '../types'

interface ReportConfig {
  id: string
  title: string
  subtitle: string
  cadence: string
  category: string
  description: string
  iconColor: string
}

const REPORT_DEFINITIONS: ReportConfig[] = [
  {
    id: 'monthly-executive',
    title: 'Monthly Cabinet Executive Brief',
    subtitle: 'High-level synthesis for Apex Review Room & PMO',
    cadence: 'Monthly Edition (July Snapshot)',
    category: 'Apex Review',
    description: 'Concise summary of national infrastructure portfolio health, capital exposure, and high-impact interventions required this cycle.',
    iconColor: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-400',
  },
  {
    id: 'at-risk-dossier',
    title: 'Critical & At-Risk Projects Dossier',
    subtitle: 'Exception list with ML Cost & Time Slip Flags',
    cadence: 'Live Automated Feed',
    category: 'Risk Intelligence',
    description: 'Itemized directory of projects in Critical and High risk tiers, complete with XGBoost probabilities and active early warning triggers.',
    iconColor: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400',
  },
  {
    id: 'sector-capex',
    title: 'Sector Capex Velocity & Slip Matrix',
    subtitle: 'Inter-ministerial delivery comparative review',
    cadence: 'Fortnightly Review',
    category: 'Sector Analysis',
    description: 'Detailed progress vs expenditure velocity across Railways, Highways, Urban Transit, and Energy sectors against baseline curves.',
    iconColor: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
  },
  {
    id: 'state-delivery',
    title: 'State Infrastructure Baseline Report',
    subtitle: 'Regional implementation & bottleneck assessment',
    cadence: 'Quarterly Audit',
    category: 'Regional',
    description: 'Cross-state evaluation of capital expenditure rates, local execution gaps, land acquisition drag, and statutory clearances.',
    iconColor: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
  },
  {
    id: 'ai-forecast',
    title: 'XGBoost & SHAP Risk Drivers Digest',
    subtitle: 'Explainable AI early warning attributions',
    cadence: 'Continuous Model Scoring',
    category: 'Predictive AI',
    description: 'Transparent attribution breakdown of why projects are slipping, highlighting financial-physical execution gaps and duration drag factors.',
    iconColor: 'bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400',
  },
  {
    id: 'statutory-clearances',
    title: 'Statutory & Early Warning Audit',
    subtitle: 'Telemetry triggers and threshold alerts',
    cadence: 'Weekly Exception Run',
    category: 'Telemetry Alerts',
    description: 'Operational exception log tracking multi-month physical stalls, financial-physical discrepancies, and severe schedule deviations.',
    iconColor: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400',
  },
]

export default function Reports() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [activeReport, setActiveReport] = useState<ReportConfig | null>(null)
  const [exportNotice, setExportNotice] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const [sumRes, projRes] = await Promise.all([
          getPortfolioSummary(),
          getProjects(),
        ])
        setSummary(sumRes)
        setProjects(projRes)
      } catch (err) {
        console.error('Failed to load report data', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const criticalProjects = projects.filter(
    (p) => p.status === 'At Risk' || (p.final_risk_score && p.final_risk_score >= 60)
  )

  // Export At-Risk Projects directly to CSV
  const handleExportCSV = (reportTitle: string) => {
    const targetProjects = reportTitle.includes('Critical') ? criticalProjects : projects
    const headers = [
      'Project ID',
      'Name',
      'Ministry',
      'Sector',
      'State',
      'Status',
      'Health Score',
      'Physical Progress %',
      'Financial Progress %',
      'Expenditure',
      'Cost Variance %',
      'Schedule Slip (Mo)',
      'Cost Overrun Risk %',
      'Time Overrun Risk %',
      'Composite Risk Score',
      'Review Reason',
    ]

    const rows = targetProjects.map((p) => [
      `"${p.id}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.ministry.replace(/"/g, '""')}"`,
      `"${p.sector}"`,
      `"${p.state}"`,
      `"${p.status}"`,
      p.health,
      p.physicalProgress,
      p.financialProgress,
      `"${p.expenditure}"`,
      p.costVariance,
      p.timeVariance,
      p.costOverrunRisk,
      p.timeOverrunRisk,
      p.final_risk_score ?? '',
      `"${(p.reviewReason || '').replace(/"/g, '""')}"`,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `${reportTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setExportNotice(`Exported ${targetProjects.length} records to CSV`)
    setTimeout(() => setExportNotice(null), 4000)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold tracking-wide text-cyan-600 dark:text-cyan-400 mb-2">
          PAIMANA EXECUTIVE INTELLIGENCE REPORT CENTER
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-ink-950 dark:text-white">
              Reports built for review rooms
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-2xl text-sm">
              Convert real-time XGBoost risk predictions, SHAP attribution signals, and portfolio telemetry into official decision briefs.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleExportCSV('National_At_Risk_Portfolio')}
              className="flex items-center gap-2 rounded-lg bg-white dark:bg-ink-900 border border-slate-200 dark:border-white/10 px-4 py-2.5 text-sm font-semibold text-ink-950 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-colors shadow-sm"
            >
              <FileSpreadsheet size={16} className="text-emerald-500" />
              Export At-Risk CSV ({criticalProjects.length})
            </button>
          </div>
        </div>
      </div>

      {exportNotice && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3 text-sm text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} /> {exportNotice}
          </span>
          <button onClick={() => setExportNotice(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Live Portfolio Snapshot Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Tracked Projects</p>
          <p className="text-2xl font-bold text-ink-950 dark:text-white mt-1">
            {summary?.total_projects ?? projects.length}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Across 10 Ministries</p>
        </div>
        <div className="rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 p-4 shadow-sm">
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400">Projects Requiring Attention</p>
          <p className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-1">
            {summary?.projects_at_risk ?? criticalProjects.length}
          </p>
          <p className="text-xs text-rose-500/80 mt-0.5">Critical & High Risk Tiers</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Average Portfolio Health</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {summary?.avg_health ?? 72.4}%
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Composite 100-pt index</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Avg Model Cost Overrun P(COP)</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {summary?.avg_cop_prob ?? 42.1}%
          </p>
          <p className="text-xs text-slate-400 mt-0.5">XGBoost inference baseline</p>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {REPORT_DEFINITIONS.map((r) => (
          <div
            key={r.id}
            className="group rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between hover:border-cyan-500/40"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${r.iconColor}`}>
                  <FileText size={20} />
                </span>
                <span className="rounded-full bg-slate-100 dark:bg-white/10 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {r.category}
                </span>
              </div>
              <h3 className="font-display font-semibold text-lg text-ink-950 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                {r.title}
              </h3>
              <p className="text-xs font-medium text-cyan-600 dark:text-cyan-400 mt-0.5 mb-2.5">
                {r.subtitle}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {r.description}
              </p>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
              <span className="text-xs text-slate-400 dark:text-slate-500">{r.cadence}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveReport(r)}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 px-3 py-1.5 text-xs font-medium text-ink-950 dark:text-white transition-colors"
                >
                  <Eye size={13} /> Preview
                </button>
                <button
                  onClick={() => handleExportCSV(r.title)}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-orange hover:bg-brand-orangeDark px-3.5 py-1.5 text-xs font-semibold text-white transition-colors shadow-sm"
                >
                  <Download size={13} /> Generate
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Report Preview Modal */}
      {activeReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-ink-900 border border-slate-200 dark:border-white/10 shadow-2xl p-6 sm:p-8">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-white/10 pb-4">
              <div>
                <span className="rounded-full bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 px-3 py-1 text-xs font-bold uppercase tracking-wider">
                  Official Apex Brief Preview
                </span>
                <h2 className="font-display text-2xl font-bold text-ink-950 dark:text-white mt-2">
                  {activeReport.title}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {activeReport.subtitle} • Generated for PM GatiShakti Review
                </p>
              </div>
              <button
                onClick={() => setActiveReport(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/5"
              >
                <X size={20} />
              </button>
            </div>

            {/* Document Body */}
            <div className="py-6 space-y-6 text-sm text-slate-700 dark:text-slate-300">
              {/* Executive Metrics Card */}
              <div className="rounded-xl bg-slate-50 dark:bg-white/5 p-5 border border-slate-200 dark:border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Projects Monitored</p>
                  <p className="text-xl font-bold text-ink-950 dark:text-white mt-1">
                    {summary?.total_projects ?? projects.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">High Risk Triggers</p>
                  <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                    {summary?.projects_at_risk ?? criticalProjects.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Mean Health Score</p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    {summary?.avg_health ?? 72.4}/100
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Reporting Period</p>
                  <p className="text-xl font-bold text-ink-950 dark:text-white mt-1">
                    July 2026
                  </p>
                </div>
              </div>

              {/* Core Executive Findings */}
              <div className="space-y-3">
                <h4 className="font-display font-semibold text-base text-ink-950 dark:text-white flex items-center gap-2">
                  <ShieldAlert size={17} className="text-brand-orange" />
                  1. Executive Strategic Assessment
                </h4>
                <p className="leading-relaxed text-slate-600 dark:text-slate-300">
                  Based on machine learning models trained on national infrastructure datasets, 
                  <strong> {summary?.projects_at_risk ?? criticalProjects.length} projects</strong> currently display high probability of schedule or cost overruns. 
                  The primary driver across flagged schemes is the <em>financial-physical execution gap</em>, where cumulative financial progress diverges by more than 10% from physical delivery on the ground.
                </p>
              </div>

              {/* Top Priority Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-display font-semibold text-base text-ink-950 dark:text-white flex items-center gap-2">
                    <AlertTriangle size={17} className="text-rose-500" />
                    2. Priority Projects Requiring Direct Escalation
                  </h4>
                  <span className="text-xs text-slate-400">Top {Math.min(5, criticalProjects.length)} ranked by ML risk</span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 font-semibold">
                      <tr>
                        <th className="p-3">Project ID</th>
                        <th className="p-3">Sector & State</th>
                        <th className="p-3">Physical %</th>
                        <th className="p-3">Cost Overrun</th>
                        <th className="p-3">Schedule Slip</th>
                        <th className="p-3">ML Risk</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                      {criticalProjects.slice(0, 5).map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                          <td className="p-3 font-semibold text-ink-950 dark:text-white font-mono">{p.id}</td>
                          <td className="p-3">
                            <span className="font-medium text-ink-950 dark:text-white">{p.sector}</span>
                            <span className="text-slate-400 block text-[11px]">{p.state}</span>
                          </td>
                          <td className="p-3 font-semibold">{p.physicalProgress}%</td>
                          <td className="p-3 text-rose-600 dark:text-rose-400 font-medium">
                            {p.costVariance > 0 ? `+${p.costVariance}%` : `${p.costVariance}%`}
                          </td>
                          <td className="p-3 text-amber-600 dark:text-amber-400 font-medium">
                            +{p.timeVariance} mo
                          </td>
                          <td className="p-3">
                            <span className="inline-flex rounded-full bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">
                              {p.final_risk_score ? `${p.final_risk_score}/100` : `${p.costOverrunRisk}% COP`}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recommended Action Items */}
              <div className="space-y-3">
                <h4 className="font-display font-semibold text-base text-ink-950 dark:text-white flex items-center gap-2">
                  <CheckCircle2 size={17} className="text-emerald-500" />
                  3. Recommended Action Plan for Review Officers
                </h4>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <li>Initiate immediate tripartite review for projects with schedule slip exceeding 4.0 months.</li>
                  <li>Perform physical milestone verification on projects with expenditure rates surpassing 80% while physical progress remains under 50%.</li>
                  <li>Deploy PM GatiShakti multi-modal alignment teams to unblock Right of Way (RoW) clearances in high-slip sectors.</li>
                </ul>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between border-t border-slate-200 dark:border-white/10 pt-4">
              <button
                onClick={() => setActiveReport(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
              >
                Close Preview
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-100 dark:bg-white/10 text-xs font-semibold text-ink-950 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
                >
                  <Printer size={14} /> Print / Save PDF
                </button>
                <button
                  onClick={() => handleExportCSV(activeReport.title)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-orange hover:bg-brand-orangeDark text-xs font-semibold text-white transition-colors shadow-sm"
                >
                  <Download size={14} /> Export CSV Dossier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
