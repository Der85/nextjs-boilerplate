// app/api/balance/compute/route.ts
// Computes today's Life Balance Score for the authenticated user
// Score represents alignment between task activity and stated priorities

import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { fetchRecentTasks, computeExtendedCategoryStats } from '@/lib/utils/taskStats'
import type { UserPriority, BalanceScore, DomainScore, BalanceScoreRow } from '@/lib/types'

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
// Get Previous Day's Score (for carry-forward on zero activity days)
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
// Compute Balance Score Algorithm
// ============================================
function computeBalanceScore(
  priorities: UserPriority[],
  categoryStats: ReturnType<typeof computeExtendedCategoryStats>,
  previousScore: number | null
): BalanceScore {
  // 1. Calculate weight per domain based on importance_score
  const totalImportance = priorities.reduce((sum, p) => sum + p.importance_score, 0)
  const weights = priorities.map(p => ({
    domain: p.domain,
    weight: totalImportance > 0 ? p.importance_score / totalImportance : 1 / priorities.length,
    importanceScore: p.importance_score,
    rank: p.rank,
  }))

  // 2. Create a map of category name (lowercase) to stats
  const categoryStatsByName = new Map<string, ReturnType<typeof computeExtendedCategoryStats>[0]>()
  for (const stat of categoryStats) {
    categoryStatsByName.set(stat.categoryName.toLowerCase(), stat)
  }

  // 3. Calculate per-domain activity score (0-100)
  const domainScores: DomainScore[] = weights.map(w => {
    const stats = categoryStatsByName.get(w.domain.toLowerCase())

    if (!stats || stats.totalTasks === 0) {
      // No tasks in this domain = score based on importance
      // High importance + no tasks = very low score
      // Low importance + no tasks = acceptable (score 50)
      return {
        domain: w.domain,
        score: w.weight > 0.15 ? 10 : 50, // heavily penalize neglected high-priority domains
        weight: w.weight,
        taskCount: 0,
        completionRate: 0,
        categoryIcon: null,
        categoryColor: null,
      }
    }

    // Has tasks: score based on completion rate + recency + volume
    const completionScore = stats.completionRate * 70 // 0-70 points from completion rate
    const volumeScore = Math.min(stats.totalTasks / 3, 1) * 20 // 0-20 points, 3+ tasks = max
    const lastCompletedDaysAgo = stats.lastCompletedDaysAgo ?? 999
    const recencyScore = lastCompletedDaysAgo <= 3 ? 10 : lastCompletedDaysAgo <= 7 ? 5 : 0 // 0-10 points

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

  // 4. Weighted average = overall balance score
  const overallScore = Math.round(
    domainScores.reduce((sum, d) => sum + (d.score * d.weight), 0)
  )

  // 5. Handle zero activity days - carry forward previous score
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
  // Upsert - update if exists for this date, insert if not
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
export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }

    // 1. Fetch user priorities
    const priorities = await fetchUserPriorities(supabase, user.id)

    if (priorities.length === 0) {
      return NextResponse.json({
        error: 'No priorities set',
        message: 'Please set your life priorities first to see your balance score.',
      }, { status: 400 })
    }

    // 2. Fetch recent tasks (14 days)
    const tasks = await fetchRecentTasks(supabase, user.id, 14)

    // 3. Compute extended category stats (with recency data)
    const categoryStats = computeExtendedCategoryStats(tasks)

    // 4. Get previous score for carry-forward logic
    const previousScore = await getPreviousScore(supabase, user.id)

    // 5. Compute balance score
    const balanceScore = computeBalanceScore(priorities, categoryStats, previousScore)

    // 6. Save to database
    const today = new Date().toISOString().split('T')[0]
    const saved = await saveBalanceScore(supabase, user.id, balanceScore, today)

    return NextResponse.json({
      score: saved || balanceScore,
      computed: true,
    })
  } catch (error) {
    console.error('Balance compute API error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
