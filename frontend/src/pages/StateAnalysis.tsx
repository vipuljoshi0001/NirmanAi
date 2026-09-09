import { useState, useEffect, useMemo } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import {
  MapPin,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Search,
  ArrowUpRight,
  BarChart3,
  Layers,
  Map as MapIcon,
  ShieldCheck,
  ChevronRight,
  Activity,
  IndianRupee,
  Clock,
} from 'lucide-react'
import { getStateBaselines, getStateDetail } from '../services/api'
import type { StateBaselineItem, StateDetailData, StateProjectData } from '../types'
import ProjectCard from '../components/ProjectCard'
import { IndiaMapSvg } from '../components/IndiaMapSvg'

// Complete normalized mapping for all 36 Indian States and Union Territories to SVG Map IDs
const STATE_NAME_TO_MAP_ID: Record<string, string> = {
  'andaman & nicobar': 'an',
  'andaman and nicobar islands': 'an',
  'andhra pradesh': 'ap',
  'arunachal pradesh': 'ar',
  'assam': 'as',
  'bihar': 'br',
  'chandigarh': 'ch',
  'chhattisgarh': 'ct',
  'dadra & nagar haveli and daman & diu': 'dn',
  'dadra and nagar haveli': 'dn',
  'daman and diu': 'dd',
  'delhi': 'dl',
  'goa': 'ga',
  'gujarat': 'gj',
  'haryana': 'hr',
  'himachal pradesh': 'hp',
  'jammu & kashmir': 'jk',
  'jammu and kashmir': 'jk',
  'jharkhand': 'jh',
  'karnataka': 'ka',
  'kerala': 'kl',
  'ladakh': 'ld',
  'lakshadweep': 'ld',
  'madhya pradesh': 'mp',
  'maharashtra': 'mh',
  'manipur': 'mn',
  'meghalaya': 'ml',
  'mizoram': 'mz',
  'nagaland': 'nl',
  'odisha': 'or',
  'puducherry': 'py',
  'punjab': 'pb',
  'rajasthan': 'rj',
  'sikkim': 'sk',
  'tamil nadu': 'tn',
  'telangana': 'tg',
  'tripura': 'tr',
  'uttar pradesh': 'up',
  'uttarakhand': 'ut',
  'west bengal': 'wb',
}

const MAP_ID_TO_STATE_NAME: Record<string, string> = {
  an: 'Andaman & Nicobar',
  ap: 'Andhra Pradesh',
  ar: 'Arunachal Pradesh',
  as: 'Assam',
  br: 'Bihar',
  ch: 'Chandigarh',
  ct: 'Chhattisgarh',
  dn: 'Dadra & Nagar Haveli and Daman & Diu',
  dd: 'Dadra & Nagar Haveli and Daman & Diu',
  dl: 'Delhi',
  ga: 'Goa',
  gj: 'Gujarat',
  hr: 'Haryana',
  hp: 'Himachal Pradesh',
  jk: 'Jammu & Kashmir',
  jh: 'Jharkhand',
  ka: 'Karnataka',
  kl: 'Kerala',
  ld: 'Ladakh',
  mp: 'Madhya Pradesh',
  mh: 'Maharashtra',
  mn: 'Manipur',
  ml: 'Meghalaya',
  mz: 'Mizoram',
  nl: 'Nagaland',
  or: 'Odisha',
  py: 'Puducherry',
  pb: 'Punjab',
  rj: 'Rajasthan',
  sk: 'Sikkim',
  tn: 'Tamil Nadu',
  tg: 'Telangana',
  tr: 'Tripura',
  up: 'Uttar Pradesh',
  ut: 'Uttarakhand',
  wb: 'West Bengal',
}

// Quick select pill tags for prominent national infrastructure hubs
const POPULAR_STATES = [
  'Maharashtra',
  'Uttar Pradesh',
  'Gujarat',
  'Karnataka',
  'Tamil Nadu',
  'Bihar',
  'Madhya Pradesh',
  'West Bengal',
  'Assam',
  'Rajasthan',
]

export default function StateAnalysis() {
  const [stateList, setStateList] = useState<StateBaselineItem[]>([])
  const [selectedState, setSelectedState] = useState<string>('Maharashtra')
  const [stateDetail, setStateDetail] = useState<StateDetailData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [showMap, setShowMap] = useState<boolean>(true)
  const [hoveredStateId, setHoveredStateId] = useState<string | null>(null)
  const [chartMetric, setChartMetric] = useState<'expenditure' | 'overrun'>('expenditure')

  // Load all 36 state baselines from live SQLite database
  useEffect(() => {
    async function loadStates() {
      try {
        const baselines = await getStateBaselines()
        if (baselines && baselines.length > 0) {
          // Sort by project count descending
          const sorted = [...baselines].sort((a, b) => b.project_count - a.project_count)
          setStateList(sorted)
        }
      } catch (err) {
        console.error('Failed to load state baselines', err)
      }
    }
    loadStates()
  }, [])

  // Load selected state telemetry & priority projects
  useEffect(() => {
    let isMounted = true
    async function fetchState() {
      setLoading(true)
      try {
        const detail = await getStateDetail(selectedState)
        if (isMounted) {
          setStateDetail(detail)
          setLoading(false)
        }
      } catch (err) {
        console.error(`Failed to fetch state detail for ${selectedState}`, err)
        if (isMounted) setLoading(false)
      }
    }
    fetchState()
    return () => {
      isMounted = false
    }
  }, [selectedState])

  // Filtered state list based on user search query
  const filteredStates = useMemo(() => {
    if (!searchQuery.trim()) return stateList
    return stateList.filter((s) =>
      s.state.toLowerCase().includes(searchQuery.toLowerCase().trim())
    )
  }, [stateList, searchQuery])

  // Map state ID from selected state name
  const currentMapId = useMemo(() => {
    return STATE_NAME_TO_MAP_ID[selectedState.toLowerCase().trim()] || 'mh'
  }, [selectedState])

  // Generate mapping for IndiaMapSvg density & tooltips
  const stateDataMap: Record<string, StateProjectData> = useMemo(() => {
    const map: Record<string, StateProjectData> = {}
    stateList.forEach((s) => {
      const code = STATE_NAME_TO_MAP_ID[s.state.toLowerCase().trim()]
      if (code) {
        map[code] = {
          name: s.state,
          totalProjects: s.project_count,
          health: Math.max(0, Math.min(100, Math.round(100 - Math.max(0, s.avg_cost_overrun_pct)))),
        }
      }
    })
    return map
  }, [stateList])

  // Handle map state click
  const handleMapSelect = (mapId: string) => {
    const resolvedName = MAP_ID_TO_STATE_NAME[mapId.toLowerCase()]
    if (resolvedName) {
      // Find exact matched baseline state name if available
      const found = stateList.find(
        (s) => s.state.toLowerCase() === resolvedName.toLowerCase()
      )
      setSelectedState(found ? found.state : resolvedName)
    }
  }

  // Formatting chart data
  const chartData = useMemo(() => {
    if (!stateDetail?.monthlyTrends) return []
    return stateDetail.monthlyTrends.map((t) => ({
      month: t.month,
      expenditure: Math.round(t.expenditure_cr),
      overrun: Number(t.cost_overrun_pct.toFixed(1)),
      revisedCost: Math.round(t.revised_cost_cr),
      projects: t.project_count,
    }))
  }, [stateDetail])

  // Health color indicator
  const healthBadge = (health: number) => {
    if (health >= 80) {
      return {
        bg: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
        label: 'Optimal Execution',
      }
    }
    if (health >= 60) {
      return {
        bg: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
        label: 'Moderate Variance',
      }
    }
    return {
      bg: 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30',
      label: 'Critical Cost Drift',
    }
  }

  const currentHealth = stateDetail?.health ?? 85
  const badge = healthBadge(currentHealth)

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200 dark:border-ink-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-xs font-semibold tracking-wider text-cyan-600 dark:text-cyan-400 uppercase">
              LIVE STATE INTELLIGENCE &bull; 36 JURISDICTIONS
            </p>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
            Pan-India Infrastructure Performance
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5 max-w-2xl text-sm sm:text-base">
            Live database telemetry, capital velocity, and ML-scored risk signals across all 36 States and Union Territories.
          </p>
        </div>

        {/* View Toggle (Map on/off) */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMap(!showMap)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              showMap
                ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 border-cyan-500/30'
                : 'bg-white dark:bg-ink-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-ink-800 hover:border-slate-300'
            }`}
          >
            <MapIcon size={14} />
            <span>{showMap ? 'Geospatial Map (Active)' : 'Show India Map'}</span>
          </button>
        </div>
      </div>

      {/* State Selector & Search Bar */}
      <div className="bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-1 max-w-md">
            <div className="relative w-full">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search across all 36 Indian states & UTs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-ink-800 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex-shrink-0">
              State:
            </label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-ink-800 bg-slate-50 dark:bg-ink-950 px-3.5 py-2 text-sm font-semibold text-slate-900 dark:text-white min-w-[210px] outline-none focus:border-cyan-500 cursor-pointer"
            >
              {filteredStates.map((s) => (
                <option key={s.state} value={s.state}>
                  {s.state} ({s.project_count} projects)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Select Pill Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 flex-shrink-0">
            <Layers size={12} /> Key Hubs:
          </span>
          {POPULAR_STATES.map((st) => {
            const isSelected = selectedState.toLowerCase() === st.toLowerCase()
            return (
              <button
                key={st}
                onClick={() => setSelectedState(st)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-sm'
                    : 'bg-slate-100 dark:bg-ink-950 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-ink-800'
                }`}
              >
                {st}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Grid: Interactive Map + Telemetry Dashboard */}
      <div className={`grid grid-cols-1 ${showMap ? 'lg:grid-cols-12' : 'lg:grid-cols-1'} gap-6`}>
        {/* Interactive India Map Panel (Optional side-by-side) */}
        {showMap && (
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-5 shadow-card flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 tracking-wider uppercase">
                  GEOSPATIAL NAVIGATOR
                </p>
                <h3 className="font-display font-semibold text-slate-900 dark:text-white text-base">
                  Interactive India Surface
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">Click state to inspect</span>
            </div>

            <div className="flex-1 rounded-xl bg-slate-950 border border-white/5 min-h-[380px] sm:min-h-[420px] flex items-center justify-center relative overflow-hidden">
              <span className="absolute top-3 right-3 z-20 flex items-center gap-1.5 text-[10px] font-medium text-emerald-400 bg-slate-900/80 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {selectedState} selected
              </span>
              <IndiaMapSvg
                selectedStateId={currentMapId}
                hoveredStateId={hoveredStateId}
                onSelectState={handleMapSelect}
                onHoverState={setHoveredStateId}
                stateDataMap={stateDataMap}
              />
            </div>

            <div className="mt-3.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-ink-800">
              <span className="flex items-center gap-1">
                <MapPin size={12} className="text-cyan-500" />
                Selected: <strong className="text-slate-800 dark:text-white ml-1">{selectedState}</strong>
              </span>
              <span>{stateDetail?.projects ?? 0} active initiatives</span>
            </div>
          </div>
        )}

        {/* State Detail Telemetry Column */}
        <div className={`${showMap ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-6`}>
          {/* Executive State Badge & Banner */}
          <div className="rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-5 shadow-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                    {stateDetail?.name || selectedState}
                  </h2>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.bg}`}>
                    {badge.label}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Active monitoring record &bull; Database snapshot updated through July 2026
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                    Sovereign Health
                  </span>
                  <div className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                    {loading ? '--' : `${stateDetail?.health ?? 85}/100`}
                  </div>
                </div>
              </div>
            </div>

            {/* 5-Metric Scoreboard Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5 mt-5 pt-5 border-t border-slate-100 dark:border-ink-800">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-ink-950 border border-slate-100 dark:border-ink-800/80">
                <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">PROJECTS</p>
                <p className="font-display text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {loading ? '...' : stateDetail?.projects ?? 0}
                </p>
                <span className="text-[10px] text-slate-400">Tracked initiatives</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-ink-950 border border-slate-100 dark:border-ink-800/80">
                <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">SANCTIONED</p>
                <p className="font-display text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {loading ? '...' : stateDetail?.investment || '₹ 0 Cr'}
                </p>
                <span className="text-[10px] text-slate-400">Revised outlay</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-ink-950 border border-slate-100 dark:border-ink-800/80">
                <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">EXPENDITURE</p>
                <p className="font-display text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {loading ? '...' : stateDetail?.expenditure || '₹ 0 Cr'}
                </p>
                <span className="text-[10px] text-slate-400">Delivered value</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-ink-950 border border-slate-100 dark:border-ink-800/80">
                <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">COST VARIANCE</p>
                <p
                  className={`font-display text-xl font-bold mt-1 ${
                    (stateDetail?.atRisk ?? 0) > 10
                      ? 'text-rose-500'
                      : (stateDetail?.atRisk ?? 0) < 0
                      ? 'text-emerald-500'
                      : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {loading
                    ? '...'
                    : (stateDetail?.atRisk ?? 0) > 0
                    ? `+${stateDetail?.atRisk}%`
                    : `${stateDetail?.atRisk}%`}
                </p>
                <span className="text-[10px] text-slate-400">Baseline drift</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-ink-950 border border-slate-100 dark:border-ink-800/80 col-span-2 sm:col-span-1">
                <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">SCHEDULE SLIP</p>
                <p className="font-display text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {loading ? '...' : stateDetail?.timeExposure || '0 mo'}
                </p>
                <span className="text-[10px] text-slate-400">Avg delay exposure</span>
              </div>
            </div>
          </div>

          {/* Monthly Velocity Chart Panel */}
          <div className="rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-5 shadow-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-semibold tracking-wide text-cyan-600 dark:text-cyan-400 mb-0.5">
                  TEMPORAL VELOCITY
                </p>
                <h3 className="font-display font-semibold text-slate-900 dark:text-white text-base">
                  Monthly Trajectory & Execution Pace
                </h3>
              </div>

              {/* Metric Toggle */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-ink-950 p-1 rounded-xl border border-slate-200 dark:border-ink-800 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setChartMetric('expenditure')}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                    chartMetric === 'expenditure'
                      ? 'bg-white dark:bg-ink-800 text-slate-900 dark:text-white shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Expenditure (₹ Cr)
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric('overrun')}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                    chartMetric === 'overrun'
                      ? 'bg-white dark:bg-ink-800 text-slate-900 dark:text-white shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Cost Overrun (%)
                </button>
              </div>
            </div>

            <div className="h-56">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="velocityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartMetric === 'expenditure' ? '#06b6d4' : '#f59e0b'} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={chartMetric === 'expenditure' ? '#06b6d4' : '#f59e0b'} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.4} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={{ stroke: '#cbd5e1', opacity: 0.3 }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) =>
                        chartMetric === 'expenditure' ? `₹${(val / 1000).toFixed(0)}k` : `${val}%`
                      }
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload
                          return (
                            <div className="rounded-xl border border-slate-200 dark:border-ink-800 bg-white/95 dark:bg-ink-950/95 backdrop-blur-md p-3 shadow-xl text-xs">
                              <p className="font-bold text-slate-900 dark:text-white mb-1.5">
                                {label} (2026 Snapshot)
                              </p>
                              <div className="space-y-1 text-slate-600 dark:text-slate-300">
                                <p className="flex justify-between gap-4">
                                  <span>Expenditure:</span>
                                  <strong className="text-cyan-500">₹ {data.expenditure.toLocaleString()} Cr</strong>
                                </p>
                                <p className="flex justify-between gap-4">
                                  <span>Cost Overrun:</span>
                                  <strong className={data.overrun > 0 ? 'text-amber-500' : 'text-emerald-500'}>
                                    {data.overrun}%
                                  </strong>
                                </p>
                                <p className="flex justify-between gap-4">
                                  <span>Active Projects:</span>
                                  <strong className="text-slate-800 dark:text-slate-200">{data.projects}</strong>
                                </p>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey={chartMetric === 'expenditure' ? 'expenditure' : 'overrun'}
                      stroke={chartMetric === 'expenditure' ? '#06b6d4' : '#f59e0b'}
                      strokeWidth={2.5}
                      fill="url(#velocityGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Loading monthly trend telemetry...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sector Capital Allocation Distribution */}
      <div className="rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-6 shadow-card">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs font-semibold tracking-wide text-cyan-600 dark:text-cyan-400 mb-1">
              PORTFOLIO COMPOSITION
            </p>
            <h3 className="font-display font-semibold text-slate-900 dark:text-white text-lg">
              Sector Distribution in {selectedState}
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {stateDetail?.sectorMix.length || 0} active operational sectors
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stateDetail?.sectorMix && stateDetail.sectorMix.length > 0 ? (
            stateDetail.sectorMix.map((s) => (
              <div
                key={s.sector}
                className="p-4 rounded-xl bg-slate-50 dark:bg-ink-950 border border-slate-100 dark:border-ink-800/80 space-y-2"
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-800 dark:text-slate-200 truncate pr-2">{s.sector}</span>
                  <span className="text-cyan-600 dark:text-cyan-400 font-tabular font-bold">{s.pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-ink-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(5, s.pct))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                  <span>Volume</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {s.count} {s.count === 1 ? 'project' : 'projects'}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-8 text-center text-sm text-slate-400">
              No sector allocation data registered for this state.
            </div>
          )}
        </div>
      </div>

      {/* Priority At-Risk Distressed Projects in Selected State */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-xs font-semibold tracking-wide text-cyan-600 dark:text-cyan-400 mb-1">
              RISK INTELLIGENCE &bull; ML RANKED
            </p>
            <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Priority Projects in {selectedState}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Identified by XGBoost predictive cost overrun and schedule slip algorithms for ministerial oversight.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-400 bg-slate-100 dark:bg-ink-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-ink-800">
            {stateDetail?.priorityProjects.length ?? 0} High-Priority Signals
          </span>
        </div>

        {stateDetail?.priorityProjects && stateDetail.priorityProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {stateDetail.priorityProjects.map((proj) => (
              <ProjectCard key={proj.id} project={proj} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-emerald-500/30 bg-emerald-500/5 p-8 text-center space-y-2">
            <CheckCircle2 className="mx-auto text-emerald-500" size={32} />
            <h4 className="font-display font-semibold text-slate-900 dark:text-white">
              Zero Critical Interventions Flagged
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              All monitored projects in {selectedState} are currently executing within their baseline schedule and budget tolerances.
            </p>
          </div>
        )}
      </div>

      {/* State Comparative Leaderboard Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-xs font-semibold tracking-wide text-cyan-600 dark:text-cyan-400 mb-1">
              SOVEREIGN LEADERBOARD
            </p>
            <h3 className="font-display font-semibold text-slate-900 dark:text-white text-lg">
              National Cross-State Benchmark
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Click any row to switch active state inspection
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-ink-800 text-slate-400 uppercase text-[10px] font-semibold tracking-wider">
                <th className="py-3 px-3">State / Union Territory</th>
                <th className="py-3 px-3 text-right">Projects</th>
                <th className="py-3 px-3 text-right">Cost Variance</th>
                <th className="py-3 px-3 text-right">Health Score</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-ink-800/60">
              {stateList.slice(0, 10).map((st, idx) => {
                const isSelected = selectedState.toLowerCase() === st.state.toLowerCase()
                const health = Math.max(0, Math.min(100, Math.round(100 - Math.max(0, st.avg_cost_overrun_pct))))
                return (
                  <tr
                    key={st.state}
                    onClick={() => setSelectedState(st.state)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-cyan-500/10 dark:bg-cyan-500/15 font-semibold'
                        : 'hover:bg-slate-50 dark:hover:bg-ink-800/40'
                    }`}
                  >
                    <td className="py-3 px-3 flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 w-4 font-mono">#{idx + 1}</span>
                      <span className="text-slate-900 dark:text-white">{st.state}</span>
                      {isSelected && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-500 text-white font-bold">
                          ACTIVE
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-tabular text-slate-700 dark:text-slate-300">
                      {st.project_count}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-tabular font-medium ${
                        st.avg_cost_overrun_pct > 15
                          ? 'text-rose-500'
                          : st.avg_cost_overrun_pct < 0
                          ? 'text-emerald-500'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {st.avg_cost_overrun_pct > 0 ? `+${st.avg_cost_overrun_pct}%` : `${st.avg_cost_overrun_pct}%`}
                    </td>
                    <td className="py-3 px-3 text-right font-tabular font-bold text-slate-900 dark:text-white">
                      {health}/100
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          health >= 80
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : health >= 60
                            ? 'bg-amber-500/10 text-amber-500'
                            : 'bg-rose-500/10 text-rose-500'
                        }`}
                      >
                        {health >= 80 ? 'On Track' : health >= 60 ? 'Watch' : 'At Risk'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="text-cyan-600 dark:text-cyan-400 flex items-center justify-end gap-0.5 text-[11px] font-medium hover:underline">
                        View <ChevronRight size={12} />
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
