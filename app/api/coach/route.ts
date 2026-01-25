// app/api/context-coach/route.ts
// Context-Aware Coach API Route
// Transforms AI from chatbot to long-term partner using historical context

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { buildUserContext } from '@/lib/userContext'

// If you already export generateContextualPrompt elsewhere, you can remove the local one below.
// This file includes an improved prompt generator + anti-wrapper prompt as requested.

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

// =======================
// Rate limiting (in-memory)
// =======================
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 30
const rateBucket = new Map<string, { count: number; resetAt: number }>()

// =======================
// Types (align these with your real UserContext shape)
// =======================
type MoodStreak =
  | { type: 'low_mood'; days: number }
  | { type: 'high_mood'; days: number }
  | { type: 'checking_in'; days: number }

type Pattern = { type: string; description: string }

type CheckIn = { mood_score: number; note?: string | null }

export type UserContext = {
  totalCheckIns: number
  averageMood: number
  currentStreak?: MoodStreak | null
  currentPattern?: Pattern | null
  comparedToBaseline: 'better' | 'same' | 'worse'
  lastCheckIn?: CheckIn | null
}

// =======================
// Supabase clients
// =======================
function getClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return null
  return createClient(supabaseUrl, supabaseAnonKey)
}

// Service-role client for server-side context reads (bypasses RLS)
// IMPORTANT: Never expose this key to the browser.
function getServiceClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return null
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// =======================
// Helpers
// =======================
function getIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const current = rateBucket.get(ip)
  if (!current || now > current.resetAt) {
    rateBucket.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return false
  }
  current.count += 1
  return current.count > RATE_MAX
}

function isValidMoodScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10
}

function clampText(input: string, maxLen: number): string {
  if (input.length <= maxLen) return input
  return input.slice(0, maxLen)
}

function safeSnippet(input: string, maxLen: number): string {
  // Light sanitisation for prompt context (don’t leak big blobs, keep it readable)
  const cleaned = input.replace(/\s+/g, ' ').trim()
  return clampText(cleaned, maxLen)
}

// ============================================
// IMPROVED PROMPT GENERATOR (with “anti-echo” support)
// ============================================
function generateContextualPrompt(context: UserContext, moodScore: number, noteText: string) {
  const insights: string[] = []
  let suggestedApproach: 'standard' | 'onboarding' | 'gentle_support' | 'celebrate_maintain' = 'standard'

  // 1) ANALYSE HISTORY
  if (context.totalCheckIns === 0) {
    insights.push("This is the user's first check-in. Welcome them warmly.")
    suggestedApproach = 'onboarding'
  } else {
    // Streak analysis
    if (context.currentStreak) {
      if (context.currentStreak.type === 'low_mood' && context.currentStreak.days >= 3) {
        insights.push(`CRITICAL: User is in a "Low Mood Cycle" (Day ${context.currentStreak.days}).`)
        suggestedApproach = 'gentle_support'
      } else if (context.currentStreak.type === 'high_mood') {
        insights.push(
          `User is on a "High Mood Streak" (${context.currentStreak.days} days). Help them bank this feeling.`
        )
        suggestedApproach = 'celebrate_maintain'
      } else if (context.currentStreak.type === 'checking_in') {
        insights.push(`Consistency Win: ${context.currentStreak.days}-day check-in streak.`)
      }
    }

    // Pattern recognition
    if (context.currentPattern) {
      insights.push(`Observed Pattern: ${context.currentPattern.description}`)
    }

    // Baseline comparison
    if (context.comparedToBaseline !== 'same') {
      const direction = context.comparedToBaseline === 'better' ? 'above' : 'below'
      insights.push(`Current State: Mood is ${direction} their historical baseline of ${context.averageMood}.`)
    }

    // Last session bridge (Object Permanence)
    if (context.lastCheckIn?.note) {
      const lastNote = context.lastCheckIn.note.trim()
      if (lastNote.length > 5) {
        insights.push(
          `Context from last time: They were feeling ${context.lastCheckIn.mood_score}/10 and mentioned "${safeSnippet(
            lastNote,
            60
          )}..."`
        )
      }
    }
  }

  // 2) SYSTEM PERSONA
  const systemContext = `ROLE: You are an expert ADHD coach who acts as an "External Executive Function" for the user. You prioritise pattern recognition over generic cheerleading.

USER PROFILE (The "Moat" Data):
- History: ${context.totalCheckIns} check-ins logged
- Baseline Mood: ${context.averageMood}/10
${insights.map((i) => `- ${i}`).join('\n')}`

  // 3) CURRENT SITUATION
  const moodChange = context.lastCheckIn ? moodScore - context.lastCheckIn.mood_score : 0
  const currentSituation = `CURRENT INPUT:
- Score: ${moodScore}/10
- Raw Text: "${noteText ? safeSnippet(noteText, 220) : '(no note provided)'}"
- Delta: ${moodChange > 0 ? '+' : ''}${moodChange} points from last entry
${moodScore <= 3 ? '- ALERT: High Dysregulation Risk. Reduce friction.' : ''}`

  // 4) STRATEGIC INSTRUCTION
  const approachInstructions: Record<string, string> = {
    standard: 'Connect the current mood to their recent history. Look for correlations.',
    onboarding: 'Focus on low-pressure welcome. Do not overwhelm with questions.',
    gentle_support:
      'Validate the difficulty of the streak. Do NOT suggest big tasks. Suggest one sensory reset (e.g., drink water, step outside).',
    celebrate_maintain: 'Help them bank this feeling. Ask them to name ONE driver they can repeat later.',
  }

  return {
    systemContext,
    currentSituation,
    suggestedApproach: approachInstructions[suggestedApproach] || approachInstructions.standard,
  }
}

// ============================================
// Context-aware fallback text (no model call)
// ============================================
function getContextAwareGenericAdvice(context: UserContext, moodScore: number): string {
  if (context.totalCheckIns === 0) {
    return "Good on you for starting this, even a quick check-in counts. If you’ve got nothing to write today, just pick one tiny comfort action (water, food, fresh air) and call that a win."
  }

  if (moodScore <= 3) {
    const streakBit =
      context.currentStreak?.type === 'low_mood' && context.currentStreak.days >= 2
        ? `This looks like it’s been a rough couple of days (${context.currentStreak.days} in a row). `
        : ''
    return `${streakBit}Keep it frictionless today, do one body-level reset first (drink water, step outside for 60 seconds), then reassess. Checking in while you feel like this is effort, it still counts.`
  }

  if (moodScore <= 5) {
    const baselineBit =
      context.comparedToBaseline === 'worse'
        ? `You’re a bit below your usual baseline (${context.averageMood}/10). `
        : ''
    return `${baselineBit}If you don’t have words right now, pick one small task you can finish in under 3 minutes and stop there. Momentum beats motivation on days like this.`
  }

  if (moodScore <= 7) {
    return `You’re in a steadier zone today, that’s useful. Choose one “annoying but important” thing and do the first 2 minutes only, just to lower the mental barrier.`
  }

  return `You’re running hot today, nice. Bank it by doing one quick thing Future You will thank you for (prep tomorrow’s first step, clear one tiny admin task), then stop before you burn it all.`
}

// ============================================
// MAIN API HANDLER
// ============================================
export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  const supabase = getClient()

  if (!apiKey) {
    console.error('GEMINI_API_KEY not configured')
    return NextResponse.json({ advice: getGenericAdvice(5) }, { status: 500 })
  }

  if (!supabase) {
    console.error('Supabase env not configured')
    return NextResponse.json({ advice: getGenericAdvice(5) }, { status: 500 })
  }

  try {
    const ip = getIp(request)
    if (isRateLimited(ip)) {
      return NextResponse.json({ advice: getGenericAdvice(5) }, { status: 429 })
    }

    // Auth: validate user from bearer token
    const authHeader = request.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return NextResponse.json({ advice: getGenericAdvice(5) }, { status: 401 })
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authData?.user) {
      return NextResponse.json({ advice: getGenericAdvice(5) }, { status: 401 })
    }
    const userId = authData.user.id

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const moodScore = body?.moodScore
    const note = body?.note

    if (!isValidMoodScore(moodScore)) {
      return NextResponse.json({ advice: getGenericAdvice(5) }, { status: 400 })
    }

    const noteTextRaw = typeof note === 'string' ? note : ''
    const noteText = noteTextRaw.trim()

    if (noteTextRaw.length > 1000) {
      return NextResponse.json({ advice: getGenericAdvice(moodScore) }, { status: 400 })
    }

    // Build Context (prefer service role for history reads, fallback to anon client)
    const serviceClient = getServiceClient()
    const contextClient = serviceClient || supabase
    const userContext = (await buildUserContext(contextClient, userId)) as UserContext

    // Quick returns for empty notes (keep them context-aware)
    if (noteText.length < 3 && userContext.totalCheckIns === 0) {
      // Onboarding return (no model call)
      return NextResponse.json({
        advice:
          "Nice one for starting, you don’t need to write loads. Give yourself a score, then do one tiny “make life easier” action (water, food, fresh air), and that’s enough for today.",
        context: {
          totalCheckIns: userContext.totalCheckIns,
          currentStreak: userContext.currentStreak ?? null,
          pattern: userContext.currentPattern?.type ?? null,
          comparedToBaseline: userContext.comparedToBaseline,
        },
      })
    }

    if (noteText.length < 3) {
      // Context-aware generic return (no model call)
      return NextResponse.json({
        advice: getContextAwareGenericAdvice(userContext, moodScore),
        context: {
          totalCheckIns: userContext.totalCheckIns,
          currentStreak: userContext.currentStreak ?? null,
          pattern: userContext.currentPattern?.type ?? null,
          comparedToBaseline: userContext.comparedToBaseline,
        },
      })
    }

    // =========================================================
    // THE NEW "ANTI-WRAPPER" PROMPT (prevents echoing typos)
    // =========================================================
    const contextualPrompt = generateContextualPrompt(userContext, moodScore, noteTextRaw)

    const prompt = `
${contextualPrompt.systemContext}

${contextualPrompt.currentSituation}

STRATEGY:
${contextualPrompt.suggestedApproach}

### CRITICAL RULES FOR INPUT SANITISATION (Do not skip):
1. **NO PARROTING:** If the user's text seems like a typo, fragment, or incoherent (e.g., "grand like", "tired ugh", "sdlfk"), **DO NOT quote it directly**.
   - BAD: "I see 'grand like' is on your mind."
   - GOOD: "It sounds like things are a bit unclear or weighing on you right now."
   - GOOD (if typo seems happy): "I’m picking up some good energy, even if the words are messy."
2. **INTERPRET INTENT:** If the text is short/unclear, prioritise the MOOD SCORE (${moodScore}/10) as your source of truth.
3. **OBJECT PERMANENCE:** If they mentioned a specific struggle in the *previous* session (see context), and they are low again, reference that connection.

### OUTPUT FORMAT:
- Write 2-3 short, warm sentences.
- **Sentence 1:** Validate their state using the Context (Streak/History) + Current Mood.
- **Sentence 2:** Offer a micro-observation or a tiny "frictionless" next step.
- Tone: UK English, casual, supportive (like a smart friend, not a medical textbook).
- NO emojis at start of sentences. NO bullet points.

Now respond:`

    // Call Gemini API
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7, // lowered to reduce hallucinations + echoing
          maxOutputTokens: 200,
        },
      }),
    })

    if (!response.ok) {
      console.error('Gemini API error:', response.status)
      return NextResponse.json({ advice: getGenericAdvice(moodScore) })
    }

    const data = await response.json().catch(() => null)
    const advice = data?.candidates?.[0]?.content?.parts?.[0]?.text

    if (!advice || typeof advice !== 'string') {
      return NextResponse.json({ advice: getGenericAdvice(moodScore) })
    }

    return NextResponse.json({
      advice: advice.trim(),
      context: {
        totalCheckIns: userContext.totalCheckIns,
        currentStreak: userContext.currentStreak ?? null,
        pattern: userContext.currentPattern?.type ?? null,
        comparedToBaseline: userContext.comparedToBaseline,
      },
    })
  } catch (error) {
    console.error('Coach API error:', error)
    return NextResponse.json({ advice: getGenericAdvice(5) }, { status: 500 })
  }
}

// =======================
// Generic advice fallback
// =======================
function getGenericAdvice(moodScore: number): string {
  if (moodScore <= 3) {
    return "I’m here with you during this hard moment. Sometimes just showing up to check in is the win, you did that today. What’s one tiny thing that might bring you a moment of comfort right now?"
  }
  if (moodScore <= 5) {
    return "Thanks for checking in, showing up matters, even when things feel flat. Share what’s going on and I can offer support tailored to your specific situation."
  }
  if (moodScore <= 7) {
    return "You’re in a steadier place right now, that’s worth noticing. Tell me what’s happening and I can help you make the most of this energy."
  }
  return "Good to see you feeling good. Share what’s contributing to this so we can spot the pattern and help you recreate it."
}