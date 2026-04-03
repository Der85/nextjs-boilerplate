// POST /api/geo/resolve
// Converts a lat/lng to an H3 zone, looks up or creates the zone in Supabase,
// and returns a human-readable label via Nominatim reverse geocoding.
//
// Zone resolution is fixed at H3 level 8 (~0.74 km²) for Phase 1.
// Dynamic resolution based on user density is a Phase 2 concern.

import { NextRequest, NextResponse } from 'next/server'
import { latLngToCell } from 'h3-js'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-response'
import { geoRateLimiter } from '@/lib/rateLimiter'

const H3_RESOLUTION = 8

const BodySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

interface NominatimAddress {
  suburb?: string
  neighbourhood?: string
  quarter?: string
  city?: string
  town?: string
  village?: string
}

interface NominatimResponse {
  address?: NominatimAddress
  display_name?: string
}

async function fetchZoneLabel(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
    const res = await fetch(url, {
      // Nominatim ToS requires a descriptive User-Agent and <= 1 req/sec
      headers: { 'User-Agent': 'ADHDer.io/1.0 (contact@adhder.io)' },
    })

    if (!res.ok) throw new Error(`Nominatim ${res.status}`)

    const data = await res.json() as NominatimResponse
    const addr = data.address ?? {}

    // Build label from most-specific to least-specific components
    const parts = [
      addr.suburb ?? addr.neighbourhood ?? addr.quarter,
      addr.city ?? addr.town ?? addr.village,
    ].filter(Boolean)

    if (parts.length > 0) return parts.join(', ')

    // Fall back to the first two parts of Nominatim's display_name
    if (data.display_name) {
      return data.display_name.split(',').slice(0, 2).map((s) => s.trim()).join(', ')
    }
  } catch {
    // Nominatim is best-effort — don't fail the whole request
  }

  return `Zone ${latLngToCell(lat, lng, H3_RESOLUTION).slice(0, 8)}`
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401, 'UNAUTHORIZED')

  if (geoRateLimiter.isLimited(user.id)) {
    return apiError('Too many requests', 429, 'RATE_LIMITED')
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid JSON', 400, 'BAD_REQUEST')
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return apiError('Invalid coordinates', 400, 'VALIDATION_ERROR')
  }

  const { latitude, longitude } = parsed.data
  const zoneId = latLngToCell(latitude, longitude, H3_RESOLUTION)

  // Check if we already know this zone — skip Nominatim if so
  const { data: existing } = await supabase
    .from('zones')
    .select('zone_id, label, resolution')
    .eq('zone_id', zoneId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ zoneId: existing.zone_id, zoneLabel: existing.label, resolution: existing.resolution })
  }

  // New zone — reverse geocode and persist
  const zoneLabel = await fetchZoneLabel(latitude, longitude)

  await supabase.from('zones').upsert(
    { zone_id: zoneId, label: zoneLabel, resolution: H3_RESOLUTION, updated_at: new Date().toISOString() },
    { onConflict: 'zone_id' }
  )

  return NextResponse.json({ zoneId, zoneLabel, resolution: H3_RESOLUTION })
}
