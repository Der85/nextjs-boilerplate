// Daily Check-in API Route
// GET: Get latest check-in and adaptive state
// POST: Upsert today's check-in

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { outcomesRateLimiter } from '@/lib/rateLimiter'
import {
  type DailyCheckin,
  type DailyCheckinWithMetadata,
  validateCheckinData,
  isValidCheckinScale,
} from '@/lib/types/daily-checkin'
import { computeAdaptiveState, hasCheckedInToday } from '@/lib/adaptive-engine'

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
// GET /api/daily-checkin - Get latest check-in and adaptive state
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

    // 2. Get latest check-in
    const { data: latestCheckin, error: fetchError } = await supabase
      .from('daily_checkins')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(1)
      .single()

    // Handle no check-ins case
    const checkinWithMetadata: DailyCheckinWithMetadata | null = latestCheckin
      ? {
          ...latestCheckin,
          is_today: hasCheckedInToday(latestCheckin),
        }
      : null

    // 3. Compute adaptive state
    const adaptiveState = computeAdaptiveState(checkinWithMetadata)

    // 4. Determine if check-in is needed today
    const needsCheckinToday = !checkinWithMetadata || !checkinWithMetadata.is_today

    return NextResponse.json({
      checkin: checkinWithMetadata,
      needs_checkin_today: needsCheckinToday,
      adaptive_state: adaptiveState,
    })

  } catch (error) {
    console.error('Daily checkin GET error:', error)
    return NextResponse.json({ error: 'Failed to get check-in' }, { status: 500 })
  }
}

// ===========================================
// POST /api/daily-checkin - Upsert today's check-in
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

    const validation = validateCheckinData(body)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors.join(', ') }, { status: 400 })
    }

    // 4. Determine date (default to today)
    const today = new Date().toISOString().split('T')[0]
    const targetDate = body.date || today

    // 5. Check if check-in exists for this date
    const { data: existingCheckin } = await supabase
      .from('daily_checkins')
      .select('id')
      .eq('user_id', user.id)
      .eq('date', targetDate)
      .single()

    const isUpdate = !!existingCheckin

    // 6. Upsert check-in
    const checkinData = {
      user_id: user.id,
      date: targetDate,
      overwhelm: body.overwhelm,
      anxiety: body.anxiety,
      energy: body.energy,
      clarity: body.clarity,
      note: body.note || null,
    }

    let result
    if (isUpdate) {
      result = await supabase
        .from('daily_checkins')
        .update(checkinData)
        .eq('id', existingCheckin.id)
        .select()
        .single()
    } else {
      result = await supabase
        .from('daily_checkins')
        .insert(checkinData)
        .select()
        .single()
    }

    if (result.error || !result.data) {
      console.error('Error upserting check-in:', result.error)
      return NextResponse.json({ error: 'Failed to save check-in' }, { status: 500 })
    }

    const checkin = result.data as DailyCheckin

    // 7. Compute adaptive state
    const adaptiveState = computeAdaptiveState(checkin)

    // 8. Log analytics event
    await supabase.from('adaptive_mode_events').insert({
      user_id: user.id,
      event_type: 'daily_checkin_submitted',
      checkin_id: checkin.id,
      metadata: {
        overwhelm: checkin.overwhelm,
        anxiety: checkin.anxiety,
        energy: checkin.energy,
        clarity: checkin.clarity,
        is_update: isUpdate,
        triggers: adaptiveState.triggers,
      },
    })

    // 9. Log adaptive mode trigger if applicable
    if (adaptiveState.triggers.length > 0) {
      await supabase.from('adaptive_mode_events').insert({
        user_id: user.id,
        event_type: 'adaptive_mode_triggered',
        trigger_reason: adaptiveState.triggers[0],
        checkin_id: checkin.id,
        metadata: {
          all_triggers: adaptiveState.triggers,
          simplified_ui: adaptiveState.simplifiedUIEnabled,
          recommendations_count: adaptiveState.recommendations.length,
        },
      })
    }

    return NextResponse.json({
      checkin,
      adaptive_state: adaptiveState,
      is_new: !isUpdate,
    })

  } catch (error) {
    console.error('Daily checkin POST error:', error)
    return NextResponse.json({ error: 'Failed to save check-in' }, { status: 500 })
  }
}

// ===========================================
// Block unsupported methods
// ===========================================
export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed. Use POST for upsert.' }, { status: 405 })
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
