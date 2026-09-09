import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string
  delta?: string
  deltaTone?: 'up-good' | 'up-bad' | 'down-good' | 'down-bad'
  sparkline?: ReactNode
}

const toneClass: Record<string, string> = {
  'up-good': 'text-emerald-600',
  'up-bad': 'text-amber-600',
  'down-good': 'text-emerald-600',
  'down-bad': 'text-red-500',
}

export default function StatCard({ label, value, delta, deltaTone = 'up-good', sparkline }: StatCardProps) {
  return (
    // 1. Inside StatCard.tsx: Find the outer wrapper div and update its classes
<div className="rounded-xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-5 shadow-sm transition-colors duration-200">
  
  {/* Inside the card, also ensure label text stays readable */}
  <p className="text-[10px] font-semibold tracking-wide text-slate-400 dark:text-slate-500">
    {label}
  </p>
  
  {/* Ensure value text changes to white in dark mode */}
  <p className="mt-2 font-display text-2xl font-bold text-ink-950 dark:text-white">
    {value}
  </p>
  
  {/* ...rest of your StatCard content... */}
</div>
  )
}
