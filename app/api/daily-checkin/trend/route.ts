// Daily Check-in Trend API Route
// GET: Get check-in trends and correlations for insights

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { type CheckinTrendPoint, type CheckinCorrelations } from '@/lib/types/daily-checkin'
import { generateCorrelationInsights } from '@/lib/adaptive-engine'

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
// GET /api/daily-checkin/trend - Get trends and correlations
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

    // 2. Parse query params
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || 'week'
    const includeCorrelations = searchParams.get('correlations') !== 'false'

    // 3. Calculate date range
    let daysBack: number
    switch (range) {
      case 'week':
        daysBack = 7
        break
      case 'month':
        daysBack = 30
        break
      case 'quarter':
        daysBack = 90
        break
      default:
        daysBack = 7
    }

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysBack)
    const startDateStr = startDate.toISOString().split('T')[0]

    // 4. Fetch check-ins
    const { data: checkins, error: checkinsError } = await supabase
      .from('daily_checkins')
      .select('date, overwhelm, anxiety, energy, clarity')
      .eq('user_id', user.id)
      .gte('date', startDateStr)
      .order('date', { ascending: true })

    if (checkinsError) {
      console.error('Error fetching check-in trend:', checkinsError)
      return NextResponse.json({ error: 'Failed to fetch trends' }, { status: 500 })
    }

    const trend: CheckinTrendPoint[] = (checkins || []).map((c) => ({
      date: c.date,
      overwhelm: c.overwhelm,
      anxiety: c.anxiety,
      energy: c.energy,
      clarity: c.clarity,
    }))

    // 5. Fetch correlations if requested
    let correlations: CheckinCorrelations | null = null
    let insights = null

    if (includeCorrelations && trend.length >= 5) {
      // Get counts for correlation calculation
      const { data: correlationData } = await supabase.rpc('get_checkin_correlations', {
        p_user_id: user.id,
      })

      if (correlationData && correlationData.length > 0) {
        correlations = correlationData[0] as CheckinCorrelations
        insights = generateCorrelationInsights(correlations)
      }
    }

    // 6. Calculate summary statistics
    const summary = calculateSummary(trend)

    return NextResponse.json({
      trend,
      correlations,
      insights,
      summary,
      range,
      days_with_data: trend.length,
      days_in_range: daysBack,
    })

  } catch (error) {
    console.error('Daily checkin trend GET error:', error)
    return NextResponse.json({ error: 'Failed to get trends' }, { status: 500 })
  }
}

// ===========================================
// Helper: Calculate summary statistics
// ===========================================
function calculateSummary(trend: CheckinTrendPoint[]) {
  if (trend.length === 0) {
    return null
  }

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length

  return {
    overwhelm: {
      average: Math.round(avg(trend.map((t) => t.overwhelm)) * 10) / 10,
      min: Math.min(...trend.map((t) => t.overwhelm)),
      max: Math.max(...trend.map((t) => t.overwhelm)),
    },
    anxiety: {
      average: Math.round(avg(trend.map((t) => t.anxiety)) * 10) / 10,
      min: Math.min(...trend.map((t) => t.anxiety)),
      max: Math.max(...trend.map((t) => t.anxiety)),
    },
    energy: {
      average: Math.round(avg(trend.map((t) => t.energy)) * 10) / 10,
      min: Math.min(...trend.map((t) => t.energy)),
      max: Math.max(...trend.map((t) => t.energy)),
    },
    clarity: {
      average: Math.round(avg(trend.map((t) => t.clarity)) * 10) / 10,
      min: Math.min(...trend.map((t) => t.clarity)),
      max: Math.max(...trend.map((t) => t.clarity)),
    },
  }
}

// ===========================================
// Block other methods
// ===========================================
export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
