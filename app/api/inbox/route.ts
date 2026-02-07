// Inbox API Route
// GET: List pending inbox items
// POST: Create new capture (frictionless, minimal fields)

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { outcomesRateLimiter } from '@/lib/rateLimiter'
import { dbInsert } from '@/lib/db-helpers'
import {
  isValidCaptureSource,
  parseTokens,
  enrichInboxItem,
  type InboxItem,
  type CreateCaptureRequest,
  type InboxSummary,
} from '@/lib/types/inbox'

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
// GET /api/inbox - List pending inbox items
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
    const status = searchParams.get('status') || 'pending'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    // 4. Fetch inbox items
    const { data: items, error } = await supabase
      .from('inbox_items')
      .select('*')
      .eq('user_id', user.id)
      .eq('triage_status', status)
      .order('captured_at', { ascending: true }) // Oldest first for triage
      .limit(limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 5. Enrich items with age and urgency
    const enrichedItems = (items || []).map(enrichInboxItem)

    // 6. Get summary stats
    const { count: pendingCount } = await supabase
      .from('inbox_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('triage_status', 'pending')

    const { count: triagedTodayCount } = await supabase
      .from('inbox_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('triage_status', 'triaged')
      .gte('triaged_at', new Date().toISOString().split('T')[0])

    const summary: InboxSummary = {
      pending_count: pendingCount || 0,
      oldest_pending_age_minutes: enrichedItems[0]?.age_minutes || 0,
      triaged_today_count: triagedTodayCount || 0,
      streak_days: 0, // TODO: Calculate actual streak
    }

    return NextResponse.json({
      items: enrichedItems,
      summary,
    })

  } catch (error) {
    console.error('Inbox GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch inbox' }, { status: 500 })
  }
}

// ===========================================
// POST /api/inbox - Create capture (frictionless)
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

    // 3. Parse body - minimal validation for speed
    const body = await request.json() as CreateCaptureRequest

    const rawText = typeof body.raw_text === 'string' ? body.raw_text.trim() : ''
    if (!rawText) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    // Limit text length
    if (rawText.length > 1000) {
      return NextResponse.json({ error: 'Text too long (max 1000 chars)' }, { status: 400 })
    }

    const source = isValidCaptureSource(body.source) ? body.source : 'quick_capture'

    // 4. Parse tokens from raw text
    const parsedTokens = parseTokens(rawText)

    // 5. Insert inbox item
    const insertData = {
      user_id: user.id,
      raw_text: rawText,
      source,
      parsed_tokens: parsedTokens,
      triage_status: 'pending',
      captured_at: new Date().toISOString(),
    }

    const result = await dbInsert<InboxItem>(supabase, 'inbox_items', insertData)

    if (!result.success) {
      return NextResponse.json({ error: result.error?.message }, { status: 500 })
    }

    // TODO: Track analytics event: capture_created

    return NextResponse.json({
      inbox_item: result.data,
      parsed_tokens: parsedTokens,
    }, { status: 201 })

  } catch (error) {
    console.error('Inbox POST error:', error)
    return NextResponse.json({ error: 'Failed to create capture' }, { status: 500 })
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
