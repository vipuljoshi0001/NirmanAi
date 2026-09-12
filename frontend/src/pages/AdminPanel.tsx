import React, { useState, useEffect, useMemo } from 'react'
import {
  ShieldCheck,
  Building2,
  MapPin,
  FileCheck2,
  Layers,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  HardHat,
  Filter,
  Eye,
  X,
  Compass,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  getProjects,
  getContractors,
  assignContractor,
  registerProject,
  getAdminAudits,
  setAdminGeofence,
} from '../services/api'
import { stateCentroids } from '../data/stateCentroids'
import { GeofenceMap } from '../components/GeofenceMap'
import type { Project, Contractor, Sector } from '../types'

const sectors: Sector[] = [
  'Roads & Highways',
  'Railways',
  'Urban Transport',
  'Power & RE',
  'Oil & Gas',
  'Aviation & Aviation Infrastructure',
  'Water Resources',
  'Urban Development',
]

const statesList = [
  'Maharashtra',
  'Uttar Pradesh',
  'Gujarat',
  'Delhi',
  'Karnataka',
  'Tamil Nadu',
  'West Bengal',
  'Telangana',
  'Rajasthan',
  'Bihar',
  'Madhya Pradesh',
  'Kerala',
  'Odisha',
  'Punjab',
  'Haryana',
  'Assam',
  'Jharkhand',
  'Andhra Pradesh',
]

export default function AdminPanel() {
  const { role, user, setLoginModalOpen } = useAuth()
  const [activeTab, setActiveTab] = useState<'states' | 'add-project' | 'audits'>('states')

  // State Assignments Tab state
  const [selectedState, setSelectedState] = useState<string>('Maharashtra')
  const [stateProjects, setStateProjects] = useState<Project[]>([])
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [loadingProjects, setLoadingProjects] = useState<boolean>(false)
  const [assignModalProject, setAssignModalProject] = useState<Project | null>(null)
  const [selectedContractorId, setSelectedContractorId] = useState<string>('CNT-LT-01')
  const [packageName, setPackageName] = useState<string>('')
  const [contractValue, setContractValue] = useState<string>('')
  const [assignSuccessMsg, setAssignSuccessMsg] = useState<string | null>(null)
  const [isAssigning, setIsAssigning] = useState<boolean>(false)

  // Add Project Tab state
  const [projectName, setProjectName] = useState<string>('')
  const [projectSector, setProjectSector] = useState<Sector>('Roads & Highways')
  const [projectState, setProjectState] = useState<string>('Maharashtra')
  const [sanctionedCost, setSanctionedCost] = useState<string>('1500')
  const [durationMonths, setDurationMonths] = useState<string>('36')
  const [physicalProgress, setPhysicalProgress] = useState<string>('20')
  const [financialProgress, setFinancialProgress] = useState<string>('18')
  const [centerLat, setCenterLat] = useState<number>(19.076)
  const [centerLng, setCenterLng] = useState<number>(72.878)
  const [radiusKm, setRadiusKm] = useState<number>(3.5)
  const [projectContractorId, setProjectContractorId] = useState<string>('CNT-LT-01')
  const [isSubmittingProject, setIsSubmittingProject] = useState<boolean>(false)
  const [newProjectResult, setNewProjectResult] = useState<any | null>(null)
  const [projectError, setProjectError] = useState<string | null>(null)

  // Audits Tab state
  const [audits, setAudits] = useState<any[]>([])
  const [loadingAudits, setLoadingAudits] = useState<boolean>(false)
  const [auditFilter, setAuditFilter] = useState<'all' | 'approved' | 'rejected'>('all')
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null)

  // Load contractors and initial state projects
  useEffect(() => {
    getContractors()
      .then((data) => {
        if (data && data.length > 0) setContractors(data)
      })
      .catch((err) => console.warn('Failed to load contractors', err))
  }, [])

  const loadStateProjects = (state: string) => {
    setLoadingProjects(true)
    getProjects({ state })
      .then((data) => {
        setStateProjects(data || [])
      })
      .catch((err) => console.warn('Failed to load state projects', err))
      .finally(() => setLoadingProjects(false))
  }

  useEffect(() => {
    loadStateProjects(selectedState)
  }, [selectedState])

  const loadAudits = () => {
    setLoadingAudits(true)
    getAdminAudits(100)
      .then((data) => {
        setAudits(data || [])
      })
      .catch((err) => console.warn('Failed to load audits', err))
      .finally(() => setLoadingAudits(false))
  }

  useEffect(() => {
    if (activeTab === 'audits') {
      loadAudits()
    }
  }, [activeTab])

  // Update center coords when user changes state in Add Project form
  const handleStateChangeInForm = (st: string) => {
    setProjectState(st)
    const centroid = stateCentroids[st]
    if (centroid) {
      setCenterLat(centroid[0])
      setCenterLng(centroid[1])
    }
  }

  // Generate hexagonal boundary vertices for preview
  const previewLamina = useMemo(() => {
    const coords: [number, number][] = []
    const R = 6371
    for (let i = 0; i < 6; i++) {
      const angle = (i * 60 * Math.PI) / 180
      const dLat = (radiusKm / R) * (180 / Math.PI) * Math.cos(angle)
      const dLng =
        ((radiusKm / (R * Math.cos((centerLat * Math.PI) / 180))) *
          (180 / Math.PI)) *
        Math.sin(angle)
      coords.push([
        Number((centerLat + dLat).toFixed(6)),
        Number((centerLng + dLng).toFixed(6)),
      ])
    }
    return coords
  }, [centerLat, centerLng, radiusKm])

  // Handle Contractor Assignment
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assignModalProject) return
    setIsAssigning(true)
    setAssignSuccessMsg(null)
    try {
      await assignContractor(
        assignModalProject.id,
        selectedContractorId,
        packageName || `Civil Package -- ${assignModalProject.id}`,
        contractValue ? parseFloat(contractValue) : assignModalProject.sanctioned_cost
      )
      setAssignSuccessMsg(`Successfully assigned ${assignModalProject.id} to ${selectedContractorId}!`)
      loadStateProjects(selectedState)
      setTimeout(() => {
        setAssignModalProject(null)
        setAssignSuccessMsg(null)
      }, 1500)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to assign contractor')
    } finally {
      setIsAssigning(false)
    }
  }

  // Handle Add Project & Geofence
  const handleAddProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingProject(true)
    setProjectError(null)
    setNewProjectResult(null)
    try {
      const payload = {
        name: projectName.trim() || `${projectState} ${projectSector} Package`,
        sector: projectSector,
        state: projectState,
        sanctioned_cost: parseFloat(sanctionedCost) || 1000.0,
        duration_months: parseFloat(durationMonths) || 36.0,
        months_elapsed: 12.0,
        physical_progress_pct: parseFloat(physicalProgress) || 20.0,
        financial_progress_pct: parseFloat(financialProgress) || 18.0,
        center_lat: centerLat,
        center_lng: centerLng,
        radius_km: radiusKm,
        contractor_id: projectContractorId,
      }
      const res = await registerProject(payload)
      setNewProjectResult(res)
      setProjectName('')
    } catch (err) {
      setProjectError(err instanceof Error ? err.message : 'Failed to register project')
    } finally {
      setIsSubmittingProject(false)
    }
  }

  // Filtered audits
  const filteredAudits = useMemo(() => {
    if (auditFilter === 'approved') return audits.filter((a) => a.inside_geofence === 1)
    if (auditFilter === 'rejected') return audits.filter((a) => a.inside_geofence === 0)
    return audits
  }, [audits, auditFilter])

  // Non-admin guard banner
  if (role !== 'admin') {
    return (
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-12">
        <div className="rounded-3xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-8 sm:p-12 text-center max-w-xl mx-auto space-y-4 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400">
            <ShieldCheck size={28} />
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Director General Admin Access Required
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Project registration, location geofencing configuration, and state contractor package assignments are restricted exclusively to the Oversight Administrator.
          </p>
          <button
            onClick={() => setLoginModalOpen(true)}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs font-bold shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
          >
            <Building2 size={15} />
            <span>Sign In with Admin ID & Password</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-8 space-y-6">
      {/* Top Banner */}
      <div className="rounded-3xl border border-slate-200 dark:border-ink-800 bg-gradient-to-br from-cyan-500/10 via-white to-blue-500/10 dark:from-cyan-950/30 dark:via-ink-900 dark:to-blue-950/20 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
              <ShieldCheck size={14} />
              <span>Oversight Directorate (Admin Panel)</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              National Infrastructure Administration Workspace
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
              Configure designated construction area lamina geofencing, assign contractors to projects under state packages, and inspect automated photo verification audits.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-2xl bg-white/80 dark:bg-ink-800/80 border border-slate-200 dark:border-ink-700 shadow-sm text-right">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Admin Authority</p>
              <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400">Director General (MoSPI)</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200/80 dark:border-ink-700/80 pb-3">
          <button
            onClick={() => setActiveTab('states')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'states'
                ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800'
            }`}
          >
            <Layers size={15} />
            <span>Assign Projects Under States</span>
          </button>
          <button
            onClick={() => setActiveTab('add-project')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'add-project'
                ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800'
            }`}
          >
            <Plus size={15} />
            <span>Add Project & Geofence Lamina</span>
          </button>
          <button
            onClick={() => setActiveTab('audits')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'audits'
                ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800'
            }`}
          >
            <FileCheck2 size={15} />
            <span>Verification Audits & Submissions</span>
          </button>
        </div>
      </div>

      {/* TAB 1: ASSIGN PROJECTS UNDER STATES */}
      {activeTab === 'states' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-ink-900 p-4 rounded-2xl border border-slate-200 dark:border-ink-800 shadow-sm">
            <div className="flex items-center gap-3">
              <Filter size={18} className="text-cyan-500" />
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Filter State Infrastructure Portfolio:
              </label>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 font-bold text-slate-900 dark:text-white outline-none focus:border-cyan-500 cursor-pointer"
              >
                {statesList.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400">
              Showing <span className="font-bold text-slate-900 dark:text-white">{stateProjects.length}</span> projects in {selectedState}
            </div>
          </div>

          {loadingProjects ? (
            <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
              <span>Loading projects in {selectedState}...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {stateProjects.map((p) => {
                const assignedC = p.contractor
                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-slate-300 font-bold">
                          {p.id}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            p.status === 'On Track'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : p.status === 'Watch'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                        {p.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {p.sector} • {p.state}
                      </p>

                      {/* Progress Metrics */}
                      <div className="pt-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-ink-850">
                          <p className="text-[10px] text-slate-400">Physical Progress</p>
                          <p className="text-sm font-bold text-brand-orange">{p.physicalProgress}%</p>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-ink-850">
                          <p className="text-[10px] text-slate-400">Health Score</p>
                          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{p.health}/100</p>
                        </div>
                      </div>

                      {/* Contractor Assignment Badge */}
                      <div className="p-2.5 rounded-xl border border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1">
                            <HardHat size={12} />
                            Assigned Contractor:
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            {assignedC ? assignedC.contractor_id : 'Unassigned'}
                          </span>
                        </div>
                        <p className="font-bold text-slate-900 dark:text-white truncate">
                          {assignedC ? assignedC.company_name : 'No contractor designated'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setAssignModalProject(p)
                        if (assignedC) setSelectedContractorId(assignedC.contractor_id)
                        setPackageName(`Package Works -- ${p.id}`)
                        setContractValue(String(p.sanctioned_cost || '1200'))
                        setAssignSuccessMsg(null)
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-cyan-50 dark:bg-ink-800 dark:hover:bg-cyan-950/40 text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 text-xs font-bold border border-slate-200 dark:border-ink-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <HardHat size={14} className="text-brand-orange" />
                      <span>Assign / Reassign Contractor</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Modal for Contractor Assignment */}
          {assignModalProject && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
              <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-ink-800 pb-3">
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Assign Contractor to {assignModalProject.id}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{assignModalProject.name}</p>
                  </div>
                  <button
                    onClick={() => setAssignModalProject(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X size={18} />
                  </button>
                </div>

                {assignSuccessMsg && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    <span>{assignSuccessMsg}</span>
                  </div>
                )}

                <form onSubmit={handleAssignSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Designate Prime Contractor:
                    </label>
                    <select
                      value={selectedContractorId}
                      onChange={(e) => setSelectedContractorId(e.target.value)}
                      className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white font-semibold outline-none focus:border-cyan-500"
                    >
                      {contractors.map((c) => (
                        <option key={c.contractor_id} value={c.contractor_id}>
                          {c.contractor_id} — {c.company_name} ({c.contact_person})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Package Contract Scope / Title:
                    </label>
                    <input
                      type="text"
                      value={packageName}
                      onChange={(e) => setPackageName(e.target.value)}
                      placeholder="e.g. Civil Construction Package 04"
                      className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Sanctioned Package Value (₹ Cr):
                    </label>
                    <input
                      type="number"
                      value={contractValue}
                      onChange={(e) => setContractValue(e.target.value)}
                      placeholder="e.g. 1250"
                      className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setAssignModalProject(null)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-ink-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isAssigning}
                      className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isAssigning ? 'Assigning...' : 'Confirm Assignment'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ADD PROJECT & GEOFENCING LAMINA */}
      {activeTab === 'add-project' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form Column */}
          <div className="lg:col-span-6 rounded-3xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-6 shadow-sm space-y-5">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="text-cyan-500" size={20} />
                Register New Infrastructure Project
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Adds a national project, configures its construction area lamina coordinates, and assigns prime contractor.
              </p>
            </div>

            {projectError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400">
                {projectError}
              </div>
            )}

            {newProjectResult && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 size={16} />
                  <span>Project Created: {newProjectResult.id}</span>
                </div>
                <p>
                  Initial ML predictions derived: Cost Overrun Risk {newProjectResult.costOverrunRisk}%, Time Risk {newProjectResult.timeOverrunRisk}%, Health Index {newProjectResult.health}/100.
                </p>
                <p className="font-mono text-[10px]">
                  Geofence Lamina Radius: {newProjectResult.geofence?.radius_km || radiusKm} km around ({centerLat}, {centerLng})
                </p>
              </div>
            )}

            <form onSubmit={handleAddProjectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Project Title / Designation
                </label>
                <input
                  type="text"
                  required
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Pune Metro Line 3 Extension"
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Sector</label>
                  <select
                    value={projectSector}
                    onChange={(e) => setProjectSector(e.target.value as Sector)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                  >
                    {sectors.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">State / UT</label>
                  <select
                    value={projectState}
                    onChange={(e) => handleStateChangeInForm(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                  >
                    {statesList.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sanctioned Cost (₹ Cr)
                  </label>
                  <input
                    type="number"
                    required
                    value={sanctionedCost}
                    onChange={(e) => setSanctionedCost(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Duration (Months)
                  </label>
                  <input
                    type="number"
                    required
                    value={durationMonths}
                    onChange={(e) => setDurationMonths(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Initial Physical Progress (%)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={physicalProgress}
                    onChange={(e) => setPhysicalProgress(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Financial Progress (%)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={financialProgress}
                    onChange={(e) => setFinancialProgress(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Geofence Settings Section */}
              <div className="pt-3 border-t border-slate-100 dark:border-ink-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Compass size={14} className="text-cyan-500" />
                    Designated Geofence Lamina
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleStateChangeInForm(projectState)}
                    className="text-[10px] text-cyan-600 dark:text-cyan-400 hover:underline font-semibold"
                  >
                    Reset to {projectState} Centroid
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Center Latitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={centerLat}
                      onChange={(e) => setCenterLat(parseFloat(e.target.value) || 19.076)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white font-mono outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Center Longitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={centerLng}
                      onChange={(e) => setCenterLng(parseFloat(e.target.value) || 72.878)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white font-mono outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-slate-500">Construction Area Radius</span>
                    <span className="font-bold text-cyan-600 dark:text-cyan-400">{radiusKm} km</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="10.0"
                    step="0.5"
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Initial Assigned Contractor:
                  </label>
                  <select
                    value={projectContractorId}
                    onChange={(e) => setProjectContractorId(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white font-semibold outline-none focus:border-cyan-500"
                  >
                    {contractors.map((c) => (
                      <option key={c.contractor_id} value={c.contractor_id}>
                        {c.company_name} ({c.contractor_id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingProject}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs font-bold shadow-md shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Plus size={16} />
                <span>{isSubmittingProject ? 'Registering Project & Generating Geofence...' : 'Register Project & Activate Geofence Lamina'}</span>
              </button>
            </form>
          </div>

          {/* Interactive Geofence Map Preview Column */}
          <div className="lg:col-span-6 rounded-3xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-6 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <MapPin size={16} className="text-brand-orange" />
                  Live Geofence Boundary Lamina Preview
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300">
                  Radius: ~{radiusKm} km
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Any contractor on-site photo uploaded outside this polygon will be rejected by the server and will not count towards execution metrics.
              </p>
            </div>

            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-ink-800">
              <GeofenceMap
                centerLat={centerLat}
                centerLng={centerLng}
                boundaryLamina={previewLamina}
                radiusKm={radiusKm}
                height={380}
                projectName={projectName || `${projectState} Project`}
              />
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-ink-850 text-xs space-y-1 text-slate-600 dark:text-slate-400">
              <p className="font-bold text-slate-800 dark:text-slate-200">Point-in-Polygon Ray Casting Enforcement:</p>
              <p className="text-[11px] leading-relaxed">
                The WGS-84 lamina engine calculates photo coordinates via spherical Haversine distances and 6-vertex polygonal boundary intersection. Coordinates outside the blue lamina fail verification immediately.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: VERIFICATION AUDITS & SUBMISSIONS */}
      {activeTab === 'audits' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-ink-900 p-4 rounded-2xl border border-slate-200 dark:border-ink-800 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Filter Audits:
              </span>
              {(['all', 'approved', 'rejected'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setAuditFilter(filter)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
                    auditFilter === filter
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadAudits}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
              >
                <RefreshCw size={13} className={loadingAudits ? 'animate-spin' : ''} />
                <span>Refresh Feed</span>
              </button>
              <span className="text-xs text-slate-400">Total: {filteredAudits.length} records</span>
            </div>
          </div>

          {loadingAudits ? (
            <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
              <span>Querying on-site submission records...</span>
            </div>
          ) : filteredAudits.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 bg-white dark:bg-ink-900 rounded-2xl border border-slate-200 dark:border-ink-800">
              No audit records matching criteria.
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-ink-850 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-ink-800">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Photo</th>
                      <th className="px-4 py-3 font-semibold">Submission ID</th>
                      <th className="px-4 py-3 font-semibold">Project & Contractor</th>
                      <th className="px-4 py-3 font-semibold">Claimed Progress</th>
                      <th className="px-4 py-3 font-semibold">Geofence Status</th>
                      <th className="px-4 py-3 font-semibold">AI Intelligence Brief</th>
                      <th className="px-4 py-3 font-semibold">Submitted At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-ink-800">
                    {filteredAudits.map((a) => {
                      const isInside = a.inside_geofence === 1
                      let aiIntel: any = null
                      try {
                        if (a.ai_intelligence_json) {
                          aiIntel = typeof a.ai_intelligence_json === 'string' ? JSON.parse(a.ai_intelligence_json) : a.ai_intelligence_json
                        }
                      } catch {}

                      return (
                        <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-ink-850/50 transition-colors">
                          <td className="px-4 py-3">
                            {a.photo_url ? (
                              <button
                                onClick={() => setPreviewPhoto(a.photo_url)}
                                className="h-12 w-12 rounded-xl overflow-hidden border border-slate-200 dark:border-ink-700 group relative block cursor-pointer"
                              >
                                <img src={a.photo_url} alt="Site" className="h-full w-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                  <Eye size={14} />
                                </div>
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[10px]">No Photo</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                            {a.submission_id}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-900 dark:text-white">{a.project_id}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{a.company_name || a.contractor_id}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-brand-orange text-sm">
                              {a.physical_progress_pct ? `${a.physical_progress_pct}%` : 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                isInside
                                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                              }`}
                            >
                              {isInside ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                              {isInside ? 'APPROVED' : 'REJECTED'}
                            </span>
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            {aiIntel ? (
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2" title={aiIntel.narrative}>
                                {aiIntel.narrative}
                              </p>
                            ) : (
                              <span className="text-[11px] text-slate-400">
                                {isInside ? 'Intelligence derived' : 'Report rejected (breach)'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {a.submitted_at ? a.submitted_at.replace('T', ' ').substring(0, 19) : ''}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Photo Modal */}
          {previewPhoto && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
              <div className="relative max-w-2xl w-full bg-white dark:bg-ink-900 rounded-3xl overflow-hidden shadow-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">On-Site Evidence Inspection</h3>
                  <button onClick={() => setPreviewPhoto(null)} className="p-1 text-slate-400 hover:text-slate-600">
                    <X size={18} />
                  </button>
                </div>
                <div className="rounded-2xl overflow-hidden max-h-[70vh] bg-black flex items-center justify-center">
                  <img src={previewPhoto} alt="Site preview" className="max-h-full max-w-full object-contain" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
