Here is the complete, updated `route.ts` file. You can copy and paste this directly to replace your existing file.

This version includes the **Input Sanitization** logic to fix the "echoing typos" issue and the **Context Engine** to ensure the AI acts as a long-term partner.

```typescript
// app/api/coach/route.ts
// Context-Aware Coach API Route
// Transforms AI from chatbot to long-term partner using historical context

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

// Rate limiting configuration
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 30
const rateBucket = new Map<string, { count: number; resetAt: number }>()

// ============================================
// HELPER FUNCTIONS & TYPES
// ============================================

interface MoodEntry {
  id: string
  user_id: string
  mood_score: number
  note: string | null
  coach_advice: string | null
  created_at: string
}

interface UserContext {
  totalCheckIns: number
  averageMood: number
  lastCheckIn: MoodEntry | null
  daysSinceLastCheckIn: number
  recentEntries: MoodEntry[]
  recentAverageMood: number
  currentStreak: { type: string; days: number } | null
  currentPattern: { type: string; description: string; daysAffected: number } | null
  recurringThemes: string[]
  comparedToBaseline: 'better' | 'worse' | 'same'
  baselineDifference: number
}

function getClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return null
  return createClient(supabaseUrl, supabaseAnonKey)
}

// Get client with service role (bypasses RLS for server-side queries)
function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return null
  return createClient(supabaseUrl, serviceRoleKey)
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

// ============================================
// CONTEXT ENGINE
// Builds the "Long-Term Memory" for the AI
// ============================================

async function buildUserContext(supabase: any, userId: string): Promise<UserContext> {
  console.log('[Context] Building context for user:', userId)
  
  // Fetch mood history (Last 30 entries)
  const { data: entries, error } = await supabase
    .from('mood_entries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) {
    console.error('[Context] Error fetching mood history:', error)
  }

  // Default context for new users or errors
  if (!entries || entries.length === 0) {
    return {
      totalCheckIns: 0,
      averageMood: 0,
      lastCheckIn: null,
      daysSinceLastCheckIn: -1,
      recentEntries: [],
      recentAverageMood: 0,
      currentStreak: null,
      currentPattern: null,
      recurringThemes: [],
      comparedToBaseline: 'same',
      baselineDifference: 0
    }
  }

  const lastCheckIn = entries[0]
  const recentEntries = entries.slice(0, 7)
  const allScores = entries.map((e: MoodEntry) => e.mood_score)
  const recentScores = recentEntries.map((e: MoodEntry) => e.mood_score)
  
  const averageMood = allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length
  const recentAverageMood = recentScores.reduce((a: number, b: number) => a + b, 0) / recentScores.length
  
  // Calculate days since last check-in
  const daysSinceLastCheckIn = Math.floor(
    (Date.now() - new Date(lastCheckIn.created_at).getTime()) / (1000 * 60 * 60 * 24)
  )

  // Calculate streak (consecutive days)
  let streak = 1
  for (let i = 1; i < entries.length; i++) {
    const curr = new Date(entries[i - 1].created_at)
    const prev = new Date(entries[i].created_at)
    const diff = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
    if (diff <= 1) streak++
    else break
  }

  // Check for low mood streak
  let lowMoodStreak = 0
  for (const entry of recentEntries) {
    if (entry.mood_score <= 4) lowMoodStreak++
    else break
  }

  // Check for high mood streak
  let highMoodStreak = 0
  for (const entry of recentEntries) {
    if (entry.mood_score >= 7) highMoodStreak++
    else break
  }

  // Determine current streak type
  let currentStreak: UserContext['currentStreak'] = null
  if (lowMoodStreak >= 3) {
    currentStreak = { type: 'low_mood', days: lowMoodStreak }
  } else if (highMoodStreak >= 3) {
    currentStreak = { type: 'high_mood', days: highMoodStreak }
  } else if (streak >= 2) {
    currentStreak = { type: 'checking_in', days: streak }
  }

  // Detect patterns
  let currentPattern: UserContext['currentPattern'] = null
  if (lowMoodStreak >= 3) {
    currentPattern = {
      type: 'streak_low',
      description: `${lowMoodStreak} consecutive days with mood at 4 or below`,
      daysAffected: lowMoodStreak
    }
  } else if (highMoodStreak >= 3) {
    currentPattern = {
      type: 'streak_high',
      description: `${highMoodStreak} consecutive days with mood at 7 or above`,
      daysAffected: highMoodStreak
    }
  } else if (recentScores.length >= 3 && recentScores[0] < recentScores[1] && recentScores[1] < recentScores[2]) {
    currentPattern = {
      type: 'declining',
      description: 'Mood has been declining over the past few days',
      daysAffected: 3
    }
  } else if (recentScores.length >= 3 && recentScores[0] > recentScores[1] && recentScores[1] > recentScores[2]) {
    currentPattern = {
      type: 'improving',
      description: 'Mood has been improving over the past few days',
      daysAffected: 3
    }
  }

  // Extract recurring themes from notes
  const entriesWithNotes = entries.filter((e: MoodEntry) => e.note && e.note.trim().length > 0)
  const themes: string[] = []
  
  const themePatterns = [
    { pattern: /work|job|boss|deadline|meeting/i, theme: 'work' },
    { pattern: /overwhelm|too much|swamp/i, theme: 'overwhelm' },
    { pattern: /anxi|worry|stress/i, theme: 'anxiety' },
    { pattern: /tired|exhaust|sleep/i, theme: 'fatigue' },
    { pattern: /focus|distract|concentrate/i, theme: 'focus' },
    { pattern: /procrastinat|avoid|putting off/i, theme: 'procrastination' },
    { pattern: /eat|food|hungry|diet/i, theme: 'diet/food' },
  ]
  
  const themeCounts: Record<string, number> = {}
  entriesWithNotes.forEach((entry: MoodEntry) => {
    themePatterns.forEach(({ pattern, theme }) => {
      if (pattern.test(entry.note!)) {
        themeCounts[theme] = (themeCounts[theme] || 0) + 1
      }
    })
  })
  
  Object.entries(themeCounts)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .forEach(([theme]) => themes.push(theme))

  // Compare to baseline
  const baselineDifference = recentAverageMood - averageMood
  const comparedToBaseline: UserContext['comparedToBaseline'] = 
    baselineDifference > 0.5 ? 'better' : 
    baselineDifference < -0.5 ? 'worse' : 'same'

  return {
    totalCheckIns: entries.length,
    averageMood: Math.round(averageMood * 10) / 10,
    lastCheckIn,
    daysSinceLastCheckIn,
    recentEntries,
    recentAverageMood: Math.round(recentAverageMood * 10) / 10,
    currentStreak,
    currentPattern,
    recurringThemes: themes,
    comparedToBaseline,
    baselineDifference: Math.round(baselineDifference * 10) / 10
  }
}

// ============================================
// PROMPT GENERATOR
// Includes "Sanitization" and "Persona" logic
// ============================================

function generateContextualPrompt(context: UserContext, moodScore: number, noteText: string) {
  const insights: string[] = []
  let suggestedApproach = 'standard'

  // 1. ANALYZE HISTORY
  if (context.totalCheckIns === 0) {
    insights.push("This is the user's first check-in. Welcome them warmly.")
    suggestedApproach = 'onboarding'
  } else {
    // Streak Analysis
    if (context.currentStreak) {
      if (context.currentStreak.type === 'low_mood' && context.currentStreak.days >= 3) {
        insights.push(`CRITICAL: User is in a "Low Mood Cycle" (Day ${context.currentStreak.days}).`)
        suggestedApproach = 'gentle_support'
      } else if (context.currentStreak.type === 'high_mood') {
        insights.push(`User is on a "High Mood Streak" (${context.currentStreak.days} days). Help them bank this feeling.`)
        suggestedApproach = 'celebrate_maintain'
      } else if (context.currentStreak.type === 'checking_in') {
        insights.push(`Consistency Win: ${context.currentStreak.days}-day check-in streak.`)
      }
    }

    // Pattern Recognition
    if (context.currentPattern) {
      insights.push(`Observed Pattern: ${context.currentPattern.description}`)
    }

    // Baseline Comparison
    if (context.comparedToBaseline !== 'same') {
      const direction = context.comparedToBaseline === 'better' ? 'above' : 'below'
      insights.push(`Current State: Mood is ${direction} their historical baseline of ${context.averageMood}.`)
    }
    
    // Last Session Bridge (Object Permanence)
    if (context.lastCheckIn && context.lastCheckIn.note) {
      // Only reference note if it was substantial
      if (context.lastCheckIn.note.length > 5) {
         // Truncate for prompt safety
         const safeNote = context.lastCheckIn.note.slice(0, 100).replace(/\n/g, " ");
         insights.push(`Context from last time: They were feeling ${context.lastCheckIn.mood_score}/10 and mentioned "${safeNote}..."`)
      }
    }
    
    // Recurring Themes
    if (context.recurringThemes.length > 0) {
      insights.push(`Common themes for this user: ${context.recurringThemes.join(', ')}`)
    }
  }

  // 2. DEFINE SYSTEM PERSONA
  const systemContext = `ROLE: You are an expert ADHD coach who acts as an "External Executive Function" for the user. You prioritize pattern recognition over generic cheerleading. You speak UK English.
  
USER PROFILE (The "Moat" Data):
- History: ${context.totalCheckIns} check-ins logged
- Baseline Mood: ${context.averageMood}/10
${insights.map(i => `- ${i}`).join('\n')}`

  // 3. DEFINE CURRENT SITUATION
  const moodChange = context.lastCheckIn 
    ? moodScore - context.lastCheckIn.mood_score 
    : 0
  
  const currentSituation = `
CURRENT INPUT:
- Score: ${moodScore}/10
- Raw Text: "${noteText || '(no note provided)'}"
- Delta: ${moodChange > 0 ? '+' : ''}${moodChange} points from last entry
${moodScore <= 3 ? '- ALERT: High Dysregulation Risk. Reduce friction.' : ''}`

  // 4. STRATEGIC INSTRUCTION
  const approachInstructions: Record<string, string> = {
    standard: 'Connect the current mood to their recent history. Look for correlations.',
    onboarding: 'Focus on low-pressure welcome. Do not overwhelm with questions. Establish trust.',
    gentle_support: 'Validate the difficulty of the streak. Do NOT suggest big tasks. Suggest one sensory reset (e.g., drink water, step outside).',
    celebrate_maintain: 'Ask them to identify ONE thing that made this happen, so they can replicate it later.',
  }

  return {
    systemContext,
    currentSituation,
    suggestedApproach: approachInstructions[suggestedApproach] || approachInstructions.standard
  }
}

// ============================================
// MAIN API HANDLER
// ============================================

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
      console.error('No auth token provided')
      return NextResponse.json({ advice: getGenericAdvice(5) }, { status: 401 })
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authData?.user) {
      console.error('Auth error:', authError)
      return NextResponse.json({ advice: getGenericAdvice(5) }, { status: 401 })
    }

    const userId = authData.user.id
    console.log('[API] Processing request for user:', userId)

    // Parse request body
    const { moodScore, note } = await request.json()
    if (!isValidMoodScore(moodScore)) {
      return NextResponse.json({ advice: getGenericAdvice(5) }, { status: 400 })
    }

    const noteText = typeof note === 'string' ? note : ''
    
    // Validate note length
    if (noteText.length > 1000) {
      return NextResponse.json({ advice: getGenericAdvice(moodScore) }, { status: 400 })
    }

    // ============================================
    // BUILD USER CONTEXT
    // Use service client to bypass RLS for history lookup
    // ============================================
    const serviceClient = getServiceClient()
    const contextClient = serviceClient || supabase
    const userContext = await buildUserContext(contextClient, userId)
    
    // Handle First Time User (No note)
    if (noteText.trim().length < 3 && userContext.totalCheckIns === 0) {
      return NextResponse.json({ 
        advice: "Welcome to ADHDer.io! I'm here to support you on your journey. Each time you check in, I'll learn more about your patterns and be able to give you more personalized advice. Try adding a note about what's on your mind for more tailored support.",
        context: {
          totalCheckIns: 0,
          currentStreak: null,
          pattern: null,
          comparedToBaseline: 'same'
        }
      })
    }
    
    // Handle Standard User (No note) - Use Contextual Generic
    if (noteText.trim().length < 3) {
      const contextAwareGeneric = getContextAwareGenericAdvice(moodScore, userContext)
      return NextResponse.json({ 
        advice: contextAwareGeneric,
        context: {
          totalCheckIns: userContext.totalCheckIns,
          currentStreak: userContext.currentStreak,
          pattern: userContext.currentPattern?.type || null,
          comparedToBaseline: userContext.comparedToBaseline
        }
      })
    }

    // =========================================================
    // GENERATE AI PROMPT
    // =========================================================
    
    const contextualPrompt = generateContextualPrompt(userContext, moodScore, noteText)

    const prompt = `
${contextualPrompt.systemContext}

${contextualPrompt.currentSituation}

STRATEGY:
${contextualPrompt.suggestedApproach}

### CRITICAL RULES FOR INPUT SANITIZATION (Do not skip):
1. **NO PARROTING:** If the user's text seems like a typo, fragment, or incoherent (e.g., "grand like", "tired ugh", "sdlfk"), **DO NOT quote it directly**.
   - BAD: "I see 'grand like' is on your mind."
   - GOOD: "It sounds like things are a bit unclear or weighing on you right now."
   - GOOD (if typo seems happy): "I sense some good energy despite the typo!"
2. **INTERPRET INTENT:** If the text is short/unclear, prioritize the MOOD SCORE (${moodScore}/10) as your source of truth.
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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7, // Reduced temperature to prevent hallucinations on typos
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

    return NextResponse.json({ 
      advice: advice.trim(),
      context: {
        totalCheckIns: userContext.totalCheckIns,
        currentStreak: userContext.currentStreak,
        pattern: userContext.currentPattern?.type || null,
        comparedToBaseline: userContext.comparedToBaseline
      }
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ advice: getGenericAdvice(5) })
  }
}

// ============================================
// FALLBACK ADVICE GENERATORS
// ============================================

function getContextAwareGenericAdvice(moodScore: number, context: UserContext): string {
  // If they have a low mood streak
  if (context.currentStreak?.type === 'low_mood') {
    return `I see this has been day ${context.currentStreak.days} of a tough stretch. That's real, and I'm here with you. Even logging this check-in when things are hard shows you're showing up for yourself. Share what's weighing on you when you're ready—I'm listening.`
  }

  // If they have a high mood streak
  if (context.currentStreak?.type === 'high_mood') {
    return `${context.currentStreak.days} good days in a row—that's momentum worth noticing! Whatever you've been doing differently seems to be working. Jot down what's contributing to this so you can come back to it.`
  }

  // If mood is declining vs their baseline
  if (context.comparedToBaseline === 'worse') {
    return `I've noticed your mood has been a bit lower than your usual ${context.averageMood}/10 lately. That's okay—everyone has waves. Adding a quick note about what's going on helps me give you more specific support.`
  }

  // If mood is improving
  if (context.comparedToBaseline === 'better') {
    return `Your mood has been trending up lately—you're averaging above your baseline. That's worth celebrating. Tell me what's been different so we can capture the pattern.`
  }

  // Default context-aware responses based on mood score
  if (moodScore <= 3) {
    return `Thanks for checking in even when things are rough. With ${context.totalCheckIns} check-ins, I'm learning your patterns. Share what's happening and I can offer support that's specific to you.`
  }
  if (moodScore <= 5) {
    return `A ${moodScore} today—showing up matters. You've checked in ${context.totalCheckIns} times now, which helps me understand your rhythms. Add a note about what's on your mind for more tailored advice.`
  }
  if (moodScore <= 7) {
    return `Steady at ${moodScore}/10. You've got ${context.totalCheckIns} check-ins logged, so I'm getting to know your patterns. Share what's working today and I can help you build on it.`
  }
  return `Love seeing you at ${moodScore}/10! With ${context.totalCheckIns} check-ins, I can see when you thrive. Tell me what's contributing to this energy so we can recreate it.`
}

function getGenericAdvice(moodScore: number): string {
  if (moodScore <= 3) {
    return "I'm here with you during this hard moment. Sometimes just showing up to check in is the win—you did that today."
  }
  if (moodScore <= 5) {
    return "Thanks for checking in—showing up matters, even when things feel meh. Share what's going on and I can offer support tailored to your specific situation."
  }
  if (moodScore <= 7) {
    return "You're in a steady place right now—that's worth acknowledging. Tell me what's happening and I can help you make the most of this energy."
  }
  return "Love to see you feeling good! Share what's contributing to this so we can help you notice the patterns and recreate it."
}

```