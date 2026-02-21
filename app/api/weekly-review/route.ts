// app/api/weekly-review/route.ts
// Returns the most recent weekly review for the user

import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { weeklyReviewRateLimiter } from '@/lib/rateLimiter'
import { formatUTCDate } from '@/lib/utils/dates'
import type { WeeklyReview } from '@/lib/types'

// ============================================
// Get Week Start from Date
// ============================================
function getWeekStartFromDate(dateStr: string): string {
  const date = new Date(dateStr)
  const dayOfWeek = date.getDay()
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday = new Date(date)
  monday.setDate(date.getDate() - daysToMonday)
  return formatUTCDate(monday)
}

function getLastWeekStart(): string {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const lastMonday = new Date(now)
  lastMonday.setDate(now.getDate() - daysToLastMonday - 7)
  return formatUTCDate(lastMonday)
}

// ============================================
// Check if user can generate a review
// ============================================
function canGenerateReview(): { canGenerate: boolean; reason: string } {
  const dayOfWeek = new Date().getDay()
  if (dayOfWeek >= 1 && dayOfWeek <= 3) {
    return { canGenerate: true, reason: '' }
  }
  return {
    canGenerate: false,
    reason: 'Weekly reviews can be generated on Monday-Wednesday',
  }
}

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


    // Check for specific week query param
    const searchParams = request.nextUrl.searchParams
    const weekParam = searchParams.get('week')

    let weekStart: string
    if (weekParam) {
      // Validate and normalize to week start (Monday)
      weekStart = getWeekStartFromDate(weekParam)
    } else {
      // Default to last week
      weekStart = getLastWeekStart()
    }

    // Fetch the review
    const { data: review, error } = await supabase
      .from('weekly_reviews')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_start', weekStart)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine
      console.error('Failed to fetch weekly review:', error)
      return apiError('Failed to fetch review', 500, 'INTERNAL_ERROR')
    }

    // Check if user can generate a review
    const { canGenerate, reason } = canGenerateReview()

    // Check if user has been using the app long enough
    const { count: taskCount } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    const hasEnoughTasks = (taskCount || 0) >= 5

    // Get earliest task to check account age
    const { data: earliestTask } = await supabase
      .from('tasks')
      .select('created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)

    let accountOldEnough = false
    if (earliestTask && earliestTask.length > 0) {
      const firstTaskDate = new Date(earliestTask[0].created_at)
      const daysSinceFirstTask = Math.floor(
        (Date.now() - firstTaskDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      accountOldEnough = daysSinceFirstTask >= 7
    }

    const canShowReviewPrompt = hasEnoughTasks && accountOldEnough && canGenerate

    return NextResponse.json({
      review: review as WeeklyReview | null,
      weekStart,
      canGenerate,
      canGenerateReason: reason,
      canShowReviewPrompt,
    }, {
      headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300' },
    })
  } catch (error) {
    console.error('Weekly review GET error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
