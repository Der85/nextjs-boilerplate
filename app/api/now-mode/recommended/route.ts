// Now Mode Recommended Tasks API Route
// GET: Get recommended tasks to pin to Now Mode

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

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
// Scoring function for task recommendations
// ===========================================
function scoreTask(task: {
  due_date: string | null
  estimated_minutes: number | null
  status: string
  now_slot: number | null
  outcome_id: string | null
  commitment_id: string | null
}): number {
  let score = 0

  // Already in Now Mode - exclude
  if (task.now_slot !== null) return -1

  // Not linked - exclude
  if (task.outcome_id === null && task.commitment_id === null) return -1

  // Completed - exclude
  if (task.status === 'completed') return -1

  // Due date urgency
  const dueDate = task.due_date
  if (dueDate === 'today') score += 50
  else if (dueDate === 'tomorrow') score += 30
  else if (dueDate === 'this_week') score += 15
  else if (dueDate === 'no_rush') score += 0
  else score += 5 // no due date

  // Time estimate (prefer shorter, actionable tasks)
  const minutes = task.estimated_minutes
  if (minutes !== null) {
    if (minutes <= 15) score += 25
    else if (minutes <= 30) score += 20
    else if (minutes <= 60) score += 15
    else if (minutes <= 90) score += 10
    else score += 5 // Longer tasks still valid but less preferred
  } else {
    score += 10 // No estimate is neutral
  }

  // Active status preferred
  if (task.status === 'active') score += 10

  return score
}

// ===========================================
// GET /api/now-mode/recommended - Get recommended tasks
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

    // 2. Get query parameters
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 20)
    const excludeIds = searchParams.get('exclude')?.split(',').filter(Boolean) || []

    // 3. Get eligible tasks (active, linked, not in Now Mode)
    let query = supabase
      .from('focus_plans')
      .select(`
        id,
        task_name,
        status,
        due_date,
        estimated_minutes,
        now_slot,
        outcome_id,
        commitment_id,
        outcomes:outcome_id (title),
        commitments:commitment_id (title)
      `)
      .eq('user_id', user.id)
      .in('status', ['active', 'needs_linking'])
      .is('now_slot', null)
      .or('outcome_id.not.is.null,commitment_id.not.is.null')
      .limit(50) // Get more than needed for scoring

    if (excludeIds.length > 0) {
      query = query.not('id', 'in', `(${excludeIds.join(',')})`)
    }

    const { data: tasks, error: tasksError } = await query

    if (tasksError) {
      console.error('Error fetching recommended tasks:', tasksError)
      return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 })
    }

    // 4. Score and sort tasks
    const scoredTasks = (tasks || [])
      .map((task: Record<string, unknown>) => ({
        id: task.id as string,
        task_name: task.task_name as string,
        estimated_minutes: task.estimated_minutes as number | null,
        outcome_title: Array.isArray(task.outcomes) ? (task.outcomes as { title: string }[])[0]?.title || null : (task.outcomes as { title: string } | null)?.title || null,
        commitment_title: Array.isArray(task.commitments) ? (task.commitments as { title: string }[])[0]?.title || null : (task.commitments as { title: string } | null)?.title || null,
        due_date: task.due_date as string | null,
        score: scoreTask({
          due_date: task.due_date as string | null,
          estimated_minutes: task.estimated_minutes as number | null,
          status: task.status as string,
          now_slot: task.now_slot as number | null,
          outcome_id: task.outcome_id as string | null,
          commitment_id: task.commitment_id as string | null,
        }),
      }))
      .filter((t) => t.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    return NextResponse.json({ tasks: scoredTasks })

  } catch (error) {
    console.error('Now Mode recommended GET error:', error)
    return NextResponse.json({ error: 'Failed to get recommendations' }, { status: 500 })
  }
}

// ===========================================
// Block other methods
// ===========================================
export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
