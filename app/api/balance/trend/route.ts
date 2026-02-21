// app/api/balance/trend/route.ts
// Returns the last 30 days of balance scores for trend visualization

import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { balanceRateLimiter } from '@/lib/rateLimiter'
import { formatUTCDate } from '@/lib/utils/dates'
import type { BalanceScoreTrend } from '@/lib/types'

// ============================================
// Get Trend Data
// ============================================
async function getTrendData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  days: number = 30
): Promise<BalanceScoreTrend[]> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)

  const { data } = await supabase
    .from('balance_scores')
    .select('score, computed_for_date')
    .eq('user_id', userId)
    .gte('computed_for_date', formatUTCDate(cutoffDate))
    .order('computed_for_date', { ascending: true })

  return (data || []).map(d => ({
    date: d.computed_for_date,
    score: d.score,
  }))
}

// ============================================
// Calculate Trend Direction
// ============================================
function calculateTrendDirection(
  trend: BalanceScoreTrend[]
): 'up' | 'down' | 'flat' {
  if (trend.length < 2) return 'flat'

  // Compare 7-day average to previous 7-day average
  const recentDays = trend.slice(-7)
  const previousDays = trend.slice(-14, -7)

  if (previousDays.length === 0) {
    // Not enough data, compare first half to second half
    const midpoint = Math.floor(trend.length / 2)
    const firstHalf = trend.slice(0, midpoint)
    const secondHalf = trend.slice(midpoint)

    if (firstHalf.length === 0 || secondHalf.length === 0) return 'flat'

    const firstAvg = firstHalf.reduce((sum, t) => sum + t.score, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((sum, t) => sum + t.score, 0) / secondHalf.length
    const diff = secondAvg - firstAvg

    if (diff > 3) return 'up'
    if (diff < -3) return 'down'
    return 'flat'
  }

  const recentAvg = recentDays.reduce((sum, t) => sum + t.score, 0) / recentDays.length
  const previousAvg = previousDays.reduce((sum, t) => sum + t.score, 0) / previousDays.length
  const diff = recentAvg - previousAvg

  if (diff > 3) return 'up'
  if (diff < -3) return 'down'
  return 'flat'
}

// ============================================
// Calculate Statistics
// ============================================
function calculateStats(trend: BalanceScoreTrend[]): {
  average: number
  highest: number
  lowest: number
  weeklyAverages: { week: number; average: number }[]
} {
  if (trend.length === 0) {
    return {
      average: 0,
      highest: 0,
      lowest: 0,
      weeklyAverages: [],
    }
  }

  const scores = trend.map(t => t.score)
  const average = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  const highest = Math.max(...scores)
  const lowest = Math.min(...scores)

  // Calculate weekly averages (last 4 weeks)
  const weeklyAverages: { week: number; average: number }[] = []
  for (let week = 0; week < 4; week++) {
    const startIdx = Math.max(0, trend.length - (7 * (week + 1)))
    const endIdx = trend.length - (7 * week)
    const weekData = trend.slice(startIdx, endIdx)

    if (weekData.length > 0) {
      const weekAvg = Math.round(
        weekData.reduce((sum, t) => sum + t.score, 0) / weekData.length
      )
      weeklyAverages.unshift({ week: week + 1, average: weekAvg })
    }
  }

  return {
    average,
    highest,
    lowest,
    weeklyAverages,
  }
}

// ============================================
// Main Handler
// ============================================
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }
    if (balanceRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }


    // Get 30-day trend data
    const trend = await getTrendData(supabase, user.id, 30)

    // Calculate trend direction and stats
    const direction = calculateTrendDirection(trend)
    const stats = calculateStats(trend)

    return NextResponse.json({
      trend,
      direction,
      stats,
    })
  } catch (error) {
    console.error('Balance trend API error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
