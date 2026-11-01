import { useEffect, useRef, useState } from 'react'

import {
  fillParent,
  googleMapsApiKey,
  loadMaps3d,
  type Map3DElement,
  type Maps3DLibrary,
} from '../../../lib/google-maps'
import { parseKmlLineStrings } from '../lib/kml'
import type { TrailPreview } from '../trail-previews'

type MapState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; reason: 'missing-key' | 'load-failed' }

export default function TrailPreviewMap({
  preview,
}: {
  preview: TrailPreview
}) {
  const mapHostRef = useRef<HTMLDivElement>(null)
  // The map is created once; later preview changes move the camera instead.
  const initialCameraRef = useRef(preview.camera)
  const apiKey = googleMapsApiKey
  const [mapState, setMapState] = useState<MapState>(
    apiKey ? { status: 'loading' } : { status: 'error', reason: 'missing-key' },
  )
  const [loadedMap, setLoadedMap] = useState<{
    element: Map3DElement
    maps3d: Maps3DLibrary
  } | null>(null)

  useEffect(() => {
    if (!apiKey) return

    let isCurrent = true
    let mapElement: HTMLElement | undefined

    async function initializeMap(key: string) {
      try {
        const maps3d = await loadMaps3d(key)
        if (!isCurrent || !mapHostRef.current) return

        const element = new maps3d.Map3DElement(initialCameraRef.current)
        mapElement = element
        fillParent(element)
        mapHostRef.current.replaceChildren(element)
        setMapState({ status: 'ready' })
        setLoadedMap({ element, maps3d })
      } catch (error) {
        console.error('Trail preview map failed to load:', error)
        if (isCurrent) setMapState({ status: 'error', reason: 'load-failed' })
      }
    }

    void initializeMap(apiKey)

    return () => {
      isCurrent = false
      mapElement?.remove()
    }
  }, [apiKey])

  useEffect(() => {
    if (!loadedMap) return
    const { element, maps3d } = loadedMap

    let isCurrent = true
    const polylines: HTMLElement[] = []

    const { center, range, tilt, heading } = preview.camera
    const endCamera = { center, range, tilt, heading }
    if (element.flyCameraTo) {
      element.flyCameraTo({ endCamera, durationMillis: 1500 })
    } else {
      Object.assign(element, endCamera)
    }

    async function addTrailPolylines() {
      const response = await fetch(preview.kmlUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch trail KML: ${response.status}`)
      }
      const kmlText = await response.text()
      const lineStrings = parseKmlLineStrings(kmlText)
      if (!isCurrent) return

      for (const coordinates of lineStrings) {
        const polyline = new maps3d.Polyline3DElement({
          coordinates,
          strokeColor: '#ff5a1f',
          strokeWidth: 6,
          altitudeMode: maps3d.AltitudeMode.CLAMP_TO_GROUND,
        })
        polylines.push(polyline)
        element.append(polyline)
      }
    }

    // The base map still loaded fine, so don't fail the whole view over a
    // missing or malformed trail overlay.
    addTrailPolylines().catch((error: unknown) => {
      console.error(`${preview.name} trail polyline failed to load:`, error)
    })

    return () => {
      isCurrent = false
      for (const polyline of polylines) polyline.remove()
    }
  }, [loadedMap, preview])

  return (
    <div className="relative min-h-80 overflow-hidden rounded-xl border border-[#d5e1da] bg-[#e8f1eb] sm:min-h-96">
      <div ref={mapHostRef} className="absolute inset-0" />
      {mapState.status !== 'ready' && (
        <div
          aria-live="polite"
          className="absolute inset-0 grid place-items-center bg-[#e8f1eb] p-6 text-center text-sm text-[#52675e]"
          role={mapState.status === 'loading' ? 'status' : undefined}
        >
          {mapState.status === 'loading' && (
            <span>Loading {preview.name} in 3D...</span>
          )}
          {mapState.status === 'error' && mapState.reason === 'missing-key' && (
            <span>
              Add VITE_GOOGLE_MAPS_API_KEY to frontend/.env.local, then restart
              the dev server.
            </span>
          )}
          {mapState.status === 'error' && mapState.reason === 'load-failed' && (
            <span>
              The 3D map could not load. Check that the Maps JavaScript API is
              enabled, billing is active, and your key allows this site's
              referrer.
            </span>
          )}
        </div>
      )}
    </div>
  )
}
