// Individual Commitment API Route
// GET: Get commitment with tasks
// PUT: Update commitment (including relinking to different outcome)
// DELETE: Delete commitment

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { outcomesRateLimiter } from '@/lib/rateLimiter'
import { dbUpdate, dbDelete } from '@/lib/db-helpers'
import {
  isValidCommitmentStatus,
  isValidUUID,
  type Commitment,
  type UpdateCommitmentRequest,
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
// GET /api/commitments/:id - Get commitment with tasks
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
      return NextResponse.json({ error: 'Invalid commitment ID' }, { status: 400 })
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

    // 4. Fetch commitment with outcome
    const { data: commitment, error: commitmentError } = await supabase
      .from('commitments')
      .select(`
        *,
        outcome:outcomes(id, title, horizon)
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (commitmentError || !commitment) {
      return NextResponse.json({ error: 'Commitment not found' }, { status: 404 })
    }

    // 5. Fetch linked tasks
    const { data: tasks } = await supabase
      .from('focus_plans')
      .select('id, task_name, status, due_date, created_at')
      .eq('commitment_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    return NextResponse.json({
      commitment,
      tasks: tasks || [],
    })

  } catch (error) {
    console.error('Commitment GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch commitment' }, { status: 500 })
  }
}

// ===========================================
// PUT /api/commitments/:id - Update commitment
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
      return NextResponse.json({ error: 'Invalid commitment ID' }, { status: 400 })
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
    const body = await request.json() as UpdateCommitmentRequest

    const updateData: Record<string, unknown> = {}
    let newOutcomeId: string | null = null

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

    if (body.status !== undefined) {
      if (!isValidCommitmentStatus(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      updateData.status = body.status
    }

    // Handle relinking to a different outcome
    if (body.outcome_id !== undefined) {
      if (!isValidUUID(body.outcome_id)) {
        return NextResponse.json({ error: 'Invalid outcome_id' }, { status: 400 })
      }

      // Verify new outcome exists and belongs to user
      const { data: outcome, error: outcomeError } = await supabase
        .from('outcomes')
        .select('id')
        .eq('id', body.outcome_id)
        .eq('user_id', user.id)
        .single()

      if (outcomeError || !outcome) {
        return NextResponse.json({ error: 'Target outcome not found' }, { status: 404 })
      }

      updateData.outcome_id = body.outcome_id
      newOutcomeId = body.outcome_id
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // 5. Update commitment
    const result = await dbUpdate<Commitment>(supabase, 'commitments', updateData, {
      id,
      user_id: user.id,
    })

    if (!result.success) {
      if (result.error?.code === 'PGRST116') {
        return NextResponse.json({ error: 'Commitment not found' }, { status: 404 })
      }
      return NextResponse.json({ error: result.error?.message }, { status: 500 })
    }

    // 6. If outcome_id changed, update all child tasks
    if (newOutcomeId) {
      const { error: updateTasksError } = await supabase
        .from('focus_plans')
        .update({ outcome_id: newOutcomeId })
        .eq('commitment_id', id)
        .eq('user_id', user.id)

      if (updateTasksError) {
        console.error('Failed to update child tasks:', updateTasksError)
        // Don't fail the request, but log the issue
      }

      // TODO: Track analytics events for each relinked task
    }

    return NextResponse.json({ commitment: result.data })

  } catch (error) {
    console.error('Commitment PUT error:', error)
    return NextResponse.json({ error: 'Failed to update commitment' }, { status: 500 })
  }
}

// ===========================================
// DELETE /api/commitments/:id - Delete commitment
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
      return NextResponse.json({ error: 'Invalid commitment ID' }, { status: 400 })
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

    // 4. Check for active tasks
    const { data: activeTasks } = await supabase
      .from('focus_plans')
      .select('id, task_name')
      .eq('commitment_id', id)
      .eq('user_id', user.id)
      .in('status', ['active', 'needs_linking'])
      .limit(10)

    if (activeTasks && activeTasks.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete commitment with active tasks',
          activeTasks,
          requiresRelink: true,
        },
        { status: 409 }
      )
    }

    // 5. Delete commitment (tasks will have commitment_id set to NULL)
    const result = await dbDelete(supabase, 'commitments', {
      id,
      user_id: user.id,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error?.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Commitment DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete commitment' }, { status: 500 })
  }
}

// ===========================================
// Block other methods
// ===========================================
export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
