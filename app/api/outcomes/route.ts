// Outcomes API Route
// GET: List user's outcomes
// POST: Create new outcome

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { outcomesRateLimiter } from '@/lib/rateLimiter'
import { dbInsert, dbFetch } from '@/lib/db-helpers'
import {
  isValidOutcomeHorizon,
  isValidOutcomeStatus,
  type Outcome,
  type CreateOutcomeRequest,
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
  if (typeof description !== 'string') return null
  const trimmed = description.trim().slice(0, 2000)
  return trimmed.length > 0 ? trimmed : null
}

// ===========================================
// GET /api/outcomes - List user's outcomes
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
    const horizon = searchParams.get('horizon')

    // 4. Build filters
    const filters: Record<string, unknown> = {}
    if (status && isValidOutcomeStatus(status)) {
      filters.status = status
    }
    if (horizon && isValidOutcomeHorizon(horizon)) {
      filters.horizon = horizon
    }

    // 5. Fetch outcomes
    const result = await dbFetch<Outcome>(supabase, 'outcomes', user.id, {
      filters,
      orderBy: { column: 'priority_rank', ascending: true },
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error?.message }, { status: 500 })
    }

    return NextResponse.json({ outcomes: result.data })

  } catch (error) {
    console.error('Outcomes GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch outcomes' }, { status: 500 })
  }
}

// ===========================================
// POST /api/outcomes - Create outcome
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
    const body = await request.json() as CreateOutcomeRequest

    const title = sanitizeTitle(body.title)
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    if (!isValidOutcomeHorizon(body.horizon)) {
      return NextResponse.json(
        { error: 'Invalid horizon. Must be weekly, monthly, or quarterly' },
        { status: 400 }
      )
    }

    // 4. Build insert data
    const insertData = {
      user_id: user.id,
      title,
      description: sanitizeDescription(body.description),
      horizon: body.horizon,
      status: 'active',
      priority_rank: typeof body.priority_rank === 'number' ? body.priority_rank : 0,
    }

    // 5. Insert outcome
    const result = await dbInsert<Outcome>(supabase, 'outcomes', insertData)

    if (!result.success) {
      return NextResponse.json({ error: result.error?.message }, { status: 500 })
    }

    // TODO: Track analytics event: outcome_created

    return NextResponse.json({ outcome: result.data }, { status: 201 })

  } catch (error) {
    console.error('Outcomes POST error:', error)
    return NextResponse.json({ error: 'Failed to create outcome' }, { status: 500 })
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
