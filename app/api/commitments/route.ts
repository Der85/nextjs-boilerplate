// Commitments API Route
// GET: List user's commitments
// POST: Create new commitment

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { outcomesRateLimiter } from '@/lib/rateLimiter'
import { dbInsert } from '@/lib/db-helpers'
import {
  isValidCommitmentStatus,
  isValidUUID,
  type Commitment,
  type CreateCommitmentRequest,
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
// GET /api/commitments - List user's commitments
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

    // 2. Rate limiting
    if (outcomesRateLimiter.isLimited(user.id)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    // 3. Parse query params
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const outcome_id = searchParams.get('outcome_id')

    // 4. Build query with joined outcome data
    let query = supabase
      .from('commitments')
      .select(`
        *,
        outcome:outcomes(id, title, horizon)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (status && isValidCommitmentStatus(status)) {
      query = query.eq('status', status)
    }

    if (outcome_id && isValidUUID(outcome_id)) {
      query = query.eq('outcome_id', outcome_id)
    }

    const { data: commitments, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ commitments: commitments || [] })

  } catch (error) {
    console.error('Commitments GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch commitments' }, { status: 500 })
  }
}

// ===========================================
// POST /api/commitments - Create commitment
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
    const body = await request.json() as CreateCommitmentRequest

    const title = sanitizeTitle(body.title)
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    if (!isValidUUID(body.outcome_id)) {
      return NextResponse.json({ error: 'Valid outcome_id is required' }, { status: 400 })
    }

    // 4. Verify outcome exists and belongs to user
    const { data: outcome, error: outcomeError } = await supabase
      .from('outcomes')
      .select('id')
      .eq('id', body.outcome_id)
      .eq('user_id', user.id)
      .single()

    if (outcomeError || !outcome) {
      return NextResponse.json({ error: 'Outcome not found' }, { status: 404 })
    }

    // 5. Build insert data
    const insertData = {
      user_id: user.id,
      outcome_id: body.outcome_id,
      title,
      description: sanitizeDescription(body.description),
      status: 'active',
    }

    // 6. Insert commitment
    const result = await dbInsert<Commitment>(supabase, 'commitments', insertData)

    if (!result.success) {
      return NextResponse.json({ error: result.error?.message }, { status: 500 })
    }

    // TODO: Track analytics event: commitment_created

    return NextResponse.json({ commitment: result.data }, { status: 201 })

  } catch (error) {
    console.error('Commitments POST error:', error)
    return NextResponse.json({ error: 'Failed to create commitment' }, { status: 500 })
  }
}

// ===========================================
// Block other methods
// ===========================================
export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
