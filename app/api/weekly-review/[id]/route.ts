// app/api/weekly-review/[id]/route.ts
// Update user reflection and read status on a weekly review

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { WeeklyReview, WeeklyReviewUpdateRequest } from '@/lib/types'

// ============================================
// Get Single Review
// ============================================
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { data: review, error } = await supabase
      .from('weekly_reviews')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    return NextResponse.json({ review: review as WeeklyReview })
  } catch (error) {
    console.error('Weekly review GET by ID error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ============================================
// Update Review (reflection, read status)
// ============================================
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body: WeeklyReviewUpdateRequest = await request.json()

    // Build update object
    const updates: Record<string, unknown> = {}

    if (body.user_reflection !== undefined) {
      updates.user_reflection = body.user_reflection
    }

    if (body.is_read !== undefined) {
      updates.is_read = body.is_read
      if (body.is_read) {
        updates.read_at = new Date().toISOString()
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    // Update the review
    const { data: review, error } = await supabase
      .from('weekly_reviews')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update weekly review:', error)
      return NextResponse.json({ error: 'Failed to update review' }, { status: 500 })
    }

    return NextResponse.json({ review: review as WeeklyReview })
  } catch (error) {
    console.error('Weekly review PATCH error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
