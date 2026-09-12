export type ProjectStatus = 'On Track' | 'Watch' | 'At Risk'

export type Sector = 'Railways' | 'Roads & Highways' | 'Urban Transport' | 'Power & RE' | string

export interface DeliveryStage {
  label: 'Sanctioned' | 'Planning' | 'Construction' | 'Current' | 'Expected'
  reached: boolean
}

export interface ShapDriver {
  feature: string
  shap_value: number
}

export interface EarlyWarning {
  warning_type: string
  severity: 'Low' | 'Medium' | 'High' | string
  signal_value: number
}

export interface Project {
  id: string
  name: string
  ministry: string
  sector: Sector
  state: string
  status: ProjectStatus
  physicalProgress: number
  financialProgress: number
  health: number
  costOverrunRisk: number
  timeOverrunRisk: number
  originalCompletion: string
  predictedCompletion: string
  expenditure: string
  costVariance: number
  timeVariance: number
  currentStageIndex: number
  reviewReason: string
  flags: { label: string; tone: 'positive' | 'negative' | 'neutral' }[]
  final_risk_score?: number
  risk_level?: string
  sanctioned_cost?: number
  cost_cr?: number
  contractor?: Contractor
  contractor_id?: string
  contractor_name?: string
}

/** A project as returned by the backend's geospatial feed (`/api/projects?map=true`). */
export interface MapProject {
  id: string
  project_id?: string
  name: string
  sector: string
  state: string
  /** Functional state-centroid coordinates (display-only, for pinning). */
  lat: number
  lng: number
  cost_cr?: number
  physical_progress_pct?: number
  expenditure_cr?: number
  status: ProjectStatus | string
  risk_score?: number
  risk_level?: 'Low' | 'Medium' | 'High' | 'Critical' | string
  agency?: string
}

export interface ProjectTimelineSnapshot {
  month: string
  physical_progress_pct: number
  financial_progress_pct: number
  cumulative_expenditure: number
  revised_cost: number
  cost_overrun_to_date_pct: number
  schedule_slip_months: number
}

export interface ProjectDetailData extends Project {
  cop_prob?: number
  top_prob?: number
  model_risk_score?: number
  rule_risk_score?: number
  final_risk_score?: number
  risk_level?: string
  shap_drivers?: ShapDriver[]
  warnings?: EarlyWarning[]
  sector_risk_baseline?: number
  state_risk_baseline?: number
  sanctioned_cost?: number
  revised_cost?: number
  cumulative_expenditure?: number
  duration_months?: number
}

export interface PortfolioSummary {
  total_projects: number
  projects_at_risk: number
  projects_watch: number
  projects_on_track: number
  avg_health: number
  avg_cost_overrun_pct: number
  avg_cop_prob: number
  avg_top_prob: number
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  top_risk_projects: Project[]
}

export interface NationalTrendItem {
  month: string
  original_cost_cr: number
  revised_cost_cr: number
  cumulative_expenditure_cr: number
  national_cost_overrun_pct: number
}

export interface SectorBaselineItem {
  sector: string
  project_count: number
  avg_cost_overrun_pct: number
  avg_expenditure: number
}

export interface StateBaselineItem {
  state: string
  project_count: number
  avg_cost_overrun_pct: number
}

export interface StateDetailData {
  name: string
  health: number
  projects: number
  investment: string
  expenditure: string
  atRisk: number
  timeExposure: string
  sectorMix: { sector: string; count: number; pct: number }[]
  monthlyTrends: {
    month: string
    project_count: number
    original_cost_cr: number
    revised_cost_cr: number
    expenditure_cr: number
    cost_overrun_pct: number
  }[]
  priorityProjects: Project[]
}

export interface StateRecord {
  name: string
  health: number
  projects: number
  investment: string
  atRisk: number
  timeExposure: string
  sectorMix: { sector: string; pct: number }[]
  velocity: number[]
}

export interface StateProjectData {
  name: string
  totalProjects: number
  health?: number
}

export interface NotificationItem {
  id: string
  message: string
  time: string
  tag: string
  tone: 'red' | 'cyan' | 'green'
}

export interface ReportDef {
  id: string
  title: string
  description: string
  cadence: string
}

export interface Contractor {
  contractor_id: string
  company_name: string
  contact_person: string
  email: string
  phone: string
  rating?: number
  active_contracts?: number
}

export interface GeofenceLamina {
  project_id: string
  center_lat: number
  center_lng: number
  radius_km: number
  boundary_lamina: [number, number][]
  boundary_geojson?: {
    type: string
    coordinates: number[][][]
  }
}

export interface ContractorProject extends Project {
  contractor?: Contractor
  geofence?: GeofenceLamina
}

export interface ContractorSubmission {
  id?: number
  submission_id: string
  project_id: string
  contractor_id: string
  physical_progress_pct?: number
  financial_expenditure_cr?: number
  notes?: string
  photo_url?: string
  gps_lat?: number
  gps_lng?: number
  inside_geofence: number | boolean
  verification_status: string
  counts_towards_progress: number | boolean
  submitted_at: string
  message?: string
  details_json?: string
}

export type UserRole = 'admin' | 'contractor' | 'guest'

export interface AuthUser {
  id: string
  name: string
  company?: string
  role: UserRole
  email: string
  title?: string
  phone?: string
  agency?: string
  rating?: number
}


