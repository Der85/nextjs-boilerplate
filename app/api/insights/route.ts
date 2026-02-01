// app/api/insights/route.ts
// Pattern Engine — Insight Generator
// Fetches 14 days of mood, burnout & focus data, sends to Gemini
// for a single actionable correlation, then caches it in user_insights.

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { insightsRateLimiter } from '@/lib/rateLimiter'

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

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
  type: 'correlation'
  title: string
  message: string
  icon: string
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
// Check for cached insight (< 24 hours old)
// ============================================
async function fetchCachedInsight(db: SupabaseClient, userId: string): Promise<Insight | null> {
  const oneDayAgo = new Date()
  oneDayAgo.setHours(oneDayAgo.getHours() - 24)

  const { data } = await db
    .from('user_insights')
    .select('type, title, message, icon')
    .eq('user_id', userId)
    .gte('created_at', oneDayAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)

  if (data && data.length > 0) {
    return data[0] as Insight
  }
  return null
}

// ============================================
// Save insight to DB
// ============================================
async function saveInsight(db: SupabaseClient, userId: string, insight: Insight) {
  const now = new Date()
  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - 14)

  await db.from('user_insights').insert({
    user_id: userId,
    type: insight.type,
    title: insight.title,
    message: insight.message,
    icon: insight.icon,
    data_window_start: windowStart.toISOString().split('T')[0],
    data_window_end: now.toISOString().split('T')[0],
  })
}

// ============================================
// Build the Gemini prompt
// ============================================
function buildInsightPrompt(
  moodEntries: any[],
  burnoutLogs: any[],
  focusPlans: any[]
): string {
  // Summarise focus plans into completed/failed counts
  const focusSummary = focusPlans.map((p) => {
    let completed = 0
    let failed = 0
    try {
      const tasks = typeof p.tasks === 'string' ? JSON.parse(p.tasks) : p.tasks
      if (Array.isArray(tasks)) {
        tasks.forEach((t: any) => {
          if (t.completed || t.status === 'completed') completed++
          else failed++
        })
      }
    } catch {
      // ignore parse errors
    }
    return {
      date: p.created_at,
      status: p.status,
      tasks_completed: completed,
      tasks_failed: failed,
    }
  })

  return `You are an ADHD wellness data analyst. Below is 14 days of data from an ADHD user's self-tracking app.

=== MOOD CHECK-INS ===
${JSON.stringify(moodEntries.map(m => ({
  date: m.created_at,
  mood: m.mood_score,
  energy: m.energy_level,
  note: m.note,
})), null, 2)}

=== BURNOUT MICRO-SIGNALS ===
${JSON.stringify(burnoutLogs.map(b => ({
  date: b.created_at,
  source: b.source,
  sleep: b.sleep_quality,
  focus_difficulty: b.focus_difficulty,
  overwhelm: b.overwhelm,
  energy: b.energy_level,
  tension: b.physical_tension,
  motivation: b.motivation,
})), null, 2)}

=== FOCUS SESSIONS ===
${JSON.stringify(focusSummary, null, 2)}

YOUR TASK:
Find ONE specific, actionable correlation in this data.  Look for patterns like:
- "On days you sleep < X, your focus difficulty jumps by Y"
- "Your mood drops the day after high-overwhelm evenings"
- "You complete more tasks on days you check in with higher energy"
- "Your overwhelm spikes mid-week — Tuesdays and Wednesdays are your hardest days"

RULES:
1. Only cite a pattern you can see in the actual data — do NOT fabricate.
2. If the data is too sparse for a real correlation, say so honestly with a gentle nudge to keep tracking.
3. Keep the message under 2 sentences, written warmly for someone with ADHD.
4. Pick an emoji icon that matches the insight topic (sleep=😴, focus=🧠, mood=🌤️, energy=⚡, stress=🫠, general=🔍).

RESPOND with valid JSON only — no markdown fences:
{"type":"correlation","title":"short title (max 8 words)","message":"1-2 sentence insight","icon":"emoji"}`
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
    type: 'correlation',
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

    // 1. Check cache — return existing insight if < 24h old
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

    // 3. If data is too sparse, return a gentle nudge
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

    // 5. Save to user_insights for caching
    await saveInsight(db, userId, insight)

    return NextResponse.json({ insight, cached: false })
  } catch (error) {
    console.error('Insights API error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
