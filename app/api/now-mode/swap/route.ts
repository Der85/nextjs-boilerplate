// Now Mode Swap API Route
// POST: Swap a task in Now Mode with another task

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { outcomesRateLimiter } from '@/lib/rateLimiter'
import { isValidUUID } from '@/lib/types/outcomes'
import {
  type NowSlot,
  type NowModePreferences,
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
// POST /api/now-mode/swap - Swap tasks in Now Mode
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

    if (!isValidUUID(body.current_task_id)) {
      return NextResponse.json({ error: 'Valid current_task_id is required' }, { status: 400 })
    }

    if (!isValidUUID(body.replacement_task_id)) {
      return NextResponse.json({ error: 'Valid replacement_task_id is required' }, { status: 400 })
    }

    if (body.current_task_id === body.replacement_task_id) {
      return NextResponse.json({ error: 'Current and replacement tasks must be different' }, { status: 400 })
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

    // 5. Get the current task (must be in Now Mode)
    const { data: currentTask, error: currentTaskError } = await supabase
      .from('focus_plans')
      .select('id, now_slot')
      .eq('id', body.current_task_id)
      .eq('user_id', user.id)
      .single()

    if (currentTaskError || !currentTask) {
      return NextResponse.json({ error: 'Current task not found' }, { status: 404 })
    }

    if (currentTask.now_slot === null) {
      return NextResponse.json({ error: 'Current task is not in Now Mode' }, { status: 400 })
    }

    const targetSlot = currentTask.now_slot as NowSlot

    // 6. Get the replacement task
    const { data: replacementTask, error: replacementTaskError } = await supabase
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
      .eq('id', body.replacement_task_id)
      .eq('user_id', user.id)
      .single()

    if (replacementTaskError || !replacementTask) {
      return NextResponse.json({ error: 'Replacement task not found' }, { status: 404 })
    }

    // 7. Validate the replacement task can be pinned
    // We pass 0 for slot count since we're swapping (not adding)
    const validation = validatePinToNowMode(replacementTask, 0, preferences)

    if (!validation.canPin && validation.error && validation.error !== 'Task is already in Now Mode') {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // 8. Perform the swap in a transaction-like manner
    // First unpin current
    const { error: unpinError } = await supabase
      .from('focus_plans')
      .update({ now_slot: null })
      .eq('id', body.current_task_id)
      .eq('user_id', user.id)

    if (unpinError) {
      console.error('Error unpinning current task:', unpinError)
      return NextResponse.json({ error: 'Failed to swap tasks' }, { status: 500 })
    }

    // Then pin replacement
    const { data: updatedReplacement, error: pinError } = await supabase
      .from('focus_plans')
      .update({ now_slot: targetSlot })
      .eq('id', body.replacement_task_id)
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

    if (pinError || !updatedReplacement) {
      // Try to restore original state
      await supabase
        .from('focus_plans')
        .update({ now_slot: targetSlot })
        .eq('id', body.current_task_id)
        .eq('user_id', user.id)

      console.error('Error pinning replacement task:', pinError)
      return NextResponse.json({ error: 'Failed to swap tasks' }, { status: 500 })
    }

    // 9. Log analytics event
    await supabase.from('now_mode_events').insert({
      user_id: user.id,
      event_type: 'task_swapped',
      task_id: body.replacement_task_id,
      slot_number: targetSlot,
      metadata: {
        previous_task_id: body.current_task_id,
      },
    })

    return NextResponse.json({
      success: true,
      unpinned_task_id: body.current_task_id,
      pinned_task: {
        id: updatedReplacement.id,
        user_id: updatedReplacement.user_id,
        task_name: updatedReplacement.task_name,
        status: updatedReplacement.status,
        now_slot: updatedReplacement.now_slot,
        estimated_minutes: updatedReplacement.estimated_minutes,
        due_date: updatedReplacement.due_date,
        outcome_id: updatedReplacement.outcome_id,
        commitment_id: updatedReplacement.commitment_id,
        outcome_title: Array.isArray(updatedReplacement.outcomes) ? (updatedReplacement.outcomes as { title: string }[])[0]?.title : (updatedReplacement.outcomes as { title: string } | null)?.title,
        commitment_title: Array.isArray(updatedReplacement.commitments) ? (updatedReplacement.commitments as { title: string }[])[0]?.title : (updatedReplacement.commitments as { title: string } | null)?.title,
        steps: updatedReplacement.steps,
      },
      slot: targetSlot,
      warning: validation.warning,
    })

  } catch (error) {
    console.error('Now Mode swap POST error:', error)
    return NextResponse.json({ error: 'Failed to swap tasks' }, { status: 500 })
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
