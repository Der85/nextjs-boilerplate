// Bulk Task Relinking API Route
// POST: Relink multiple tasks to a new outcome or commitment

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { outcomesRateLimiter } from '@/lib/rateLimiter'
import { isValidUUID, type BulkRelinkRequest } from '@/lib/types/outcomes'

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
// POST /api/tasks/bulk-relink - Bulk relink tasks
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
    const body = await request.json() as BulkRelinkRequest

    if (!Array.isArray(body.task_ids) || body.task_ids.length === 0) {
      return NextResponse.json({ error: 'task_ids array is required' }, { status: 400 })
    }

    // Limit batch size for safety
    if (body.task_ids.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 tasks can be relinked at once' },
        { status: 400 }
      )
    }

    // Validate all task IDs
    for (const taskId of body.task_ids) {
      if (!isValidUUID(taskId)) {
        return NextResponse.json({ error: `Invalid task_id: ${taskId}` }, { status: 400 })
      }
    }

    if (!body.target_outcome_id && !body.target_commitment_id) {
      return NextResponse.json(
        { error: 'Must provide target_outcome_id or target_commitment_id' },
        { status: 400 }
      )
    }

    // 4. Build update data based on target
    const updateData: Record<string, unknown> = {}

    if (body.target_commitment_id) {
      if (!isValidUUID(body.target_commitment_id)) {
        return NextResponse.json({ error: 'Invalid target_commitment_id' }, { status: 400 })
      }

      // Verify commitment exists and belongs to user
      const { data: commitment, error: commitmentError } = await supabase
        .from('commitments')
        .select('id, outcome_id')
        .eq('id', body.target_commitment_id)
        .eq('user_id', user.id)
        .single()

      if (commitmentError || !commitment) {
        return NextResponse.json({ error: 'Target commitment not found' }, { status: 404 })
      }

      updateData.commitment_id = body.target_commitment_id
      updateData.outcome_id = commitment.outcome_id
    } else if (body.target_outcome_id) {
      if (!isValidUUID(body.target_outcome_id)) {
        return NextResponse.json({ error: 'Invalid target_outcome_id' }, { status: 400 })
      }

      // Verify outcome exists and belongs to user
      const { data: outcome, error: outcomeError } = await supabase
        .from('outcomes')
        .select('id')
        .eq('id', body.target_outcome_id)
        .eq('user_id', user.id)
        .single()

      if (outcomeError || !outcome) {
        return NextResponse.json({ error: 'Target outcome not found' }, { status: 404 })
      }

      updateData.outcome_id = body.target_outcome_id
      updateData.commitment_id = null
    }

    // 5. Update tasks in bulk
    // First, verify all tasks belong to user
    const { data: tasks, error: tasksError } = await supabase
      .from('focus_plans')
      .select('id')
      .in('id', body.task_ids)
      .eq('user_id', user.id)

    if (tasksError) {
      return NextResponse.json({ error: 'Failed to verify tasks' }, { status: 500 })
    }

    const validTaskIds = (tasks || []).map(t => t.id)
    const invalidCount = body.task_ids.length - validTaskIds.length

    if (validTaskIds.length === 0) {
      return NextResponse.json({ error: 'No valid tasks found' }, { status: 404 })
    }

    // 6. Perform bulk update
    const { error: updateError, count } = await supabase
      .from('focus_plans')
      .update(updateData)
      .in('id', validTaskIds)
      .eq('user_id', user.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // 7. Also transition any needs_linking tasks to active
    await supabase
      .from('focus_plans')
      .update({ status: 'active' })
      .in('id', validTaskIds)
      .eq('user_id', user.id)
      .eq('status', 'needs_linking')

    // TODO: Track analytics events for each relinked task

    return NextResponse.json({
      success: true,
      relinked_count: count || validTaskIds.length,
      skipped_count: invalidCount,
    })

  } catch (error) {
    console.error('Bulk relink error:', error)
    return NextResponse.json({ error: 'Failed to relink tasks' }, { status: 500 })
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
