export type TrailPreviewCamera = {
  center: { lat: number; lng: number; altitude: number }
  range: number
  tilt: number
  heading: number
  mode: 'SATELLITE'
}

export type TrailPreview = {
  name: string
  subtitle: string
  kmlUrl: string
  camera: TrailPreviewCamera
}

// Provisional route: the Cabintan jump-off to Sulfatara section of the Wikiloc
// track "Alto peak via lake janagdan and malingatong" by James Pialago. Replace
// it once verified Sulfatara route data is collected.
export const SULFATARA_PREVIEW: TrailPreview = {
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
