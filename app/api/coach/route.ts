// Secured Coach API Route
// Authentication + Rate Limiting to protect Gemini API key

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

// ===========================================
// Rate Limiting (in-memory, per-user)
// ===========================================
const RATE_WINDOW_MS = 60_000  // 1 minute
const RATE_MAX_REQUESTS = 20   // 20 requests per minute per user
const rateBucket = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const bucket = rateBucket.get(userId)
  
  if (!bucket || now > bucket.resetAt) {
    rateBucket.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return false
  }
  
  bucket.count += 1
  return bucket.count > RATE_MAX_REQUESTS
}

// Clean up old buckets periodically (prevent memory leak)
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of rateBucket.entries()) {
    if (now > bucket.resetAt) {
      rateBucket.delete(key)
    }
  }
}, 60_000)

// ===========================================
// Supabase Client
// ===========================================
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!url || !anonKey) return null
  return createClient(url, anonKey)
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
// Generic Advice (fallback)
// ===========================================
function getGenericAdvice(moodScore: number): string {
  if (moodScore <= 3) {
    return "It's okay to have hard days—your feelings are valid. Try sharing what's on your mind next time so I can give you more personalized support."
  }
  if (moodScore <= 5) {
    return "Thanks for checking in—showing up matters. If you share what's going on, I can offer advice tailored to your situation."
  }
  if (moodScore <= 7) {
    return "You're in a steady place right now—that's worth acknowledging. Tell me more about what's happening and I can help you make the most of it."
  }
  return "Love to see you feeling good! Share what's contributing to this so we can help you recreate it."
}

// ===========================================
// Main Handler
// ===========================================
export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  
  // 1. Check API key is configured
  if (!apiKey) {
    console.error('GEMINI_API_KEY not configured')
    return NextResponse.json({ advice: getGenericAdvice(5) })
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
    if (isRateLimited(user.id)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        { status: 429 }
      )
    }

    // 5. VALIDATE INPUT
    const body = await request.json()
    const { moodScore, note } = body

    if (!isValidMoodScore(moodScore)) {
      return NextResponse.json(
        { error: 'Invalid mood score' },
        { status: 400 }
      )
    }

    const sanitizedNote = sanitizeNote(note)

    // 6. If no note provided, return generic advice (save API calls)
    if (!sanitizedNote || sanitizedNote.length < 3) {
      return NextResponse.json({ advice: getGenericAdvice(moodScore) })
    }

    // 7. Build prompt for Gemini
    const prompt = `You are a warm, experienced ADHD coach responding to a client's daily check-in.

Current check-in:
- Mood: ${moodScore}/10
- What they shared: "${sanitizedNote}"

Guidelines for your response:
1. Be warm and validating - acknowledge their feelings first
2. Keep it brief (2-3 sentences max)
3. If mood is low (1-4), focus on compassion and one tiny doable step
4. If mood is medium (5-7), acknowledge progress and suggest building on it
5. If mood is high (8-10), celebrate and help them notice what's working
6. Reference specific things they mentioned
7. Use "you" language, not "I suggest" or "you should"
8. End with something actionable but low-pressure

Respond directly as the coach (no intro like "Here's my response"):`

    // 8. Call Gemini API
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
      return NextResponse.json({ advice: getGenericAdvice(moodScore) })
    }

    const geminiData = await geminiResponse.json()
    const advice = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text

    if (!advice) {
      console.error('Unexpected Gemini response format')
      return NextResponse.json({ advice: getGenericAdvice(moodScore) })
    }

    return NextResponse.json({ advice: advice.trim() })

  } catch (error) {
    console.error('Coach API error:', error)
    return NextResponse.json({ advice: getGenericAdvice(5) })
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
