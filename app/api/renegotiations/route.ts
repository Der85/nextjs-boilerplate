// Renegotiations API Route
// GET: Get tasks needing renegotiation
// POST: Renegotiate a task

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { renegotiationRateLimiter } from '@/lib/rateLimiter'
import {
  type RenegotiateTaskRequest,
  type RenegotiationResult,
  isValidRenegotiationAction,
  isValidRenegotiationReasonCode,
} from '@/lib/types/renegotiation'
import {
  validateRenegotiationRequest,
  analyzeRenegotiationPattern,
  formatDateForAPI,
} from '@/lib/renegotiation-engine'

// ===========================================
// Supabase Client
// ===========================================
function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  return createClient(url, anonKey)
}

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

// ===========================================
// GET /api/renegotiations - Get tasks needing renegotiation
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
    if (renegotiationRateLimiter.isLimited(user.id)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    // 3. Query params
    const { searchParams } = new URL(request.url)
    const includePatterns = searchParams.get('patterns') === 'true'

    // 4. Fetch overdue tasks
    const today = new Date().toISOString().split('T')[0]
    const { data: overdueTasks, error: tasksError } = await supabase
      .from('focus_plans')
      .select(`
        id,
        title,
        due_date,
        status,
        renegotiation_count,
        outcome_id,
        outcomes(title)
      `)
      .eq('user_id', user.id)
      .lt('due_date', today)
      .not('status', 'in', '("completed","parked","dropped")')
      .order('due_date', { ascending: true })

    if (tasksError) {
      return NextResponse.json({ error: tasksError.message }, { status: 500 })
    }

    // 5. Transform tasks
    const tasksNeedingRenegotiation = (overdueTasks || []).map(task => {
      const dueDate = new Date(task.due_date)
      const todayDate = new Date()
      todayDate.setHours(0, 0, 0, 0)
      dueDate.setHours(0, 0, 0, 0)
      const daysOverdue = Math.floor((todayDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

      // Handle Supabase join which may return array or object
      const outcomeData = task.outcomes
      const outcomeTitle = Array.isArray(outcomeData)
        ? outcomeData[0]?.title
        : (outcomeData as { title: string } | null)?.title

      return {
        id: task.id,
        title: task.title,
        due_date: task.due_date,
        days_overdue: daysOverdue,
        renegotiation_count: task.renegotiation_count,
        outcome_title: outcomeTitle || null,
      }
    })

    // 6. Optionally fetch patterns
    let patterns = null
    if (includePatterns) {
      const { data: patternData } = await supabase.rpc('get_renegotiation_patterns', {
        p_user_id: user.id,
        p_days: 14,
      })
      patterns = patternData || []
    }

    return NextResponse.json({
      tasks: tasksNeedingRenegotiation,
      count: tasksNeedingRenegotiation.length,
      patterns,
    })

  } catch (error) {
    console.error('Renegotiations GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

// ===========================================
// POST /api/renegotiations - Renegotiate a task
// ===========================================
export async function POST(request: NextRequest) {
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
    if (renegotiationRateLimiter.isLimited(user.id)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    // 3. Parse body
    const body = await request.json() as RenegotiateTaskRequest

    // 4. Validate request
    if (!isValidUUID(body.task_id)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
    }

    const validation = validateRenegotiationRequest(
      body.action,
      body.reason_code,
      body.new_due_date,
      body.subtasks
    )

    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors.join(', ') }, { status: 400 })
    }

    // 5. Verify task ownership
    const { data: task, error: taskError } = await supabase
      .from('focus_plans')
      .select('*')
      .eq('id', body.task_id)
      .eq('user_id', user.id)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // 6. Handle action
    let newStatus = task.status
    let newDueDate = task.due_date
    let createdSubtasks: Array<{ id: string; title: string; due_date: string | null }> = []

    switch (body.action) {
      case 'reschedule':
        newDueDate = body.new_due_date || null
        newStatus = 'active'
        break

      case 'park':
        newStatus = 'parked'
        newDueDate = null
        break

      case 'drop':
        newStatus = 'dropped'
        newDueDate = null
        break

      case 'split':
        // Create subtasks
        if (body.subtasks && body.subtasks.length > 0) {
          const subtaskInserts = body.subtasks.map((st, index) => ({
            user_id: user.id,
            title: st.title,
            status: 'active',
            due_date: st.due_date || null,
            estimated_minutes: st.estimated_minutes || 30,
            outcome_id: task.outcome_id,
            commitment_id: task.commitment_id,
            parent_task_id: task.id,
            split_reason: `Split from: ${task.title}`,
          }))

          const { data: newSubtasks, error: subtaskError } = await supabase
            .from('focus_plans')
            .insert(subtaskInserts)
            .select('id, title, due_date')

          if (subtaskError) {
            return NextResponse.json({ error: subtaskError.message }, { status: 500 })
          }

          createdSubtasks = newSubtasks || []
        }

        // Mark original as completed (re-scoped)
        newStatus = 'completed'
        break
    }

    // 7. Create renegotiation record
    const { data: renegotiation, error: renegError } = await supabase
      .from('task_renegotiations')
      .insert({
        task_id: body.task_id,
        user_id: user.id,
        action: body.action,
        from_due_date: task.due_date,
        to_due_date: newDueDate,
        reason_code: body.reason_code,
        reason_text: body.reason_text || null,
        split_into_task_ids: createdSubtasks.length > 0
          ? createdSubtasks.map(s => s.id)
          : null,
      })
      .select()
      .single()

    if (renegError) {
      return NextResponse.json({ error: renegError.message }, { status: 500 })
    }

    // 8. Update the task
    const { data: updatedTask, error: updateError } = await supabase
      .from('focus_plans')
      .update({
        status: newStatus,
        due_date: newDueDate,
        last_renegotiated_at: new Date().toISOString(),
        renegotiation_count: task.renegotiation_count + 1,
        original_due_date: task.original_due_date || task.due_date,
      })
      .eq('id', body.task_id)
      .eq('user_id', user.id)
      .select('id, title, status, due_date, renegotiation_count')
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // 9. Track analytics event
    const eventType = body.action === 'split'
      ? 'task_split_from_renegotiation'
      : body.action === 'drop'
        ? 'task_dropped_after_review'
        : body.action === 'park'
          ? 'task_parked_for_later'
          : 'task_renegotiated'

    await supabase.from('renegotiation_events').insert({
      user_id: user.id,
      event_type: eventType,
      task_id: body.task_id,
      renegotiation_id: renegotiation.id,
      metadata: {
        action: body.action,
        reason_code: body.reason_code,
        from_due_date: task.due_date,
        to_due_date: newDueDate,
        subtasks_created: createdSubtasks.length,
      },
    })

    // 10. Check for pattern warning
    let patternWarning = null
    if (updatedTask.renegotiation_count >= 3) {
      // Fetch recent reasons
      const { data: recentRenegs } = await supabase
        .from('task_renegotiations')
        .select('reason_code')
        .eq('task_id', body.task_id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (recentRenegs && recentRenegs.length >= 3) {
        const pattern = analyzeRenegotiationPattern(
          body.task_id,
          task.title,
          updatedTask.renegotiation_count,
          recentRenegs.map(r => r.reason_code)
        )

        if (pattern.hasPattern) {
          patternWarning = pattern.pattern

          // Track pattern detection
          await supabase.from('renegotiation_events').insert({
            user_id: user.id,
            event_type: 'repeat_renegotiation_pattern_detected',
            task_id: body.task_id,
            metadata: {
              renegotiation_count: updatedTask.renegotiation_count,
              most_common_reason: pattern.pattern?.most_common_reason,
            },
          })
        }
      }
    }

    const result: RenegotiationResult = {
      renegotiation,
      updated_task: updatedTask,
      created_subtasks: createdSubtasks.length > 0 ? createdSubtasks : undefined,
      pattern_warning: patternWarning || undefined,
    }

    return NextResponse.json(result, { status: 201 })

  } catch (error) {
    console.error('Renegotiations POST error:', error)
    return NextResponse.json({ error: 'Failed to renegotiate task' }, { status: 500 })
  }
}
