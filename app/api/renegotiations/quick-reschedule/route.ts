// Quick Reschedule API Route
// POST: Quick reschedule a task without full modal flow

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { renegotiationRateLimiter } from '@/lib/rateLimiter'
import {
  type QuickRescheduleRequest,
  isValidRenegotiationReasonCode,
} from '@/lib/types/renegotiation'

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
// POST /api/renegotiations/quick-reschedule
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
    const body = await request.json() as QuickRescheduleRequest

    // 4. Validate
    if (!isValidUUID(body.task_id)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
    }

    if (!body.new_due_date) {
      return NextResponse.json({ error: 'New due date is required' }, { status: 400 })
    }

    const newDate = new Date(body.new_due_date)
    if (isNaN(newDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    const reasonCode = isValidRenegotiationReasonCode(body.reason_code)
      ? body.reason_code
      : 'other'

    // 5. Verify task ownership
    const { data: task, error: taskError } = await supabase
      .from('focus_plans')
      .select('id, title, due_date, status, renegotiation_count, original_due_date')
      .eq('id', body.task_id)
      .eq('user_id', user.id)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // 6. Create renegotiation record
    const { data: renegotiation, error: renegError } = await supabase
      .from('task_renegotiations')
      .insert({
        task_id: body.task_id,
        user_id: user.id,
        action: 'reschedule',
        from_due_date: task.due_date,
        to_due_date: body.new_due_date,
        reason_code: reasonCode,
        reason_text: null,
      })
      .select()
      .single()

    if (renegError) {
      return NextResponse.json({ error: renegError.message }, { status: 500 })
    }

    // 7. Update task
    const { data: updatedTask, error: updateError } = await supabase
      .from('focus_plans')
      .update({
        due_date: body.new_due_date,
        status: 'active',
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

    // 8. Track analytics
    await supabase.from('renegotiation_events').insert({
      user_id: user.id,
      event_type: 'quick_reschedule_used',
      task_id: body.task_id,
      renegotiation_id: renegotiation.id,
      metadata: {
        from_due_date: task.due_date,
        to_due_date: body.new_due_date,
        reason_code: reasonCode,
      },
    })

    return NextResponse.json({
      task: updatedTask,
      renegotiation,
      message: 'Task rescheduled successfully',
    })

  } catch (error) {
    console.error('Quick reschedule error:', error)
    return NextResponse.json({ error: 'Failed to reschedule task' }, { status: 500 })
  }
}
