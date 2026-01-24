import { supabase } from '@/lib/supabase'

export async function getADHDCoachAdvice(moodScore: number, note: string | null): Promise<string> {
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
      return getFallbackAdvice(moodScore)
    }

    const data = await response.json()
    return data.advice || getFallbackAdvice(moodScore)
  } catch (error) {
    console.error('Coach API error:', error)
    return getFallbackAdvice(moodScore)
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
