// Individual Outcome API Route
// GET: Get outcome with linked commitments and tasks
// PUT: Update outcome
// DELETE: Delete outcome (blocks if active tasks exist)

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { outcomesRateLimiter } from '@/lib/rateLimiter'
import { dbUpdate, dbDelete } from '@/lib/db-helpers'
import {
  isValidOutcomeHorizon,
  isValidOutcomeStatus,
  isValidUUID,
  type Outcome,
  type UpdateOutcomeRequest,
} from '@/lib/types/outcomes'

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
// Input Validation
// ===========================================
function sanitizeTitle(title: unknown): string | null {
  if (typeof title !== 'string') return null
  const trimmed = title.trim().slice(0, 500)
  return trimmed.length > 0 ? trimmed : null
}

function sanitizeDescription(description: unknown): string | null {
  if (description === null) return null
  if (typeof description !== 'string') return null
  const trimmed = description.trim().slice(0, 2000)
  return trimmed.length > 0 ? trimmed : null
}

// ===========================================
// Route Context Type
// ===========================================
interface RouteContext {
  params: Promise<{ id: string }>
}

// ===========================================
// GET /api/outcomes/:id - Get outcome with commitments and tasks
// ===========================================
export async function GET(request: NextRequest, context: RouteContext) {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    const { id } = await context.params

    // 1. Validate ID
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid outcome ID' }, { status: 400 })
    }

    // 2. Authentication
    const authHeader = request.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
    }

    // 3. Rate limiting
    if (outcomesRateLimiter.isLimited(user.id)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    // 4. Fetch outcome
    const { data: outcome, error: outcomeError } = await supabase
      .from('outcomes')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (outcomeError || !outcome) {
      return NextResponse.json({ error: 'Outcome not found' }, { status: 404 })
    }

    // 5. Fetch linked commitments
    const { data: commitments } = await supabase
      .from('commitments')
      .select('*')
      .eq('outcome_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // 6. Fetch linked tasks (directly to outcome or via commitments)
    const commitmentIds = (commitments || []).map(c => c.id)

    let tasksQuery = supabase
      .from('focus_plans')
      .select('id, task_name, status, outcome_id, commitment_id, due_date, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Build OR condition for outcome_id or commitment_ids
    if (commitmentIds.length > 0) {
      tasksQuery = tasksQuery.or(`outcome_id.eq.${id},commitment_id.in.(${commitmentIds.join(',')})`)
    } else {
      tasksQuery = tasksQuery.eq('outcome_id', id)
    }

    const { data: tasks } = await tasksQuery

    return NextResponse.json({
      outcome,
      commitments: commitments || [],
      tasks: tasks || [],
    })

  } catch (error) {
    console.error('Outcome GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch outcome' }, { status: 500 })
  }
}

// ===========================================
// PUT /api/outcomes/:id - Update outcome
// ===========================================
export async function PUT(request: NextRequest, context: RouteContext) {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    const { id } = await context.params

    // 1. Validate ID
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid outcome ID' }, { status: 400 })
    }

    // 2. Authentication
    const authHeader = request.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
    }

    // 3. Rate limiting
    if (outcomesRateLimiter.isLimited(user.id)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    // 4. Parse and validate body
    const body = await request.json() as UpdateOutcomeRequest

    const updateData: Record<string, unknown> = {}

    if (body.title !== undefined) {
      const title = sanitizeTitle(body.title)
      if (!title) {
        return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
      }
      updateData.title = title
    }

    if (body.description !== undefined) {
      updateData.description = sanitizeDescription(body.description)
    }

    if (body.horizon !== undefined) {
      if (!isValidOutcomeHorizon(body.horizon)) {
        return NextResponse.json({ error: 'Invalid horizon' }, { status: 400 })
      }
      updateData.horizon = body.horizon
    }

    if (body.status !== undefined) {
      if (!isValidOutcomeStatus(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      updateData.status = body.status
    }

    if (body.priority_rank !== undefined) {
      if (typeof body.priority_rank !== 'number') {
        return NextResponse.json({ error: 'Invalid priority_rank' }, { status: 400 })
      }
      updateData.priority_rank = body.priority_rank
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // 5. Update outcome
    const result = await dbUpdate<Outcome>(supabase, 'outcomes', updateData, {
      id,
      user_id: user.id,
    })

    if (!result.success) {
      if (result.error?.code === 'PGRST116') {
        return NextResponse.json({ error: 'Outcome not found' }, { status: 404 })
      }
      return NextResponse.json({ error: result.error?.message }, { status: 500 })
    }

    return NextResponse.json({ outcome: result.data })

  } catch (error) {
    console.error('Outcome PUT error:', error)
    return NextResponse.json({ error: 'Failed to update outcome' }, { status: 500 })
  }
}

// ===========================================
// DELETE /api/outcomes/:id - Delete outcome (with active task check)
// ===========================================
export async function DELETE(request: NextRequest, context: RouteContext) {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    const { id } = await context.params

    // 1. Validate ID
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid outcome ID' }, { status: 400 })
    }

    // 2. Authentication
    const authHeader = request.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
    }

    // 3. Rate limiting
    if (outcomesRateLimiter.isLimited(user.id)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    // 4. Check for active tasks linked to this outcome
    const { data: directTasks } = await supabase
      .from('focus_plans')
      .select('id, task_name')
      .eq('outcome_id', id)
      .eq('user_id', user.id)
      .in('status', ['active', 'needs_linking'])
      .limit(10)

    // 5. Check for commitments and their tasks
    const { data: commitments } = await supabase
      .from('commitments')
      .select('id')
      .eq('outcome_id', id)
      .eq('user_id', user.id)

    const commitmentIds = (commitments || []).map(c => c.id)

    let commitmentTasks: Array<{ id: string; task_name: string }> = []
    if (commitmentIds.length > 0) {
      const { data } = await supabase
        .from('focus_plans')
        .select('id, task_name')
        .in('commitment_id', commitmentIds)
        .eq('user_id', user.id)
        .in('status', ['active', 'needs_linking'])
        .limit(10)
      commitmentTasks = data || []
    }

    const allActiveTasks = [...(directTasks || []), ...commitmentTasks]

    // 6. Block deletion if active tasks exist
    if (allActiveTasks.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete outcome with active tasks',
          activeTasks: allActiveTasks,
          requiresRelink: true,
        },
        { status: 409 }
      )
    }

    // 7. Delete outcome (commitments will cascade delete)
    const result = await dbDelete(supabase, 'outcomes', {
      id,
      user_id: user.id,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error?.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Outcome DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete outcome' }, { status: 500 })
  }
}

// ===========================================
// Block other methods
// ===========================================
export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
