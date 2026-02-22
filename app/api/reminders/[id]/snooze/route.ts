import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { remindersRateLimiter } from '@/lib/rateLimiter'
import type { SnoozeDuration } from '@/lib/types'

interface RouteContext {
  params: Promise<{ id: string }>
}

// Calculate snooze end time based on duration
function calculateSnoozeUntil(duration: SnoozeDuration): Date {
  const now = new Date()

  switch (duration) {
    case '10min':
      return new Date(now.getTime() + 10 * 60 * 1000)

    case '30min':
      return new Date(now.getTime() + 30 * 60 * 1000)

    case '1hour':
      return new Date(now.getTime() + 60 * 60 * 1000)

    case 'after_lunch': {
      // Today at 13:00, or tomorrow 13:00 if past 13:00
      const lunch = new Date(now)
      lunch.setHours(13, 0, 0, 0)
      if (lunch <= now) {
        lunch.setDate(lunch.getDate() + 1)
      }
      return lunch
    }

    case 'tomorrow_morning': {
      // Tomorrow at 09:00 (or user's first preferred time)
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(9, 0, 0, 0)
      return tomorrow
    }

    default:
      // Fallback to 30 minutes
      return new Date(now.getTime() + 30 * 60 * 1000)
  }
}

// POST /api/reminders/[id]/snooze
// Snoozes a reminder until a specified time

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }

    if (remindersRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }

    const { id } = await context.params
    const body = await request.json()
    const duration: SnoozeDuration = body.duration

    // Validate duration
    const validDurations: SnoozeDuration[] = ['10min', '30min', '1hour', 'after_lunch', 'tomorrow_morning']
    if (!validDurations.includes(duration)) {
      return apiError('Invalid snooze duration.', 400, 'VALIDATION_ERROR')
    }

    const snoozedUntil = calculateSnoozeUntil(duration)

    // Update reminder: set snoozed_until, clear delivered_at so it re-delivers
    const { error } = await supabase
      .from('reminders')
      .update({
        snoozed_until: snoozedUntil.toISOString(),
        delivered_at: null, // Clear so it re-delivers when snooze expires
      })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Reminder snooze error:', error)
      return apiError('Failed to snooze reminder.', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({
      success: true,
      snoozed_until: snoozedUntil.toISOString(),
    })
  } catch (error) {
    console.error('Reminder snooze error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
