import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

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

    const authHeader = request.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return NextResponse.json({ advice: getGenericAdvice(5) }, { status: 401 })
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authData?.user) {
      return NextResponse.json({ advice: getGenericAdvice(5) }, { status: 401 })
    }

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

    const prompt = `You are a warm, experienced ADHD coach responding to a client's check-in.

THEIR CHECK-IN:
- Mood: ${moodScore}/10
- What they shared: "${noteText}"

YOUR TASK:
Respond with EXACTLY 2 sentences that directly address what they specifically shared. 

CRITICAL RULES:
1. Your response MUST reference the specific situation, feelings, or details they mentioned
2. First sentence: Validate their specific experience (use their words/situation)
3. Second sentence: Give ONE practical micro-tip relevant to their exact situation
4. Be warm but concise
5. No emojis, no bullet points, no generic advice
6. Do NOT give advice that could apply to anyone - make it specific to what they wrote

BAD EXAMPLE (too generic): "It sounds like you're having a tough time. Try taking a few deep breaths."
GOOD EXAMPLE (specific): "Dealing with a boss who keeps changing priorities is exhausting, especially when your ADHD brain was already working hard to stay on track. Before your next interaction with them, jot down your top 2 non-negotiables so you have an anchor when things shift again."

Respond now with your 2 personalized sentences:`

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
          temperature: 0.9,
          maxOutputTokens: 150,
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

    return NextResponse.json({ advice: advice.trim() })
  } catch (error) {
    console.error('Gemini API error:', error)
    return NextResponse.json({ advice: getGenericAdvice(5) })
  }
}

function getGenericAdvice(moodScore: number): string {
  if (moodScore <= 3) {
    return "under 3, no response"
  }
  if (moodScore <= 5) {
    return "under 5, no response"
  }
  if (moodScore <= 7) {
    return "under 7, no response"
  }
  return "over 7, no response"
}
