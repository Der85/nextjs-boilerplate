import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { suggestionsRateLimiter } from '@/lib/rateLimiter'

interface RouteContext {
  params: Promise<{ id: string }>
}

// POST /api/suggestions/[id]/dismiss
// Marks the suggestion as dismissed

export async function POST(_request: NextRequest, context: RouteContext) {
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

    // Update suggestion status
    const { error } = await supabase
      .from('task_suggestions')
      .update({
        status: 'dismissed',
        dismissed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Suggestion dismiss error:', error)
      return apiError('Failed to dismiss suggestion.', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Suggestion dismiss error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
