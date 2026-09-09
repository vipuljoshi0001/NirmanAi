import { X } from 'lucide-react'
import { notifications } from '../data/mockData'

const toneDot: Record<string, string> = {
  red: 'bg-signal-red',
  cyan: 'bg-signal-cyan',
  green: 'bg-signal-green',
}

export default function NotificationCenter({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute right-0 top-12 w-96 rounded-xl border border-slate-200 bg-white shadow-xl z-50">
      <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <p className="font-display font-semibold text-sm text-ink-950">Notification center</p>
          <p className="text-xs text-slate-500 mt-0.5">{notifications.length} intelligence updates</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close notifications">
          <X size={16} />
        </button>
      </div>
      <ul>
        {notifications.map((n) => (
          <li key={n.id} className="px-5 py-3 border-b border-slate-50 last:border-b-0 hover:bg-slate-50">
            <div className="flex items-start gap-2.5">
              <span className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${toneDot[n.tone]}`} />
              <div>
                <p className="text-sm text-ink-950 leading-snug">{n.message}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {n.time} · {n.tag}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
