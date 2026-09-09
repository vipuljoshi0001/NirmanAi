import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, ZoomControl } from 'react-leaflet'
import { Link } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import type { MapProject } from '../types'

/** Cluster colouring keeps the same language as the rest of the dashboard. */
export const STATUS_COLORS: Record<string, string> = {
  'At Risk': '#ef4444', // red-500
  Watch: '#f59e0b', // amber-500
  'On Track': '#10b981', // emerald-500
}

const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [5.5, 66.0],
  [38.5, 99.0],
]

function statusOf(p: MapProject): 'At Risk' | 'Watch' | 'On Track' {
  if (p.status === 'On Track') return 'On Track'
  if (p.status === 'Watch') return 'Watch'
  return 'At Risk'
}

function colorOf(p: MapProject): string {
  return STATUS_COLORS[statusOf(p)] ?? '#ef4444'
}

/** Marker size scales with the composite risk score (0–100). */
function radiusOf(p: MapProject): number {
  return 6 + ((p.risk_score ?? 40) / 100) * 9
}

function formatCr(v: number): string {
  return v >= 1000 ? `₹${(v / 1000).toFixed(2)}K Cr` : `₹${Math.round(v)} Cr`
}

interface ProjectMapProps {
  projects: MapProject[]
  height?: number | string
  center?: [number, number]
  zoom?: number
  /** Use the CARTO dark basemap (matches the site's dark theme). */
  dark?: boolean
}

export default function ProjectMap({
  projects,
  height = 380,
  center = [22.0, 79.0],
  zoom = 5,
  dark = false,
}: ProjectMapProps) {
  const tileUrl = dark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
  const attribution = dark
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

  return (
    <div className="relative z-0 overflow-hidden rounded-lg" style={{ height }}>
      <MapContainer
        center={center}
        zoom={zoom}
        minZoom={4}
        maxZoom={18}
        maxBounds={INDIA_BOUNDS}
        maxBoundsViscosity={1}
        scrollWheelZoom
        zoomControl={false}
        className="h-full w-full"
      >
        <TileLayer url={tileUrl} attribution={attribution} />
        <ZoomControl position="bottomright" />
        {projects.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={radiusOf(p)}
            pathOptions={{
              color: colorOf(p),
              fillColor: colorOf(p),
              fillOpacity: 0.6,
              weight: 1.5,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={1}>
              <span className="text-xs font-semibold">{p.name}</span>
            </Tooltip>
            <Popup>
              <div className="min-w-[230px] text-slate-900">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {p.sector} · {p.state}
                </p>
                <p className="mt-1 text-sm font-bold leading-snug">{p.name}</p>
                <div className="mt-2 flex items-center justify-between gap-3 text-[11px] font-medium text-slate-600">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white ${
                      statusOf(p) === 'At Risk'
                        ? 'bg-red-500'
                        : statusOf(p) === 'Watch'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                    }`}
                  >
                    {statusOf(p)}
                  </span>
                  <span>{p.risk_score != null ? `Risk ${p.risk_score}` : `Risk ${p.risk_level ?? '—'}`}</span>
                </div>
                <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                  {p.cost_cr != null && p.cost_cr > 0 && <p>Sanctioned cost: {formatCr(p.cost_cr)}</p>}
                  {p.physical_progress_pct != null && <p>Physical progress: {p.physical_progress_pct}%</p>}
                </div>
                <Link
                  to={`/projects/${p.project_id ?? p.id}`}
                  className="mt-3 inline-block text-[11px] font-semibold text-cyan-600 hover:underline"
                >
                  Open project intelligence →
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}