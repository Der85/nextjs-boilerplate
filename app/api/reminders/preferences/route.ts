import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { remindersRateLimiter } from '@/lib/rateLimiter'
import { reminderPreferencesSchema, parseBody } from '@/lib/validations'

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
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }

    if (remindersRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
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
      return apiError('Failed to fetch preferences.', 500, 'INTERNAL_ERROR')
    }

    const cacheHeaders = { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=600' }

    if (prefs) {
      return NextResponse.json({ preferences: prefs }, { headers: cacheHeaders })
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
      return apiError('Failed to create preferences.', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({ preferences: newPrefs }, { headers: cacheHeaders })
  } catch (error) {
    console.error('Reminder preferences GET error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}

// PUT /api/reminders/preferences
// Updates user's reminder preferences

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }

    if (remindersRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }

    const body = await request.json()
    const parsed = parseBody(reminderPreferencesSchema, body)
    if (!parsed.success) return parsed.response

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) {
        updates[key] = value
      }
    }

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
      return apiError('Failed to update preferences.', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({ preferences: prefs })
  } catch (error) {
    console.error('Reminder preferences PUT error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
