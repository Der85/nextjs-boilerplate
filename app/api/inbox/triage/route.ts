// Inbox Triage API Route
// POST: Triage an inbox item (convert to task or discard)

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { outcomesRateLimiter } from '@/lib/rateLimiter'
import { dbInsert, dbUpdate } from '@/lib/db-helpers'
import {
  isValidTriageAction,
  stripTokens,
  type InboxItem,
  type TriageItemRequest,
  type TriageAction,
} from '@/lib/types/inbox'
import { isValidUUID } from '@/lib/types/outcomes'

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
// Convert inbox item to task
// ===========================================
async function convertToTask(
  supabase: SupabaseClient,
  userId: string,
  inboxItem: InboxItem,
  action: TriageAction,
  metadata: Record<string, unknown>,
  outcomeId?: string | null,
  commitmentId?: string | null
): Promise<{ id: string; task_name: string; status: string } | null> {
  // Only create task for actionable triage actions
  if (action === 'drop' || action === 'park') {
    return null
  }

  // Clean task name by removing tokens
  const taskName = stripTokens(inboxItem.raw_text) || inboxItem.raw_text

  // Determine initial status
  let status = 'active'
  if (!outcomeId && !commitmentId) {
    status = 'needs_linking'
  }

  // Determine due date based on action and metadata
  let dueDate: string | null = null
  if (action === 'do_now') {
    dueDate = 'today'
  } else if (action === 'schedule' && metadata.scheduled_date) {
    dueDate = metadata.scheduled_date as string
  }

  // Build task data
  const taskData: Record<string, unknown> = {
    user_id: userId,
    task_name: taskName,
    status,
    due_date: dueDate,
    steps: [],
    outcome_id: outcomeId || null,
    commitment_id: commitmentId || null,
  }

  // Apply parsed tokens
  if (inboxItem.parsed_tokens.priority === 'high') {
    taskData.energy_required = 'high'
  }

  const result = await dbInsert(supabase, 'focus_plans', taskData)

  if (!result.success || !result.data) {
    console.error('Failed to create task from inbox item:', result.error)
    return null
  }

  return {
    id: (result.data as any).id,
    task_name: taskName,
    status,
  }
}

// ===========================================
// POST /api/inbox/triage - Triage an inbox item
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
    const body = await request.json() as TriageItemRequest

    if (!isValidUUID(body.inbox_item_id)) {
      return NextResponse.json({ error: 'Valid inbox_item_id is required' }, { status: 400 })
    }

    if (!isValidTriageAction(body.action)) {
      return NextResponse.json({ error: 'Valid action is required' }, { status: 400 })
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

    // Check if already triaged
    if (inboxItem.triage_status !== 'pending') {
      return NextResponse.json({ error: 'Item already triaged' }, { status: 400 })
    }

    // 5. Convert to task if applicable
    let task = null
    if (body.action !== 'drop' && body.action !== 'park') {
      task = await convertToTask(
        supabase,
        user.id,
        inboxItem,
        body.action,
        body.metadata || {},
        body.outcome_id,
        body.commitment_id
      )
    }

    // 6. Update inbox item
    const triageStatus = body.action === 'drop' ? 'discarded' : 'triaged'
    const now = new Date().toISOString()

    const updateData: Record<string, unknown> = {
      triage_status: triageStatus,
      triage_action: body.action,
      triage_metadata: body.metadata || {},
      triaged_at: now,
    }

    if (task) {
      updateData.proposed_task_id = task.id
      updateData.converted_at = now
    }

    const result = await dbUpdate<InboxItem>(supabase, 'inbox_items', updateData, {
      id: body.inbox_item_id,
      user_id: user.id,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error?.message }, { status: 500 })
    }

    // TODO: Track analytics events:
    // - inbox_item_triaged or inbox_item_discarded
    // - capture_to_triage_time_ms

    return NextResponse.json({
      inbox_item: result.data,
      task,
    })

  } catch (error) {
    console.error('Triage POST error:', error)
    return NextResponse.json({ error: 'Failed to triage item' }, { status: 500 })
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
