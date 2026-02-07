// Now Mode API Route
// GET: Get current Now Mode state
// PUT: Update Now Mode preferences

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { outcomesRateLimiter } from '@/lib/rateLimiter'
import {
  type NowModeState,
  type NowModeSlotState,
  type NowModeTask,
  type NowSlot,
  type NowModePreferences,
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
// Helper: Build Now Mode state from tasks
// ===========================================
function buildNowModeState(
  tasks: NowModeTask[],
  preferences: NowModePreferences
): NowModeState {
  const slots: [NowModeSlotState, NowModeSlotState, NowModeSlotState] = [
    { slot: 1, task: null, isEmpty: true },
    { slot: 2, task: null, isEmpty: true },
    { slot: 3, task: null, isEmpty: true },
  ]

  let completedCount = 0
  for (const task of tasks) {
    const slotIndex = task.now_slot - 1
    if (slotIndex >= 0 && slotIndex < 3) {
      slots[slotIndex] = {
        slot: task.now_slot,
        task,
        isEmpty: false,
      }
      if (task.status === 'completed') {
        completedCount++
      }
    }
  }

  const occupiedCount = tasks.length
  const allCompleted = occupiedCount > 0 && completedCount === occupiedCount

  return {
    slots,
    occupiedCount,
    allCompleted,
    enabled: preferences.now_mode_enabled,
    strictLimit: preferences.now_mode_strict_limit,
  }
}

// ===========================================
// GET /api/now-mode - Get current Now Mode state
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

    // 2. Get user preferences
    const { data: userStats } = await supabase
      .from('user_stats')
      .select('now_mode_enabled, now_mode_strict_limit')
      .eq('user_id', user.id)
      .single()

    const preferences: NowModePreferences = {
      now_mode_enabled: userStats?.now_mode_enabled ?? DEFAULT_NOW_MODE_PREFERENCES.now_mode_enabled,
      now_mode_strict_limit: userStats?.now_mode_strict_limit ?? DEFAULT_NOW_MODE_PREFERENCES.now_mode_strict_limit,
    }

    // 3. Get tasks in Now Mode
    const { data: tasks, error: tasksError } = await supabase
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
      .eq('user_id', user.id)
      .not('now_slot', 'is', null)
      .in('status', ['active', 'needs_linking', 'completed'])
      .order('now_slot', { ascending: true })

    if (tasksError) {
      console.error('Error fetching Now Mode tasks:', tasksError)
      return NextResponse.json({ error: 'Failed to fetch Now Mode state' }, { status: 500 })
    }

    // Transform tasks to include outcome/commitment titles
    const nowModeTasks: NowModeTask[] = (tasks || []).map((t: Record<string, unknown>) => ({
      id: t.id as string,
      user_id: t.user_id as string,
      task_name: t.task_name as string,
      status: t.status as 'active' | 'completed' | 'needs_linking',
      now_slot: t.now_slot as NowSlot,
      estimated_minutes: t.estimated_minutes as number | null,
      due_date: t.due_date as string | null,
      outcome_id: t.outcome_id as string | null,
      commitment_id: t.commitment_id as string | null,
      outcome_title: Array.isArray(t.outcomes) ? (t.outcomes as { title: string }[])[0]?.title : (t.outcomes as { title: string } | null)?.title,
      commitment_title: Array.isArray(t.commitments) ? (t.commitments as { title: string }[])[0]?.title : (t.commitments as { title: string } | null)?.title,
      steps: t.steps as NowModeTask['steps'],
    }))

    const state = buildNowModeState(nowModeTasks, preferences)

    return NextResponse.json({ state })

  } catch (error) {
    console.error('Now Mode GET error:', error)
    return NextResponse.json({ error: 'Failed to get Now Mode state' }, { status: 500 })
  }
}

// ===========================================
// PUT /api/now-mode - Update Now Mode preferences
// ===========================================
export async function PUT(request: NextRequest) {
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
    const updates: Partial<NowModePreferences> = {}

    if (typeof body.now_mode_enabled === 'boolean') {
      updates.now_mode_enabled = body.now_mode_enabled
    }
    if (typeof body.now_mode_strict_limit === 'boolean') {
      updates.now_mode_strict_limit = body.now_mode_strict_limit
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 })
    }

    // 4. Upsert user_stats with preferences
    const { data: userStats, error: upsertError } = await supabase
      .from('user_stats')
      .upsert({
        user_id: user.id,
        ...updates,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select('now_mode_enabled, now_mode_strict_limit')
      .single()

    if (upsertError) {
      console.error('Error updating Now Mode preferences:', upsertError)
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
    }

    // 5. Log analytics event
    const eventType = updates.now_mode_enabled === false ? 'now_mode_disabled' : 'now_mode_enabled'
    if (updates.now_mode_enabled !== undefined) {
      await supabase.from('now_mode_events').insert({
        user_id: user.id,
        event_type: eventType,
        metadata: { strict_limit: userStats.now_mode_strict_limit },
      })
    }

    return NextResponse.json({
      preferences: {
        now_mode_enabled: userStats.now_mode_enabled,
        now_mode_strict_limit: userStats.now_mode_strict_limit,
      },
    })

  } catch (error) {
    console.error('Now Mode PUT error:', error)
    return NextResponse.json({ error: 'Failed to update Now Mode preferences' }, { status: 500 })
  }
}

// ===========================================
// Block unsupported methods
// ===========================================
export async function POST() {
  return NextResponse.json({ error: 'Method not allowed. Use /api/now-mode/pin or /api/now-mode/unpin' }, { status: 405 })
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
