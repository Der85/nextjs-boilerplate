// Now Mode Pin API Route
// POST: Pin a task to Now Mode

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { outcomesRateLimiter } from '@/lib/rateLimiter'
import { isValidUUID } from '@/lib/types/outcomes'
import {
  type NowSlot,
  type NowModePreferences,
  NOW_MODE_MAX_SLOTS,
  NOW_MODE_MAX_MINUTES,
  isValidNowSlot,
  validatePinToNowMode,
  DEFAULT_NOW_MODE_PREFERENCES,
} from '@/lib/types/now-mode'

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
// POST /api/now-mode/pin - Pin a task to Now Mode
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
    if (outcomesRateLimiter.isLimited(user.id)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    // 3. Parse and validate body
    const body = await request.json()

    if (!isValidUUID(body.task_id)) {
      return NextResponse.json({ error: 'Valid task_id is required' }, { status: 400 })
    }

    if (body.slot !== undefined && !isValidNowSlot(body.slot)) {
      return NextResponse.json({ error: 'Slot must be 1, 2, or 3' }, { status: 400 })
    }

    // 4. Get user preferences
    const { data: userStats } = await supabase
      .from('user_stats')
      .select('now_mode_enabled, now_mode_strict_limit')
      .eq('user_id', user.id)
      .single()

    const preferences: NowModePreferences = {
      now_mode_enabled: userStats?.now_mode_enabled ?? DEFAULT_NOW_MODE_PREFERENCES.now_mode_enabled,
      now_mode_strict_limit: userStats?.now_mode_strict_limit ?? DEFAULT_NOW_MODE_PREFERENCES.now_mode_strict_limit,
    }

    // 5. Get the task
    const { data: task, error: taskError } = await supabase
      .from('focus_plans')
      .select(`
        id,
        user_id,
        task_name,
        status,
        now_slot,
        estimated_minutes,
        due_date,
        outcome_id,
        commitment_id,
        steps,
        outcomes:outcome_id (title),
        commitments:commitment_id (title)
      `)
      .eq('id', body.task_id)
      .eq('user_id', user.id)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // 6. Count current Now Mode slots
    const { count: slotCount } = await supabase
      .from('focus_plans')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('now_slot', 'is', null)
      .in('status', ['active', 'needs_linking'])

    const currentSlotCount = slotCount || 0

    // 7. Validate pin operation
    const validation = validatePinToNowMode(task, currentSlotCount, preferences)

    if (!validation.canPin && validation.error) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Check for time warning override
    if (validation.warning && task.estimated_minutes && task.estimated_minutes > NOW_MODE_MAX_MINUTES) {
      if (!body.override_time_warning) {
        return NextResponse.json({
          error: 'Time estimate exceeds limit',
          warning: validation.warning,
          requires_override: true,
        }, { status: 400 })
      }
    }

    // 8. Determine slot to use
    let targetSlot: NowSlot
    if (body.slot) {
      // Check if requested slot is available
      const { data: existingInSlot } = await supabase
        .from('focus_plans')
        .select('id')
        .eq('user_id', user.id)
        .eq('now_slot', body.slot)
        .in('status', ['active', 'needs_linking'])
        .single()

      if (existingInSlot) {
        return NextResponse.json({ error: `Slot ${body.slot} is already occupied` }, { status: 400 })
      }
      targetSlot = body.slot
    } else {
      // Find first available slot
      const { data: occupiedSlots } = await supabase
        .from('focus_plans')
        .select('now_slot')
        .eq('user_id', user.id)
        .not('now_slot', 'is', null)
        .in('status', ['active', 'needs_linking'])

      const occupied = new Set((occupiedSlots || []).map((s: { now_slot: number }) => s.now_slot))
      const available = ([1, 2, 3] as NowSlot[]).find((s) => !occupied.has(s))

      if (!available) {
        return NextResponse.json({ error: 'All slots are occupied' }, { status: 400 })
      }
      targetSlot = available
    }

    // 9. Update task with slot
    const { data: updatedTask, error: updateError } = await supabase
      .from('focus_plans')
      .update({ now_slot: targetSlot })
      .eq('id', body.task_id)
      .eq('user_id', user.id)
      .select(`
        id,
        user_id,
        task_name,
        status,
        now_slot,
        estimated_minutes,
        due_date,
        outcome_id,
        commitment_id,
        steps,
        outcomes:outcome_id (title),
        commitments:commitment_id (title)
      `)
      .single()

    if (updateError || !updatedTask) {
      console.error('Error pinning task:', updateError)
      return NextResponse.json({ error: 'Failed to pin task' }, { status: 500 })
    }

    // 10. Log analytics event
    await supabase.from('now_mode_events').insert({
      user_id: user.id,
      event_type: 'task_pinned',
      task_id: body.task_id,
      slot_number: targetSlot,
      metadata: {
        time_override: body.override_time_warning || false,
        estimated_minutes: task.estimated_minutes,
      },
    })

    return NextResponse.json({
      success: true,
      task: {
        id: updatedTask.id,
        user_id: updatedTask.user_id,
        task_name: updatedTask.task_name,
        status: updatedTask.status,
        now_slot: updatedTask.now_slot,
        estimated_minutes: updatedTask.estimated_minutes,
        due_date: updatedTask.due_date,
        outcome_id: updatedTask.outcome_id,
        commitment_id: updatedTask.commitment_id,
        outcome_title: Array.isArray(updatedTask.outcomes) ? updatedTask.outcomes[0]?.title : (updatedTask.outcomes as { title: string } | null)?.title,
        commitment_title: Array.isArray(updatedTask.commitments) ? updatedTask.commitments[0]?.title : (updatedTask.commitments as { title: string } | null)?.title,
        steps: updatedTask.steps,
      },
      slot: targetSlot,
      warning: validation.warning,
    })

  } catch (error) {
    console.error('Now Mode pin POST error:', error)
    return NextResponse.json({ error: 'Failed to pin task' }, { status: 500 })
  }
}

// ===========================================
// Block other methods
// ===========================================
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
