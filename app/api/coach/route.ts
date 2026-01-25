// Context-Aware Coach API Route
// Transforms AI from chatbot to long-term partner using historical context

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildUserContext, generateContextualPrompt } from '@/lib/userContext'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

// Rate limiting
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 30
const rateBucket = new Map<string, { count: number; resetAt: number }>()

function getClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return null
  return createClient(supabaseUrl, supabaseAnonKey)
}

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

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  const supabase = getClient()

  if (!apiKey) {
    console.error('GEMINI_API_KEY not configured')
    return NextResponse.json({ advice: getGenericAdvice(5) })
  }

  try {
    if (!supabase) {
      console.error('Supabase env not configured')
      return NextResponse.json({ advice: getGenericAdvice(5) }, { status: 500 })
    }

    const ip = getIp(request)
    if (isRateLimited(ip)) {
      return NextResponse.json({ advice: getGenericAdvice(5) }, { status: 429 })
    }

    // Get auth token and validate user
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
    const { moodScore, note } = await request.json()
    if (!isValidMoodScore(moodScore)) {
      return NextResponse.json({ advice: getGenericAdvice(5) }, { status: 400 })
    }

    const noteText = typeof note === 'string' ? note : ''
    
    // If no note provided, return generic advice
    if (noteText.trim().length < 3) {
      return NextResponse.json({ advice: getGenericAdvice(moodScore) })
    }
    if (noteText.length > 1000) {
      return NextResponse.json({ advice: getGenericAdvice(moodScore) }, { status: 400 })
    }

    // ============================================
    // CONTEXT-AWARE RAG: Build user context
    // ============================================
    const userContext = await buildUserContext(supabase, userId)
    const contextualPrompt = generateContextualPrompt(userContext, moodScore, noteText)

    // ============================================
    // Build the enhanced prompt with full context
    // ============================================
    const prompt = `${contextualPrompt.systemContext}

${contextualPrompt.currentSituation}

YOUR APPROACH:
${contextualPrompt.suggestedApproach}

RESPONSE GUIDELINES:
1. Your response MUST reference specific details from their history OR their current note
2. First sentence: Acknowledge their specific situation using what you KNOW about them
3. Second sentence: Give ONE practical micro-tip relevant to their exact situation
4. Be warm but concise (2-3 sentences max)
5. No emojis, no bullet points, no generic advice
6. NEVER say "How have you been?" or ask questions you should already know the answer to
7. Reference patterns you've noticed when relevant (e.g., "I noticed you've been feeling low the past few days...")

EXAMPLES OF CONTEXT-AWARE RESPONSES:

If user has 3-day low mood streak and mentions work stress:
"Three tough days in a row dealing with work pressure is a lot, especially for an ADHD brain that's already working overtime. For today, try the '2-minute rule'—just commit to 2 minutes on the most dreaded task, then give yourself full permission to stop."

If user is improving after a rough patch:
"This is the third day in a row your mood has lifted—that's real momentum building. Whatever you've been doing differently this week, it's worth noticing and writing down so you can return to it next time things get hard."

If user mentions the same recurring theme:
"This is the third time in two weeks you've mentioned [theme]—it seems like this is really weighing on you. Sometimes naming a pattern helps: what would change if we tackled this specific thing head-on?"

Now respond to this check-in with your context-aware coaching:`

    // ============================================
    // Call Gemini API
    // ============================================
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: 200,
        }
      })
    })

    if (!response.ok) {
      console.error('Gemini API error:', response.status)
      return NextResponse.json({ advice: getGenericAdvice(moodScore) })
    }

    const data = await response.json()
    const advice = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!advice) {
      return NextResponse.json({ advice: getGenericAdvice(moodScore) })
    }

    // Return the context-aware advice along with some metadata
    return NextResponse.json({ 
      advice: advice.trim(),
      // Include context metadata for frontend use (optional)
      context: {
        totalCheckIns: userContext.totalCheckIns,
        currentStreak: userContext.currentStreak,
        pattern: userContext.currentPattern?.type || null,
        comparedToBaseline: userContext.comparedToBaseline
      }
    })

  } catch (error) {
    console.error('Gemini API error:', error)
    return NextResponse.json({ advice: getGenericAdvice(5) })
  }
}

function getGenericAdvice(moodScore: number): string {
  if (moodScore <= 3) {
    return "I'm here with you during this hard moment. Sometimes just showing up to check in is the win—you did that today. What's one tiny thing that might bring you a moment of comfort right now?"
  }
  if (moodScore <= 5) {
    return "Thanks for checking in—showing up matters, even when things feel meh. Share what's going on and I can offer support tailored to your specific situation."
  }
  if (moodScore <= 7) {
    return "You're in a steady place right now—that's worth acknowledging. Tell me what's happening and I can help you make the most of this energy."
  }
  return "Love to see you feeling good! Share what's contributing to this so we can help you notice the patterns and recreate it."
}
