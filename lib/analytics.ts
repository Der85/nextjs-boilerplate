// Lightweight Analytics Utility for Beta Testing
// Logs events to Supabase analytics_events table
// Can be replaced with PostHog/Mixpanel later

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ===========================================
// Types
// ===========================================
export interface AnalyticsEvent {
  event_name: string
  properties?: Record<string, unknown>
  user_id?: string
}

export type EventName =
  // Check-in events
  | 'checkin_completed'
  // Focus events
  | 'focus_session_started'
  | 'focus_session_completed'
  | 'focus_session_abandoned'
  // Coach events
  | 'coach_queried'
  // Weekly planning events
  | 'weekly_plan_committed'
  | 'weekly_plan_started'
  // General events
  | 'page_viewed'
  | 'feature_used'

// ===========================================
// Client-side Analytics (for React components)
// ===========================================
let clientSupabase: SupabaseClient | null = null

function getClientSupabase(): SupabaseClient | null {
  if (typeof window === 'undefined') return null

  if (!clientSupabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) return null
    clientSupabase = createClient(url, anonKey)
  }
  return clientSupabase
}

/**
 * Track an event from client-side code (React components)
 * Non-blocking - fires and forgets to avoid impacting UX
 */
export async function trackEvent(
  eventName: EventName,
  properties?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = getClientSupabase()
    if (!supabase) {
      console.warn('[Analytics] Supabase not configured')
      return
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.warn('[Analytics] No authenticated user')
      return
    }

    // Insert event (fire and forget)
    const { error } = await supabase
      .from('analytics_events')
      .insert({
        user_id: user.id,
        event_name: eventName,
        properties: properties || {},
      })

    if (error) {
      console.error('[Analytics] Failed to track event:', error.message)
    }
  } catch (err) {
    // Silent fail - analytics should never break the app
    console.error('[Analytics] Error:', err)
  }
}

// ===========================================
// Server-side Analytics (for API routes)
// ===========================================

/**
 * Track an event from server-side code (API routes)
 * Requires passing the Supabase client and user ID
 */
export async function trackServerEvent(
  supabase: SupabaseClient,
  userId: string,
  eventName: EventName,
  properties?: Record<string, unknown>
): Promise<void> {
  try {
    const { error } = await supabase
      .from('analytics_events')
      .insert({
        user_id: userId,
        event_name: eventName,
        properties: properties || {},
      })

    if (error) {
      console.error('[Analytics] Server event failed:', error.message)
    }
  } catch (err) {
    // Silent fail - analytics should never break the API
    console.error('[Analytics] Server error:', err)
  }
}

// ===========================================
// Convenience Helpers
// ===========================================

/**
 * Track check-in completion
 */
export function trackCheckinCompleted(properties: {
  mood_score: number
  has_note: boolean
  energy_level?: number
}): Promise<void> {
  return trackEvent('checkin_completed', properties)
}

/**
 * Track focus session start
 */
export function trackFocusStarted(properties: {
  task_name: string
  duration_minutes: number
}): Promise<void> {
  return trackEvent('focus_session_started', properties)
}

/**
 * Track focus session completion
 */
export function trackFocusCompleted(properties: {
  task_name: string
  duration_minutes: number
  completed: boolean
}): Promise<void> {
  return trackEvent('focus_session_completed', properties)
}

/**
 * Track weekly plan commitment
 */
export function trackWeeklyPlanCommitted(properties: {
  outcomes_count: number
  tasks_count: number
  week_start: string
}): Promise<void> {
  return trackEvent('weekly_plan_committed', properties)
}
