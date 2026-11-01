import { useEffect, useRef, useState } from 'react'

import {
  googleMapsApiKey,
  loadMaps2d,
  type GoogleMap,
  type LatLng,
  type LatLngBoundsLiteral,
  type Maps2DLibrary,
  type Marker,
  type MarkerLabel,
  type Polyline,
} from '../../../lib/google-maps'
import type { LiveTrek } from '../../../lib/live-treks-api'
import { parseKmlLineStrings } from '../../home/lib/kml'
import { SULFATARA_PREVIEW, TRAIL_PREVIEWS } from '../../home/trail-previews'
import { trekColor } from '../lib/live-map'

type MapState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; reason: 'missing-key' | 'load-failed' }

type LoadedMap = { map: GoogleMap; maps: Maps2DLibrary }

// What the map draws for one trek: the path walked and the guide's dot.
type TrekOverlay = { path: Polyline; marker: Marker }

// Asks the map to pan to a trek; [nonce] lets the same trek be picked again.
export type MapFocus = { bookingId: string; nonce: number }

// Same look as the guide app's map: the trail in TrailSync green with a white
// outline, on satellite imagery with labels.
const TRAIL_COLOR = '#008755'
const FOCUS_ZOOM = 17

// Draw order: trail outline, trail, then each walked path. Markers always
// draw above lines on a flat map.
const Z_TRAIL_CASING = 1
const Z_TRAIL = 2
const Z_PATH = 3

const toLatLng = (point: { latitude: number; longitude: number }): LatLng => ({
  lat: point.latitude,
  lng: point.longitude,
})

// The guide's name above their dot, readable on dark imagery.
const markerLabel = (text: string): MarkerLabel => ({
  text,
  color: '#ffffff',
  fontSize: '12px',
  fontWeight: '700',
  className: '[text-shadow:0_1px_3px_rgb(0_0_0/0.9)]',
})

// All live treks on one flat satellite map: the bundled trail routes, each
// trek's walked path in its own colour, and a dot on its guide.
export default function LiveTrekMap({
  treks,
  focus,
}: {
  treks: LiveTrek[]
  focus: MapFocus | null
}) {
  const mapHostRef = useRef<HTMLDivElement>(null)
  const overlaysRef = useRef(new Map<string, TrekOverlay>())
  const treksRef = useRef(treks)
  const apiKey = googleMapsApiKey
  const [mapState, setMapState] = useState<MapState>(
    apiKey ? { status: 'loading' } : { status: 'error', reason: 'missing-key' },
  )
  const [loadedMap, setLoadedMap] = useState<LoadedMap | null>(null)

  useEffect(() => {
    treksRef.current = treks
  }, [treks])

  // The map and the trail routes are created once.
  useEffect(() => {
    if (!apiKey) return

    let isCurrent = true
    const overlays = overlaysRef.current
    const trailLines: Polyline[] = []

    async function initializeMap(key: string) {
      try {
        const maps = await loadMaps2d(key)
        if (!isCurrent || !mapHostRef.current) return

        const { lat, lng } = SULFATARA_PREVIEW.camera.center
        const map = new maps.Map(mapHostRef.current, {
          center: { lat, lng },
          zoom: 14,
          mapTypeId: 'hybrid',
          streetViewControl: false,
          clickableIcons: false,
          gestureHandling: 'greedy',
        })
        setMapState({ status: 'ready' })
        setLoadedMap({ map, maps })

        // A missing route shouldn't take the live positions down with it.
        const routes = await Promise.all(
          TRAIL_PREVIEWS.map((preview) =>
            loadRoute(preview.kmlUrl).catch((error: unknown) => {
              console.error(`${preview.name} route failed to load:`, error)
              return []
            }),
          ),
        )
        if (!isCurrent) return
        const lines = routes.flat()
        for (const path of lines) {
          trailLines.push(
            new maps.Polyline({
              map,
              path,
              strokeColor: '#ffffff',
              strokeWeight: 8,
              zIndex: Z_TRAIL_CASING,
              clickable: false,
            }),
            new maps.Polyline({
              map,
              path,
              strokeColor: TRAIL_COLOR,
              strokeWeight: 5,
              zIndex: Z_TRAIL,
              clickable: false,
            }),
          )
        }
        const bounds = boundsOf(lines.flat())
        if (bounds) map.fitBounds(bounds, 40)
      } catch (error) {
        console.error('Live map failed to load:', error)
        if (isCurrent) setMapState({ status: 'error', reason: 'load-failed' })
      }
    }

    void initializeMap(apiKey)

    return () => {
      isCurrent = false
      for (const line of trailLines) line.setMap(null)
      for (const overlay of overlays.values()) {
        overlay.path.setMap(null)
        overlay.marker.setMap(null)
      }
      overlays.clear()
    }
  }, [apiKey])

  // Each poll updates the existing overlays in place, so nothing flickers.
  useEffect(() => {
    if (!loadedMap) return
    const { map, maps } = loadedMap
    const overlays = overlaysRef.current
    const live = new Set<string>()

    for (const trek of treks) {
      if (!trek.latest || trek.path.length === 0) continue
      live.add(trek.bookingId)
      const path = trek.path.map(toLatLng)
      const position = toLatLng(trek.latest)
      const name = trek.guide?.fullName ?? 'Guide'

      const existing = overlays.get(trek.bookingId)
      if (existing) {
        existing.path.setPath(path)
        existing.marker.setPosition(position)
        existing.marker.setLabel(markerLabel(name))
        existing.marker.setTitle(`${name} · ${trek.trail.name}`)
        continue
      }
      const color = trekColor(trek.bookingId)
      overlays.set(trek.bookingId, {
        path: new maps.Polyline({
          map,
          path,
          strokeColor: color,
          strokeOpacity: 0.9,
          strokeWeight: 4,
          zIndex: Z_PATH,
          clickable: false,
        }),
        // A location dot like the guide app's, in the trek's colour.
        marker: new maps.Marker({
          map,
          position,
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
            // Puts the name above the dot instead of on it.
            labelOrigin: new maps.Point(0, -2.4),
          },
          label: markerLabel(name),
          title: `${name} · ${trek.trail.name}`,
          zIndex: 1000,
        }),
      })
    }

    // Treks that were completed since the last poll.
    for (const [bookingId, overlay] of overlays) {
      if (live.has(bookingId)) continue
      overlay.path.setMap(null)
      overlay.marker.setMap(null)
      overlays.delete(bookingId)
    }
  }, [loadedMap, treks])

  useEffect(() => {
    if (!loadedMap || !focus) return
    const trek = treksRef.current.find((t) => t.bookingId === focus.bookingId)
    if (!trek?.latest) return
    loadedMap.map.setZoom(FOCUS_ZOOM)
    loadedMap.map.panTo(toLatLng(trek.latest))
  }, [loadedMap, focus])

  return (
    <div className="relative h-[28rem] overflow-hidden rounded-xl border border-[#d5e1da] bg-[#e8f1eb] lg:h-[36rem]">
      <div ref={mapHostRef} className="absolute inset-0" />
      {mapState.status !== 'ready' && (
        <div
          aria-live="polite"
          className="absolute inset-0 grid place-items-center bg-[#e8f1eb] p-6 text-center text-sm text-[#52675e]"
          role={mapState.status === 'loading' ? 'status' : undefined}
        >
          {mapState.status === 'loading' && <span>Loading the live map…</span>}
          {mapState.status === 'error' && mapState.reason === 'missing-key' && (
            <span>
              Add VITE_GOOGLE_MAPS_API_KEY to frontend/.env.local, then restart
              the dev server.
            </span>
          )}
          {mapState.status === 'error' && mapState.reason === 'load-failed' && (
            <span>
              The map could not load. Check that the Maps JavaScript API is
              enabled, billing is active, and your key allows this site's
              referrer.
            </span>
          )}
        </div>
      )}
    </div>
  )
}

async function loadRoute(kmlUrl: string): Promise<LatLng[][]> {
  const response = await fetch(kmlUrl)
  if (!response.ok)
    throw new Error(`Failed to fetch trail KML: ${response.status}`)
  return parseKmlLineStrings(await response.text()).map((line) =>
    line.map(({ lat, lng }) => ({ lat, lng })),
  )
}

function boundsOf(points: LatLng[]): LatLngBoundsLiteral | null {
  if (points.length === 0) return null
  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    west: Math.min(...lngs),
  }
}
