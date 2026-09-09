import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowUpRight, MapPin } from 'lucide-react'
import type { Project } from '../types'
import StatusPill from './StatusPill'

const healthColor = (health: number) => {
  if (health >= 80) return '#3FEBA6'
  if (health >= 65) return '#F5C542'
  return '#F0654F'
}

const accentBar: Record<Project['status'], string> = {
  'On Track': 'bg-emerald-400',
  'Watch': 'bg-amber-400',
  'At Risk': 'bg-red-400',
}

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-white dark:bg-ink-900 border border-slate-200 dark:border-white/5 p-5 flex flex-col gap-4 shadow-sm dark:shadow-none">

      <span
        className={`absolute inset-x-0 top-0 h-[3px] ${accentBar[project.status]}`}
      />

      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[11px] tracking-wide text-slate-400 dark:text-slate-500">
          {project.id}
        </p>

        <StatusPill status={project.status} />
      </div>

      <div>
        <h3 className="font-display font-semibold text-slate-900 dark:text-white leading-snug">
          {project.name}
        </h3>

        <div className="flex items-center justify-between mt-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <MapPin size={11} />
            {project.state}
          </span>

          <span>{project.sector}</span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1.5">
          <span>Physical progress</span>
        </div>

        <div className="flex items-center gap-3">

          {/* Progress bar */}
          <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 bg-emerald-500"
              style={{
                width: `${project.physicalProgress}%`,
                background: '#3feb56',
                boxShadow: '0 0 8px rgba(34, 197, 94, 0.45)',
              }}
            />
          </div>

          <span className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            {project.physicalProgress}%
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-white/5">
        <span className="flex items-center gap-1.5 text-xs text-amber-500 dark:text-amber-400">
          <AlertTriangle size={12} />
          Cost {project.costVariance}% &nbsp; Time {project.timeVariance}%
        </span>

        <Link
          to={`/projects/${project.id}`}
          className="flex items-center gap-1 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300"
        >
          View intelligence <ArrowUpRight size={12} />
        </Link>
      </div>
    </div>
  )
}
