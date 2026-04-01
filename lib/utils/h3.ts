import { latLngToCell, cellToLatLng, getResolution } from 'h3-js'

// Default resolution 7: ~5.16 km² hexagons, good neighbourhood-sized zones
const DEFAULT_RESOLUTION = 7

/**
 * Convert lat/lng to an H3 cell index at the default resolution.
 */
export function latLngToZoneId(lat: number, lng: number, resolution = DEFAULT_RESOLUTION): string {
  return latLngToCell(lat, lng, resolution)
}

/**
 * Get the center point of an H3 cell.
 */
export function getZoneCenter(h3Index: string): { lat: number; lng: number } {
  const [lat, lng] = cellToLatLng(h3Index)
  return { lat, lng }
}

/**
 * Get the resolution of an existing H3 index.
 */
export function getH3Resolution(h3Index: string): number {
  return getResolution(h3Index)
}

export { DEFAULT_RESOLUTION }
