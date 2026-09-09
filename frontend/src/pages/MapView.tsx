import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Layers,
  MapPin,
  Search,
  TrendingDown,
} from 'lucide-react'
import ProjectMapSafe from '../components/ProjectMapSafe'
import { getMapProjects } from '../services/api'
import type { MapProject, ProjectStatus } from '../types'

type StatusFilter = 'All' | ProjectStatus

const FILTER_PILLS: { key: StatusFilter; label: string }[] = [
  { key: 'All', label: 'All' },
  { key: 'At Risk', label: 'At Risk' },
  { key: 'Watch', label: 'Watch' },
  { key: 'On Track', label: 'On Track' },
]

export default function MapView() {
  const [allProjects, setAllProjects] = useState<MapProject[]>([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState('demo')
  const [sector, setSector] = useState('All')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [query, setQuery] = useState('')
  const [dark, setDark] = useState(false)

  // Follow the document theme so the basemap stays legible (light ↔ CARTO dark).
  useEffect(() => {
    const applyTheme = () => setDark(document.documentElement.classList.contains('dark'))
    applyTheme()
    const observer = new MutationObserver(applyTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let alive = true
    getMapProjects()
      .then((res) => {
        if (!alive) return
        setAllProjects(res.projects)
        setSource(res.mode)
      })
      .catch((err) => console.warn('MapView: could not load map projects', err))
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const sectors = useMemo(() => {
    const seen = new Set<string>()
    allProjects.forEach((p) => seen.add(p.sector))
    return ['All', ...[...seen].sort()]
  }, [allProjects])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allProjects.filter((p) => {
      if (sector !== 'All' && p.sector !== sector) return false
      if (statusFilter !== 'All' && p.status !== statusFilter) return false
      if (q && !`${p.name} ${p.state} ${p.id}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [allProjects, sector, statusFilter, query])

  const stats = useMemo(() => {
    const total = filtered.length
    const atRisk = filtered.filter((p) => p.status === 'At Risk').length
    const watch = filtered.filter((p) => p.status === 'Watch').length
    const onTrack = filtered.filter((p) => p.status === 'On Track').length
    const avgRisk = total
      ? Math.round(filtered.reduce((sum, p) => sum + (p.risk_score ?? 0), 0) / total)
      : 0
    return { total, atRisk, watch, onTrack, avgRisk }
  }, [filtered])

  const byRisk = useMemo(
    () => [...filtered].sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0)),
    [filtered],
  )

  const statCards = [
    { label: 'Plotted projects', value: stats.total, icon: Layers, tone: 'text-slate-500' },
    { label: 'At risk', value: stats.atRisk, icon: AlertTriangle, tone: 'text-red-500' },
    { label: 'Watch', value: stats.watch, icon: TrendingDown, tone: 'text-amber-500' },
    { label: 'On track', value: stats.onTrack, icon: CheckCircle2, tone: 'text-emerald-500' },
    { label: 'Avg risk score', value: stats.avgRisk, icon: Gauge, tone: 'text-cyan-500' },
  ]

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="rounded-xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-6 shadow-card transition-colors duration-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-cyan-600 dark:text-cyan-400">
              NATIONAL PROJECT ATLAS
            </p>
            <h1 className="font-display text-2xl font-black text-slate-900 dark:text-white mt-1">
              Interactive infrastructure project map
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-xl">
              Every project pinned to a deterministic state centroid and coloured by its live XGBoost risk
              status. Zoom in, hover for a tooltip, and click any marker for the full intelligence dossier.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE
            </span>
            <span className="rounded-full bg-slate-100 dark:bg-ink-950 px-3 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              source: {source === 'live' ? '/api/projects?map=true' : 'demo fallback'}
            </span>
          </div>
        </div>
      </section>

      {/* Stat cards */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 shadow-card transition-colors duration-200"
          >
            <div className="flex items-center justify-between text-slate-400">
              <p className="text-[10px] font-bold uppercase tracking-wider">{card.label}</p>
              <card.icon size={15} strokeWidth={2} className={card.tone} />
            </div>
            <p className="font-display text-2xl font-black text-slate-900 dark:text-white mt-2">
              {loading ? '—' : card.value}
            </p>
          </div>
        ))}
      </section>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 rounded-lg bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-800 px-3 py-2 shadow-card w-full sm:w-64">
          <Search size={15} className="text-slate-400 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search project, state, ID…"
            className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 shadow-card focus:outline-none"
        >
          {sectors.map((s) => (
            <option key={s} value={s}>
              {s === 'All' ? 'All sectors' : s}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_PILLS.map((pill) => (
            <button
              key={pill.key}
              onClick={() => setStatusFilter(pill.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === pill.key
                  ? 'bg-brand-orange text-white shadow-sm'
                  : 'bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-slate-400">
          {loading ? 'Loading geospatial feed…' : `${filtered.length} of ${allProjects.length} projects`}
        </span>
      </div>

      {/* Map + risk list */}
      <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr),340px] gap-6 items-start">
        <div className="rounded-xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-3 shadow-card transition-colors duration-200">
          <div className="relative z-0">
            <ProjectMapSafe projects={filtered} height={560} dark={dark} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-4">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> On track</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Watch</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> At risk</span>
            </span>
            <span>Marker size ∝ composite risk score · pinned to state centroid</span>
          </div>
        </div>

        {/* Sidebar: highest-risk projects */}
        <div className="rounded-xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-5 shadow-card transition-colors duration-200">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold tracking-wide text-red-500">HOTSPOT RANKING</p>
            <MapPin size={15} className="text-slate-400" />
          </div>
          <h3 className="font-display font-semibold text-slate-900 dark:text-white mb-1">Highest risk right now</h3>
          <p className="text-xs text-slate-400 mb-4">Sorted by composite risk score (100 = worst).</p>

          {loading ? (
            <p className="py-10 text-center text-xs text-slate-400">Loading…</p>
          ) : byRisk.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-400">No projects match these filters.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-ink-800">
              {byRisk.slice(0, 9).map((p) => (
                <li key={p.id}>
                  <Link to={`/projects/${p.project_id ?? p.id}`} className="group flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white group-hover:text-brand-orange">
                        {p.name}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-400">
                        {p.state} · {p.sector}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={`text-[11px] font-bold uppercase tracking-wide ${
                          p.status === 'At Risk'
                            ? 'text-red-500'
                            : p.status === 'Watch'
                              ? 'text-amber-500'
                              : 'text-emerald-500'
                        }`}
                      >
                        {p.status}
                      </p>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{p.risk_score ?? '—'}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 rounded-lg bg-slate-50 dark:bg-ink-950 px-3 py-2.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            Points plot from <code className="font-semibold">/api/projects?map=true</code>; the default{' '}
            <code>/api/projects</code> payload is unchanged. Coordinates are functional centroids for
            visualisation only — not geospatial survey positions.
          </p>
        </div>
      </section>
    </div>
  )
}