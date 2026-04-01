import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-response'
import { zonesRateLimiter } from '@/lib/rateLimiter'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ zoneId: string }> }
) {
  try {
    const { zoneId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }
    if (zonesRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }

    const { data: zone, error } = await supabase
      .from('zones')
      .select('*')
      .eq('id', zoneId)
      .single()

    if (error || !zone) {
      return apiError('Zone not found.', 404, 'NOT_FOUND')
    }

    // Check if current user follows this zone
    const { data: follow } = await supabase
      .from('location_follows')
      .select('id')
      .eq('user_id', user.id)
      .eq('zone_id', zoneId)
      .single()

    return NextResponse.json({ zone, is_following: !!follow })
  } catch (error) {
    console.error('Zone GET error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
