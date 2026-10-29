import { useEffect, useRef, useState } from 'react'

import { parseKmlLineStrings, type KmlCoordinate } from '../lib/kml'
import type { TrailPreview, TrailPreviewCamera } from '../trail-previews'

type Map3DElementOptions = TrailPreviewCamera

type Map3DElement = HTMLElement & {
  flyCameraTo?: (options: {
    endCamera: Omit<TrailPreviewCamera, 'mode'>
    durationMillis?: number
  }) => void
}

type Polyline3DElementOptions = {
  coordinates: KmlCoordinate[]
  strokeColor?: string
  strokeWidth?: number
  altitudeMode?: unknown
}

type Maps3DLibrary = {
  Map3DElement: new (options: Map3DElementOptions) => Map3DElement
  Polyline3DElement: new (options: Polyline3DElementOptions) => HTMLElement
  AltitudeMode: { CLAMP_TO_GROUND: unknown }
}

type GoogleMapsApi = {
  maps: {
    importLibrary: (libraryName: 'maps3d') => Promise<Maps3DLibrary>
  }
}

declare global {
  interface Window {
    google?: GoogleMapsApi
  }
}

let mapsApiPromise: Promise<GoogleMapsApi> | null = null

declare global {
  interface Window {
    __trailsyncMapsLoaded__?: () => void
  }
}

function loadGoogleMapsApi(apiKey: string): Promise<GoogleMapsApi> {
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google)
  if (mapsApiPromise) return mapsApiPromise

  mapsApiPromise = new Promise<GoogleMapsApi>((resolve, reject) => {
    const fail = (message: string, script: HTMLScriptElement) => {
      // Reset so a later mount can retry instead of reusing a rejected promise.
      mapsApiPromise = null
      delete window.__trailsyncMapsLoaded__
      script.remove()
      reject(new Error(message))
    }

    const script = document.createElement('script')
    script.async = true
    // The script's `load` event fires once this bootstrap file itself has
    // run, but it then fetches the real API payload asynchronously, so
    // `importLibrary` isn't defined yet at that point. The `callback` param
    // is invoked only once the requested `libraries` are actually ready.
    window.__trailsyncMapsLoaded__ = () => {
      delete window.__trailsyncMapsLoaded__
      if (window.google?.maps?.importLibrary) {
        resolve(window.google)
      } else {
        fail('Google Maps loaded without its API namespace.', script)
      }
    }
    // `v=beta` is needed on projects where maps3d is not yet generally available.
    script.src = `https://maps.googleapis.com/maps/api/js?loading=async&v=beta&libraries=maps3d&callback=__trailsyncMapsLoaded__&key=${encodeURIComponent(apiKey)}`
    script.onerror = () => fail('Google Maps could not be loaded.', script)
    document.head.appendChild(script)
  })

  return mapsApiPromise
}

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
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
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
        const googleMaps = await loadGoogleMapsApi(key)
        const maps3d = await googleMaps.maps.importLibrary('maps3d')
        if (!isCurrent || !mapHostRef.current) return

        const element = new maps3d.Map3DElement(initialCameraRef.current)
        mapElement = element
        // Custom elements don't always fill their parent, so size explicitly.
        element.style.display = 'block'
        element.style.width = '100%'
        element.style.height = '100%'
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
