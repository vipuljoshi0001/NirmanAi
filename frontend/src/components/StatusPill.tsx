import type { ProjectStatus } from '../types'

const textStyles: Record<ProjectStatus, string> = {
  'On Track': 'text-emerald-500',
  Watch: 'text-amber-500',
  'At Risk': 'text-red-500',
}

export default function StatusPill({ status }: { status: ProjectStatus }) {
  return (
    <span className={`inline-flex items-center text-[11px] font-bold tracking-wider uppercase ${textStyles[status]}`}>
      {status}
    </span>
  )
}
