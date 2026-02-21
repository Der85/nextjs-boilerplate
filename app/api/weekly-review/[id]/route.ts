// app/api/weekly-review/[id]/route.ts
// Update user reflection and read status on a weekly review

import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { weeklyReviewRateLimiter } from '@/lib/rateLimiter'
import { weeklyReviewPatchSchema, parseBody } from '@/lib/validations'
import type { WeeklyReview } from '@/lib/types'

// ============================================
// Get Single Review
// ============================================
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }
    if (weeklyReviewRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }


    const { data: review, error } = await supabase
      .from('weekly_reviews')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !review) {
      return apiError('Review not found', 404, 'NOT_FOUND')
    }

    return NextResponse.json({ review: review as WeeklyReview }, {
      headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300' },
    })
  } catch (error) {
    console.error('Weekly review GET by ID error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}

// ============================================
// Update Review (reflection, read status)
// ============================================
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }
    if (weeklyReviewRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }


    const body = await request.json()
    const parsed = parseBody(weeklyReviewPatchSchema, body)
    if (!parsed.success) return parsed.response

    // Build update object
    const updates: Record<string, unknown> = {}

    if (parsed.data.user_reflection !== undefined) {
      updates.user_reflection = parsed.data.user_reflection
    }

    if (parsed.data.is_read !== undefined) {
      updates.is_read = parsed.data.is_read
      if (parsed.data.is_read) {
        updates.read_at = new Date().toISOString()
      }
    }

    // Update the review
    const { data: review, error } = await supabase
      .from('weekly_reviews')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update weekly review:', error)
      return apiError('Failed to update review', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({ review: review as WeeklyReview })
  } catch (error) {
    console.error('Weekly review PATCH error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
