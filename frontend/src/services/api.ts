import type {
  EarlyWarning,
  MapProject,
  NationalTrendItem,
  PortfolioSummary,
  Project,
  ProjectDetailData,
  ProjectTimelineSnapshot,
  SectorBaselineItem,
  StateBaselineItem,
  StateDetailData,
} from '../types'
import { projects as mockProjects, states as mockStates } from '../data/mockData'
import { stateCentroids } from '../data/stateCentroids'

const BASE_URL = '' // Proxy forwards /api requests to http://127.0.0.1:8000

export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  try {
    const res = await fetch(`${BASE_URL}/api/portfolio/summary`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn('Backend unavailable, using fallback portfolio summary', err)
    return {
      total_projects: 317,
      projects_at_risk: 42,
      projects_watch: 73,
      projects_on_track: 202,
      avg_health: 74.5,
      avg_cost_overrun_pct: 7.8,
      avg_cop_prob: 38.2,
      avg_top_prob: 46.1,
      critical_count: 14,
      high_count: 28,
      medium_count: 73,
      low_count: 202,
      top_risk_projects: mockProjects.slice(0, 5),
    }
  }
}

export async function getProjects(params?: {
  sector?: string
  state?: string
  risk_level?: string
  limit?: number
}): Promise<Project[]> {
  try {
    const query = new URLSearchParams()
    if (params?.sector && params.sector !== 'All Sectors') query.set('sector', params.sector)
    if (params?.state) query.set('state', params.state)
    if (params?.risk_level) query.set('risk_level', params.risk_level)
    if (params?.limit) query.set('limit', String(params.limit))

    const url = `${BASE_URL}/api/projects${query.toString() ? `?${query.toString()}` : ''}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data && data.length > 0 ? data : mockProjects
  } catch (err) {
    console.warn('Backend unavailable, using fallback projects', err)
    return mockProjects
  }
}

/* ------------------------------------------------------------------ *
 * Geospatial feed (/api/projects?map=true)
 * ------------------------------------------------------------------ */

/** `GET /api/projects?map=true` → `{ mode, projects[] }` with lat/lng per project. */
export interface MapProjectsResponse {
  mode: 'live' | 'fallback'
  projects: MapProject[]
}

/** Deterministic string hash → stable pseudo-random offsets (no Math.random). */
function seedFrom(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Pseudo-random value in [-1, 1] that is stable for a given seed string. */
function jitter(seed: string, scale = 0.5): number {
  const x = Math.sin(seedFrom(seed)) * 43758.5453
  return ((x - Math.floor(x)) * 2 - 1) * scale
}

/** Resolve a state display name (comma/ampersand tolerant) to a centroid. */
function centroidFor(state: string): [number, number] | null {
  const first = state.split('/')[0].split(',')[0].trim()
  const key = first.toLowerCase()
  const aliases: Record<string, string> = {
    'andaman & nicobar islands': 'Andaman & Nicobar',
    'jammu & kashmir': 'Jammu & Kashmir',
    'nct of delhi': 'Delhi',
    delhi: 'Delhi',
    'new delhi': 'Delhi',
    orissa: 'Odisha',
    pondicherry: 'Puducherry',
    telangana: 'Telangana',
    'uttar pradesh': 'Uttar Pradesh',
    'andhra pradesh': 'Andhra Pradesh',
    'arunachal pradesh': 'Arunachal Pradesh',
    'himachal pradesh': 'Himachal Pradesh',
    'madya pradesh': 'Madhya Pradesh',
    'tamil nadu': 'Tamil Nadu',
    'west bengal': 'West Bengal',
  }
  const resolved = aliases[key] ?? first
  return stateCentroids[resolved] ?? null
}

/**
 * Build a deterministic demo set of map projects from the bundled mock data.
 * Only used when the backend is unreachable — state centroids mirror the
 * backend exactly, and the pseudo-random jitter is seeded per project id so
 * the map is stable across reloads.
 */
export function buildFallbackMapProjects(): MapProject[] {
  const result: MapProject[] = []
  for (const p of mockProjects) {
    const c = centroidFor(p.state)
    if (!c) continue
    const lat = Math.max(6, Math.min(37.5, c[0] + jitter(`${p.id}-lat`, 0.45)))
    const lng = Math.max(68, Math.min(97.5, c[1] + jitter(`${p.id}-lng`, 0.6)))
    const status = p.status
    result.push({
      id: p.id,
      project_id: p.id,
      name: p.name,
      sector: p.sector,
      state: p.state,
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      physical_progress_pct: p.physicalProgress,
      status,
      risk_score: Math.round(100 - p.health),
      risk_level: status === 'At Risk' ? 'High' : status === 'Watch' ? 'Medium' : 'Low',
    })
  }
  return result
}

/** Fetch geospatial project markers. Falls back to the deterministic demo set. */
export async function getMapProjects(): Promise<MapProjectsResponse> {
  try {
    const res = await fetch(`${BASE_URL}/api/projects?map=true`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data && Array.isArray(data.projects) && data.projects.length > 0) {
      return { mode: 'live', projects: data.projects }
    }
    return { mode: 'fallback', projects: buildFallbackMapProjects() }
  } catch (err) {
    console.warn('Backend unavailable, using fallback map projects', err)
    return { mode: 'fallback', projects: buildFallbackMapProjects() }
  }
}

export async function getProjectDetail(id: string): Promise<ProjectDetailData> {
  try {
    const res = await fetch(`${BASE_URL}/api/projects/${id}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn(`Backend unavailable for project ${id}, using fallback`, err)
    const fallback = mockProjects.find((p) => p.id === id) || mockProjects[0]
    return {
      ...fallback,
      cop_prob: (fallback.costOverrunRisk || 15) / 100,
      top_prob: (fallback.timeOverrunRisk || 25) / 100,
      model_risk_score: 55,
      rule_risk_score: 45,
      final_risk_score: 100 - fallback.health,
      risk_level: fallback.status === 'At Risk' ? 'High' : fallback.status === 'Watch' ? 'Medium' : 'Low',
      shap_drivers: [
        { feature: 'schedule_slip_months', shap_value: 0.32 },
        { feature: 'financial_physical_gap', shap_value: 0.24 },
        { feature: 'sector_risk_baseline', shap_value: 0.16 },
        { feature: 'cost_overrun_to_date_pct', shap_value: 0.11 },
        { feature: 'expenditure_rate', shap_value: -0.08 },
      ],
      warnings: [
        { warning_type: 'schedule_slip', severity: 'High', signal_value: fallback.timeVariance },
        { warning_type: 'cost_overrun_breach', severity: 'Medium', signal_value: fallback.costVariance },
      ],
      sanctioned_cost: 15000,
      revised_cost: 16800,
      cumulative_expenditure: 8900,
      duration_months: 60,
    }
  }
}

export async function getProjectTimeline(id: string): Promise<ProjectTimelineSnapshot[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/projects/${id}/timeline`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn(`Backend unavailable for timeline ${id}, using generated snapshots`, err)
    return [
      { month: 'Feb', physical_progress_pct: 20, financial_progress_pct: 18, cumulative_expenditure: 2000, revised_cost: 15000, cost_overrun_to_date_pct: 0, schedule_slip_months: 0 },
      { month: 'March', physical_progress_pct: 28, financial_progress_pct: 26, cumulative_expenditure: 3200, revised_cost: 15200, cost_overrun_to_date_pct: 1.3, schedule_slip_months: 0.5 },
      { month: 'April', physical_progress_pct: 35, financial_progress_pct: 36, cumulative_expenditure: 4600, revised_cost: 15600, cost_overrun_to_date_pct: 4.0, schedule_slip_months: 1.2 },
      { month: 'May', physical_progress_pct: 44, financial_progress_pct: 46, cumulative_expenditure: 6100, revised_cost: 16000, cost_overrun_to_date_pct: 6.7, schedule_slip_months: 2.1 },
      { month: 'June', physical_progress_pct: 52, financial_progress_pct: 54, cumulative_expenditure: 7500, revised_cost: 16400, cost_overrun_to_date_pct: 9.3, schedule_slip_months: 3.4 },
      { month: 'July', physical_progress_pct: 60, financial_progress_pct: 62, cumulative_expenditure: 8900, revised_cost: 16800, cost_overrun_to_date_pct: 12.0, schedule_slip_months: 4.8 },
    ]
  }
}

export async function getNationalTrends(): Promise<NationalTrendItem[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/trends/national`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn('Backend unavailable, using fallback national trends', err)
    return [
      { month: 'Feb', original_cost_cr: 1420000, revised_cost_cr: 1510000, cumulative_expenditure_cr: 820000, national_cost_overrun_pct: 6.3 },
      { month: 'March', original_cost_cr: 1440000, revised_cost_cr: 1540000, cumulative_expenditure_cr: 860000, national_cost_overrun_pct: 6.9 },
      { month: 'April', original_cost_cr: 1470000, revised_cost_cr: 1580000, cumulative_expenditure_cr: 900000, national_cost_overrun_pct: 7.5 },
      { month: 'May', original_cost_cr: 1500000, revised_cost_cr: 1630000, cumulative_expenditure_cr: 950000, national_cost_overrun_pct: 8.7 },
      { month: 'June', original_cost_cr: 1530000, revised_cost_cr: 1675000, cumulative_expenditure_cr: 1010000, national_cost_overrun_pct: 9.5 },
      { month: 'July', original_cost_cr: 1550000, revised_cost_cr: 1707000, cumulative_expenditure_cr: 1060000, national_cost_overrun_pct: 10.1 },
    ]
  }
}

export async function getSectorBaselines(): Promise<SectorBaselineItem[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/baselines/sectors`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn('Backend unavailable, using fallback sector baselines', err)
    return [
      { sector: 'Roads & Highways', project_count: 61, avg_cost_overrun_pct: 15.2, avg_expenditure: 2177.8 },
      { sector: 'Railways', project_count: 54, avg_cost_overrun_pct: 11.4, avg_expenditure: 3050.5 },
      { sector: 'Power & RE', project_count: 48, avg_cost_overrun_pct: 10.9, avg_expenditure: 2532.5 },
      { sector: 'Urban Transport', project_count: 42, avg_cost_overrun_pct: 18.5, avg_expenditure: 1831.1 },
    ]
  }
}

export async function getStateBaselines(): Promise<StateBaselineItem[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/baselines/states`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn('Backend unavailable, using fallback state baselines', err)
    return mockStates.map((s) => ({
      state: s.name,
      project_count: s.projects,
      avg_cost_overrun_pct: s.atRisk,
    }))
  }
}

export async function getWarnings(limit: number = 30): Promise<EarlyWarning[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/warnings?limit=${limit}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn('Backend unavailable, using fallback warnings', err)
    return [
      { warning_type: 'schedule_slip', severity: 'High', signal_value: 8.4 },
      { warning_type: 'cost_overrun_breach', severity: 'High', signal_value: 24.2 },
      { warning_type: 'financial_physical_gap', severity: 'Medium', signal_value: 16.5 },
      { warning_type: 'behind_schedule', severity: 'Medium', signal_value: -14.2 },
    ]
  }
}

export interface CustomPredictionInput {
  sector: string
  state: string
  sanctioned_cost: number
  duration_months: number
  months_elapsed: number
  physical_progress_pct: number
  financial_progress_pct: number
  cost_overrun_to_date_pct: number
  schedule_slip_months: number
  cumulative_expenditure: number
  revised_cost: number
}

export async function predictCustomProject(data: CustomPredictionInput): Promise<ProjectDetailData> {
  const res = await fetch(`${BASE_URL}/api/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Prediction failed with HTTP ${res.status}`)
  return await res.json()
}

export interface AINarrative {
  project_id: string | null
  narrative: string | null
  model: string
  available: boolean
  error: string | null
  source: 'openrouter' | 'template'
}

/** Ask the OpenRouter-backed endpoint for a natural-language risk brief. */
export async function getAINarrative(projectId: string): Promise<AINarrative> {
  try {
    const res = await fetch(`${BASE_URL}/api/llm/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn(`LLM narrative unavailable for ${projectId}, using template`, err)
    return {
      project_id: projectId,
      narrative: null,
      model: 'template',
      available: false,
      error: err instanceof Error ? err.message : 'request failed',
      source: 'template',
    }
  }
}

export interface RegisterProjectPayload {
  name?: string
  ministry?: string
  sector: string
  state: string
  sanctioned_cost: number
  revised_cost?: number
  duration_months?: number
  months_elapsed?: number
  physical_progress_pct?: number
  financial_progress_pct?: number
  cost_overrun_to_date_pct?: number
  schedule_slip_months?: number
  cumulative_expenditure?: number
  sanctioned_date?: string
  original_end_date?: string
}

export async function registerNewProject(data: RegisterProjectPayload): Promise<Project> {
  const res = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Registration failed with HTTP ${res.status}`)
  return await res.json()
}

export async function getStateDetail(stateName: string): Promise<StateDetailData> {
  try {
    const res = await fetch(`${BASE_URL}/api/states/${encodeURIComponent(stateName)}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn(`Failed to fetch state detail for ${stateName}, using fallback`, err)
    const fallback = mockStates.find((s) => s.name === stateName) || mockStates[0]
    return {
      name: fallback.name,
      health: fallback.health,
      projects: fallback.projects,
      investment: fallback.investment,
      expenditure: '₹ 4.12L Cr',
      atRisk: fallback.atRisk,
      timeExposure: fallback.timeExposure,
      sectorMix: fallback.sectorMix.map((s) => ({ sector: s.sector, count: 10, pct: s.pct })),
      monthlyTrends: fallback.velocity.map((v, i) => ({
        month: ['Feb', 'March', 'April', 'May', 'June', 'July'][i] || `M${i + 1}`,
        project_count: fallback.projects,
        original_cost_cr: 100000,
        revised_cost_cr: 115000,
        expenditure_cr: v * 1000,
        cost_overrun_pct: fallback.atRisk,
      })),
      priorityProjects: mockProjects.slice(0, 3),
    }
  }
}

