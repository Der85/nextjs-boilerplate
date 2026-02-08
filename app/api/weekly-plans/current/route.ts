// Current Weekly Plan API Route
// GET: Get the current week's plan with full details + previous week summary

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { weeklyPlanningRateLimiter } from '@/lib/rateLimiter'
import { trackServerEvent } from '@/lib/analytics'
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
function getSupabaseClient(accessToken?: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  // When an access token is provided, create a client that sends it
  // as the Authorization header so RLS policies see auth.uid()
  if (accessToken) {
    return createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })
  }
  return createClient(url, anonKey)
}

// ===========================================
// GET /api/weekly-plans/current - Get current week's plan
// ===========================================
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  // Create client with anon key first to validate the token
  const anonClient = getSupabaseClient()
  if (!anonClient) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    // 1. Authentication - validate the token
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
    }

    // Create an authenticated client so RLS policies see auth.uid()
    const supabase = getSupabaseClient(token)!

    // 2. Rate limiting (wrapped in try/catch to prevent crashes if rate limiter fails)
    try {
      if (weeklyPlanningRateLimiter.isLimited(user.id)) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
      }
    } catch (rateLimitError) {
      console.warn('Rate limiter check failed, allowing request:', rateLimitError)
      // Continue without rate limiting rather than crash
    }

    // 3. Get current week info
    const currentWeek = getISOWeekInfo()

    // 4. Check for existing plan this week
    const { data: existingPlans, error: fetchError } = await supabase
      .from('weekly_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('year', currentWeek.year)
      .eq('week_number', currentWeek.week_number)
      .order('version', { ascending: false })
      .limit(1)

    // Handle fetch error gracefully
    if (fetchError) {
      console.error('Failed to fetch weekly_plans:', fetchError.message, fetchError.code)
      // If table doesn't exist, return a helpful error
      if (fetchError.message.includes('does not exist') || fetchError.code === '42P01') {
        return NextResponse.json({
          error: 'Weekly planning tables not set up. Please run migration 010.',
          details: fetchError.message,
        }, { status: 500 })
      }
      // Return error for any other fetch failure (RLS, permissions, etc.)
      return NextResponse.json({
        error: `Failed to load weekly plans: ${fetchError.message}`,
        code: fetchError.code,
      }, { status: 500 })
    }

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
        console.error('Failed to create weekly_plan:', createError.message)
        // If table doesn't exist, return a helpful error
        if (createError.message.includes('does not exist') || createError.code === '42P01') {
          return NextResponse.json({
            error: 'Weekly planning tables not set up. Please run migration 010.',
            details: createError.message,
          }, { status: 500 })
        }
        return NextResponse.json({ error: createError.message }, { status: 500 })
      }

      // Strict null check - plan should always be returned if no error
      if (!newPlan) {
        console.error('Plan created but no data returned - check RLS policies')
        return NextResponse.json({
          error: 'Plan created but no data returned. Check RLS policies on weekly_plans table.',
        }, { status: 500 })
      }

      plan = newPlan
      created = true

      // Track analytics using the existing analytics_events table (fire and forget)
      trackServerEvent(supabase, user.id, 'weekly_plan_started', {
        week_number: currentWeek.week_number,
        year: currentWeek.year,
        plan_id: plan.id,
      })
    }

    // 6. Fetch plan outcomes (base data without joins - more robust)
    const { data: planOutcomes, error: outcomesError } = await supabase
      .from('weekly_plan_outcomes')
      .select('id, weekly_plan_id, outcome_id, priority_rank, created_at')
      .eq('weekly_plan_id', plan.id)
      .order('priority_rank', { ascending: true })

    // 7. Fetch plan tasks (base data without joins - more robust)
    const { data: planTasks, error: tasksError } = await supabase
      .from('weekly_plan_tasks')
      .select('id, weekly_plan_id, task_id, estimated_minutes, priority_rank, scheduled_day, created_at')
      .eq('weekly_plan_id', plan.id)
      .order('scheduled_day', { ascending: true, nullsFirst: false })
      .order('priority_rank', { ascending: true })

    // Log errors but don't fail - tables may not exist yet
    if (outcomesError) {
      console.warn('Failed to fetch plan outcomes:', outcomesError.message)
    }
    if (tasksError) {
      console.warn('Failed to fetch plan tasks:', tasksError.message)
    }

    // 8. Fetch related outcomes data separately (if we have outcome IDs)
    const outcomeIds = [...new Set((planOutcomes || []).map(po => po.outcome_id).filter(Boolean))]
    let outcomesMap: Record<string, { id: string; title: string; description?: string; horizon?: string; status?: string }> = {}

    if (outcomeIds.length > 0) {
      const { data: outcomesData } = await supabase
        .from('outcomes')
        .select('id, title, description, horizon, status')
        .in('id', outcomeIds)

      if (outcomesData) {
        outcomesMap = Object.fromEntries(outcomesData.map(o => [o.id, o]))
      }
    }

    // 9. Fetch related tasks data separately (if we have task IDs)
    const taskIds = [...new Set((planTasks || []).map(pt => pt.task_id).filter(Boolean))]
    let tasksMap: Record<string, { id: string; title: string; status: string; outcome_id: string | null; commitment_id: string | null }> = {}

    if (taskIds.length > 0) {
      const { data: tasksData } = await supabase
        .from('focus_plans')
        .select('id, task_name, status, outcome_id, commitment_id')
        .in('id', taskIds)

      if (tasksData) {
        tasksMap = Object.fromEntries(tasksData.map(t => [t.id, {
          id: t.id,
          title: t.task_name || 'Untitled',
          status: t.status || 'active',
          outcome_id: t.outcome_id ?? null,
          commitment_id: t.commitment_id ?? null,
        }]))
      }
    }

    // 10. Map outcomes with their related data
    const outcomes = (planOutcomes || []).map(po => ({
      ...po,
      outcome: po.outcome_id ? outcomesMap[po.outcome_id] || undefined : undefined,
    }))

    // 11. Map tasks with their related data (use undefined instead of null for optional task)
    const tasks = (planTasks || []).map(pt => ({
      ...pt,
      task: pt.task_id && tasksMap[pt.task_id] ? tasksMap[pt.task_id] : undefined,
    }))

    // 12. Calculate capacity analysis
    const capacityAnalysis = calculateCapacityAnalysis(
      tasks || [],
      plan.available_capacity_minutes
    )

    // 13. Get previous week summary
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

      // Get task stats (base data without joins - more robust)
      const { data: prevPlanTasks } = await supabase
        .from('weekly_plan_tasks')
        .select('task_id, estimated_minutes')
        .eq('weekly_plan_id', prevPlanId)

      if (prevPlanTasks && prevPlanTasks.length > 0) {
        // Fetch task statuses separately
        const prevTaskIds = [...new Set(prevPlanTasks.map(pt => pt.task_id).filter(Boolean))]
        let prevTaskStatusMap: Record<string, string> = {}

        if (prevTaskIds.length > 0) {
          const { data: prevTasksData } = await supabase
            .from('focus_plans')
            .select('id, status')
            .in('id', prevTaskIds)

          if (prevTasksData) {
            prevTaskStatusMap = Object.fromEntries(prevTasksData.map(t => [t.id, t.status]))
          }
        }

        const completedTasks = prevPlanTasks.filter(t => {
          if (!t.task_id) return false
          return prevTaskStatusMap[t.task_id] === 'completed'
        })
        const totalMinutesCompleted = completedTasks.reduce(
          (sum, t) => sum + (t.estimated_minutes || 0),
          0
        )

        previousWeekSummary = {
          completed_tasks: completedTasks.length,
          total_planned_tasks: prevPlanTasks.length,
          total_minutes_completed: totalMinutesCompleted,
          top_outcomes: [], // Simplified - could be expanded
          completion_rate: prevPlanTasks.length > 0
            ? Math.round((completedTasks.length / prevPlanTasks.length) * 100)
            : 0,
        }
      }
    }

    // 14. Get user's active outcomes for selection
    const { data: availableOutcomes } = await supabase
      .from('outcomes')
      .select('id, title, description, horizon, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('priority_rank', { ascending: true })

    // 15. Get user's available tasks for selection
    const { data: availableTasks } = await supabase
      .from('focus_plans')
      .select('id, task_name, status, outcome_id, commitment_id, estimated_minutes')
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
    // Improved error logging with full details
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Current weekly plan GET error:', errorMessage)
    if (errorStack) {
      console.error('Stack trace:', errorStack)
    }
    return NextResponse.json({
      error: `Failed to fetch current plan: ${errorMessage}`,
    }, { status: 500 })
  }
}
