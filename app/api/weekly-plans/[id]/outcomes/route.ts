// Weekly Plan Outcomes API Route
// GET: List outcomes for a plan
// POST: Add outcome to plan
// DELETE: Remove outcome from plan

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { weeklyPlanningRateLimiter } from '@/lib/rateLimiter'
import {
  type AddOutcomeRequest,
  MAX_WEEKLY_OUTCOMES,
} from '@/lib/types/weekly-planning'

// ===========================================
// Supabase Client
// ===========================================
function getSupabaseClient(accessToken?: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  if (accessToken) {
    return createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })
  }
  return createClient(url, anonKey)
}

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

// ===========================================
// GET /api/weekly-plans/[id]/outcomes
// ===========================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const anonClient = getSupabaseClient()
  if (!anonClient) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    const { id } = await params

    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid plan ID' }, { status: 400 })
    }

    // 1. Authentication
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
    }

    const supabase = getSupabaseClient(token)!

    // 2. Verify plan ownership
    const { data: plan } = await supabase
      .from('weekly_plans')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // 3. Fetch outcomes
    const { data: outcomes, error } = await supabase
      .from('weekly_plan_outcomes')
      .select(`
        *,
        outcome:outcomes(id, title, description, horizon, status)
      `)
      .eq('weekly_plan_id', id)
      .order('priority_rank', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ outcomes: outcomes || [] })

  } catch (error) {
    console.error('Weekly plan outcomes GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch outcomes' }, { status: 500 })
  }
}

// ===========================================
// POST /api/weekly-plans/[id]/outcomes - Add outcome
// ===========================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const anonClient = getSupabaseClient()
  if (!anonClient) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    const { id } = await params

    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid plan ID' }, { status: 400 })
    }

    // 1. Authentication
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
    }

    const supabase = getSupabaseClient(token)!

    // 2. Rate limiting
    if (weeklyPlanningRateLimiter.isLimited(user.id)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    // 3. Verify plan ownership and status
    const { data: plan } = await supabase
      .from('weekly_plans')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (plan.status !== 'draft') {
      return NextResponse.json(
        { error: 'Cannot modify committed plan' },
        { status: 400 }
      )
    }

    // 4. Check current outcome count
    const { count } = await supabase
      .from('weekly_plan_outcomes')
      .select('*', { count: 'exact', head: true })
      .eq('weekly_plan_id', id)

    if (count !== null && count >= MAX_WEEKLY_OUTCOMES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_WEEKLY_OUTCOMES} outcomes allowed per plan` },
        { status: 400 }
      )
    }

    // 5. Parse body
    const body = await request.json() as AddOutcomeRequest

    if (!isValidUUID(body.outcome_id)) {
      return NextResponse.json({ error: 'Invalid outcome ID' }, { status: 400 })
    }

    // 6. Verify outcome exists and belongs to user
    const { data: outcome } = await supabase
      .from('outcomes')
      .select('id')
      .eq('id', body.outcome_id)
      .eq('user_id', user.id)
      .single()

    if (!outcome) {
      return NextResponse.json({ error: 'Outcome not found' }, { status: 404 })
    }

    // 7. Insert plan outcome
    const { data: planOutcome, error: insertError } = await supabase
      .from('weekly_plan_outcomes')
      .insert({
        weekly_plan_id: id,
        outcome_id: body.outcome_id,
        priority_rank: typeof body.priority_rank === 'number' ? body.priority_rank : (count || 0) + 1,
        notes: typeof body.notes === 'string' ? body.notes.slice(0, 500) : null,
      })
      .select(`
        *,
        outcome:outcomes(id, title, description, horizon, status)
      `)
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'Outcome already added to this plan' },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // 8. Track analytics
    await supabase.from('weekly_planning_events').insert({
      user_id: user.id,
      event_type: 'outcomes_selected',
      weekly_plan_id: id,
      metadata: { outcome_id: body.outcome_id, priority_rank: body.priority_rank },
    })

    return NextResponse.json({ outcome: planOutcome }, { status: 201 })

  } catch (error) {
    console.error('Weekly plan outcomes POST error:', error)
    return NextResponse.json({ error: 'Failed to add outcome' }, { status: 500 })
  }
}

// ===========================================
// DELETE /api/weekly-plans/[id]/outcomes - Remove outcome
// ===========================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const anonClient = getSupabaseClient()
  if (!anonClient) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    const { id } = await params

    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid plan ID' }, { status: 400 })
    }

    // 1. Authentication
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
    }

    const supabase = getSupabaseClient(token)!

    // 2. Rate limiting
    if (weeklyPlanningRateLimiter.isLimited(user.id)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    // 3. Get outcome_id from query params
    const { searchParams } = new URL(request.url)
    const outcomeId = searchParams.get('outcome_id')

    if (!outcomeId || !isValidUUID(outcomeId)) {
      return NextResponse.json({ error: 'Invalid outcome ID' }, { status: 400 })
    }

    // 4. Verify plan ownership and status
    const { data: plan } = await supabase
      .from('weekly_plans')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (plan.status !== 'draft') {
      return NextResponse.json(
        { error: 'Cannot modify committed plan' },
        { status: 400 }
      )
    }

    // 5. Delete the plan outcome
    const { error: deleteError } = await supabase
      .from('weekly_plan_outcomes')
      .delete()
      .eq('weekly_plan_id', id)
      .eq('outcome_id', outcomeId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Weekly plan outcomes DELETE error:', error)
    return NextResponse.json({ error: 'Failed to remove outcome' }, { status: 500 })
  }
}
