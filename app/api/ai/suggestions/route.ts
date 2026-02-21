import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { aiRateLimiter } from '@/lib/rateLimiter'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }
    if (aiRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }


    const { data: suggestions, error } = await supabase
      .from('category_suggestions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error('Suggestions fetch error:', error)
      return apiError('Failed to load suggestions.', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({ suggestion: suggestions?.[0] || null })
  } catch (error) {
    console.error('Suggestions GET error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
