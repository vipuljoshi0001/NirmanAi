import React, { useState, useEffect } from 'react'
import { 
  HardHat, 
  Building2, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  MapPin, 
  Camera, 
  FileText, 
  Sparkles, 
  Clock, 
  ArrowRight,
  ShieldAlert,
  Percent,
  TrendingUp,
  RotateCcw,
  Navigation
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { 
  getContractorProjects, 
  getContractorSubmissions, 
  submitContractorProgress, 
  getProjectGeofence,
  isPointInsideLamina
} from '../services/api'
import { GeofenceMap } from '../components/GeofenceMap'
import type { ContractorProject, ContractorSubmission, GeofenceLamina } from '../types'

export default function ContractorPanel() {
  const { user, role, setLoginModalOpen } = useAuth()
  const [projects, setProjects] = useState<ContractorProject[]>([])
  const [submissions, setSubmissions] = useState<ContractorSubmission[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // Selected project for progress submission
  const [selectedProject, setSelectedProject] = useState<ContractorProject | null>(null)
  const [geofence, setGeofence] = useState<GeofenceLamina | null>(null)

  // Form states
  const [physicalProgress, setPhysicalProgress] = useState<number>(65)
  const [financialExpenditure, setFinancialExpenditure] = useState<number>(120)
  const [notes, setNotes] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [gpsLat, setGpsLat] = useState<number | null>(null)
  const [gpsLng, setGpsLng] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [submitResult, setSubmitResult] = useState<any | null>(null)
  const [gpsSource, setGpsSource] = useState<string>('manual')

  const contractorId = user?.role === 'contractor' ? user.id : 'CNT-LT-01'

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getContractorProjects(contractorId),
      getContractorSubmissions(contractorId),
    ])
      .then(([projData, subData]) => {
        setProjects(projData)
        setSubmissions(subData)
        if (projData.length > 0) {
          selectProject(projData[0])
        }
      })
      .catch((err) => console.warn('Error loading contractor data', err))
      .finally(() => setLoading(false))
  }, [contractorId])

  const selectProject = (p: ContractorProject) => {
    setSelectedProject(p)
    setSubmitResult(null)
    setPhysicalProgress(p.physicalProgress || 60)
    if (p.geofence) {
      setGeofence(p.geofence)
      setGpsLat(p.geofence.center_lat)
      setGpsLng(p.geofence.center_lng)
      setGpsSource('site_center')
    } else {
      getProjectGeofence(p.id).then((geo) => {
        setGeofence(geo)
        setGpsLat(geo.center_lat)
        setGpsLng(geo.center_lng)
        setGpsSource('site_center')
      })
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setSubmitResult(null)
    }
  }

  // Quick Simulation Helpers
  const simulateInsideGeofence = () => {
    if (!geofence) return
    setGpsLat(geofence.center_lat)
    setGpsLng(geofence.center_lng)
    setGpsSource('simulation_inside')
    setSubmitResult(null)
  }

  const simulateOutsideGeofence = () => {
    if (!geofence) return
    // Offset by ~0.8 degrees (~90 km away) to guarantee outside
    setGpsLat(Number((geofence.center_lat + 0.85).toFixed(6)))
    setGpsLng(Number((geofence.center_lng + 0.85).toFixed(6)))
    setGpsSource('simulation_outside')
    setSubmitResult(null)
  }

  const useDeviceGps = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLat(Number(pos.coords.latitude.toFixed(6)))
        setGpsLng(Number(pos.coords.longitude.toFixed(6)))
        setGpsSource('device_gps')
        setSubmitResult(null)
      },
      (err) => {
        alert(`Failed to get device GPS: ${err.message}. Using simulated coordinates.`)
      }
    )
  }

  // Live Geofence Check
  const isInsideLamina = React.useMemo(() => {
    if (!geofence || gpsLat === null || gpsLng === null) return false
    return isPointInsideLamina(gpsLat, gpsLng, geofence.boundary_lamina)
  }, [geofence, gpsLat, gpsLng])

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProject) {
      alert('Please select a project first.')
      return
    }

    setSubmitting(true)
    setSubmitResult(null)

    try {
      const formData = new FormData()
      // If no file was picked, create a synthetic photo
      if (selectedFile) {
        formData.append('file', selectedFile)
      } else {
        const dummyCanvas = document.createElement('canvas')
        dummyCanvas.width = 400
        dummyCanvas.height = 300
        const ctx = dummyCanvas.getContext('2d')
        if (ctx) {
          ctx.fillStyle = isInsideLamina ? '#10b981' : '#f43f5e'
          ctx.fillRect(0, 0, 400, 300)
          ctx.fillStyle = '#ffffff'
          ctx.font = 'bold 18px sans-serif'
          ctx.fillText(`Project: ${selectedProject.id}`, 20, 50)
          ctx.fillText(`Coordinates: ${gpsLat}, ${gpsLng}`, 20, 90)
          ctx.fillText(isInsideLamina ? 'STATUS: INSIDE LAMINA' : 'STATUS: OUTSIDE LAMINA', 20, 130)
          ctx.fillText(new Date().toISOString(), 20, 170)
        }
        const blob = await new Promise<Blob>((resolve) =>
          dummyCanvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg')
        )
        formData.append('file', blob, 'site_progress_capture.jpg')
      }

      formData.append('project_id', selectedProject.id)
      formData.append('contractor_id', contractorId)
      formData.append('physical_progress_pct', String(physicalProgress))
      formData.append('financial_expenditure_cr', String(financialExpenditure))
      formData.append('notes', notes || 'Routine milestone progress update')
      if (gpsLat !== null) formData.append('gps_lat', String(gpsLat))
      if (gpsLng !== null) formData.append('gps_lng', String(gpsLng))

      const result = await submitContractorProgress(formData)
      setSubmitResult(result)

      // Refresh list
      getContractorProjects(contractorId).then(setProjects)
      getContractorSubmissions(contractorId).then(setSubmissions)
    } catch (err) {
      console.error('Submission error', err)
      alert(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Contractor Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-ink-950 to-slate-900 border border-slate-800 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-brand-orange text-white shadow-lg shadow-amber-500/20 shrink-0">
              <HardHat size={28} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Registered Contractor Portal
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ID: {contractorId}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold font-display mt-1 text-white">
                {user?.company || 'Larsen & Toubro Heavy Civil Infra'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 flex items-center gap-3">
                <span>Director: {user?.name || 'S. Ramanathan (VP Projects)'}</span>
                <span>•</span>
                <span>Rating: ★ {user?.rating || 4.8} / 5.0</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setLoginModalOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/10 text-white transition-all cursor-pointer"
            >
              Switch Contractor Account
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
            <p className="text-[11px] text-slate-400 uppercase font-semibold">Active Contracts</p>
            <p className="text-xl font-bold text-white mt-0.5">{projects.length} Projects</p>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
            <p className="text-[11px] text-slate-400 uppercase font-semibold">Geofence Compliance</p>
            <p className="text-xl font-bold text-emerald-400 mt-0.5">100% On-Site</p>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
            <p className="text-[11px] text-slate-400 uppercase font-semibold">Verified Uploads</p>
            <p className="text-xl font-bold text-cyan-400 mt-0.5">{submissions.length} Submissions</p>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
            <p className="text-[11px] text-slate-400 uppercase font-semibold">Oversight Status</p>
            <p className="text-xl font-bold text-amber-400 mt-0.5">Authorized</p>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Assigned Projects List (4 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 size={18} className="text-brand-orange" />
              Projects Under Contractor's Name ({projects.length})
            </h2>
            <span className="text-xs text-slate-500">Select to update</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading assigned projects...</div>
          ) : projects.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-ink-900 rounded-2xl border border-slate-200 dark:border-ink-800 text-slate-500 text-xs">
              No packages currently assigned under this contractor ID.
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((p) => {
                const isSelected = selectedProject?.id === p.id
                return (
                  <div
                    key={p.id}
                    onClick={() => selectProject(p)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? 'bg-amber-500/5 dark:bg-amber-500/10 border-brand-orange shadow-md'
                        : 'bg-white dark:bg-ink-900 border-slate-200 dark:border-ink-800 hover:border-slate-300 dark:hover:border-ink-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-ink-800 text-slate-700 dark:text-slate-300">
                            {p.id}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {p.sector} • {p.state}
                          </span>
                        </div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-1.5 leading-snug">
                          {p.name}
                        </h3>
                      </div>
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${
                          p.status === 'On Track'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                            : p.status === 'Watch'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                            : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400'
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-ink-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">Physical Progress:</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {p.physicalProgress}%
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 font-semibold text-[11px]">
                        <span>Select Package</span>
                        <ArrowRight size={12} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Submission History Feed */}
          {submissions.length > 0 && (
            <div className="mt-8 space-y-3">
              <h3 className="text-sm font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
                <Clock size={16} className="text-slate-400" />
                Recent Audit Trail ({submissions.length})
              </h3>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {submissions.map((sub) => {
                  const wasInside = Boolean(sub.inside_geofence && sub.counts_towards_progress)
                  return (
                    <div
                      key={sub.submission_id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 text-xs flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-400">
                            {sub.submission_id}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 font-medium truncate">
                            {sub.project_id}
                          </span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 truncate mt-0.5">
                          {sub.notes || 'Progress milestone submission'}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {sub.submitted_at}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {wasInside ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                            <CheckCircle2 size={10} />
                            COUNTED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
                            <AlertTriangle size={10} />
                            REJECTED
                          </span>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1">
                          Progress: {sub.physical_progress_pct}%
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Upload Progress & Geofence Verification (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {selectedProject ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Active Package Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Active Contract Package
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                    {selectedProject.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    ID: {selectedProject.id} • Sanctioned: {selectedProject.expenditure}
                  </p>
                </div>
              </div>

              {/* Progress Inputs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Reported Physical Progress (%)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={physicalProgress}
                      onChange={(e) => setPhysicalProgress(Number(e.target.value))}
                      className="flex-1 accent-brand-orange cursor-pointer"
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={physicalProgress}
                      onChange={(e) => setPhysicalProgress(Number(e.target.value))}
                      className="w-16 px-2 py-1 text-sm font-bold text-center border border-slate-200 dark:border-ink-700 rounded-lg bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Current official: {selectedProject.physicalProgress}%
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Claimed Expenditure (₹ Cr)
                  </label>
                  <input
                    type="number"
                    value={financialExpenditure}
                    onChange={(e) => setFinancialExpenditure(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-semibold border border-slate-200 dark:border-ink-700 rounded-lg bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-white"
                    placeholder="e.g. 150"
                  />
                  <p className="text-[11px] text-slate-400">
                    Cumulative billing claimed for this cycle
                  </p>
                </div>
              </div>

              {/* Progress Notes */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Milestone Details & Site Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Pier cap casting package-3 completed on schedule. Track laying segment 4 initiated."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 text-slate-900 dark:text-white outline-none focus:border-brand-orange"
                />
              </div>

              {/* Photo Upload & Drop Zone */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>Mandatory On-Site Photo Verification</span>
                  <span className="text-amber-500 font-normal normal-case text-[11px]">
                    EXIF Geotag or Device Coordinates Required
                  </span>
                </label>

                <div className="relative border-2 border-dashed border-slate-300 dark:border-ink-700 hover:border-brand-orange rounded-2xl p-4 sm:p-6 text-center transition-all bg-slate-50/50 dark:bg-ink-950/40">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  />

                  {previewUrl ? (
                    <div className="flex flex-col items-center gap-3">
                      <img
                        src={previewUrl}
                        alt="Upload preview"
                        className="h-36 max-w-full rounded-xl object-cover shadow-md border border-slate-200 dark:border-ink-700"
                      />
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {selectedFile?.name || 'Site Photo Selected'}
                      </p>
                      <span className="text-[11px] text-brand-orange underline">
                        Click or drag to change image
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-brand-orange">
                        <Camera size={24} />
                      </span>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Drop on-site construction photo here or click to browse
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Supports JPEG, PNG, WebP (camera photos with GPS EXIF metadata)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Geofence Coordinate Controls & Simulation Testing */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Navigation size={14} className="text-cyan-500" />
                      Geofence Coordinate Verification
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Coordinates tested against designated construction zone boundary lamina
                    </p>
                  </div>

                  {/* Coordinate Source Controls */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={useDeviceGps}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Navigation size={12} />
                      Use Device GPS
                    </button>
                    <button
                      type="button"
                      onClick={simulateInsideGeofence}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 hover:bg-emerald-200 text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer"
                      title="Set coordinate directly to site center"
                    >
                      Simulate On-Site (Inside)
                    </button>
                    <button
                      type="button"
                      onClick={simulateOutsideGeofence}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-rose-100 dark:bg-rose-950/60 hover:bg-rose-200 text-rose-700 dark:text-rose-300 transition-colors cursor-pointer"
                      title="Set coordinate 90km away to test geofence rejection"
                    >
                      Simulate Off-Site (Outside)
                    </button>
                  </div>
                </div>

                {/* Coordinate Inputs */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Capture Latitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={gpsLat ?? ''}
                      onChange={(e) => setGpsLat(parseFloat(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Capture Longitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={gpsLng ?? ''}
                      onChange={(e) => setGpsLng(parseFloat(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Interactive Geofence Map */}
                {geofence && (
                  <div className="mt-2">
                    <GeofenceMap
                      centerLat={geofence.center_lat}
                      centerLng={geofence.center_lng}
                      boundaryLamina={geofence.boundary_lamina}
                      radiusKm={geofence.radius_km}
                      currentLat={gpsLat}
                      currentLng={gpsLng}
                      onCoordinateChange={(lat, lng) => {
                        setGpsLat(lat)
                        setGpsLng(lng)
                        setGpsSource('map_click')
                        setSubmitResult(null)
                      }}
                      projectName={selectedProject.name}
                      height={260}
                    />
                  </div>
                )}

                {/* Geofence Enforcement Alert */}
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-start gap-3 transition-all ${
                    isInsideLamina
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                  }`}
                >
                  {isInsideLamina ? (
                    <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={18} />
                  ) : (
                    <ShieldAlert className="text-rose-600 shrink-0 mt-0.5" size={18} />
                  )}
                  <div>
                    <p className="font-bold">
                      {isInsideLamina
                        ? 'Geofence Verification Passed (Inside Construction Lamina)'
                        : 'Geofence Boundary Violation (Outside Construction Area)'}
                    </p>
                    <p className="mt-0.5 leading-relaxed">
                      {isInsideLamina
                        ? 'Photo coordinates match the project site. This progress report will be accredited and updated in official project timelines.'
                        : 'Warning: Under statutory oversight rules, photos uploaded from outside the designated construction lamina DO NOT COUNT. Submitting will register an audit violation without crediting project progress.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Submission Result Notification Banner */}
              {submitResult && (
                <div
                  className={`p-5 rounded-2xl border text-xs animate-in zoom-in-95 duration-200 space-y-3 ${
                    submitResult.counts
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-400 text-emerald-900 dark:text-emerald-200'
                      : 'bg-rose-50 dark:bg-rose-950/50 border-rose-400 text-rose-900 dark:text-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      {submitResult.counts ? (
                        <>
                          <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={20} />
                          <span>Report Verified & Counted On-Site</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="text-rose-600 dark:text-rose-400" size={20} />
                          <span>Report Rejected: Geofence Enforcement Triggered</span>
                        </>
                      )}
                    </div>
                    <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-white/80 dark:bg-black/40 border border-current/20">
                      ID: #{submitResult.submission_id}
                    </span>
                  </div>

                  <p className="leading-relaxed text-xs">{submitResult.message}</p>

                  <div className="pt-2 border-t border-current/15 flex flex-wrap items-center gap-4 text-[11px]">
                    <span>Status: <strong className="uppercase">{submitResult.status}</strong></span>
                    <span>Official Metrics Updated: <strong>{submitResult.counts ? 'YES (Updated to ' + submitResult.physical_progress_pct + '%)' : 'NO (Discarded)'}</strong></span>
                  </div>

                  {/* Derived AI Intelligence Sub-Card */}
                  {submitResult.ai_intelligence && (
                    <div className="mt-3 p-4 rounded-xl bg-white dark:bg-ink-900/90 border border-emerald-200 dark:border-emerald-800/60 shadow-sm text-slate-800 dark:text-slate-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles size={16} className="text-amber-500 animate-pulse" />
                          <span className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white">
                            AI Model Intelligence Derivation
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          submitResult.ai_intelligence.risk_level === 'HIGH'
                            ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30'
                            : submitResult.ai_intelligence.risk_level === 'MEDIUM'
                            ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {submitResult.ai_intelligence.risk_level} RISK TIER
                        </span>
                      </div>

                      {/* Health & Metrics Bar */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-ink-800 border border-slate-200 dark:border-ink-700">
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Physical Progress</p>
                          <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {submitResult.ai_intelligence.updated_physical_progress}%
                          </p>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-ink-800 border border-slate-200 dark:border-ink-700">
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Composite Health</p>
                          <p className="text-base font-bold text-cyan-600 dark:text-cyan-400 mt-0.5">
                            {submitResult.ai_intelligence.health} / 100
                          </p>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-ink-800 border border-slate-200 dark:border-ink-700">
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Cost Overrun Prob</p>
                          <p className="text-base font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                            {submitResult.ai_intelligence.cop_prob}%
                          </p>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-ink-800 border border-slate-200 dark:border-ink-700">
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Schedule Delay Prob</p>
                          <p className="text-base font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                            {submitResult.ai_intelligence.top_prob}%
                          </p>
                        </div>
                      </div>

                      {/* AI Brief */}
                      {submitResult.ai_intelligence.narrative && (
                        <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-ink-800/60 p-2.5 rounded-lg border border-slate-200/60 dark:border-ink-700/60">
                          {submitResult.ai_intelligence.narrative}
                        </p>
                      )}

                      {/* SHAP Risk Drivers */}
                      {submitResult.ai_intelligence.shap_drivers && submitResult.ai_intelligence.shap_drivers.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Key AI Risk Drivers</p>
                          <div className="flex flex-wrap gap-1.5">
                            {submitResult.ai_intelligence.shap_drivers.slice(0, 3).map((driver: any, idx: number) => (
                              <span key={idx} className="px-2 py-0.5 rounded-md text-[10px] bg-slate-100 dark:bg-ink-800 border border-slate-200 dark:border-ink-700 text-slate-700 dark:text-slate-300">
                                {driver.feature || driver.driver}: <strong>{driver.impact || driver.weight || driver.value}</strong>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className={`w-full py-3 px-6 rounded-2xl text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                  isInsideLamina
                    ? 'bg-brand-orange hover:bg-brand-orangeDark shadow-amber-500/25'
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/25'
                }`}
              >
                {submitting ? (
                  'Verifying Geofence & Submitting...'
                ) : isInsideLamina ? (
                  <>
                    <Upload size={16} />
                    Submit Verified Progress Report (Counts Towards Metrics)
                  </>
                ) : (
                  <>
                    <AlertTriangle size={16} />
                    Submit Progress Report (Will Be Rejected By Geofence)
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="p-12 text-center bg-white dark:bg-ink-900 rounded-2xl border border-slate-200 dark:border-ink-800 text-slate-400">
              Select a project from the left column to upload work progress.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
