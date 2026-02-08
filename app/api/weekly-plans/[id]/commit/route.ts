// Weekly Plan Commit API Route
// POST: Commit a weekly plan (finalize it)

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { weeklyPlanningRateLimiter } from '@/lib/rateLimiter'
import {
  type WeeklyPlanFull,
  calculateCapacityAnalysis,
  generatePlanSummary,
  getISOWeekInfo,
} from '@/lib/types/weekly-planning'

// ===========================================
// Supabase Client
// ===========================================
function getSupabaseClient(accessToken?: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  if (accessToken) {
    return createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })
  }
  return createClient(url, anonKey)
}

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

// ===========================================
// POST /api/weekly-plans/[id]/commit - Commit plan
// ===========================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const anonClient = getSupabaseClient()
  if (!anonClient) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    const { id } = await params

    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid plan ID' }, { status: 400 })
    }

    // 1. Authentication
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
    }

    const supabase = getSupabaseClient(token)!

    // 2. Rate limiting
    if (weeklyPlanningRateLimiter.isLimited(user.id)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    // 3. Fetch plan with full details
    const { data: plan, error: planError } = await supabase
      .from('weekly_plans')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (plan.status !== 'draft') {
      return NextResponse.json(
        { error: 'Plan is already committed' },
        { status: 400 }
      )
    }

    // 4. Fetch outcomes
    const { data: outcomes } = await supabase
      .from('weekly_plan_outcomes')
      .select(`
        *,
        outcome:outcomes(id, title, description, horizon, status)
      `)
      .eq('weekly_plan_id', id)
      .order('priority_rank', { ascending: true })

    // 5. Fetch tasks
    const { data: tasks } = await supabase
      .from('weekly_plan_tasks')
      .select(`
        *,
        task:focus_plans(id, task_name, status, outcome_id, commitment_id)
      `)
      .eq('weekly_plan_id', id)
      .order('priority_rank', { ascending: true })

    // 6. Validate plan has minimum content
    console.log('Commit POST: outcomes count:', outcomes?.length, 'tasks count:', tasks?.length)

    if (!outcomes || outcomes.length === 0) {
      return NextResponse.json(
        { error: 'Please select at least one outcome before committing', outcomes_count: 0 },
        { status: 400 }
      )
    }

    if (!tasks || tasks.length === 0) {
      return NextResponse.json(
        { error: 'Please add at least one task before committing', tasks_count: 0, outcomes_count: outcomes.length },
        { status: 400 }
      )
    }

    // 7. Calculate capacity and check for warnings
    const capacityAnalysis = calculateCapacityAnalysis(
      tasks,
      plan.available_capacity_minutes
    )

    // 8. Generate summary markdown
    const weekInfo = getISOWeekInfo()
    // Override week info with plan's week if different
    if (plan.week_number !== weekInfo.week_number || plan.year !== weekInfo.year) {
      // Calculate the actual week dates for this plan
      const planDate = new Date()
      planDate.setFullYear(plan.year)
      // Approximate - find the Monday of the given ISO week
      const jan4 = new Date(plan.year, 0, 4)
      const daysSinceMonday = (jan4.getDay() + 6) % 7
      const firstMonday = new Date(jan4)
      firstMonday.setDate(jan4.getDate() - daysSinceMonday)
      const weekStart = new Date(firstMonday)
      weekStart.setDate(firstMonday.getDate() + (plan.week_number - 1) * 7)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      weekInfo.week_number = plan.week_number
      weekInfo.year = plan.year
      weekInfo.week_start = weekStart
      weekInfo.week_end = weekEnd
    }

    const summaryMarkdown = generatePlanSummary(plan, outcomes, tasks, weekInfo)

    // 9. Update plan to committed status
    const { data: updatedPlan, error: updateError } = await supabase
      .from('weekly_plans')
      .update({
        status: 'committed',
        committed_at: new Date().toISOString(),
        summary_markdown: summaryMarkdown,
        planned_capacity_minutes: capacityAnalysis.totalPlannedMinutes,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // 10. Track analytics event
    await supabase.from('weekly_planning_events').insert({
      user_id: user.id,
      event_type: 'plan_committed',
      weekly_plan_id: id,
      metadata: {
        outcomes_count: outcomes.length,
        tasks_count: tasks.length,
        utilization_percent: capacityAnalysis.utilizationPercent,
        is_overcommitted: capacityAnalysis.isOvercommitted,
      },
    })

    // 11. Return full plan
    const fullPlan: WeeklyPlanFull = {
      ...updatedPlan,
      outcomes: outcomes,
      tasks: tasks,
      capacity_analysis: capacityAnalysis,
    }

    return NextResponse.json({
      plan: fullPlan,
      summary: summaryMarkdown,
      warnings: capacityAnalysis.warnings,
    })

  } catch (error) {
    console.error('Weekly plan commit error:', error)
    return NextResponse.json({ error: 'Failed to commit plan' }, { status: 500 })
  }
}
