// Weekly Plans API Route
// GET: List user's weekly plans
// POST: Create new weekly plan (or get existing for current week)

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { weeklyPlanningRateLimiter } from '@/lib/rateLimiter'
import { dbInsert, dbFetch } from '@/lib/db-helpers'
import {
  type WeeklyPlan,
  type CreateWeeklyPlanRequest,
  getISOWeekInfo,
  isValidWeeklyPlanStatus,
  DEFAULT_CAPACITY_MINUTES,
} from '@/lib/types/weekly-planning'

// ===========================================
// Supabase Client
// ===========================================
function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  return createClient(url, anonKey)
}

// ===========================================
// GET /api/weekly-plans - List user's weekly plans
// ===========================================
export async function GET(request: NextRequest) {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    // 1. Authentication
    const authHeader = request.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
    }

    // 2. Rate limiting
    if (weeklyPlanningRateLimiter.isLimited(user.id)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    // 3. Parse query params
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const year = searchParams.get('year')
    const weekNumber = searchParams.get('week')

    // 4. Build filters
    const filters: Record<string, unknown> = {}
    if (status && isValidWeeklyPlanStatus(status)) {
      filters.status = status
    }
    if (year && !isNaN(parseInt(year))) {
      filters.year = parseInt(year)
    }
    if (weekNumber && !isNaN(parseInt(weekNumber))) {
      filters.week_number = parseInt(weekNumber)
    }

    // 5. Fetch plans
    const result = await dbFetch<WeeklyPlan>(supabase, 'weekly_plans', user.id, {
      filters,
      orderBy: { column: 'created_at', ascending: false },
      limit: 20,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error?.message }, { status: 500 })
    }

    // Include current week info
    const currentWeek = getISOWeekInfo()

    return NextResponse.json({
      plans: result.data,
      current_week: {
        week_number: currentWeek.week_number,
        year: currentWeek.year,
        week_start: currentWeek.week_start.toISOString(),
        week_end: currentWeek.week_end.toISOString(),
      },
    })

  } catch (error) {
    console.error('Weekly plans GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch weekly plans' }, { status: 500 })
  }
}

// ===========================================
// POST /api/weekly-plans - Create weekly plan
// ===========================================
export async function POST(request: NextRequest) {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    // 1. Authentication
    const authHeader = request.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
    }

    // 2. Rate limiting
    if (weeklyPlanningRateLimiter.isLimited(user.id)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    // 3. Parse body
    const body = await request.json() as CreateWeeklyPlanRequest

    // 4. Determine week number and year
    const currentWeek = getISOWeekInfo()
    const weekNumber = body.week_number ?? currentWeek.week_number
    const year = body.year ?? currentWeek.year
    const availableCapacity = typeof body.available_capacity_minutes === 'number'
      ? body.available_capacity_minutes
      : DEFAULT_CAPACITY_MINUTES

    // 5. Check for existing draft plan for this week
    const { data: existingPlans } = await supabase
      .from('weekly_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('year', year)
      .eq('week_number', weekNumber)
      .eq('status', 'draft')
      .order('version', { ascending: false })
      .limit(1)

    if (existingPlans && existingPlans.length > 0) {
      // Return existing draft
      return NextResponse.json({
        plan: existingPlans[0],
        created: false,
      })
    }

    // 6. Get the latest version number for this week
    const { data: versionData } = await supabase
      .from('weekly_plans')
      .select('version')
      .eq('user_id', user.id)
      .eq('year', year)
      .eq('week_number', weekNumber)
      .order('version', { ascending: false })
      .limit(1)

    const nextVersion = versionData && versionData.length > 0
      ? versionData[0].version + 1
      : 1

    // 7. Insert new plan
    const insertData = {
      user_id: user.id,
      week_number: weekNumber,
      year,
      version: nextVersion,
      status: 'draft',
      available_capacity_minutes: availableCapacity,
      planned_capacity_minutes: 0,
    }

    const result = await dbInsert<WeeklyPlan>(supabase, 'weekly_plans', insertData)

    if (!result.success) {
      return NextResponse.json({ error: result.error?.message }, { status: 500 })
    }

    // 8. Track analytics event
    await supabase.from('weekly_planning_events').insert({
      user_id: user.id,
      event_type: 'planning_started',
      weekly_plan_id: result.data?.id,
      metadata: { week_number: weekNumber, year, version: nextVersion },
    })

    return NextResponse.json({
      plan: result.data,
      created: true,
    }, { status: 201 })

  } catch (error) {
    console.error('Weekly plans POST error:', error)
    return NextResponse.json({ error: 'Failed to create weekly plan' }, { status: 500 })
  }
}
