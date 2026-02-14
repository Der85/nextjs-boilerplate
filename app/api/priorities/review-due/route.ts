import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const REVIEW_INTERVAL_DAYS = 90 // Quarterly review

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Get the most recent last_reviewed_at from user's priorities
    const { data: priorities, error } = await supabase
      .from('user_priorities')
      .select('last_reviewed_at')
      .eq('user_id', user.id)
      .order('last_reviewed_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error('Priority review check error:', error)
      return NextResponse.json({ error: 'Failed to check review status.' }, { status: 500 })
    }

    // If no priorities exist, they haven't set them yet
    if (!priorities || priorities.length === 0) {
      return NextResponse.json({
        isDue: false,
        lastReviewedAt: null,
        daysSinceReview: null,
        hasPriorities: false,
      })
    }

    const lastReviewedAt = priorities[0].last_reviewed_at
    const lastReviewDate = new Date(lastReviewedAt)
    const now = new Date()
    const daysSinceReview = Math.floor(
      (now.getTime() - lastReviewDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    return NextResponse.json({
      isDue: daysSinceReview >= REVIEW_INTERVAL_DAYS,
      lastReviewedAt,
      daysSinceReview,
      hasPriorities: true,
    })
  } catch (error) {
    console.error('Priority review-due GET error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
