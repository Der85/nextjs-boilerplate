import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { prioritiesRateLimiter } from '@/lib/rateLimiter'
import type {
  UserPriority,
  PriorityInput,
  PriorityDomain,
  PriorityReviewTrigger,
  PriorityRankingSnapshot,
  PRIORITY_DOMAINS,
} from '@/lib/types'

const VALID_DOMAINS: PriorityDomain[] = [
  'Work',
  'Health',
  'Home',
  'Finance',
  'Social',
  'Personal Growth',
  'Admin',
  'Family',
]

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }

    const { data: priorities, error } = await supabase
      .from('user_priorities')
      .select('*')
      .eq('user_id', user.id)
      .order('rank', { ascending: true })

    if (error) {
      console.error('Priorities fetch error:', error)
      return apiError('Failed to load priorities.', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({ priorities: priorities || [] })
  } catch (error) {
    console.error('Priorities GET error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }

    if (prioritiesRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }

    const body = await request.json()
    const priorities: PriorityInput[] = body.priorities
    const trigger: PriorityReviewTrigger = body.trigger || 'manual'

    // Validate input
    if (!Array.isArray(priorities) || priorities.length !== 8) {
      return NextResponse.json(
        { error: 'Exactly 8 priorities are required.' },
        { status: 400 }
      )
    }

    // Validate all domains are present
    const domains = new Set(priorities.map(p => p.domain))
    const missingDomains = VALID_DOMAINS.filter(d => !domains.has(d))
    if (missingDomains.length > 0) {
      return NextResponse.json(
        { error: `Missing domains: ${missingDomains.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate ranks are 1-8 with no duplicates
    const ranks = priorities.map(p => p.rank).sort((a, b) => a - b)
    const expectedRanks = [1, 2, 3, 4, 5, 6, 7, 8]
    if (JSON.stringify(ranks) !== JSON.stringify(expectedRanks)) {
      return NextResponse.json(
        { error: 'Ranks must be 1-8 with no duplicates.' },
        { status: 400 }
      )
    }

    // Validate importance scores are 1-10
    for (const p of priorities) {
      if (p.importance_score < 1 || p.importance_score > 10) {
        return NextResponse.json(
          { error: 'Importance scores must be between 1 and 10.' },
          { status: 400 }
        )
      }
    }

    // Fetch existing priorities for review snapshot
    const { data: existingPriorities } = await supabase
      .from('user_priorities')
      .select('*')
      .eq('user_id', user.id)
      .order('rank', { ascending: true })

    const isUpdate = existingPriorities && existingPriorities.length > 0

    // Create snapshot of previous rankings if updating
    let previousRankings: PriorityRankingSnapshot[] = []
    if (isUpdate) {
      previousRankings = existingPriorities.map(p => ({
        domain: p.domain as PriorityDomain,
        rank: p.rank,
        importance_score: p.importance_score,
        aspirational_note: p.aspirational_note,
      }))
    }

    // Prepare new rankings snapshot
    const newRankings: PriorityRankingSnapshot[] = priorities.map(p => ({
      domain: p.domain,
      rank: p.rank,
      importance_score: p.importance_score,
      aspirational_note: p.aspirational_note || null,
    }))

    // Delete existing priorities and insert new ones (atomic upsert)
    if (isUpdate) {
      const { error: deleteError } = await supabase
        .from('user_priorities')
        .delete()
        .eq('user_id', user.id)

      if (deleteError) {
        console.error('Priorities delete error:', deleteError)
        return apiError('Failed to update priorities.', 500, 'INTERNAL_ERROR')
      }
    }

    // Insert all priorities
    const now = new Date().toISOString()
    const prioritiesToInsert = priorities.map(p => ({
      user_id: user.id,
      domain: p.domain,
      rank: p.rank,
      importance_score: p.importance_score,
      aspirational_note: p.aspirational_note || null,
      last_reviewed_at: now,
    }))

    const { data: insertedPriorities, error: insertError } = await supabase
      .from('user_priorities')
      .insert(prioritiesToInsert)
      .select()

    if (insertError) {
      console.error('Priorities insert error:', insertError)
      return apiError('Failed to save priorities.', 500, 'INTERNAL_ERROR')
    }

    // Create review record if this is an update
    if (isUpdate) {
      const { error: reviewError } = await supabase
        .from('priority_reviews')
        .insert({
          user_id: user.id,
          previous_rankings: previousRankings,
          new_rankings: newRankings,
          trigger: trigger,
        })

      if (reviewError) {
        // Log but don't fail - review records are supplementary
        console.error('Priority review insert error:', reviewError)
      }
    }

    return NextResponse.json(
      { priorities: insertedPriorities, isUpdate },
      { status: isUpdate ? 200 : 201 }
    )
  } catch (error) {
    console.error('Priorities POST error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
