import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-response'
import { zonesRateLimiter } from '@/lib/rateLimiter'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }
    if (zonesRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    let query = supabase
      .from('zones')
      .select('*')
      .order('post_count', { ascending: false })
      .limit(limit)

    if (search) {
      query = query.ilike('label', `%${search}%`)
    }

    const { data: zones, error } = await query

    if (error) {
      console.error('Zones fetch error:', error)
      return apiError('Failed to load zones.', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({ zones })
  } catch (error) {
    console.error('Zones GET error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
