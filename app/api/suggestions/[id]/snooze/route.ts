import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { suggestionsRateLimiter } from '@/lib/rateLimiter'
import type { SnoozeOption } from '@/lib/types'

interface RouteContext {
  params: Promise<{ id: string }>
}

function calculateSnoozeUntil(option: SnoozeOption): string {
  const now = new Date()

  switch (option) {
    case 'tomorrow':
      now.setDate(now.getDate() + 1)
      now.setHours(9, 0, 0, 0) // 9 AM tomorrow
      break
    case 'next_week':
      now.setDate(now.getDate() + 7)
      now.setHours(9, 0, 0, 0) // 9 AM next week
      break
    case 'next_month':
      now.setMonth(now.getMonth() + 1)
      now.setHours(9, 0, 0, 0) // 9 AM next month
      break
  }

  return now.toISOString()
}

// POST /api/suggestions/[id]/snooze
// Snoozes the suggestion until a specified time

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }

    if (suggestionsRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }

    const { id } = await context.params
    const body = await request.json()
    const until: SnoozeOption = body.until

    if (!['tomorrow', 'next_week', 'next_month'].includes(until)) {
      return apiError('Invalid snooze duration.', 400, 'VALIDATION_ERROR')
    }

    const snoozedUntil = calculateSnoozeUntil(until)

    // Update suggestion status
    const { error } = await supabase
      .from('task_suggestions')
      .update({
        status: 'snoozed',
        snoozed_until: snoozedUntil,
      })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Suggestion snooze error:', error)
      return apiError('Failed to snooze suggestion.', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({
      success: true,
      snoozed_until: snoozedUntil,
    })
  } catch (error) {
    console.error('Suggestion snooze error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
