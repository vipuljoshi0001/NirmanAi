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
  AuthUser,
  Contractor,
  ContractorProject,
  ContractorSubmission,
  GeofenceLamina,
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

/* ------------------------------------------------------------------ *
 * Contractor Portal, Geofence Lamina & Unified Authentication API
 * ------------------------------------------------------------------ */

export const FALLBACK_CONTRACTORS: Contractor[] = [
  {
    contractor_id: 'CNT-LT-01',
    company_name: 'Larsen & Toubro Heavy Civil Infra',
    contact_person: 'S. Ramanathan (VP Projects)',
    email: 'ramanathan.s@lntecc.com',
    phone: '+91 22 6752 5656',
    rating: 4.8,
    active_contracts: 6,
  },
  {
    contractor_id: 'CNT-AF-02',
    company_name: 'Afcons Infrastructure Limited',
    contact_person: 'Rajiv K. Menon (Chief Eng)',
    email: 'ops.infra@afcons.com',
    phone: '+91 22 6719 1000',
    rating: 4.6,
    active_contracts: 5,
  },
  {
    contractor_id: 'CNT-TP-03',
    company_name: 'Tata Projects Limited',
    contact_person: 'Ananya Sharma (Project Director)',
    email: 'asharma@tataprojects.com',
    phone: '+91 40 6623 8800',
    rating: 4.7,
    active_contracts: 5,
  },
  {
    contractor_id: 'CNT-DB-04',
    company_name: 'Dilip Buildcon Limited',
    contact_person: 'Rohan Suryavanshi (Exec Director)',
    email: 'highways@dilipbuildcon.co.in',
    phone: '+91 755 402 9999',
    rating: 4.4,
    active_contracts: 4,
  },
  {
    contractor_id: 'CNT-ME-05',
    company_name: 'Megha Engineering & Infrastructures Ltd',
    contact_person: 'V. K. Reddy (Director Ops)',
    email: 'vkreddy@meil.in',
    phone: '+91 40 4433 6700',
    rating: 4.5,
    active_contracts: 4,
  },
]

export function generateClientLamina(centerLat: number, centerLng: number, radiusKm = 3.5): [number, number][] {
  const coords: [number, number][] = []
  const latScale = radiusKm / 111.0
  const lngScale = radiusKm / (111.0 * Math.max(0.1, Math.cos((centerLat * Math.PI) / 180)))
  for (let i = 0; i < 6; i++) {
    const angle = (2 * Math.PI * i) / 6
    const rMod = 0.85 + 0.3 * ((i % 3) / 2.0)
    const pLat = Number((centerLat + Math.sin(angle) * latScale * rMod).toFixed(6))
    const pLng = Number((centerLng + Math.cos(angle) * lngScale * rMod).toFixed(6))
    coords.push([pLat, pLng])
  }
  return coords
}

export function isPointInsideLamina(lat: number, lng: number, polygon: [number, number][]): boolean {
  if (!polygon || polygon.length < 3) return false
  let inside = false
  const n = polygon.length
  let p1Lat = polygon[0][0]
  let p1Lng = polygon[0][1]

  for (let i = 1; i <= n; i++) {
    const p2Lat = polygon[i % n][0]
    const p2Lng = polygon[i % n][1]
    if (Math.min(p1Lat, p2Lat) < lat && lat <= Math.max(p1Lat, p2Lat)) {
      if (lng <= Math.max(p1Lng, p2Lng)) {
        let xInters = p1Lng
        if (p1Lat !== p2Lat) {
          xInters = ((lat - p1Lat) * (p2Lng - p1Lng)) / (p2Lat - p1Lat) + p1Lng
        }
        if (p1Lng === p2Lng || lng <= xInters) {
          inside = !inside
        }
      }
    }
    p1Lat = p2Lat
    p1Lng = p2Lng
  }
  return inside
}

export async function authLogin(
  role: 'admin' | 'contractor',
  id?: string,
  password?: string
): Promise<{ status: string; role: string; user: AuthUser; token: string }> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role,
      username: id || (role === 'admin' ? 'admin' : 'CNT-LT-01'),
      contractor_id: id || 'CNT-LT-01',
      password: password || (role === 'admin' ? 'admin123' : 'contractor123'),
    }),
  })
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const data = await res.json()
      if (data.detail) msg = data.detail
    } catch {}
    throw new Error(msg)
  }
  return await res.json()
}

export async function getNotifications(role: string, contractorId?: string): Promise<{ notifications: any[]; unread_count: number }> {
  try {
    const url = `${BASE_URL}/api/notifications?role=${encodeURIComponent(role)}&contractor_id=${encodeURIComponent(contractorId || '')}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn('Failed to fetch notifications', err)
    return { notifications: [], unread_count: 0 }
  }
}

export async function assignContractor(
  projectId: string,
  contractorId: string,
  packageName?: string,
  contractValueCr?: number
): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/admin/assign-contractor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      contractor_id: contractorId,
      package_name: packageName,
      contract_value_cr: contractValueCr,
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to assign contractor`)
  return await res.json()
}

export async function setAdminGeofence(
  projectId: string,
  centerLat: number,
  centerLng: number,
  radiusKm: number = 3.5
): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/admin/geofence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      center_lat: centerLat,
      center_lng: centerLng,
      radius_km: radiusKm,
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to set geofence`)
  return await res.json()
}

export async function getAdminAudits(limit: number = 100): Promise<any[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/admin/audits?limit=${limit}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn('Failed to fetch admin audits', err)
    return []
  }
}

export async function registerProject(projectData: any): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(projectData),
  })
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const d = await res.json()
      if (d.detail) msg = d.detail
    } catch {}
    throw new Error(msg)
  }
  return await res.json()
}

export async function getContractors(): Promise<Contractor[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/contractors`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn('Backend unavailable, using fallback contractors', err)
    return FALLBACK_CONTRACTORS
  }
}

export async function getContractorProjects(contractorId: string): Promise<ContractorProject[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/contractors/${contractorId}/projects`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn('Backend unavailable, using fallback contractor projects', err)
    const c = FALLBACK_CONTRACTORS.find((x) => x.contractor_id === contractorId) || FALLBACK_CONTRACTORS[0]
    // Filter or match projects from mock
    return mockProjects.slice(0, 4).map((p, idx) => {
      const lat = 19.012 + idx * 0.15
      const lng = 72.831 + idx * 0.2
      return {
        ...p,
        contractor: c,
        geofence: {
          project_id: p.id,
          center_lat: lat,
          center_lng: lng,
          radius_km: 3.5,
          boundary_lamina: generateClientLamina(lat, lng, 3.5),
        },
      }
    })
  }
}

export async function getProjectGeofence(projectId: string): Promise<GeofenceLamina> {
  try {
    const res = await fetch(`${BASE_URL}/api/projects/${projectId}/geofence`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn('Failed to fetch geofence, using fallback', err)
    return {
      project_id: projectId,
      center_lat: 19.076,
      center_lng: 72.878,
      radius_km: 3.5,
      boundary_lamina: generateClientLamina(19.076, 72.878, 3.5),
    }
  }
}

export async function submitContractorProgress(formData: FormData): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/contractor/submit-progress`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to submit progress`)
  return await res.json()
}

export async function getContractorSubmissions(contractorId: string): Promise<ContractorSubmission[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/contractor/${contractorId}/submissions`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn('Failed to fetch submissions, returning empty', err)
    return []
  }
}

export async function getDatabasesStatus(): Promise<any> {
  try {
    const res = await fetch(`${BASE_URL}/api/databases/status`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn('Failed to fetch databases status', err)
    return null
  }
}


