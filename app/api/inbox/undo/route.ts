// Inbox Undo API Route
// POST: Undo the last triage action (within 10 seconds)

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { outcomesRateLimiter } from '@/lib/rateLimiter'
import { dbUpdate, dbDelete } from '@/lib/db-helpers'
import type { InboxItem, UndoTriageRequest } from '@/lib/types/inbox'
import { isValidUUID } from '@/lib/types/outcomes'

const UNDO_WINDOW_MS = 10_000 // 10 seconds

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
// POST /api/inbox/undo - Undo last triage
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
    const body = await request.json() as UndoTriageRequest

    if (!isValidUUID(body.inbox_item_id)) {
      return NextResponse.json({ error: 'Valid inbox_item_id is required' }, { status: 400 })
    }

    // 4. Fetch inbox item
    const { data: inboxItem, error: fetchError } = await supabase
      .from('inbox_items')
      .select('*')
      .eq('id', body.inbox_item_id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !inboxItem) {
      return NextResponse.json({ error: 'Inbox item not found' }, { status: 404 })
    }

    // 5. Check if within undo window
    if (inboxItem.triage_status === 'pending') {
      return NextResponse.json({ error: 'Item has not been triaged' }, { status: 400 })
    }

    if (!inboxItem.triaged_at) {
      return NextResponse.json({ error: 'No triage timestamp found' }, { status: 400 })
    }

    const triagedAt = new Date(inboxItem.triaged_at).getTime()
    const now = Date.now()

    if (now - triagedAt > UNDO_WINDOW_MS) {
      return NextResponse.json(
        { error: 'Undo window expired (10 seconds)' },
        { status: 400 }
      )
    }

    // 6. Delete the created task if exists
    if (inboxItem.proposed_task_id) {
      await dbDelete(supabase, 'focus_plans', {
        id: inboxItem.proposed_task_id,
        user_id: user.id,
      })
    }

    // 7. Revert inbox item to pending
    const updateData = {
      triage_status: 'pending',
      triage_action: null,
      triage_metadata: {},
      triaged_at: null,
      proposed_task_id: null,
      converted_at: null,
    }

    const result = await dbUpdate<InboxItem>(supabase, 'inbox_items', updateData, {
      id: body.inbox_item_id,
      user_id: user.id,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error?.message }, { status: 500 })
    }

    // TODO: Track analytics event: triage_undo

    return NextResponse.json({
      inbox_item: result.data,
      undone: true,
    })

  } catch (error) {
    console.error('Undo POST error:', error)
    return NextResponse.json({ error: 'Failed to undo triage' }, { status: 500 })
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
