import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tasksRateLimiter } from '@/lib/rateLimiter'
import { getNextOccurrenceDate } from '@/lib/utils/recurrence'
import type { RecurrenceRule } from '@/lib/types'

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

    // First, fetch the current task to check for recurrence
    const { data: currentTask, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !currentTask) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
    }

    // Validate title if provided
    if ('title' in body) {
      const title = String(body.title || '').trim()
      if (!title) {
        return NextResponse.json({ error: 'Task title cannot be empty.' }, { status: 400 })
      }
      if (title.length > 500) {
        return NextResponse.json({ error: 'Task title must be 500 characters or fewer.' }, { status: 400 })
      }
    }

    // Build update object from allowed fields
    const updates: Record<string, unknown> = {}
    const allowedFields = [
      'title', 'status', 'due_date', 'due_time', 'priority', 'category_id', 'position',
      'is_recurring', 'recurrence_rule'
    ]

    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field]
      }
    }

    // Handle status transitions
    if (updates.status === 'done') {
      updates.completed_at = new Date().toISOString()
      updates.dropped_at = null
      updates.skipped_at = null
    } else if (updates.status === 'dropped') {
      updates.dropped_at = new Date().toISOString()
      updates.completed_at = null
      updates.skipped_at = null
    } else if (updates.status === 'skipped') {
      updates.skipped_at = new Date().toISOString()
      updates.completed_at = null
      updates.dropped_at = null
      // Reset streak on skip
      updates.recurring_streak = 0
    } else if (updates.status === 'active') {
      updates.completed_at = null
      updates.dropped_at = null
      updates.skipped_at = null
    }

    // Handle recurring task completion
    let nextOccurrence = null
    const isCompletingRecurring = updates.status === 'done' &&
      currentTask.is_recurring &&
      currentTask.recurrence_rule

    if (isCompletingRecurring) {
      const rule = currentTask.recurrence_rule as RecurrenceRule
      const nextDueDate = getNextOccurrenceDate(currentTask.due_date, rule)

      if (nextDueDate) {
        // Increment streak on the current task
        updates.recurring_streak = (currentTask.recurring_streak || 0) + 1

        // Create next occurrence
        const { data: newTask, error: createError } = await supabase
          .from('tasks')
          .insert({
            user_id: user.id,
            title: currentTask.title,
            status: 'active',
            due_date: nextDueDate,
            due_time: currentTask.due_time,
            priority: currentTask.priority,
            category_id: currentTask.category_id,
            is_recurring: true,
            recurrence_rule: currentTask.recurrence_rule,
            recurrence_parent_id: currentTask.recurrence_parent_id || currentTask.id,
            recurring_streak: (currentTask.recurring_streak || 0) + 1,
          })
          .select('*, category:categories(id, name, color, icon)')
          .single()

        if (!createError && newTask) {
          nextOccurrence = newTask
        }
      }
    }

    // Handle skipping recurring task - also generate next occurrence
    let skippedNextOccurrence = null
    const isSkippingRecurring = updates.status === 'skipped' &&
      currentTask.is_recurring &&
      currentTask.recurrence_rule

    if (isSkippingRecurring) {
      const rule = currentTask.recurrence_rule as RecurrenceRule
      const nextDueDate = getNextOccurrenceDate(currentTask.due_date, rule)

      if (nextDueDate) {
        // Create next occurrence with reset streak
        const { data: newTask, error: createError } = await supabase
          .from('tasks')
          .insert({
            user_id: user.id,
            title: currentTask.title,
            status: 'active',
            due_date: nextDueDate,
            due_time: currentTask.due_time,
            priority: currentTask.priority,
            category_id: currentTask.category_id,
            is_recurring: true,
            recurrence_rule: currentTask.recurrence_rule,
            recurrence_parent_id: currentTask.recurrence_parent_id || currentTask.id,
            recurring_streak: 0, // Reset streak on skip
          })
          .select('*, category:categories(id, name, color, icon)')
          .single()

        if (!createError && newTask) {
          skippedNextOccurrence = newTask
        }
      }
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

    return NextResponse.json({
      task,
      nextOccurrence: nextOccurrence || skippedNextOccurrence
    })
  } catch (error) {
    console.error('Task PATCH error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
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
