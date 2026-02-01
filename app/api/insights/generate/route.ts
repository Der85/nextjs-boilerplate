// app/api/insights/generate/route.ts
// Pattern Engine — "Sherlock" Insight Generator
// Fetches 14 days of mood, burnout & focus data, sends to Gemini
// for hidden cross-day correlations, then caches in user_insights.
//
// Cache constraint: only generates a new insight if none exists
// from the last 10 minutes (prevents spam and saves API costs).

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { insightsRateLimiter } from '@/lib/rateLimiter'

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

const CACHE_MINUTES = 10

// ============================================
// Rate Limiting
// ============================================
function getClientIp(request: NextRequest): string {
  const forwardedFor =
    request.headers.get('x-vercel-forwarded-for') ||
    request.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

// ============================================
// Supabase Clients
// ============================================
function getClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return null
  return createClient(supabaseUrl, supabaseAnonKey)
}

function getServiceClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return null
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ============================================
// Types
// ============================================
interface Insight {
  type: 'correlation' | 'streak' | 'warning' | 'praise'
  title: string
  message: string
  icon: string
}

interface InsightRow extends Insight {
  id: string
}

// ============================================
// Data Gathering — last 14 days
// ============================================
function fourteenDaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 14)
  return d.toISOString()
}

async function fetchRecentMoodEntries(db: SupabaseClient, userId: string) {
  const { data } = await db
    .from('mood_entries')
    .select('mood_score, note, energy_level, created_at')
    .eq('user_id', userId)
    .gte('created_at', fourteenDaysAgo())
    .order('created_at', { ascending: true })

  return data || []
}

async function fetchRecentBurnoutLogs(db: SupabaseClient, userId: string) {
  const { data } = await db
    .from('burnout_logs')
    .select('sleep_quality, focus_difficulty, overwhelm, energy_level, physical_tension, motivation, source, created_at')
    .eq('user_id', userId)
    .gte('created_at', fourteenDaysAgo())
    .order('created_at', { ascending: true })

  return data || []
}

async function fetchRecentFocusPlans(db: SupabaseClient, userId: string) {
  const { data } = await db
    .from('focus_plans')
    .select('status, tasks, created_at')
    .eq('user_id', userId)
    .gte('created_at', fourteenDaysAgo())
    .order('created_at', { ascending: true })

  return data || []
}

// ============================================
// Check for cached insight (< 10 minutes old)
// ============================================
async function fetchCachedInsight(db: SupabaseClient, userId: string): Promise<InsightRow | null> {
  const cutoff = new Date()
  cutoff.setMinutes(cutoff.getMinutes() - CACHE_MINUTES)

  const { data } = await db
    .from('user_insights')
    .select('id, type, title, message, icon')
    .eq('user_id', userId)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)

  if (data && data.length > 0) {
    return data[0] as InsightRow
  }
  return null
}

// ============================================
// Save insight to DB and return with id
// ============================================
async function saveInsight(db: SupabaseClient, userId: string, insight: Insight): Promise<InsightRow | null> {
  const now = new Date()
  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - 14)

  const { data } = await db.from('user_insights').insert({
    user_id: userId,
    type: insight.type,
    title: insight.title,
    message: insight.message,
    icon: insight.icon,
    data_window_start: windowStart.toISOString().split('T')[0],
    data_window_end: now.toISOString().split('T')[0],
  }).select('id, type, title, message, icon').single()

  return data as InsightRow | null
}

// ============================================
// Build the Gemini prompt — "Sherlock" mode
// ============================================
function buildInsightPrompt(
  moodEntries: any[],
  burnoutLogs: any[],
  focusPlans: any[]
): string {
  // 1. Interpret Focus Plans (Success Rate)
  const focusSummary = focusPlans.map((p) => {
    let completedCount = 0
    let totalCount = 0
    try {
      // Handle both JSONB array and stringified JSON
      const tasks = typeof p.tasks === 'string' ? JSON.parse(p.tasks) : p.tasks
      if (Array.isArray(tasks)) {
        totalCount = tasks.length
        completedCount = tasks.filter((t: any) => t.completed || t.status === 'completed').length
      }
    } catch { /* ignore parse errors */ }
    
    return {
      date: p.created_at,
      success_rate: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) + '%' : 'N/A',
      status: p.status
    }
  })

  // 2. Interpret Burnout Logs (Trojan Horse Data)
  // We translate raw scores into meanings so Gemini doesn't have to guess
  const interpretedBurnout = burnoutLogs.map(b => ({
    date: b.created_at,
    source: b.source, // 'morning_key', 'focus_exit', etc.
    // Sleep: 1=Terrible, 10=Great
    sleep: b.sleep_quality ? (b.sleep_quality < 4 ? "POOR" : b.sleep_quality > 7 ? "GREAT" : "OK") : null,
    // Focus: 1=Laser, 5=Foggy, 8=Distracted
    focus_state: b.focus_difficulty ? (b.focus_difficulty <= 2 ? "LASER" : b.focus_difficulty >= 7 ? "DISTRACTED" : "FOGGY") : null,
    // Overwhelm: 8=High (from Implicit Logger)
    overwhelm: b.overwhelm ? (b.overwhelm > 6 ? "HIGH ALERT" : "Manageable") : null,
    tension: b.physical_tension,
  }))

  return `You are an expert ADHD Data Analyst. 
I am sending you 14 days of tracked data from an ADHD user.
Your goal is to find ONE specific, hidden cause-and-effect correlation.

=== DATA STREAM ===

[MOOD & ENERGY]
${JSON.stringify(moodEntries.map(m => ({
  date: m.created_at,
  mood_1_to_10: m.mood_score,
  energy_1_to_5: m.energy_level,
  note_keywords: m.note ? m.note.substring(0, 50) : null // Shorten notes for token limits
})), null, 2)}

[MICRO-SIGNALS (Sleep, Focus Quality, Overwhelm)]
${JSON.stringify(interpretedBurnout, null, 2)}

[TASK EXECUTION]
${JSON.stringify(focusSummary, null, 2)}

=== INSTRUCTIONS ===
1. Look for TIME-LAGGED patterns (e.g., "Poor sleep on Monday causes low Mood on Tuesday").
2. Look for IMMEDIATE triggers (e.g., "High Overwhelm immediately precedes Failed Tasks").
3. Look for "WINNING CONDITIONS" (e.g., "When Sleep is GREAT, Task Success is 100%").

=== OUTPUT RULES ===
- If you find a negative pattern, phrase it as a gentle "Did you know?" observation, not a judgment.
- If you find a positive pattern, phrase it as a "Superpower" discovery.
- Keep the title punchy (max 6 words).
- Keep the message short (max 2 sentences).
- Use strictly valid JSON format.

JSON TEMPLATE:
{
  "type": "correlation", 
  "title": "Sleep impacts your Focus",
  "message": "When you sleep poorly, your focus is 'Distracted' 80% of the time the next day.",
  "icon": "😴"
}`
}

// ============================================
// Call Gemini
// ============================================
async function callGemini(apiKey: string, prompt: string): Promise<Insight | null> {
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        ],
      }),
    })

    if (!response.ok) {
      console.error('Gemini API returned', response.status)
      return null
    }

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Extract JSON from response (Gemini sometimes wraps in markdown fences)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      // Validate required fields
      if (parsed.title && parsed.message) {
        return {
          type: parsed.type || 'correlation',
          title: parsed.title,
          message: parsed.message,
          icon: parsed.icon || '🔍',
        }
      }
    }
  } catch (e) {
    console.error('Gemini insight error:', e)
  }
  return null
}

// ============================================
// Fallback when data is too sparse
// ============================================
function sparseDataFallback(): Insight {
  return {
    type: 'praise',
    title: 'Keep tracking!',
    message:
      "You're building your data trail — a few more days of check-ins and I'll spot patterns for you.",
    icon: '🌱',
  }
}

// ============================================
// Main Handler
// ============================================
export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  const supabase = getClient()

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    // Rate limit
    const ip = getClientIp(request)
    if (insightsRateLimiter.isLimited(ip)) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
    }

    // Auth
    const authHeader = request.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = authData.user.id
    const db = getServiceClient() || supabase

    // 1. Check cache — return existing insight if < 10 min old
    const cached = await fetchCachedInsight(db, userId)
    if (cached) {
      return NextResponse.json({ insight: cached, cached: true })
    }

    // 2. Gather last 14 days of data (in parallel)
    const [moodEntries, burnoutLogs, focusPlans] = await Promise.all([
      fetchRecentMoodEntries(db, userId),
      fetchRecentBurnoutLogs(db, userId),
      fetchRecentFocusPlans(db, userId),
    ])

    // 3. If data is too sparse, return a gentle nudge (don't save)
    const totalDataPoints = moodEntries.length + burnoutLogs.length + focusPlans.length
    if (totalDataPoints < 5) {
      const fallback = sparseDataFallback()
      return NextResponse.json({ insight: fallback, cached: false })
    }

    // 4. Call Gemini
    if (!apiKey) {
      const fallback = sparseDataFallback()
      return NextResponse.json({ insight: fallback, cached: false })
    }

    const prompt = buildInsightPrompt(moodEntries, burnoutLogs, focusPlans)
    const insight = await callGemini(apiKey, prompt)

    if (!insight) {
      const fallback = sparseDataFallback()
      return NextResponse.json({ insight: fallback, cached: false })
    }

    // 5. Save to user_insights and return with id
    const saved = await saveInsight(db, userId, insight)

    return NextResponse.json({
      insight: saved || insight,
      cached: false,
    })
  } catch (error) {
    console.error('Insights generate API error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}