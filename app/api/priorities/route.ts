import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { prioritiesRateLimiter } from '@/lib/rateLimiter'
import { prioritiesSetSchema, parseBody } from '@/lib/validations'

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
    const parsed = parseBody(prioritiesSetSchema, body)
    if (!parsed.success) return parsed.response

    const { priorities, trigger } = parsed.data

    // Validate all domains are present and ranks are unique
    const domains = new Set(priorities.map(p => p.domain))
    if (domains.size !== 8) {
      return apiError('All 8 domains must be present with no duplicates.', 400, 'VALIDATION_ERROR')
    }

    const ranks = new Set(priorities.map(p => p.rank))
    if (ranks.size !== 8) {
      return apiError('Ranks must be 1-8 with no duplicates.', 400, 'VALIDATION_ERROR')
    }

    // Check if this is an update (for response status code)
    const { count } = await supabase
      .from('user_priorities')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    const isUpdate = (count ?? 0) > 0

    // Prepare priorities as JSON for the RPC function
    const prioritiesJson = priorities.map(p => ({
      domain: p.domain,
      rank: p.rank,
      importance_score: p.importance_score,
      aspirational_note: p.aspirational_note || null,
    }))

    // Atomic upsert: delete + insert + review record in a single transaction
    const { data: result, error: rpcError } = await supabase.rpc('upsert_priorities', {
      p_priorities: prioritiesJson,
      p_trigger: trigger,
    })

    if (rpcError) {
      console.error('Priorities upsert error:', rpcError)
      return apiError('Failed to save priorities.', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json(
      { priorities: result || [], isUpdate },
      { status: isUpdate ? 200 : 201 }
    )
  } catch (error) {
    console.error('Priorities POST error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
