// Current Weekly Plan API Route
// GET: Get the current week's plan with full details + previous week summary

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { weeklyPlanningRateLimiter } from '@/lib/rateLimiter'
import {
  type WeeklyPlanFull,
  type PreviousWeekSummary,
  calculateCapacityAnalysis,
  getISOWeekInfo,
  formatWeekRange,
  formatWeekLabel,
  DEFAULT_CAPACITY_MINUTES,
} from '@/lib/types/weekly-planning'

// ===========================================
// Supabase Client
// ===========================================
function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  return createClient(url, anonKey)
}

// ===========================================
// GET /api/weekly-plans/current - Get current week's plan
// ===========================================
export async function GET(request: NextRequest) {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    // 1. Authentication
    const authHeader = request.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
    }

    // 2. Rate limiting
    if (weeklyPlanningRateLimiter.isLimited(user.id)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    // 3. Get current week info
    const currentWeek = getISOWeekInfo()

    // 4. Check for existing plan this week
    const { data: existingPlans } = await supabase
      .from('weekly_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('year', currentWeek.year)
      .eq('week_number', currentWeek.week_number)
      .order('version', { ascending: false })
      .limit(1)

    let plan = existingPlans && existingPlans.length > 0 ? existingPlans[0] : null
    let created = false

    // 5. Create new plan if none exists
    if (!plan) {
      const { data: newPlan, error: createError } = await supabase
        .from('weekly_plans')
        .insert({
          user_id: user.id,
          week_number: currentWeek.week_number,
          year: currentWeek.year,
          version: 1,
          status: 'draft',
          available_capacity_minutes: DEFAULT_CAPACITY_MINUTES,
          planned_capacity_minutes: 0,
        })
        .select()
        .single()

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 })
      }

      plan = newPlan
      created = true

      // Track analytics
      await supabase.from('weekly_planning_events').insert({
        user_id: user.id,
        event_type: 'planning_started',
        weekly_plan_id: plan.id,
        metadata: { week_number: currentWeek.week_number, year: currentWeek.year },
      })
    }

    // 6. Fetch outcomes (simplified join - no alias prefix)
    const { data: outcomes } = await supabase
      .from('weekly_plan_outcomes')
      .select(`
        *,
        outcomes(id, title, description, horizon, status)
      `)
      .eq('weekly_plan_id', plan.id)
      .order('priority_rank', { ascending: true })

    // 7. Fetch tasks (simplified join - no alias prefix)
    const { data: tasks } = await supabase
      .from('weekly_plan_tasks')
      .select(`
        *,
        focus_plans(id, title, status, outcome_id, commitment_id)
      `)
      .eq('weekly_plan_id', plan.id)
      .order('scheduled_day', { ascending: true, nullsFirst: false })
      .order('priority_rank', { ascending: true })

    // 8. Calculate capacity analysis
    const capacityAnalysis = calculateCapacityAnalysis(
      tasks || [],
      plan.available_capacity_minutes
    )

    // 9. Get previous week summary
    let previousWeekSummary: PreviousWeekSummary | null = null

    // Calculate previous week
    const prevDate = new Date()
    prevDate.setDate(prevDate.getDate() - 7)
    const prevWeek = getISOWeekInfo(prevDate)

    const { data: prevPlans } = await supabase
      .from('weekly_plans')
      .select('id')
      .eq('user_id', user.id)
      .eq('year', prevWeek.year)
      .eq('week_number', prevWeek.week_number)
      .in('status', ['committed', 'completed'])
      .order('version', { ascending: false })
      .limit(1)

    // Early exit if no previous plan exists
    if (!prevPlans || prevPlans.length === 0) {
      // No previous week plan - skip summary calculation
    } else {
      const prevPlanId = prevPlans[0].id

      // Get task stats (simplified join - no alias prefix)
      const { data: prevTasks } = await supabase
        .from('weekly_plan_tasks')
        .select(`
          estimated_minutes,
          focus_plans(status)
        `)
        .eq('weekly_plan_id', prevPlanId)

      if (prevTasks && prevTasks.length > 0) {
        const completedTasks = prevTasks.filter(t => {
          if (!t.focus_plans) return false
          // Supabase joins may return array or single object
          const taskData = Array.isArray(t.focus_plans) ? t.focus_plans[0] : t.focus_plans
          return taskData && (taskData as { status: string }).status === 'completed'
        })
        const totalMinutesCompleted = completedTasks.reduce(
          (sum, t) => sum + (t.estimated_minutes || 0),
          0
        )

        previousWeekSummary = {
          completed_tasks: completedTasks.length,
          total_planned_tasks: prevTasks.length,
          total_minutes_completed: totalMinutesCompleted,
          top_outcomes: [], // Simplified - could be expanded
          completion_rate: prevTasks.length > 0
            ? Math.round((completedTasks.length / prevTasks.length) * 100)
            : 0,
        }
      }
    }

    // 10. Get user's active outcomes for selection
    const { data: availableOutcomes } = await supabase
      .from('outcomes')
      .select('id, title, description, horizon, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('priority_rank', { ascending: true })

    // 11. Get user's available tasks for selection
    const { data: availableTasks } = await supabase
      .from('focus_plans')
      .select('id, title, status, outcome_id, commitment_id, estimated_minutes')
      .eq('user_id', user.id)
      .in('status', ['active', 'needs_linking'])
      .order('created_at', { ascending: false })
      .limit(50)

    const fullPlan: WeeklyPlanFull = {
      ...plan,
      outcomes: outcomes || [],
      tasks: tasks || [],
      capacity_analysis: capacityAnalysis,
    }

    return NextResponse.json({
      plan: fullPlan,
      created,
      week_info: {
        week_number: currentWeek.week_number,
        year: currentWeek.year,
        week_start: currentWeek.week_start.toISOString(),
        week_end: currentWeek.week_end.toISOString(),
        range_label: formatWeekRange(currentWeek),
        week_label: formatWeekLabel(currentWeek),
      },
      previous_week_summary: previousWeekSummary,
      available_outcomes: availableOutcomes || [],
      available_tasks: availableTasks || [],
    })

  } catch (error) {
    // Improved error logging with full Supabase error details
    if (error && typeof error === 'object') {
      console.error('Current weekly plan GET error:', JSON.stringify(error, null, 2))
    } else {
      console.error('Current weekly plan GET error:', error)
    }
    return NextResponse.json({ error: 'Failed to fetch current plan' }, { status: 500 })
  }
}
