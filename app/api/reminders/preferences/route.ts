import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { remindersRateLimiter } from '@/lib/rateLimiter'
import type { ReminderPreferencesInput } from '@/lib/types'

// Default preferences for new users
const DEFAULT_PREFERENCES = {
  reminders_enabled: true,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  max_reminders_per_day: 5,
  reminder_lead_time_minutes: 30,
  preferred_reminder_times: ['09:00', '13:00', '17:00'],
  weekend_reminders: false,
  high_priority_override: true,
}

// GET /api/reminders/preferences
// Returns user's reminder preferences (creates defaults if none exist)

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (remindersRateLimiter.isLimited(user.id)) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }

    // Try to fetch existing preferences
    const { data: prefs, error } = await supabase
      .from('reminder_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found (expected for new users)
      console.error('Reminder preferences fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch preferences.' }, { status: 500 })
    }

    if (prefs) {
      return NextResponse.json({ preferences: prefs })
    }

    // Create default preferences for new users
    const { data: newPrefs, error: insertError } = await supabase
      .from('reminder_preferences')
      .insert({
        user_id: user.id,
        ...DEFAULT_PREFERENCES,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Reminder preferences insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create preferences.' }, { status: 500 })
    }

    return NextResponse.json({ preferences: newPrefs })
  } catch (error) {
    console.error('Reminder preferences GET error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

// PUT /api/reminders/preferences
// Updates user's reminder preferences

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (remindersRateLimiter.isLimited(user.id)) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }

    const body: ReminderPreferencesInput = await request.json()

    // Validate inputs
    if (body.max_reminders_per_day !== undefined) {
      if (body.max_reminders_per_day < 1 || body.max_reminders_per_day > 15) {
        return NextResponse.json({ error: 'Max reminders per day must be between 1 and 15.' }, { status: 400 })
      }
    }

    if (body.reminder_lead_time_minutes !== undefined) {
      if (![15, 30, 60, 120].includes(body.reminder_lead_time_minutes)) {
        return NextResponse.json({ error: 'Invalid lead time.' }, { status: 400 })
      }
    }

    if (body.preferred_reminder_times !== undefined) {
      if (body.preferred_reminder_times.length > 3) {
        return NextResponse.json({ error: 'Maximum 3 preferred reminder times.' }, { status: 400 })
      }
    }

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {}
    if (body.reminders_enabled !== undefined) updates.reminders_enabled = body.reminders_enabled
    if (body.quiet_hours_start !== undefined) updates.quiet_hours_start = body.quiet_hours_start
    if (body.quiet_hours_end !== undefined) updates.quiet_hours_end = body.quiet_hours_end
    if (body.max_reminders_per_day !== undefined) updates.max_reminders_per_day = body.max_reminders_per_day
    if (body.reminder_lead_time_minutes !== undefined) updates.reminder_lead_time_minutes = body.reminder_lead_time_minutes
    if (body.preferred_reminder_times !== undefined) updates.preferred_reminder_times = body.preferred_reminder_times
    if (body.weekend_reminders !== undefined) updates.weekend_reminders = body.weekend_reminders
    if (body.high_priority_override !== undefined) updates.high_priority_override = body.high_priority_override

    // Upsert preferences
    const { data: prefs, error } = await supabase
      .from('reminder_preferences')
      .upsert({
        user_id: user.id,
        ...updates,
      }, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) {
      console.error('Reminder preferences update error:', error)
      return NextResponse.json({ error: 'Failed to update preferences.' }, { status: 500 })
    }

    return NextResponse.json({ preferences: prefs })
  } catch (error) {
    console.error('Reminder preferences PUT error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
