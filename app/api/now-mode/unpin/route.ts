// Now Mode Unpin API Route
// POST: Unpin a task from Now Mode

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { outcomesRateLimiter } from '@/lib/rateLimiter'
import { isValidUUID } from '@/lib/types/outcomes'

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
// POST /api/now-mode/unpin - Unpin a task from Now Mode
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

    // 4. Get the task to verify it exists and is in Now Mode
    const { data: task, error: taskError } = await supabase
      .from('focus_plans')
      .select('id, now_slot')
      .eq('id', body.task_id)
      .eq('user_id', user.id)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    if (task.now_slot === null) {
      return NextResponse.json({ error: 'Task is not in Now Mode' }, { status: 400 })
    }

    const previousSlot = task.now_slot

    // 5. Remove task from Now Mode
    const { error: updateError } = await supabase
      .from('focus_plans')
      .update({ now_slot: null })
      .eq('id', body.task_id)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Error unpinning task:', updateError)
      return NextResponse.json({ error: 'Failed to unpin task' }, { status: 500 })
    }

    // 6. Log analytics event
    await supabase.from('now_mode_events').insert({
      user_id: user.id,
      event_type: 'task_unpinned',
      task_id: body.task_id,
      slot_number: previousSlot,
    })

    return NextResponse.json({
      success: true,
      task_id: body.task_id,
    })

  } catch (error) {
    console.error('Now Mode unpin POST error:', error)
    return NextResponse.json({ error: 'Failed to unpin task' }, { status: 500 })
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
