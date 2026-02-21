import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { insightsRateLimiter } from '@/lib/rateLimiter'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }

    if (insightsRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)

    // Total active + done tasks
    const { count: totalTasks } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .neq('status', 'dropped')

    // Completed today
    const { count: completedToday } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'done')
      .gte('completed_at', todayStart)

    // Completed this week
    const { count: completedThisWeek } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'done')
      .gte('completed_at', weekStart.toISOString())

    // Compute streak: consecutive days with completions
    const { data: recentCompletions } = await supabase
      .from('tasks')
      .select('completed_at')
      .eq('user_id', user.id)
      .eq('status', 'done')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(100)

    let streak = 0
    if (recentCompletions && recentCompletions.length > 0) {
      const dates = new Set(
        recentCompletions.map(t => t.completed_at!.split('T')[0])
      )
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Check if today has completions
      const todayISO = today.toISOString().split('T')[0]
      if (dates.has(todayISO)) {
        streak = 1
        const d = new Date(today)
        d.setDate(d.getDate() - 1)
        while (dates.has(d.toISOString().split('T')[0])) {
          streak++
          d.setDate(d.getDate() - 1)
        }
      } else {
        // Check if yesterday had completions (streak not broken yet today)
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayISO = yesterday.toISOString().split('T')[0]
        if (dates.has(yesterdayISO)) {
          streak = 1
          const d = new Date(yesterday)
          d.setDate(d.getDate() - 1)
          while (dates.has(d.toISOString().split('T')[0])) {
            streak++
            d.setDate(d.getDate() - 1)
          }
        }
      }
    }

    // Completion rate this week
    const { count: createdThisWeek } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', weekStart.toISOString())

    const completionRate = createdThisWeek && createdThisWeek > 0
      ? Math.round(((completedThisWeek || 0) / createdThisWeek) * 100)
      : 0

    return NextResponse.json({
      total_tasks: totalTasks || 0,
      completed_today: completedToday || 0,
      completed_this_week: completedThisWeek || 0,
      current_streak: streak,
      completion_rate: completionRate,
    })
  } catch (error) {
    console.error('Insights summary error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
