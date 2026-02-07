// app/api/focus-coach/route.ts
// AI-Powered Focus Coach API
// Parses brain dumps into tasks and generates ADHD-friendly micro-step breakdowns

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { focusRateLimiter } from '@/lib/rateLimiter'

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

// Environment validation warning (logged once at module load)
if (!process.env.GEMINI_API_KEY) {
  console.warn('[focus-coach] GEMINI_API_KEY not configured - AI features will use fallback logic')
}

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
// Supabase Client
// ============================================
function getClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return null
  return createClient(supabaseUrl, supabaseAnonKey)
}

// ============================================
// Types
// ============================================
interface FocusCoachRequest {
  action: 'parse' | 'breakdown'
  text?: string
  taskName?: string
  dueDate?: string
  energyLevel?: string
}

interface ParsedTask {
  id: string
  text: string
}

interface MicroStep {
  id: string
  text: string
  dueBy: string
  timeEstimate: string
}

// ============================================
// Parse Result Type (explicit success/error)
// ============================================
interface ParseResult {
  tasks: ParsedTask[]
  aiUsed: boolean
  fallbackReason?: 'no_api_key' | 'api_error' | 'parse_error' | 'rate_limited'
}

// ============================================
// Parse Brain Dump (AI)
// ============================================
async function parseBrainDump(apiKey: string | undefined, text: string): Promise<ParseResult> {
  // If no API key, return immediately with fallback flag
  if (!apiKey) {
    return {
      tasks: createManualFallbackTasks(text),
      aiUsed: false,
      fallbackReason: 'no_api_key',
    }
  }

  const prompt = `You're an ADHD coach helping someone organize their thoughts.

The user just did a "brain dump" — a messy stream of consciousness about what's on their mind.

BRAIN DUMP TEXT:
"${text}"

INSTRUCTIONS:
1. Extract distinct, actionable tasks or goals from this text
2. Clean up the wording to be clear and specific
3. Ignore filler words, emotions, or non-actionable statements
4. Keep the user's intent — don't add tasks they didn't mention
5. Return 1-8 tasks maximum (combine related items)

RESPOND with valid JSON array only:
[{"id":"task_1", "text":"clear task description"}, {"id":"task_2", "text":"another task"}]`

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 400 },
      }),
    })

    if (!response.ok) {
      console.error('AI API failed with status:', response.status)
      return {
        tasks: createManualFallbackTasks(text),
        aiUsed: false,
        fallbackReason: response.status === 429 ? 'rate_limited' : 'api_error',
      }
    }

    const data = await response.json()
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const tasks = JSON.parse(jsonMatch[0])
      return { tasks, aiUsed: true }
    }

    // AI returned but couldn't parse response
    console.error('Could not parse AI response:', responseText.slice(0, 200))
    return {
      tasks: createManualFallbackTasks(text),
      aiUsed: false,
      fallbackReason: 'parse_error',
    }
  } catch (e) {
    console.error('Error parsing brain dump:', e)
    return {
      tasks: createManualFallbackTasks(text),
      aiUsed: false,
      fallbackReason: 'api_error',
    }
  }
}

// ============================================
// Smarter Fallback Task Creation
// ============================================
function createManualFallbackTasks(text: string): ParsedTask[] {
  // Split by sentence endings, newlines, or "and"
  // But be smarter about it - prefer newlines and periods over commas
  const lines = text
    .split(/[\n]/)  // First split by newlines
    .flatMap(line => line.split(/[.!?]+/))  // Then by sentence endings
    .map(s => s.trim())
    .filter(s => s.length > 5 && !s.match(/^(and|but|or|so|also|maybe|i think|i need to|i should)$/i))
    .slice(0, 8)

  // If we only got 0-1 lines, the whole text might be one task
  if (lines.length <= 1 && text.length > 5) {
    return [{
      id: 'task_1',
      text: text.trim().slice(0, 200),
    }]
  }

  return lines.map((line, i) => ({
    id: `task_${i + 1}`,
    text: line.charAt(0).toUpperCase() + line.slice(1).slice(0, 200),
  }))
}

// ============================================
// Generate Breakdown with Timestamps (AI)
// ============================================
async function generateBreakdown(
  apiKey: string,
  taskName: string,
  dueDate: string,
  energyLevel: string
): Promise<MicroStep[]> {
  const now = new Date()
  const currentHour = now.getHours()
  const timeOfDay = currentHour < 12 ? 'morning' : currentHour < 17 ? 'afternoon' : 'evening'

  let deadlineContext = ''
  if (dueDate === 'today') {
    deadlineContext = `Due TODAY. Current time: ${timeOfDay}. Suggest steps that fit within the remaining hours today.`
  } else if (dueDate === 'tomorrow') {
    deadlineContext = 'Due TOMORROW. Suggest steps spread across tomorrow with reasonable pacing.'
  } else if (dueDate === 'this_week') {
    deadlineContext = 'Due THIS WEEK. Spread steps across multiple days with natural breaks.'
  } else {
    deadlineContext = 'No hard deadline. Suggest a relaxed pace, a step or two per day.'
  }

  const energyContext = energyLevel === 'low'
    ? 'User energy is LOW — steps must be very small and gentle. First step should be trivially easy.'
    : energyLevel === 'high'
      ? 'User energy is HIGH — can handle more substantial steps, but still keep them focused.'
      : 'User energy is MODERATE — balance between challenge and manageability.'

  const prompt = `You're an ADHD coach creating a micro-step plan for a task.

TASK: "${taskName}"

CONTEXT:
- ${deadlineContext}
- ${energyContext}

ADHD-FRIENDLY PRINCIPLES:
1. Each step should take 5-15 minutes MAX
2. First step must be embarrassingly easy (reduce activation energy)
3. Steps should be concrete and specific (not vague)
4. Include natural "reward" or "check" moments between steps
5. Vary the effort level so there are easy wins mixed in

Generate 3-5 micro-steps with estimated completion times.

RESPOND with valid JSON array only:
[{"id":"step_1", "text":"specific action", "dueBy":"suggested time like '2:00 PM' or 'Morning'", "timeEstimate":"X min"}]`

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 500 },
      }),
    })

    if (!response.ok) throw new Error('API failed')

    const data = await response.json()
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.error('Error generating breakdown:', e)
  }

  // Fallback
  return [
    { id: 'step_1', text: 'Write down the very first tiny action for this task', dueBy: 'Now', timeEstimate: '2 min' },
    { id: 'step_2', text: 'Gather any materials or info you need', dueBy: 'Next', timeEstimate: '5 min' },
    { id: 'step_3', text: 'Set a 10-minute timer and start the smallest piece', dueBy: 'After that', timeEstimate: '10 min' },
  ]
}

// ============================================
// Main API Handler
// ============================================
export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  const supabase = getClient()

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  try {
    const ip = getClientIp(request)
    if (focusRateLimiter.isLimited(ip)) {
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

    const body = (await request.json()) as FocusCoachRequest

    switch (body.action) {
      case 'parse': {
        if (!body.text || body.text.trim().length < 3) {
          return NextResponse.json({ error: 'Text required' }, { status: 400 })
        }

        const sanitizedText = body.text.trim().slice(0, 2000)
        const result = await parseBrainDump(apiKey, sanitizedText)

        // Return tasks with explicit error flags so UI can handle gracefully
        return NextResponse.json({
          tasks: result.tasks,
          aiUsed: result.aiUsed,
          fallbackReason: result.fallbackReason,
        })
      }

      case 'breakdown': {
        if (!body.taskName) {
          return NextResponse.json({ error: 'Task name required' }, { status: 400 })
        }

        const steps = apiKey
          ? await generateBreakdown(
              apiKey,
              body.taskName.trim().slice(0, 500),
              body.dueDate || 'no_rush',
              body.energyLevel || 'medium'
            )
          : [
              { id: 'step_1', text: 'Write down the very first tiny action', dueBy: 'Now', timeEstimate: '2 min' },
              { id: 'step_2', text: 'Gather what you need', dueBy: 'Next', timeEstimate: '5 min' },
              { id: 'step_3', text: 'Set a timer and start', dueBy: 'After that', timeEstimate: '10 min' },
            ]

        return NextResponse.json({ steps })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Focus coach API error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
