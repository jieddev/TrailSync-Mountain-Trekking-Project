// Loads the Google Maps JS API once for the whole app: the beta `maps3d`
// library for the hiker trail preview, and the flat (2D) map for the
// coordinator live map. Only the parts of the API TrailSync uses are typed.

export type LatLng = { lat: number; lng: number }
export type LatLngAltitude = LatLng & { altitude?: number }

// --- 3D (hiker trail preview) ---

export type Map3DCamera = {
  center: { lat: number; lng: number; altitude: number }
  range: number
  tilt: number
  heading: number
}

export type Map3DElementOptions = Map3DCamera & { mode: 'SATELLITE' | 'HYBRID' }

export type Map3DElement = HTMLElement & {
  flyCameraTo?: (options: {
    endCamera: Map3DCamera
    durationMillis?: number
  }) => void
}

export type Polyline3DElementOptions = {
  coordinates: LatLngAltitude[]
  strokeColor?: string
  strokeWidth?: number
  altitudeMode?: unknown
}

export type Maps3DLibrary = {
  Map3DElement: new (options: Map3DElementOptions) => Map3DElement
  Polyline3DElement: new (options: Polyline3DElementOptions) => HTMLElement
  AltitudeMode: { CLAMP_TO_GROUND: unknown }
}

// --- 2D (coordinator live map) ---

export type LatLngBoundsLiteral = {
  north: number
  south: number
  east: number
  west: number
}

export type GoogleMap = {
  fitBounds: (bounds: LatLngBoundsLiteral, padding?: number) => void
  panTo: (position: LatLng) => void
  setZoom: (zoom: number) => void
}

export type MapOptions = {
  center: LatLng
  zoom: number
  minZoom?: number
  mapTypeId?: 'roadmap' | 'satellite' | 'hybrid' | 'terrain'
  mapTypeControl?: boolean
  streetViewControl?: boolean
  fullscreenControl?: boolean
  clickableIcons?: boolean
  gestureHandling?: 'cooperative' | 'greedy' | 'none' | 'auto'
}

export type Polyline = {
  setPath: (path: LatLng[]) => void
  setMap: (map: GoogleMap | null) => void
}

export type PolylineOptions = {
  map?: GoogleMap
  path: LatLng[]
  strokeColor?: string
  strokeOpacity?: number
  strokeWeight?: number
  zIndex?: number
  clickable?: boolean
}

export type MarkerLabel = {
  text: string
  color?: string
  fontSize?: string
  fontWeight?: string
  className?: string
}

export type MarkerIcon = {
  path: unknown
  scale: number
  fillColor: string
  fillOpacity: number
  strokeColor: string
  strokeWeight: number
  labelOrigin?: unknown
}

export type Marker = {
  setPosition: (position: LatLng) => void
  setLabel: (label: MarkerLabel) => void
  setTitle: (title: string) => void
  setMap: (map: GoogleMap | null) => void
}

export type MarkerOptions = {
  map?: GoogleMap
  position: LatLng
  icon?: MarkerIcon
  label?: MarkerLabel
  title?: string
  zIndex?: number
}

export type Maps2DLibrary = {
  Map: new (element: HTMLElement, options: MapOptions) => GoogleMap
  Polyline: new (options: PolylineOptions) => Polyline
  Marker: new (options: MarkerOptions) => Marker
  SymbolPath: { CIRCLE: unknown }
  Point: new (x: number, y: number) => unknown
}

// --- Loader ---

type GoogleMapsApi = {
  maps: {
    importLibrary: (libraryName: string) => Promise<unknown>
  }
}

declare global {
  interface Window {
    google?: GoogleMapsApi
    __trailsyncMapsLoaded__?: () => void
  }
}

export const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as
  string | undefined

let mapsApiPromise: Promise<GoogleMapsApi> | null = null

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
    // `v=beta` is needed on projects where maps3d is not yet generally
    // available. Other libraries load on demand through importLibrary.
    script.src = `https://maps.googleapis.com/maps/api/js?loading=async&v=beta&libraries=maps3d&callback=__trailsyncMapsLoaded__&key=${encodeURIComponent(apiKey)}`
    script.onerror = () => fail('Google Maps could not be loaded.', script)
    document.head.appendChild(script)
  })

  return mapsApiPromise
}

export async function loadMaps3d(apiKey: string): Promise<Maps3DLibrary> {
  const googleMaps = await loadGoogleMapsApi(apiKey)
  return (await googleMaps.maps.importLibrary('maps3d')) as Maps3DLibrary
}

// The flat map, polylines and classic markers (core, maps and marker).
export async function loadMaps2d(apiKey: string): Promise<Maps2DLibrary> {
  const googleMaps = await loadGoogleMapsApi(apiKey)
  const [core, maps, marker] = (await Promise.all([
    googleMaps.maps.importLibrary('core'),
    googleMaps.maps.importLibrary('maps'),
    googleMaps.maps.importLibrary('marker'),
  ])) as [
    Pick<Maps2DLibrary, 'SymbolPath' | 'Point'>,
    Pick<Maps2DLibrary, 'Map' | 'Polyline'>,
    Pick<Maps2DLibrary, 'Marker'>,
  ]
  return {
    Map: maps.Map,
    Polyline: maps.Polyline,
    Marker: marker.Marker,
    SymbolPath: core.SymbolPath,
    Point: core.Point,
  }
}

// Custom elements don't always fill their parent, so size explicitly.
export function fillParent(element: HTMLElement) {
  element.style.display = 'block'
  element.style.width = '100%'
  element.style.height = '100%'
}
