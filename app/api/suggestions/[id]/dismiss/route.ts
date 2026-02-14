import { NextRequest, NextResponse } from 'next/server'
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
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (suggestionsRateLimiter.isLimited(user.id)) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
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
      return NextResponse.json({ error: 'Failed to dismiss suggestion.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Suggestion dismiss error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
