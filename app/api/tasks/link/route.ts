// Task Linking API Route
// POST: Link a task to an outcome or commitment

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { outcomesRateLimiter } from '@/lib/rateLimiter'
import { dbUpdate } from '@/lib/db-helpers'
import { isValidUUID, type LinkTaskRequest } from '@/lib/types/outcomes'

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
// POST /api/tasks/link - Link task to outcome/commitment
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
    const body = await request.json() as LinkTaskRequest

    if (!isValidUUID(body.task_id)) {
      return NextResponse.json({ error: 'Valid task_id is required' }, { status: 400 })
    }

    if (!body.outcome_id && !body.commitment_id) {
      return NextResponse.json(
        { error: 'Must provide outcome_id or commitment_id' },
        { status: 400 }
      )
    }

    // 4. Verify task exists and belongs to user
    const { data: task, error: taskError } = await supabase
      .from('focus_plans')
      .select('id, status')
      .eq('id', body.task_id)
      .eq('user_id', user.id)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // 5. Handle linking to commitment
    if (body.commitment_id) {
      if (!isValidUUID(body.commitment_id)) {
        return NextResponse.json({ error: 'Invalid commitment_id' }, { status: 400 })
      }

      // Verify commitment exists and belongs to user
      const { data: commitment, error: commitmentError } = await supabase
        .from('commitments')
        .select('id, outcome_id')
        .eq('id', body.commitment_id)
        .eq('user_id', user.id)
        .single()

      if (commitmentError || !commitment) {
        return NextResponse.json({ error: 'Commitment not found' }, { status: 404 })
      }

      // Link to both commitment and its parent outcome
      const updateData: Record<string, unknown> = {
        commitment_id: body.commitment_id,
        outcome_id: commitment.outcome_id,
      }

      // If task was needs_linking, transition to active
      if (task.status === 'needs_linking') {
        updateData.status = 'active'
      }

      const result = await dbUpdate(supabase, 'focus_plans', updateData, {
        id: body.task_id,
        user_id: user.id,
      })

      if (!result.success) {
        return NextResponse.json({ error: result.error?.message }, { status: 500 })
      }

      // TODO: Track analytics event: task_linked_to_commitment

      return NextResponse.json({ task: result.data, linkedTo: 'commitment' })
    }

    // 6. Handle linking directly to outcome
    if (body.outcome_id) {
      if (!isValidUUID(body.outcome_id)) {
        return NextResponse.json({ error: 'Invalid outcome_id' }, { status: 400 })
      }

      // Verify outcome exists and belongs to user
      const { data: outcome, error: outcomeError } = await supabase
        .from('outcomes')
        .select('id')
        .eq('id', body.outcome_id)
        .eq('user_id', user.id)
        .single()

      if (outcomeError || !outcome) {
        return NextResponse.json({ error: 'Outcome not found' }, { status: 404 })
      }

      const updateData: Record<string, unknown> = {
        outcome_id: body.outcome_id,
        commitment_id: null, // Clear any previous commitment link
      }

      // If task was needs_linking, transition to active
      if (task.status === 'needs_linking') {
        updateData.status = 'active'
      }

      const result = await dbUpdate(supabase, 'focus_plans', updateData, {
        id: body.task_id,
        user_id: user.id,
      })

      if (!result.success) {
        return NextResponse.json({ error: result.error?.message }, { status: 500 })
      }

      // TODO: Track analytics event: task_linked_to_outcome

      return NextResponse.json({ task: result.data, linkedTo: 'outcome' })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  } catch (error) {
    console.error('Task link error:', error)
    return NextResponse.json({ error: 'Failed to link task' }, { status: 500 })
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
