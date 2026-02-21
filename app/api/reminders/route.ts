import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { remindersRateLimiter } from '@/lib/rateLimiter'

// GET /api/reminders
// Returns reminders that should be visible to the user
// - scheduled_for <= now AND delivered_at is null (ready to deliver)
// - OR snoozed_until <= now (snooze expired)
// - AND dismissed_at is null

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }

    if (remindersRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }

    const now = new Date().toISOString()

    // Fetch reminders that should be shown:
    // 1. Ready to deliver (scheduled_for <= now, not dismissed, not snoozed or snooze expired)
    // 2. Already delivered but not dismissed (for viewing history)
    const { data: reminders, error } = await supabase
      .from('reminders')
      .select(`
        *,
        task:tasks(
          id, title, status, due_date, due_time, priority, is_recurring, recurring_streak,
          category:categories(id, name, color, icon)
        )
      `)
      .eq('user_id', user.id)
      .is('dismissed_at', null)
      .or(`and(scheduled_for.lte.${now},snoozed_until.is.null),and(snoozed_until.lte.${now})`)
      .order('priority', { ascending: true }) // important first (alphabetically: gentle > important > normal, so we need to sort in code)
      .order('scheduled_for', { ascending: true })
      .limit(20)

    if (error) {
      console.error('Reminders fetch error:', error)
      return apiError('Failed to fetch reminders.', 500, 'INTERNAL_ERROR')
    }

    // Normalize task joins and sort by priority
    const priorityOrder = { important: 0, normal: 1, gentle: 2 }
    const normalizedReminders = (reminders || [])
      .map(r => ({
        ...r,
        task: Array.isArray(r.task) ? r.task[0] || null : r.task,
      }))
      .map(r => {
        if (r.task && r.task.category) {
          return {
            ...r,
            task: {
              ...r.task,
              category: Array.isArray(r.task.category) ? r.task.category[0] || null : r.task.category,
            },
          }
        }
        return r
      })
      .sort((a, b) => {
        const orderA = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 1
        const orderB = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 1
        return orderA - orderB
      })

    // Mark undelivered reminders as delivered
    const undeliveredIds = normalizedReminders
      .filter(r => !r.delivered_at)
      .map(r => r.id)

    if (undeliveredIds.length > 0) {
      await supabase
        .from('reminders')
        .update({ delivered_at: now })
        .in('id', undeliveredIds)

      // Update local data to reflect delivery
      for (const r of normalizedReminders) {
        if (!r.delivered_at) {
          r.delivered_at = now
        }
      }
    }

    // Count unread (delivered but not read)
    const unreadCount = normalizedReminders.filter(r => !r.read_at).length

    return NextResponse.json({
      reminders: normalizedReminders,
      unread_count: unreadCount,
    })
  } catch (error) {
    console.error('Reminders GET error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}

// DELETE /api/reminders (clear all)
// Dismisses all reminders for the user

export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }

    if (remindersRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }

    const now = new Date().toISOString()

    const { error } = await supabase
      .from('reminders')
      .update({ dismissed_at: now })
      .eq('user_id', user.id)
      .is('dismissed_at', null)

    if (error) {
      console.error('Reminders clear error:', error)
      return apiError('Failed to clear reminders.', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({ success: true, message: 'All reminders cleared.' })
  } catch (error) {
    console.error('Reminders DELETE error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
