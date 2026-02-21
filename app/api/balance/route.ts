// app/api/balance/route.ts
// Returns the latest balance score for the user
// If today's score doesn't exist yet, computes it
// Also returns the last 14 scores for the trend chart

import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { fetchRecentTasks, computeExtendedCategoryStats } from '@/lib/utils/taskStats'
import type { UserPriority, BalanceScore, DomainScore, BalanceScoreRow, BalanceScoreTrend } from '@/lib/types'

// ============================================
// Fetch User Priorities
// ============================================
async function fetchUserPriorities(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<UserPriority[]> {
  const { data } = await supabase
    .from('user_priorities')
    .select('*')
    .eq('user_id', userId)
    .order('rank', { ascending: true })

  return (data || []) as UserPriority[]
}

// ============================================
// Get Today's Score
// ============================================
async function getTodayScore(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<BalanceScoreRow | null> {
  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('balance_scores')
    .select('id, user_id, score, breakdown, computed_for_date, created_at')
    .eq('user_id', userId)
    .eq('computed_for_date', today)
    .single()

  return data as BalanceScoreRow | null
}

// ============================================
// Get Recent Scores for Trend
// ============================================
async function getRecentScores(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  days: number = 14
): Promise<BalanceScoreTrend[]> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)

  const { data } = await supabase
    .from('balance_scores')
    .select('score, computed_for_date')
    .eq('user_id', userId)
    .gte('computed_for_date', cutoffDate.toISOString().split('T')[0])
    .order('computed_for_date', { ascending: true })

  return (data || []).map(d => ({
    date: d.computed_for_date,
    score: d.score,
  }))
}

// ============================================
// Get Previous Day's Score (for carry-forward)
// ============================================
async function getPreviousScore(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<number | null> {
  const { data } = await supabase
    .from('balance_scores')
    .select('score')
    .eq('user_id', userId)
    .order('computed_for_date', { ascending: false })
    .limit(1)

  if (data && data.length > 0) {
    return data[0].score
  }
  return null
}

// ============================================
// Compute Balance Score (duplicated for convenience - could be shared)
// ============================================
function computeBalanceScore(
  priorities: UserPriority[],
  categoryStats: ReturnType<typeof computeExtendedCategoryStats>,
  previousScore: number | null
): BalanceScore {
  const totalImportance = priorities.reduce((sum, p) => sum + p.importance_score, 0)
  const weights = priorities.map(p => ({
    domain: p.domain,
    weight: totalImportance > 0 ? p.importance_score / totalImportance : 1 / priorities.length,
    importanceScore: p.importance_score,
    rank: p.rank,
  }))

  const categoryStatsByName = new Map<string, ReturnType<typeof computeExtendedCategoryStats>[0]>()
  for (const stat of categoryStats) {
    categoryStatsByName.set(stat.categoryName.toLowerCase(), stat)
  }

  const domainScores: DomainScore[] = weights.map(w => {
    const stats = categoryStatsByName.get(w.domain.toLowerCase())

    if (!stats || stats.totalTasks === 0) {
      return {
        domain: w.domain,
        score: w.weight > 0.15 ? 10 : 50,
        weight: w.weight,
        taskCount: 0,
        completionRate: 0,
        categoryIcon: null,
        categoryColor: null,
      }
    }

    const completionScore = stats.completionRate * 70
    const volumeScore = Math.min(stats.totalTasks / 3, 1) * 20
    const lastCompletedDaysAgo = stats.lastCompletedDaysAgo ?? 999
    const recencyScore = lastCompletedDaysAgo <= 3 ? 10 : lastCompletedDaysAgo <= 7 ? 5 : 0

    return {
      domain: w.domain,
      score: Math.round(completionScore + volumeScore + recencyScore),
      weight: w.weight,
      taskCount: stats.totalTasks,
      completionRate: stats.completionRate,
      categoryIcon: stats.categoryIcon,
      categoryColor: stats.categoryColor,
    }
  })

  const overallScore = Math.round(
    domainScores.reduce((sum, d) => sum + (d.score * d.weight), 0)
  )

  const totalTaskCount = domainScores.reduce((sum, d) => sum + d.taskCount, 0)
  if (totalTaskCount === 0 && previousScore !== null) {
    return {
      score: previousScore,
      breakdown: domainScores,
    }
  }

  return {
    score: Math.min(100, Math.max(0, overallScore)),
    breakdown: domainScores,
  }
}

// ============================================
// Save Score to Database
// ============================================
async function saveBalanceScore(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  score: BalanceScore,
  date: string
): Promise<BalanceScoreRow | null> {
  const { data, error } = await supabase
    .from('balance_scores')
    .upsert({
      user_id: userId,
      score: score.score,
      breakdown: score.breakdown,
      computed_for_date: date,
    }, {
      onConflict: 'user_id,computed_for_date',
    })
    .select('id, user_id, score, breakdown, computed_for_date, created_at')
    .single()

  if (error) {
    console.error('Failed to save balance score:', error)
    return null
  }

  return data as BalanceScoreRow
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

    // 1. Check if user has priorities
    const priorities = await fetchUserPriorities(supabase, user.id)

    if (priorities.length === 0) {
      return NextResponse.json({
        hasPriorities: false,
        message: 'Please set your life priorities first to see your balance score.',
      })
    }

    // 2. Check for today's score
    let todayScore = await getTodayScore(supabase, user.id)

    // 3. If no score for today, compute it
    if (!todayScore) {
      const tasks = await fetchRecentTasks(supabase, user.id, 14)
      const categoryStats = computeExtendedCategoryStats(tasks)
      const previousScore = await getPreviousScore(supabase, user.id)
      const balanceScore = computeBalanceScore(priorities, categoryStats, previousScore)
      const today = new Date().toISOString().split('T')[0]
      todayScore = await saveBalanceScore(supabase, user.id, balanceScore, today)
    }

    // 4. Get recent scores for trend
    const trend = await getRecentScores(supabase, user.id, 14)

    // 5. Calculate change from yesterday
    let changeFromYesterday: number | null = null
    if (trend.length >= 2 && todayScore) {
      const yesterday = trend[trend.length - 2]
      if (yesterday) {
        changeFromYesterday = todayScore.score - yesterday.score
      }
    }

    return NextResponse.json({
      hasPriorities: true,
      score: todayScore,
      trend,
      changeFromYesterday,
    })
  } catch (error) {
    console.error('Balance GET API error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
