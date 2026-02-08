// Weekly Plan [id] API Route
// GET: Get single weekly plan with outcomes and tasks
// PUT: Update weekly plan
// DELETE: Delete weekly plan

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { weeklyPlanningRateLimiter } from '@/lib/rateLimiter'
import { dbUpdate, dbDelete } from '@/lib/db-helpers'
import {
  type WeeklyPlan,
  type WeeklyPlanFull,
  type UpdateWeeklyPlanRequest,
  isValidWeeklyPlanStatus,
  calculateCapacityAnalysis,
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
// UUID Validation
// ===========================================
function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

// ===========================================
// GET /api/weekly-plans/[id] - Get single plan with full details
// ===========================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    const { id } = await params

    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid plan ID' }, { status: 400 })
    }

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

    // 3. Fetch plan
    const { data: plan, error: planError } = await supabase
      .from('weekly_plans')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // 4. Fetch plan outcomes (base data without joins)
    const { data: planOutcomes, error: outcomesError } = await supabase
      .from('weekly_plan_outcomes')
      .select('id, weekly_plan_id, outcome_id, priority_rank, created_at')
      .eq('weekly_plan_id', id)
      .order('priority_rank', { ascending: true })

    // 5. Fetch plan tasks (base data without joins)
    const { data: planTasks, error: tasksError } = await supabase
      .from('weekly_plan_tasks')
      .select('id, weekly_plan_id, task_id, estimated_minutes, priority_rank, scheduled_day, created_at')
      .eq('weekly_plan_id', id)
      .order('priority_rank', { ascending: true })

    // Log errors but don't fail - tables may not exist yet
    if (outcomesError) {
      console.warn('Failed to fetch plan outcomes:', outcomesError.message)
    }
    if (tasksError) {
      console.warn('Failed to fetch plan tasks:', tasksError.message)
    }

    // 6. Fetch related outcomes data separately (if we have outcome IDs)
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

    // 7. Fetch related tasks data separately (if we have task IDs)
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

    // 8. Map outcomes with their related data
    const outcomes = (planOutcomes || []).map(po => ({
      ...po,
      outcome: po.outcome_id ? outcomesMap[po.outcome_id] || undefined : undefined,
    }))

    // 9. Map tasks with their related data (use undefined instead of null for optional task)
    const tasks = (planTasks || []).map(pt => ({
      ...pt,
      task: pt.task_id && tasksMap[pt.task_id] ? tasksMap[pt.task_id] : undefined,
    }))

    // 10. Calculate capacity analysis
    const capacityAnalysis = calculateCapacityAnalysis(
      tasks || [],
      plan.available_capacity_minutes
    )

    const fullPlan: WeeklyPlanFull = {
      ...plan,
      outcomes: outcomes || [],
      tasks: tasks || [],
      capacity_analysis: capacityAnalysis,
    }

    return NextResponse.json({ plan: fullPlan })

  } catch (error) {
    console.error('Weekly plan GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch weekly plan' }, { status: 500 })
  }
}

// ===========================================
// PUT /api/weekly-plans/[id] - Update plan
// ===========================================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    const { id } = await params

    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid plan ID' }, { status: 400 })
    }

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

    // 3. Parse body
    const body = await request.json() as UpdateWeeklyPlanRequest

    // 4. Build update data
    const updateData: Record<string, unknown> = {}

    if (typeof body.available_capacity_minutes === 'number') {
      updateData.available_capacity_minutes = Math.max(0, body.available_capacity_minutes)
    }

    if (typeof body.previous_week_reflection === 'string') {
      updateData.previous_week_reflection = body.previous_week_reflection.slice(0, 2000)
    }

    if (Array.isArray(body.wins)) {
      updateData.wins = body.wins.slice(0, 10).map(w => String(w).slice(0, 500))
    }

    if (Array.isArray(body.learnings)) {
      updateData.learnings = body.learnings.slice(0, 10).map(l => String(l).slice(0, 500))
    }

    if (isValidWeeklyPlanStatus(body.status)) {
      updateData.status = body.status
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // 5. Update plan
    const result = await dbUpdate<WeeklyPlan>(supabase, 'weekly_plans', updateData, {
      id,
      user_id: user.id,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error?.message }, { status: 500 })
    }

    return NextResponse.json({ plan: result.data })

  } catch (error) {
    console.error('Weekly plan PUT error:', error)
    return NextResponse.json({ error: 'Failed to update weekly plan' }, { status: 500 })
  }
}

// ===========================================
// DELETE /api/weekly-plans/[id] - Delete plan
// ===========================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    const { id } = await params

    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid plan ID' }, { status: 400 })
    }

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

    // 3. Check plan exists and is deletable (only draft plans)
    const { data: plan } = await supabase
      .from('weekly_plans')
      .select('status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (plan.status === 'committed' || plan.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot delete committed or completed plans' },
        { status: 400 }
      )
    }

    // 4. Delete plan (cascade will remove outcomes and tasks)
    const result = await dbDelete(supabase, 'weekly_plans', {
      id,
      user_id: user.id,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error?.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Weekly plan DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete weekly plan' }, { status: 500 })
  }
}
