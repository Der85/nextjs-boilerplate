// Server-side location verification utilities
//
// verifyZoneCoords — re-exported from lib/location (pure, shared with client)
// ipGeoMatchesGps  — server-only soft check using Vercel IP-geo request headers

import type { NextRequest } from 'next/server'
import { latLngToCell } from 'h3-js'

// Re-export the pure coord check so routes only need one import path
export { verifyZoneCoords } from '@/lib/location'

// Res 3 hexagons are ~600 km across — generous enough to absorb VPN and cell-network drift
const IP_GEO_RESOLUTION = 3

/**
 * Soft check: compare Vercel's IP-geo headers against the claimed GPS position at
 * a coarse H3 resolution (res 3 ≈ 600 km hexagons).
 *
 * Always returns true when headers are absent — expected in dev, CI, and for VPN users.
 * Only returns false when both geo headers are present AND the cells clearly disagree
 * (i.e. the user's IP says they're on a different continent from their claimed position).
 */
export function ipGeoMatchesGps(request: NextRequest, lat: number, lng: number): boolean {
  const ipLatStr = request.headers.get('x-vercel-ip-latitude')
  const ipLngStr = request.headers.get('x-vercel-ip-longitude')

  if (!ipLatStr || !ipLngStr) return true

  const ipLat = parseFloat(ipLatStr)
  const ipLng = parseFloat(ipLngStr)
  if (isNaN(ipLat) || isNaN(ipLng)) return true

  try {
    return (
      latLngToCell(ipLat, ipLng, IP_GEO_RESOLUTION) ===
      latLngToCell(lat, lng, IP_GEO_RESOLUTION)
    )
  } catch {
    return true
  }
}
