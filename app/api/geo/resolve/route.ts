import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-response'
import { geoRateLimiter } from '@/lib/rateLimiter'
import { geoResolveSchema, parseBody } from '@/lib/validations'
import { latLngToZoneId, getZoneCenter } from '@/lib/utils/h3'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }
    if (geoRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }

    const body = await request.json()
    const parsed = parseBody(geoResolveSchema, body)
    if (!parsed.success) return parsed.response

    const { lat, lng } = parsed.data
    const h3Index = latLngToZoneId(lat, lng)
    const center = getZoneCenter(h3Index)

    // Try to find existing zone
    const { data: existingZone } = await supabase
      .from('zones')
      .select('*')
      .eq('id', h3Index)
      .single()

    if (existingZone) {
      return NextResponse.json({ zone: existingZone, h3_index: h3Index })
    }

    // Zone doesn't exist yet — create it with H3 index as temporary label.
    // Reverse geocoding can enrich the label later.
    const { data: newZone, error: insertError } = await supabase
      .from('zones')
      .insert({
        id: h3Index,
        label: h3Index, // placeholder until reverse geocoded
        h3_resolution: 7,
        lat: center.lat,
        lng: center.lng,
      })
      .select()
      .single()

    if (insertError) {
      // Race condition: another request created it first
      if (insertError.code === '23505') {
        const { data: raceZone } = await supabase
          .from('zones')
          .select('*')
          .eq('id', h3Index)
          .single()
        return NextResponse.json({ zone: raceZone, h3_index: h3Index })
      }
      console.error('Zone create error:', insertError)
      return apiError('Failed to resolve zone.', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({ zone: newZone, h3_index: h3Index })
  } catch (error) {
    console.error('Geo resolve error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
