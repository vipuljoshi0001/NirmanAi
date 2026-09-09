import { Component } from 'react'
import type { ReactNode } from 'react'
import { Globe2 } from 'lucide-react'
import ProjectMap from './ProjectMap'
import type { MapProject } from '../types'

/**
 * Safety wrapper around the Leaflet map:
 * - renders a friendly fallback if Leaflet fails to initialise (error boundary)
 * - never lets an empty project list crash the dashboard
 */

interface BoundaryProps {
  children: ReactNode
  fallback: ReactNode
}

interface BoundaryState {
  hasError: boolean
}

class MapErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false }

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}

function FallbackPanel({ dark, empty }: { dark?: boolean; empty?: boolean }) {
  return (
    <div
      className={`flex h-full min-h-[240px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center ${
        dark ? 'border-ink-700 bg-ink-950' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <Globe2 className="text-slate-400" size={30} strokeWidth={1.5} />
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
        {empty ? 'No projects to plot yet' : 'Interactive map unavailable'}
      </p>
      <p className="max-w-[260px] text-xs text-slate-400">
        {empty
          ? 'Once map data arrives, projects will be pinned by state.'
          : 'Leaflet could not initialise. Head to State Analysis for the regional view.'}
      </p>
    </div>
  )
}

export interface ProjectMapSafeProps {
  projects: MapProject[]
  height?: number | string
  center?: [number, number]
  zoom?: number
  dark?: boolean
}

export default function ProjectMapSafe({ projects, ...rest }: ProjectMapSafeProps) {
  const isEmpty = !projects || projects.length === 0
  const fallback = (
    <div className="w-full" style={{ height: rest.height ?? 380 }}>
      <FallbackPanel dark={rest.dark} empty={isEmpty} />
    </div>
  )

  return (
    <MapErrorBoundary fallback={fallback}>
      {isEmpty ? fallback : <ProjectMap projects={projects} {...rest} />}
    </MapErrorBoundary>
  )
}