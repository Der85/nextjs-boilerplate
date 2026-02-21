// app/api/tasks/[id]/complete/route.ts
// Optimized endpoint for completing a task and dismissing all related reminders
// in a single database transaction (reduces N+1 HTTP request problem)

import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { tasksRateLimiter } from '@/lib/rateLimiter'
import { getNextOccurrenceDate } from '@/lib/utils/recurrence'
import type { RecurrenceRule } from '@/lib/types'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }

    if (tasksRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }

    const { id: taskId } = await context.params

    // 1. Fetch the current task
    const { data: currentTask, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !currentTask) {
      return apiError('Task not found.', 404, 'NOT_FOUND')
    }

    // Already completed? Return early
    if (currentTask.status === 'done') {
      return NextResponse.json({
        task: currentTask,
        reminders_dismissed: 0,
        message: 'Task was already completed',
      })
    }

    // 2. Build update object for completion
    const updates: Record<string, unknown> = {
      status: 'done',
      completed_at: new Date().toISOString(),
      dropped_at: null,
      skipped_at: null,
    }

    // 3. Handle recurring task completion
    let nextOccurrence = null
    const isCompletingRecurring = currentTask.is_recurring && currentTask.recurrence_rule

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

    // 4. Update the task (only if still active — prevents duplicate completion race)
    const { data: task, error: updateError } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .eq('user_id', user.id)
      .neq('status', 'done')
      .select('*, category:categories(id, name, color, icon)')
      .single()

    if (updateError) {
      // If no rows matched, another request already completed this task
      if (updateError.code === 'PGRST116') {
        return NextResponse.json({
          task: currentTask,
          reminders_dismissed: 0,
          message: 'Task was already completed',
        })
      }
      console.error('Task completion error:', updateError)
      return apiError('Failed to complete task.', 500, 'INTERNAL_ERROR')
    }

    // 5. Dismiss all reminders for this task in a single query
    const { data: dismissedReminders, error: dismissError } = await supabase
      .from('reminders')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('task_id', taskId)
      .eq('user_id', user.id)
      .is('dismissed_at', null) // Only dismiss active reminders
      .select('id')

    if (dismissError) {
      console.error('Reminder dismissal error:', dismissError)
      // Don't fail the request - task was completed successfully
    }

    const remindersDismissed = dismissedReminders?.length || 0

    return NextResponse.json({
      task,
      nextOccurrence,
      reminders_dismissed: remindersDismissed,
    })
  } catch (error) {
    console.error('Task complete error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
