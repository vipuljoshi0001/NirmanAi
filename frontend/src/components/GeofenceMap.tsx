import React, { useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Polygon, Popup, Tooltip, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { isPointInsideLamina } from '../services/api'
import { CheckCircle2, AlertTriangle, MapPin, Navigation } from 'lucide-react'

interface GeofenceMapProps {
  centerLat: number
  centerLng: number
  boundaryLamina: [number, number][]
  radiusKm?: number
  currentLat?: number | null
  currentLng?: number | null
  onCoordinateChange?: (lat: number, lng: number) => void
  interactive?: boolean
  height?: string | number
  dark?: boolean
  projectName?: string
}

function ClickHandler({ onSelect }: { onSelect?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (onSelect) {
        onSelect(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)))
      }
    },
  })
  return null
}

export const GeofenceMap: React.FC<GeofenceMapProps> = ({
  centerLat,
  centerLng,
  boundaryLamina,
  radiusKm = 3.5,
  currentLat,
  currentLng,
  onCoordinateChange,
  interactive = true,
  height = 320,
  dark = false,
  projectName = 'Designated Construction Site',
}) => {
  const hasCoords = currentLat !== null && currentLat !== undefined && currentLng !== null && currentLng !== undefined

  const isInside = useMemo(() => {
    if (!hasCoords || !boundaryLamina || boundaryLamina.length < 3) return false
    return isPointInsideLamina(currentLat as number, currentLng as number, boundaryLamina)
  }, [hasCoords, currentLat, currentLng, boundaryLamina])

  // Compute distance in km
  const distanceKm = useMemo(() => {
    if (!hasCoords) return null
    const R = 6371
    const dLat = ((currentLat as number) - centerLat) * (Math.PI / 180)
    const dLng = ((currentLng as number) - centerLng) * (Math.PI / 180)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(centerLat * (Math.PI / 180)) *
        Math.cos((currentLat as number) * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return Number((R * c).toFixed(2))
  }, [hasCoords, currentLat, currentLng, centerLat, centerLng])

  const polygonColor = hasCoords ? (isInside ? '#10b981' : '#ef4444') : '#3b82f6'
  const polygonFillColor = hasCoords ? (isInside ? '#10b981' : '#ef4444') : '#3b82f6'

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-900 overflow-hidden shadow-sm flex flex-col">
      {/* Geofence Status Header */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-ink-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50 dark:bg-ink-850">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-brand-orange" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Construction Area Lamina (Radius: ~{radiusKm} km)
          </span>
        </div>

        {hasCoords ? (
          isInside ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              <CheckCircle2 size={13} className="text-emerald-500" />
              Inside Geofence ({distanceKm} km to center) — Validated On-Site
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse">
              <AlertTriangle size={13} className="text-rose-500" />
              Outside Geofence ({distanceKm} km away) — Report Will Not Count!
            </span>
          )
        ) : (
          <span className="text-xs text-slate-400">
            Upload photo or select capture coordinates
          </span>
        )}
      </div>

      {/* Map Surface */}
      <div style={{ height }} className="w-full relative z-0">
        <MapContainer
          center={[centerLat, centerLng]}
          zoom={13}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
          attributionControl={false}
        >
          <TileLayer
            url={
              dark
                ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
            }
          />

          {interactive && <ClickHandler onSelect={onCoordinateChange} />}

          {/* Construction Lamina Boundary Polygon */}
          {boundaryLamina && boundaryLamina.length >= 3 && (
            <Polygon
              positions={boundaryLamina}
              pathOptions={{
                color: polygonColor,
                fillColor: polygonFillColor,
                fillOpacity: isInside ? 0.25 : 0.15,
                weight: 2.5,
                dashArray: isInside ? undefined : '6, 6',
              }}
            >
              <Tooltip sticky>
                <div className="text-xs font-sans">
                  <strong>{projectName}</strong>
                  <br />
                  Designated Construction Zone ({radiusKm} km lamina)
                </div>
              </Tooltip>
            </Polygon>
          )}

          {/* Site Center Marker */}
          <CircleMarker
            center={[centerLat, centerLng]}
            radius={8}
            pathOptions={{
              color: '#ffffff',
              fillColor: '#f59e0b',
              fillOpacity: 1,
              weight: 2,
            }}
          >
            <Popup>
              <div className="text-xs font-sans">
                <p className="font-bold text-amber-600">Site Center Pin</p>
                <p className="text-slate-600">
                  Lat: {centerLat.toFixed(4)}, Lng: {centerLng.toFixed(4)}
                </p>
              </div>
            </Popup>
          </CircleMarker>

          {/* Photo Capture Marker */}
          {hasCoords && (
            <CircleMarker
              center={[currentLat as number, currentLng as number]}
              radius={10}
              pathOptions={{
                color: '#ffffff',
                fillColor: isInside ? '#10b981' : '#ef4444',
                fillOpacity: 1,
                weight: 3,
              }}
            >
              <Popup>
                <div className="text-xs font-sans">
                  <p className={`font-bold ${isInside ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isInside ? '✓ Photo Capture: Inside Lamina' : '✗ Photo Capture: Outside Lamina'}
                  </p>
                  <p className="text-slate-600">
                    Lat: {(currentLat as number).toFixed(4)}, Lng: {(currentLng as number).toFixed(4)}
                  </p>
                  <p className="text-slate-500 mt-1">
                    Distance: {distanceKm} km from center
                  </p>
                  {!isInside && (
                    <p className="text-rose-600 font-semibold mt-1">
                      Report will be rejected for progress calculation
                    </p>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          )}
        </MapContainer>

        {/* Map Legend Overlay */}
        <div className="absolute bottom-3 left-3 z-[400] bg-white/90 dark:bg-ink-900/90 backdrop-blur rounded-xl p-2.5 shadow-md border border-slate-200 dark:border-ink-800 text-[11px] space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-amber-500 border border-white shrink-0" />
            <span className="text-slate-700 dark:text-slate-300">Official Site Center</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-sm border shrink-0"
              style={{ borderColor: polygonColor, backgroundColor: `${polygonColor}33` }}
            />
            <span className="text-slate-700 dark:text-slate-300">
              Construction Area Lamina (Permitted)
            </span>
          </div>
          {hasCoords && (
            <div className="flex items-center gap-2">
              <span
                className={`h-3 w-3 rounded-full border border-white shrink-0 ${
                  isInside ? 'bg-emerald-500' : 'bg-rose-500 animate-ping'
                }`}
              />
              <span className={isInside ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-rose-600 dark:text-rose-400 font-semibold'}>
                {isInside ? 'Photo Capture (Inside)' : 'Photo Capture (Violation)'}
              </span>
            </div>
          )}
          {interactive && (
            <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-ink-800">
              Click anywhere on the map to test coordinates
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
