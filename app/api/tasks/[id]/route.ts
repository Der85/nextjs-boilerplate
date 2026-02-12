import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tasksRateLimiter } from '@/lib/rateLimiter'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (tasksRateLimiter.isLimited(user.id)) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }

    const { id } = await context.params
    const body = await request.json()

    // Build update object from allowed fields
    const updates: Record<string, unknown> = {}
    const allowedFields = ['title', 'status', 'due_date', 'due_time', 'priority', 'category_id', 'position']

    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field]
      }
    }

    // Handle status transitions
    if (updates.status === 'done') {
      updates.completed_at = new Date().toISOString()
      updates.dropped_at = null
    } else if (updates.status === 'dropped') {
      updates.dropped_at = new Date().toISOString()
      updates.completed_at = null
    } else if (updates.status === 'active') {
      updates.completed_at = null
      updates.dropped_at = null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 })
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*, category:categories(id, name, color, icon)')
      .single()

    if (error) {
      console.error('Task update error:', error)
      return NextResponse.json({ error: 'Failed to update task.' }, { status: 500 })
    }

    if (!task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
    }

    return NextResponse.json({ task })
  } catch (error) {
    console.error('Task PATCH error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await context.params

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Task delete error:', error)
      return NextResponse.json({ error: 'Failed to delete task.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Task DELETE error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
