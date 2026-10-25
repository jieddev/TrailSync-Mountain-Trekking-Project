export type TrailPreviewCamera = {
  center: { lat: number; lng: number; altitude: number }
  range: number
  tilt: number
  heading: number
  mode: 'SATELLITE'
}

export type TrailPreview = {
  // Matches the trail's catalog slug.
  id: string
  name: string
  subtitle: string
  kmlUrl: string
  camera: TrailPreviewCamera
}

// Both routes are provisional sections of the Wikiloc track "Alto peak via
// lake janagdan and malingatong" by James Pialago, starting at the Cabintan
// jump-off. Replace them once verified route data is collected.
export const SULFATARA_PREVIEW: TrailPreview = {
  id: 'sulfatara',
  name: 'Sulfatara',
  subtitle: 'Provisional working trail',
  kmlUrl: '/trails/sulfatara.kml',
  camera: {
    center: { lat: 11.0901, lng: 124.728, altitude: 0 },
    range: 5000,
    tilt: 60,
    heading: 0,
    mode: 'SATELLITE',
  },
}

// The source track only reaches the 1,069 m high point on the Malingatong
// side trail (likely the view deck), not the summit.
export const MT_MALINGATONG_PREVIEW: TrailPreview = {
  id: 'mt-malingatong',
  name: 'Mt. Malingatong',
  subtitle: 'Provisional working trail, up to the view deck',
  kmlUrl: '/trails/mt-malingatong.kml',
  camera: {
    center: { lat: 11.0903, lng: 124.7284, altitude: 0 },
    range: 5200,
    tilt: 60,
    heading: 0,
    mode: 'SATELLITE',
  },
}

export const TRAIL_PREVIEWS = [SULFATARA_PREVIEW, MT_MALINGATONG_PREVIEW]
