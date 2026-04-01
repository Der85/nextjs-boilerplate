import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-response'
import { followRateLimiter } from '@/lib/rateLimiter'
import { locationFollowSchema, parseBody } from '@/lib/validations'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }
    if (followRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }

    const { data: follows, error } = await supabase
      .from('location_follows')
      .select('*, zone:zones!location_follows_zone_id_fkey(id, label)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Follows fetch error:', error)
      return apiError('Failed to load follows.', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({ follows })
  } catch (error) {
    console.error('Follows GET error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }
    if (followRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }

    const body = await request.json()
    const parsed = parseBody(locationFollowSchema, body)
    if (!parsed.success) return parsed.response

    // Get the zone label for denormalised storage
    const { data: zone } = await supabase
      .from('zones')
      .select('label')
      .eq('id', parsed.data.zone_id)
      .single()

    const { data: follow, error } = await supabase
      .from('location_follows')
      .insert({
        user_id: user.id,
        zone_id: parsed.data.zone_id,
        zone_label: zone?.label || parsed.data.zone_id,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return apiError('Already following this zone.', 409, 'CONFLICT')
      }
      console.error('Follow create error:', error)
      return apiError('Failed to follow zone.', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({ follow }, { status: 201 })
  } catch (error) {
    console.error('Follows POST error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }
    if (followRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }

    const body = await request.json()
    const parsed = parseBody(locationFollowSchema, body)
    if (!parsed.success) return parsed.response

    const { error } = await supabase
      .from('location_follows')
      .delete()
      .eq('user_id', user.id)
      .eq('zone_id', parsed.data.zone_id)

    if (error) {
      console.error('Follow delete error:', error)
      return apiError('Failed to unfollow zone.', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({ unfollowed: true })
  } catch (error) {
    console.error('Follows DELETE error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
