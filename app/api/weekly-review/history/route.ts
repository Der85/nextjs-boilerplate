// app/api/weekly-review/history/route.ts
// Returns all weekly reviews for the user, paginated

import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { weeklyReviewRateLimiter } from '@/lib/rateLimiter'
import type { WeeklyReview } from '@/lib/types'

// ============================================
// Main Handler
// ============================================
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }
    if (weeklyReviewRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }


    // Parse pagination params
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Fetch reviews with pagination
    const { data: reviews, error, count } = await supabase
      .from('weekly_reviews')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('week_start', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Failed to fetch weekly review history:', error)
      return apiError('Failed to fetch history', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({
      reviews: (reviews || []) as WeeklyReview[],
      total: count || 0,
      limit,
      offset,
      hasMore: count ? offset + limit < count : false,
    }, {
      headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300' },
    })
  } catch (error) {
    console.error('Weekly review history error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
