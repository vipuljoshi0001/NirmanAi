import { useMemo, useState, useEffect } from 'react'
import {
  Search,
  LayoutGrid,
  List,
  Plus,
  X,
  Cpu,
  RefreshCw,
} from 'lucide-react'
import ProjectCard from '../components/ProjectCard'
import type { Project, Sector } from '../types'
import { getProjects, registerNewProject } from '../services/api'

const sectors: (Sector | 'All Sectors')[] = [
  'All Sectors',
  'Railways',
  'Roads & Highways',
  'Urban Transport',
  'Power & RE',
  'Oil & Gas',
  'Aviation & Aviation Infrastructure',
]

type ProjectForm = {
  name: string
  ministry: string
  sector: Sector
  state: string
  requiredBudget: string
  allottedBudget: string
  completionDate: string
  physicalProgress: string
}

export default function Projects() {
  const [query, setQuery] = useState('')
  const [sector, setSector] = useState<Sector | 'All Sectors'>('All Sectors')
  const [sectorOpen, setSectorOpen] = useState(false)
  const [projectList, setProjectList] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddProject, setShowAddProject] = useState(false)
  const [isPredicting, setIsPredicting] = useState(false)

  const [form, setForm] = useState<ProjectForm>({
    name: '',
    ministry: '',
    sector: 'Roads & Highways',
    state: '',
    requiredBudget: '',
    allottedBudget: '',
    completionDate: '',
    physicalProgress: '25',
  })

  const loadProjects = () => {
    setLoading(true)
    getProjects()
      .then((data) => {
        setProjectList(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to fetch projects', err)
        setLoading(false)
      })
  }

  useEffect(() => {
    loadProjects()
  }, [])

  const filtered = useMemo(() => {
    return projectList.filter((p) => {
      const matchesSector = sector === 'All Sectors' || p.sector.toLowerCase().includes(sector.toLowerCase())
      const q = query.trim().toLowerCase()

      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.ministry.toLowerCase().includes(q) ||
        p.state.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)

      return matchesSector && matchesQuery
    })
  }, [query, sector, projectList])

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsPredicting(true)

    const phys = Math.min(100, Math.max(0, Number(form.physicalProgress) || 0))
    const sanctioned = Math.max(1, Number(form.requiredBudget.replace(/[^\d.]/g, '')) || 1000)
    const revised = Math.max(sanctioned, Number(form.allottedBudget.replace(/[^\d.]/g, '')) || sanctioned)
    const overrun = Number((((revised - sanctioned) / sanctioned) * 100).toFixed(1))

    try {
      // Call live registration & ML scoring endpoint
      const newProj = await registerNewProject({
        name: form.name,
        ministry: form.ministry || `Ministry of ${form.sector}`,
        sector: form.sector,
        state: form.state || 'Maharashtra',
        sanctioned_cost: sanctioned,
        revised_cost: revised,
        duration_months: 36,
        months_elapsed: Math.round(36 * (phys / 100)),
        physical_progress_pct: phys,
        financial_progress_pct: Math.min(100, phys + 5),
        cost_overrun_to_date_pct: overrun,
        schedule_slip_months: overrun > 10 ? 4.2 : 1.0,
        cumulative_expenditure: (revised * phys) / 100,
        original_end_date: form.completionDate || '2028-12-31',
      })

      setProjectList((prev) => [newProj, ...prev])
      setIsPredicting(false)
      setShowAddProject(false)
      setForm({
        name: '',
        ministry: '',
        sector: 'Roads & Highways',
        state: '',
        requiredBudget: '',
        allottedBudget: '',
        completionDate: '',
        physicalProgress: '25',
      })
    } catch (err) {
      console.warn('Interactive prediction failed, fallback local calculation', err)
      const fallbackProject: Project = {
        id: `PRJ-${String(projectList.length + 1).padStart(4, '0')}`,
        name: form.name,
        ministry: form.ministry || `Ministry of ${form.sector}`,
        sector: form.sector,
        state: form.state,
        status: phys >= 70 ? 'On Track' : phys >= 40 ? 'Watch' : 'At Risk',
        physicalProgress: phys,
        financialProgress: phys,
        health: phys >= 70 ? 88 : phys >= 40 ? 68 : 52,
        costOverrunRisk: 22,
        timeOverrunRisk: 31,
        originalCompletion: form.completionDate || '2028-12-31',
        predictedCompletion: form.completionDate || '2029-06-30',
        expenditure: `₹ ${sanctioned.toLocaleString()} Cr`,
        costVariance: overrun,
        timeVariance: 0,
        currentStageIndex: Math.min(4, Math.max(0, Math.floor(phys / 25))),
        reviewReason: 'Registered through portal with estimated domain rules.',
        flags: [{ label: 'Newly Registered', tone: 'neutral' }],
      }
      setProjectList((prev) => [fallbackProject, ...prev])
      setIsPredicting(false)
      setShowAddProject(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-wide text-cyan-600 dark:text-cyan-400 mb-2">
          PROJECT INTELLIGENCE EXPLORER
        </p>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <h1 className="font-display text-3xl font-bold text-ink-950 dark:text-white">
              Find the signal in every project
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-xl">
              Live predictive portfolio grounded in national baselines with XGBoost cost & schedule risk scores.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 whitespace-nowrap">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> {projectList.length} projects live
            </span>
            <button
              onClick={loadProjects}
              className="p-2 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500"
              title="Refresh project list"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl bg-ink-900 p-3 flex flex-wrap items-center gap-3 shadow-md">
        <div className="flex items-center gap-2.5 flex-1 min-w-[240px] rounded-lg bg-white/5 px-3.5 py-2.5">
          <Search size={16} className="text-slate-400 flex-shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search project, ministry, state or ID (e.g. PRJ-0001)..."
            className="bg-transparent text-sm text-white placeholder:text-slate-500 outline-none flex-1"
          />
        </div>

        <div className="relative">
          <button
            onClick={() => setSectorOpen((v) => !v)}
            className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3.5 py-2.5 text-sm text-white min-w-[170px]"
          >
            {sector}
            <span className="text-slate-400">▾</span>
          </button>
          {sectorOpen && (
            <div className="absolute z-20 mt-1 w-full rounded-lg bg-ink-950 border border-white/10 overflow-hidden shadow-2xl">
              {sectors.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSector(s)
                    setSectorOpen(false)
                  }}
                  className={`block w-full text-left px-3.5 py-2.5 text-sm hover:bg-white/10 ${
                    s === sector ? 'bg-cyan-500 text-white font-semibold' : 'text-slate-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setShowAddProject(true)}
          className="flex items-center gap-2 rounded-lg bg-brand-orange hover:bg-brand-orangeDark px-4 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          <Plus size={15} />
          Register Project & Run ML
        </button>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Showing <span className="font-semibold text-ink-950 dark:text-white">{filtered.length}</span> projects matching criteria
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
          <p className="text-sm text-slate-500">Querying project telemetry database...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-slate-400 py-16 bg-white dark:bg-ink-900 rounded-xl border border-slate-200 dark:border-white/5">
              <p className="text-base font-semibold text-slate-700 dark:text-slate-300">No matching projects found</p>
              <p className="text-xs text-slate-400 mt-1">Try resetting the sector filter or searching for another keyword.</p>
            </div>
          )}
        </div>
      )}

      {/* Add Project Modal with Live ML Inference */}
      {showAddProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs px-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-ink-900 border border-slate-200 dark:border-white/10 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-white/10">
              <div>
                <p className="text-xs font-semibold tracking-wide text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
                  <Cpu size={14} /> LIVE ML SCORING ENGINE
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">Register Project & Predict Overrun</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAddProject(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddProject} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Project Name *
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Pune Metro Line 3 Extension"
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Department / Ministry *
                  </label>
                  <input
                    required
                    value={form.ministry}
                    onChange={(e) => setForm({ ...form, ministry: e.target.value })}
                    placeholder="e.g. Ministry of Housing & Urban Affairs"
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Sector *</label>
                  <select
                    value={form.sector}
                    onChange={(e) => setForm({ ...form, sector: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                  >
                    {sectors
                      .filter((s) => s !== 'All Sectors')
                      .map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">State *</label>
                  <input
                    required
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    placeholder="e.g. Maharashtra"
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Sanctioned Cost (₹ Cr) *
                  </label>
                  <input
                    required
                    value={form.requiredBudget}
                    onChange={(e) => setForm({ ...form, requiredBudget: e.target.value })}
                    placeholder="e.g. 8500"
                    type="number"
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Revised / Anticipated Cost (₹ Cr)
                  </label>
                  <input
                    value={form.allottedBudget}
                    onChange={(e) => setForm({ ...form, allottedBudget: e.target.value })}
                    placeholder="e.g. 9200"
                    type="number"
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Current Physical Execution (%) *
                  </label>
                  <input
                    required
                    value={form.physicalProgress}
                    onChange={(e) => setForm({ ...form, physicalProgress: e.target.value })}
                    placeholder="0 - 100"
                    type="number"
                    min="0"
                    max="100"
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Target Completion Date
                  </label>
                  <input
                    value={form.completionDate}
                    onChange={(e) => setForm({ ...form, completionDate: e.target.value })}
                    type="date"
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800 text-xs text-cyan-800 dark:text-cyan-300">
                Submitting will trigger live XGBoost COP & TOP models via <code className="font-mono">/api/predict</code> to calculate instant overrun probabilities and SHAP driver attributions.
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddProject(false)}
                  className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPredicting}
                  className="flex items-center gap-2 rounded-lg bg-brand-orange hover:bg-brand-orangeDark px-5 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50"
                >
                  {isPredicting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Computing ML Risk...
                    </>
                  ) : (
                    <>
                      <Cpu size={16} /> Run ML & Save
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
