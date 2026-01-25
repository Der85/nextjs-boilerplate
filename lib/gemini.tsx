// Client-side Gemini helper with context support
import { supabase } from '@/lib/supabase'

export interface CoachResponse {
  advice: string
  context?: {
    totalCheckIns: number
    currentStreak: {
      type: 'checking_in' | 'low_mood' | 'high_mood' | 'improving'
      days: number
    } | null
    pattern: 'streak_low' | 'streak_high' | 'declining' | 'improving' | 'volatile' | 'stable' | null
    comparedToBaseline: 'better' | 'worse' | 'same'
  }
}

export async function getADHDCoachAdvice(moodScore: number, note: string | null): Promise<CoachResponse> {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData?.session?.access_token ?? null

    const response = await fetch('/api/coach', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
      },
      body: JSON.stringify({ moodScore, note }),
    })

    if (!response.ok) {
      console.error('Coach API error:', response.status)
      return { advice: getFallbackAdvice(moodScore) }
    }

    const data = await response.json()
    return {
      advice: data.advice || getFallbackAdvice(moodScore),
      context: data.context
    }
  } catch (error) {
    console.error('Coach API error:', error)
    return { advice: getFallbackAdvice(moodScore) }
  }
}

function getFallbackAdvice(moodScore: number): string {
  if (moodScore <= 3) {
    return "I'm here with you during this hard moment. Sometimes just showing up to check in is the win—you did that today."
  }
  if (moodScore <= 5) {
    return "Thanks for checking in—showing up matters. If you share what's going on, I can offer advice tailored to your situation."
  }
  if (moodScore <= 7) {
    return "You're in a steady place right now—that's worth acknowledging. Tell me more about what's happening and I can help you make the most of it."
  }
  return "Love to see you feeling good! Share what's contributing to this so we can help you recreate it."
}
