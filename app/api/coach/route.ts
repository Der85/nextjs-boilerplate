// Secured Coach API Route
// Authentication + Rate Limiting to protect Gemini API key
// Context-Aware Coaching: Fetches historical data for personalized responses

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { coachRateLimiter } from '@/lib/rateLimiter'
import { trackServerEvent } from '@/lib/analytics'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

// ===========================================
// Types for User Context
// ===========================================
interface UserContext {
  recentMoods: { mood_score: number; created_at: string }[]
  recentFocus: { status: string; task_name: string; completed_at: string | null }[]
  userStats: { current_level: number; total_xp: number } | null
  avgMood: number | null
  completedFocusCount: number
  moodTrend: 'improving' | 'declining' | 'stable' | 'unknown'
}

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
// Fetch Historical Context (Parallel Queries)
// ===========================================
async function fetchUserContext(
  supabase: SupabaseClient,
  userId: string
): Promise<UserContext> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoISO = sevenDaysAgo.toISOString()

  // Run all queries in parallel for performance
  const [moodsResult, focusResult, statsResult] = await Promise.all([
    // Recent Moods: Last 7 entries
    supabase
      .from('mood_entries')
      .select('mood_score, created_at')
      .eq('user_id', userId)
      .gte('created_at', sevenDaysAgoISO)
      .order('created_at', { ascending: false })
      .limit(7),

    // Recent Focus: Last 5 sessions
    supabase
      .from('focus_plans')
      .select('status, task_name, completed_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(5),

    // User Stats: Level and XP
    supabase
      .from('user_stats')
      .select('current_level, total_xp')
      .eq('user_id', userId)
      .single(),
  ])

  const recentMoods = moodsResult.data || []
  const recentFocus = focusResult.data || []
  const userStats = statsResult.data || null

  // Calculate average mood
  let avgMood: number | null = null
  if (recentMoods.length > 0) {
    const sum = recentMoods.reduce((acc, m) => acc + (m.mood_score || 0), 0)
    avgMood = Math.round((sum / recentMoods.length) * 10) / 10
  }

  // Count completed focus sessions
  const completedFocusCount = recentFocus.filter(f => f.status === 'completed').length

  // Calculate mood trend (comparing first half vs second half of entries)
  let moodTrend: 'improving' | 'declining' | 'stable' | 'unknown' = 'unknown'
  if (recentMoods.length >= 4) {
    const midpoint = Math.floor(recentMoods.length / 2)
    const recentHalf = recentMoods.slice(0, midpoint)
    const olderHalf = recentMoods.slice(midpoint)

    const recentAvg = recentHalf.reduce((acc, m) => acc + (m.mood_score || 0), 0) / recentHalf.length
    const olderAvg = olderHalf.reduce((acc, m) => acc + (m.mood_score || 0), 0) / olderHalf.length

    const diff = recentAvg - olderAvg
    if (diff > 0.5) moodTrend = 'improving'
    else if (diff < -0.5) moodTrend = 'declining'
    else moodTrend = 'stable'
  }

  return {
    recentMoods,
    recentFocus,
    userStats,
    avgMood,
    completedFocusCount,
    moodTrend,
  }
}

// ===========================================
// Build Context-Aware System Prompt
// ===========================================
function buildContextPrompt(context: UserContext): string {
  const parts: string[] = []

  // Mood trend context
  if (context.avgMood !== null) {
    const moodLabel = context.avgMood <= 4 ? 'lower' : context.avgMood <= 6 ? 'moderate' : 'good'
    parts.push(`- Mood Trend (Last 7 days): ${context.avgMood}/10 average (${moodLabel})`)

    if (context.moodTrend !== 'unknown') {
      const trendLabel = {
        improving: 'trending upward lately',
        declining: 'has been dipping recently',
        stable: 'has been consistent',
      }[context.moodTrend]
      parts.push(`- Mood Pattern: ${trendLabel}`)
    }
  }

  // Focus session context
  if (context.recentFocus.length > 0) {
    parts.push(`- Recent Focus: ${context.completedFocusCount}/${context.recentFocus.length} sessions completed`)

    // Mention recent task if completed
    const recentCompleted = context.recentFocus.find(f => f.status === 'completed')
    if (recentCompleted) {
      parts.push(`- Last completed: "${recentCompleted.task_name}"`)
    }
  }

  // Level context
  if (context.userStats) {
    parts.push(`- Level: ${context.userStats.current_level} (${context.userStats.total_xp} XP)`)
  }

  if (parts.length === 0) {
    return '[USER CONTEXT]\n- New user or limited history available'
  }

  return `[USER CONTEXT]\n${parts.join('\n')}`
}

// ===========================================
// Input Validation
// ===========================================
function isValidMoodScore(value: unknown): value is number {
  return typeof value === 'number' && 
         Number.isFinite(value) && 
         value >= 0 && 
         value <= 10
}

function sanitizeNote(note: unknown): string | null {
  if (typeof note !== 'string') return null
  // Limit note length to prevent abuse
  const trimmed = note.trim().slice(0, 2000)
  return trimmed.length > 0 ? trimmed : null
}

// ===========================================
// Generic Advice (fallback) - ADHD-friendly copy
// ===========================================
function getGenericAdvice(moodScore: number | null | undefined): string {
  // Handle invalid/missing mood scores with neutral response
  if (moodScore === null || moodScore === undefined || !Number.isFinite(moodScore)) {
    return "Thanks for checking in today. Every check-in is a win. How are you feeling right now?"
  }
  
  // Clamp to valid range
  const score = Math.max(0, Math.min(10, moodScore))
  
  if (score <= 3) {
    return "It's okay to have hard days—your feelings are valid. Try sharing what's on your mind next time so I can give you more personalized support."
  }
  if (score <= 5) {
    return "Thanks for checking in—showing up matters. If you share what's going on, I can offer advice tailored to your situation."
  }
  if (score <= 7) {
    return "You're in a steady place right now—that's worth acknowledging. Tell me more about what's happening and I can help you make the most of it."
  }
  return "Love to see you feeling good! Share what's contributing to this so we can help you recreate it."
}

// Error-specific responses (not generic placeholders)
function getErrorAdvice(): string {
  return "I'm having a moment—couldn't connect to my thinking cap. Your check-in still counts though! Try again in a sec?"
}

function getConfigErrorAdvice(): string {
  return "Thanks for checking in! I'm not fully set up yet, but showing up is what matters. You're doing great."
}

// ===========================================
// Main Handler
// ===========================================
export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  
  // 1. Check API key is configured
  if (!apiKey) {
    console.error('GEMINI_API_KEY not configured')
    return NextResponse.json({ advice: getConfigErrorAdvice() })
  }

  // 2. Get Supabase client
  const supabase = getSupabaseClient()
  if (!supabase) {
    console.error('Supabase not configured')
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    )
  }

  try {
    // 3. AUTHENTICATION - Verify user session
    const authHeader = request.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : null

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify the token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      )
    }

    // 4. RATE LIMITING - Per user
    if (coachRateLimiter.isLimited(user.id)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        { status: 429 }
      )
    }

    // 5. VALIDATE INPUT
    const body = await request.json()
    const { moodScore, note, energyLevel } = body

    if (!isValidMoodScore(moodScore)) {
      return NextResponse.json(
        { error: 'Invalid mood score' },
        { status: 400 }
      )
    }

    const sanitizedNote = sanitizeNote(note)

    // Validate energy level if provided (1-10 scale)
    const hasValidEnergy = typeof energyLevel === 'number' && energyLevel >= 1 && energyLevel <= 10

    // 6. If no note provided, return generic advice (save API calls)
    if (!sanitizedNote || sanitizedNote.length < 3) {
      return NextResponse.json({ advice: getGenericAdvice(moodScore) })
    }

    // 7. FETCH HISTORICAL CONTEXT (parallel queries for performance)
    let userContext: UserContext | null = null
    try {
      userContext = await fetchUserContext(supabase, user.id)
    } catch (contextError) {
      console.warn('Failed to fetch user context, proceeding without it:', contextError)
    }

    // 8. Build context-aware prompt for Gemini
    const getEnergyLabel = (level: number): string => {
      if (level <= 2) return 'Depleted'
      if (level <= 4) return 'Low'
      if (level <= 6) return 'Moderate'
      if (level <= 8) return 'High'
      return 'Overflowing'
    }
    const energyContext = hasValidEnergy
      ? `\n- Energy level: ${getEnergyLabel(energyLevel)} (${energyLevel}/10)`
      : ''

    // Build the user context section
    const contextSection = userContext
      ? `\n\n${buildContextPrompt(userContext)}`
      : ''

    // Add context-aware insights for the prompt
    let contextInsights = ''
    if (userContext) {
      if (userContext.moodTrend === 'declining' && moodScore <= 4) {
        contextInsights = '\n\nNote: This user has had a rough few days. Be extra gentle and emphasize that dips are normal—not failure.'
      } else if (userContext.moodTrend === 'improving') {
        contextInsights = '\n\nNote: This user has been trending upward. Acknowledge their progress without making it feel fragile.'
      }
      if (userContext.completedFocusCount >= 3) {
        contextInsights += '\n\nThis user has been completing tasks—reference this momentum if relevant.'
      }
    }

    const prompt = `You are a warm, experienced ADHD coach responding to a client's daily check-in.
${contextSection}

Current check-in:
- Mood: ${moodScore}/10${energyContext}
- What they shared: "${sanitizedNote}"

CORE PHILOSOPHY - Normalization over Pathology:
- ADHD is a brain difference, not a disorder to be fixed
- Struggles are normal human experiences, not personal failures
- Progress is non-linear—dips happen and that's okay
- Every check-in is a win, regardless of the mood score

Guidelines for your response:
1. Be warm and validating - acknowledge their feelings first
2. Keep it brief (2-3 sentences max)
3. If mood is low (1-4), focus on compassion and one tiny doable step—no toxic positivity
4. If mood is medium (5-7), acknowledge steady presence and suggest building gently
5. If mood is high (8-10), celebrate authentically and help them notice what's working
6. Reference specific things they mentioned from their note
7. If historical context is available, weave in relevant data naturally (e.g., "you've been showing up consistently" or "rough patch lately—totally normal")
8. Use "you" language, avoid "I suggest" or "you should"
9. End with something actionable but low-pressure
10. Never shame, guilt, or imply they're behind${contextInsights}

Respond directly as the coach (no intro like "Here's my response"):`

    // 9. Call Gemini API with enriched context
    const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 200,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        ],
      }),
    })

    if (!geminiResponse.ok) {
      console.error('Gemini API error:', geminiResponse.status)
      return NextResponse.json({ advice: getErrorAdvice() })
    }

    const geminiData = await geminiResponse.json()
    const advice = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text

    if (!advice) {
      console.error('Unexpected Gemini response format')
      return NextResponse.json({ advice: getErrorAdvice() })
    }

    // Track analytics event (fire and forget)
    trackServerEvent(supabase, user.id, 'coach_queried', {
      mood_score: moodScore,
      has_note: !!sanitizedNote,
      has_context: !!userContext,
    })

    return NextResponse.json({ advice: advice.trim() })

  } catch (error) {
    console.error('Coach API error:', error)
    return NextResponse.json({ advice: getErrorAdvice() })
  }
}

// ===========================================
// Block other methods
// ===========================================
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
