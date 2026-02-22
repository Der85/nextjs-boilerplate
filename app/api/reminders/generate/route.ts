import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { remindersRateLimiter } from '@/lib/rateLimiter'
import type { ReminderPreferences, ReminderType, ReminderPriority, TaskWithCategory, UserPriority } from '@/lib/types'

// Default preferences if user hasn't set any
const DEFAULT_PREFERENCES: Omit<ReminderPreferences, 'user_id' | 'created_at' | 'updated_at'> = {
  reminders_enabled: true,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  max_reminders_per_day: 5,
  reminder_lead_time_minutes: 30,
  preferred_reminder_times: ['09:00', '13:00', '17:00'],
  weekend_reminders: false,
  high_priority_override: true,
}

interface ReminderToCreate {
  task_id: string
  reminder_type: ReminderType
  scheduled_for: string
  title: string
  message: string
  priority: ReminderPriority
}

// Helper: Check if date is today
function isToday(dateStr: string): boolean {
  const date = new Date(dateStr)
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

// Helper: Check if task is overdue
function isOverdue(task: TaskWithCategory): boolean {
  if (!task.due_date) return false
  const dueDate = new Date(task.due_date)
  if (task.due_time) {
    const [hours, minutes] = task.due_time.split(':').map(Number)
    dueDate.setHours(hours, minutes, 0, 0)
  } else {
    dueDate.setHours(23, 59, 59, 999)
  }
  return dueDate < new Date()
}

// Helper: Check if task is due within X minutes
function isDueWithin(task: TaskWithCategory, minutes: number): boolean {
  if (!task.due_date) return false
  const now = new Date()
  const dueDate = new Date(task.due_date)
  if (task.due_time) {
    const [hours, mins] = task.due_time.split(':').map(Number)
    dueDate.setHours(hours, mins, 0, 0)
  } else {
    dueDate.setHours(23, 59, 59, 999)
  }
  const diff = dueDate.getTime() - now.getTime()
  return diff > 0 && diff <= minutes * 60 * 1000
}

// Helper: Calculate days since task was created
function daysSinceCreated(task: TaskWithCategory): number {
  const created = new Date(task.created_at)
  const now = new Date()
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
}

// Helper: Format relative time for messages
function formatRelativeTime(dateStr: string, timeStr?: string | null): string {
  const date = new Date(dateStr)
  if (timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number)
    date.setHours(hours, minutes, 0, 0)
  }

  const now = new Date()
  const diff = date.getTime() - now.getTime()
  const absDiff = Math.abs(diff)

  if (absDiff < 60 * 60 * 1000) {
    const mins = Math.round(absDiff / (60 * 1000))
    return diff < 0 ? `${mins} minutes ago` : `in ${mins} minutes`
  }
  if (absDiff < 24 * 60 * 60 * 1000) {
    const hours = Math.round(absDiff / (60 * 60 * 1000))
    return diff < 0 ? `${hours} hours ago` : `in ${hours} hours`
  }
  const days = Math.round(absDiff / (24 * 60 * 60 * 1000))
  return diff < 0 ? `${days} days ago` : `in ${days} days`
}

// Helper: Calculate when to send the reminder based on preferences
function calculateReminderTime(task: TaskWithCategory, prefs: typeof DEFAULT_PREFERENCES): Date {
  const now = new Date()

  if (task.due_date && task.due_time) {
    // Remind X minutes before due time
    const dueDate = new Date(task.due_date)
    const [hours, minutes] = task.due_time.split(':').map(Number)
    dueDate.setHours(hours, minutes, 0, 0)
    dueDate.setMinutes(dueDate.getMinutes() - prefs.reminder_lead_time_minutes)

    // If the reminder time is in the past, use now
    if (dueDate < now) return now
    return dueDate
  }

  // Use next preferred time if no due_time
  return getNextPreferredTime(prefs)
}

// Helper: Get next preferred reminder time
function getNextPreferredTime(prefs: typeof DEFAULT_PREFERENCES): Date {
  const now = new Date()
  const today = new Date()

  for (const timeStr of prefs.preferred_reminder_times) {
    const [hours, minutes] = timeStr.split(':').map(Number)
    const candidate = new Date(today)
    candidate.setHours(hours, minutes, 0, 0)

    if (candidate > now) {
      return candidate
    }
  }

  // All today's times passed, use first time tomorrow
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const [hours, minutes] = (prefs.preferred_reminder_times[0] || '09:00').split(':').map(Number)
  tomorrow.setHours(hours, minutes, 0, 0)
  return tomorrow
}

// Helper: Check if time is within active hours (not in quiet hours)
function isWithinActiveHours(scheduledFor: Date, prefs: typeof DEFAULT_PREFERENCES): boolean {
  const hours = scheduledFor.getHours()
  const minutes = scheduledFor.getMinutes()
  const timeMinutes = hours * 60 + minutes

  const [qStartH, qStartM] = prefs.quiet_hours_start.split(':').map(Number)
  const [qEndH, qEndM] = prefs.quiet_hours_end.split(':').map(Number)
  const quietStart = qStartH * 60 + qStartM
  const quietEnd = qEndH * 60 + qEndM

  // Check weekend
  const dayOfWeek = scheduledFor.getDay()
  if ((dayOfWeek === 0 || dayOfWeek === 6) && !prefs.weekend_reminders) {
    return false
  }

  // Quiet hours can span midnight (e.g., 22:00 to 08:00)
  if (quietStart > quietEnd) {
    // Quiet from 22:00 to 08:00 means active from 08:00 to 22:00
    return timeMinutes >= quietEnd && timeMinutes < quietStart
  } else {
    // Normal case: quiet from 00:00 to 08:00
    return timeMinutes < quietStart || timeMinutes >= quietEnd
  }
}

// POST /api/reminders/generate
// Generates reminders based on user's tasks

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }

    if (remindersRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }

    // 1. Get user's reminder preferences
    const { data: prefsData } = await supabase
      .from('reminder_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()

    const prefs = prefsData || DEFAULT_PREFERENCES

    // If reminders are disabled, don't generate any
    if (!prefs.reminders_enabled) {
      return NextResponse.json({ generated: 0, message: 'Reminders are disabled.' })
    }

    // 2. Get user's active tasks with categories
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*, category:categories(id, name, color, icon)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('due_date', { ascending: true, nullsFirst: false })

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ generated: 0, message: 'No active tasks.' })
    }

    // Normalize category joins
    const normalizedTasks: TaskWithCategory[] = tasks.map(t => ({
      ...t,
      category: Array.isArray(t.category) ? t.category[0] || null : t.category,
    }))

    // 3. Get existing undismissed reminders to avoid duplicates
    const { data: existingReminders } = await supabase
      .from('reminders')
      .select('task_id, reminder_type')
      .eq('user_id', user.id)
      .is('dismissed_at', null)

    const existingSet = new Set(
      (existingReminders || []).map(r => `${r.task_id}:${r.reminder_type}`)
    )

    // 4. Get user's priorities for priority-based nudging
    const { data: priorities } = await supabase
      .from('user_priorities')
      .select('*')
      .eq('user_id', user.id)

    // 5. Get categories to map domain to category
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name')
      .eq('user_id', user.id)

    const categoryNameToId = new Map(
      (categories || []).map((c: { id: string; name: string }) => [c.name.toLowerCase(), c.id])
    )

    // Build priority rank lookup (domain -> category_id)
    const priorityRankByCategory = new Map<string, number>()
    if (priorities) {
      for (const p of priorities as UserPriority[]) {
        const catId = categoryNameToId.get(p.domain.toLowerCase())
        if (catId) {
          priorityRankByCategory.set(catId, p.rank)
        }
      }
    }

    // 6. Generate reminders based on rules
    const newReminders: ReminderToCreate[] = []
    const now = new Date()

    for (const task of normalizedTasks) {
      const categoryIcon = task.category?.icon || '📋'

      // Rule A: OVERDUE — task past due date (highest priority)
      if (isOverdue(task)) {
        const key = `${task.id}:overdue`
        if (!existingSet.has(key)) {
          newReminders.push({
            task_id: task.id,
            reminder_type: 'overdue',
            scheduled_for: now.toISOString(),
            title: `Overdue: ${task.title}`,
            message: `"${task.title}" was due ${formatRelativeTime(task.due_date!, task.due_time)}. Want to reschedule or complete it?`,
            priority: 'important',
          })
        }
        continue // Don't create other reminders for overdue tasks
      }

      // Rule B: DUE_SOON — task due within next 24 hours
      if (isDueWithin(task, 24 * 60)) {
        const key = `${task.id}:due_soon`
        if (!existingSet.has(key)) {
          const timeEstimate = task.priority === 'high' ? 'This is a high-priority task.' : ''
          newReminders.push({
            task_id: task.id,
            reminder_type: 'due_soon',
            scheduled_for: calculateReminderTime(task, prefs).toISOString(),
            title: `${categoryIcon} Due soon: ${task.title}`,
            message: `"${task.title}" is due ${formatRelativeTime(task.due_date!, task.due_time)}. ${timeEstimate}`.trim(),
            priority: 'normal',
          })
        }
      }

      // Rule C: RECURRING_DUE — recurring task due today
      if (task.is_recurring && task.due_date && isToday(task.due_date)) {
        const key = `${task.id}:recurring_due`
        if (!existingSet.has(key)) {
          const streakMessage = task.recurring_streak > 0
            ? `You're on a ${task.recurring_streak}-day streak!`
            : 'Start a new streak today!'
          newReminders.push({
            task_id: task.id,
            reminder_type: 'recurring_due',
            scheduled_for: calculateReminderTime(task, prefs).toISOString(),
            title: `${categoryIcon} Daily habit: ${task.title}`,
            message: `Time for "${task.title}". ${streakMessage}`,
            priority: 'normal',
          })
        }
      }

      // Rule D: PRIORITY_NUDGE — task in high-priority category, sitting for 3+ days, no due date
      if (priorities && priorities.length > 0 && !task.due_date && daysSinceCreated(task) >= 3) {
        const categoryRank = task.category_id ? priorityRankByCategory.get(task.category_id) : undefined
        if (categoryRank !== undefined && categoryRank <= 3) {
          const key = `${task.id}:priority_nudge`
          if (!existingSet.has(key)) {
            newReminders.push({
              task_id: task.id,
              reminder_type: 'priority_nudge',
              scheduled_for: getNextPreferredTime(prefs).toISOString(),
              title: `${categoryIcon} Priority task waiting`,
              message: `"${task.title}" is in your top-3 priority area. It's been waiting ${daysSinceCreated(task)} days.`,
              priority: 'gentle',
            })
          }
        }
      }
    }

    // 7. Apply quiet hours filter (except for high-priority override)
    const filtered = newReminders.filter(r => {
      const scheduledFor = new Date(r.scheduled_for)

      // Important reminders can override quiet hours (but not if it's the user's sleep time)
      if (r.priority === 'important' && prefs.high_priority_override) {
        // Still respect core sleep hours (midnight to quiet_hours_end)
        const hours = scheduledFor.getHours()
        const [qEndH] = prefs.quiet_hours_end.split(':').map(Number)
        if (hours < qEndH) {
          return false // Don't wake them up
        }
        return true
      }

      return isWithinActiveHours(scheduledFor, prefs)
    })

    // 8. Apply daily limit
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)

    const { data: todaysReminders } = await supabase
      .from('reminders')
      .select('id')
      .eq('user_id', user.id)
      .gte('scheduled_for', startOfDay.toISOString())
      .lte('scheduled_for', endOfDay.toISOString())

    const todayCount = todaysReminders?.length || 0
    const remainingSlots = Math.max(0, prefs.max_reminders_per_day - todayCount)

    // Prioritize: important > normal > gentle
    const priorityOrder = { important: 0, normal: 1, gentle: 2 }
    const sorted = filtered.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    const toCreate = sorted.slice(0, remainingSlots)

    // 9. Insert new reminders
    if (toCreate.length > 0) {
      const { error: insertError } = await supabase
        .from('reminders')
        .insert(toCreate.map(r => ({
          user_id: user.id,
          ...r,
        })))

      if (insertError) {
        console.error('Reminder insert error:', insertError)
        return apiError('Failed to create reminders.', 500, 'INTERNAL_ERROR')
      }
    }

    return NextResponse.json({
      generated: toCreate.length,
      skipped_quiet_hours: newReminders.length - filtered.length,
      skipped_daily_limit: filtered.length - toCreate.length,
    })
  } catch (error) {
    console.error('Reminder generate error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
