// Weekly Plan Tasks API Route
// GET: List tasks for a plan
// POST: Add task to plan
// PUT: Update task schedule
// DELETE: Remove task from plan

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { weeklyPlanningRateLimiter } from '@/lib/rateLimiter'
import {
  type AddTaskRequest,
  type UpdateTaskScheduleRequest,
  isValidDayOfWeek,
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
// GET /api/weekly-plans/[id]/tasks
// ===========================================
export async function GET(
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

    // 2. Verify plan ownership
    const { data: plan } = await supabase
      .from('weekly_plans')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // 3. Fetch tasks
    const { data: tasks, error } = await supabase
      .from('weekly_plan_tasks')
      .select(`
        *,
        task:focus_plans(id, task_name, status, outcome_id, commitment_id, estimated_minutes)
      `)
      .eq('weekly_plan_id', id)
      .order('scheduled_day', { ascending: true, nullsFirst: false })
      .order('priority_rank', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tasks: tasks || [] })

  } catch (error) {
    console.error('Weekly plan tasks GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

// ===========================================
// POST /api/weekly-plans/[id]/tasks - Add task
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

    // 3. Verify plan ownership and status
    const { data: plan } = await supabase
      .from('weekly_plans')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (plan.status !== 'draft') {
      return NextResponse.json(
        { error: 'Cannot modify committed plan' },
        { status: 400 }
      )
    }

    // 4. Parse body
    const body = await request.json() as AddTaskRequest

    console.log('Tasks POST: received body:', JSON.stringify(body))

    if (!body.task_id || !isValidUUID(body.task_id)) {
      return NextResponse.json({ error: 'Invalid task ID', received: body.task_id }, { status: 400 })
    }

    // 5. Verify task exists and belongs to user
    const { data: task, error: taskError } = await supabase
      .from('focus_plans')
      .select('id, estimated_minutes')
      .eq('id', body.task_id)
      .eq('user_id', user.id)
      .single()

    if (taskError) {
      console.error('Tasks POST: task lookup error:', taskError.message, taskError.code)
    }

    if (!task) {
      return NextResponse.json({ error: 'Task not found', task_id: body.task_id, details: taskError?.message }, { status: 404 })
    }

    // 6. Validate scheduled_day
    let scheduledDay: number | null = null
    if (body.scheduled_day !== null && body.scheduled_day !== undefined) {
      if (!isValidDayOfWeek(body.scheduled_day)) {
        return NextResponse.json({ error: 'Invalid scheduled day (0-6)' }, { status: 400 })
      }
      scheduledDay = body.scheduled_day
    }

    // 7. Insert plan task
    const estimatedMinutes = typeof body.estimated_minutes === 'number'
      ? Math.max(5, Math.min(480, body.estimated_minutes))
      : (task.estimated_minutes || 30)

    const { data: planTask, error: insertError } = await supabase
      .from('weekly_plan_tasks')
      .insert({
        weekly_plan_id: id,
        task_id: body.task_id,
        scheduled_day: scheduledDay,
        estimated_minutes: estimatedMinutes,
        priority_rank: typeof body.priority_rank === 'number' ? body.priority_rank : 0,
      })
      .select(`
        *,
        task:focus_plans(id, task_name, status, outcome_id, commitment_id)
      `)
      .single()

    if (insertError) {
      console.error('Tasks POST: insert error:', insertError.message, insertError.code, insertError.details)
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'Task already added to this plan' },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: insertError.message, code: insertError.code }, { status: 500 })
    }

    // 8. Update plan's planned capacity
    await supabase.rpc('calculate_plan_capacity', { p_weekly_plan_id: id })

    return NextResponse.json({ task: planTask }, { status: 201 })

  } catch (error) {
    console.error('Weekly plan tasks POST error:', error)
    return NextResponse.json({ error: 'Failed to add task' }, { status: 500 })
  }
}

// ===========================================
// PUT /api/weekly-plans/[id]/tasks - Update task schedule
// ===========================================
export async function PUT(
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

    // 3. Get task_id from query params
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('task_id')

    if (!taskId || !isValidUUID(taskId)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
    }

    // 4. Verify plan ownership and status
    const { data: plan } = await supabase
      .from('weekly_plans')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (plan.status !== 'draft') {
      return NextResponse.json(
        { error: 'Cannot modify committed plan' },
        { status: 400 }
      )
    }

    // 5. Parse body
    const body = await request.json() as UpdateTaskScheduleRequest

    // 6. Build update data
    const updateData: Record<string, unknown> = {}

    if (body.scheduled_day === null) {
      updateData.scheduled_day = null
    } else if (isValidDayOfWeek(body.scheduled_day)) {
      updateData.scheduled_day = body.scheduled_day
    }

    if (typeof body.estimated_minutes === 'number') {
      updateData.estimated_minutes = Math.max(5, Math.min(480, body.estimated_minutes))
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // 7. Update the plan task
    const { data: updatedTask, error: updateError } = await supabase
      .from('weekly_plan_tasks')
      .update(updateData)
      .eq('weekly_plan_id', id)
      .eq('task_id', taskId)
      .select(`
        *,
        task:focus_plans(id, task_name, status, outcome_id, commitment_id)
      `)
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // 8. Update plan's planned capacity
    await supabase.rpc('calculate_plan_capacity', { p_weekly_plan_id: id })

    return NextResponse.json({ task: updatedTask })

  } catch (error) {
    console.error('Weekly plan tasks PUT error:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

// ===========================================
// DELETE /api/weekly-plans/[id]/tasks - Remove task
// ===========================================
export async function DELETE(
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

    // 3. Get task_id from query params
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('task_id')

    if (!taskId || !isValidUUID(taskId)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
    }

    // 4. Verify plan ownership and status
    const { data: plan } = await supabase
      .from('weekly_plans')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (plan.status !== 'draft') {
      return NextResponse.json(
        { error: 'Cannot modify committed plan' },
        { status: 400 }
      )
    }

    // 5. Delete the plan task
    const { error: deleteError } = await supabase
      .from('weekly_plan_tasks')
      .delete()
      .eq('weekly_plan_id', id)
      .eq('task_id', taskId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // 6. Update plan's planned capacity
    await supabase.rpc('calculate_plan_capacity', { p_weekly_plan_id: id })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Weekly plan tasks DELETE error:', error)
    return NextResponse.json({ error: 'Failed to remove task' }, { status: 500 })
  }
}
