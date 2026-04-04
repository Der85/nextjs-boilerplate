// Central location-validation module
// Pure functions — no Next.js or Node.js imports — safe for both client and server.
//
// Everything location-related lives here so new checks can be added in one place
// without touching individual endpoints or components.

import { latLngToCell } from 'h3-js'

// ── Constants ────────────────────────────────────────────────────────────────

export const H3_RESOLUTION = 8

/** ~1,080 km/h — faster than a commercial jet at cruise. Any single GPS jump
 *  above this speed is physically impossible and indicates spoofing or a bad fix. */
export const MAX_PLAUSIBLE_SPEED_MS = 300  // metres per second

/** Minimum number of samples needed before the jitter check can run. */
export const MIN_JITTER_SAMPLES = 5

/** Rolling window size kept by LocationProvider. */
export const POSITION_HISTORY_SIZE = 10

// ── Types ────────────────────────────────────────────────────────────────────

export interface PositionSample {
  lat: number
  lng: number
  timestamp: number  // ms epoch
}

// ── Geometry ─────────────────────────────────────────────────────────────────

/**
 * Great-circle distance between two coordinates in metres (Haversine formula).
 */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6_371_000
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Zone logic ───────────────────────────────────────────────────────────────

/**
 * Single source of truth for the location gate.
 * A user can interact with content in `targetZoneId` only when their GPS
 * places them in that same H3 cell.
 */
export function canInteract(currentZoneId: string | null, targetZoneId: string): boolean {
  return Boolean(currentZoneId && currentZoneId === targetZoneId)
}

/**
 * Server-side hard check: verify the submitted (lat, lng) actually hashes to
 * `claimedZoneId` at resolution 8. Prevents clients from asserting a zone that
 * doesn't match their coordinates.
 */
export function verifyZoneCoords(lat: number, lng: number, claimedZoneId: string): boolean {
  try {
    return latLngToCell(lat, lng, H3_RESOLUTION) === claimedZoneId
  } catch {
    return false
  }
}

// ── Anomaly detection ────────────────────────────────────────────────────────

/**
 * Returns true if the transition between two GPS samples is physically plausible.
 * A jump faster than MAX_PLAUSIBLE_SPEED_MS (300 m/s ≈ jet speed) is flagged.
 */
export function isVelocityPlausible(prev: PositionSample, next: PositionSample): boolean {
  const elapsedSecs = (next.timestamp - prev.timestamp) / 1_000
  if (elapsedSecs <= 0) return true   // retrograde or same timestamp — skip
  const distMetres = haversineDistance(prev.lat, prev.lng, next.lat, next.lng)
  return distMetres / elapsedSecs <= MAX_PLAUSIBLE_SPEED_MS
}

/**
 * Returns true if the sample window contains natural GPS noise (expected drift).
 * Real devices never emit perfectly identical coordinates across multiple readings.
 * All-identical samples across MIN_JITTER_SAMPLES+ points signal a static fake position.
 */
export function hasNaturalJitter(samples: PositionSample[]): boolean {
  if (samples.length < MIN_JITTER_SAMPLES) return true   // not enough data to judge
  const { lat: refLat, lng: refLng } = samples[0]
  return samples.some((s) => s.lat !== refLat || s.lng !== refLng)
}
