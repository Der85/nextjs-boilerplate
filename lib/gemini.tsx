// Client-side helper for calling the coach API
// Includes authentication token for security

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export interface CoachResponse {
  advice: string
  context?: {
    currentStreak?: {
      type: 'low_mood' | 'high_mood' | 'checkin'
      days: number
    }
    patterns?: string[]
    recentMoods?: number[]
  }
}

export async function getADHDCoachAdvice(
  moodScore: number,
  note: string | null,
  energyLevel?: number | null
): Promise<CoachResponse> {
  try {
    // Get the current session token
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.access_token) {
      console.warn('No auth session - returning fallback advice')
      return { advice: getFallbackAdvice(moodScore) }
    }

    const response = await fetch('/api/coach', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ moodScore, note, energyLevel }),
    })

    // Handle rate limiting
    if (response.status === 429) {
      return { advice: "You're checking in frequently - that's great! Take a breath and try again in a minute." }
    }

    // Handle auth errors
    if (response.status === 401) {
      console.warn('Auth error from coach API')
      return { advice: getFallbackAdvice(moodScore) }
    }

    if (!response.ok) {
      console.error('Coach API error:', response.status)
      return { advice: getFallbackAdvice(moodScore) }
    }

    const data = await response.json()
    return { advice: data.advice || getFallbackAdvice(moodScore) }
    
  } catch (error) {
    console.error('Coach API error:', error)
    return { advice: getFallbackAdvice(moodScore) }
  }
}

function getFallbackAdvice(moodScore: number): string {
  if (moodScore <= 3) {
    return "It's okay to have hard days—your feelings are valid. Try sharing what's on your mind next time so I can give you more personalized support."
  }
  if (moodScore <= 5) {
    return "Thanks for checking in—showing up matters. If you share what's going on, I can offer advice tailored to your situation."
  }
  if (moodScore <= 7) {
    return "You're in a steady place right now—that's worth acknowledging. Tell me more about what's happening and I can help you make the most of it."
  }
  return "Love to see you feeling good! Share what's contributing to this so we can help you recreate it."
}
