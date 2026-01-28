// app/api/stuck-coach/route.ts
// AI-Powered "I'm Stuck" Coach API
// Integrates with user context to provide dynamic, personalized unsticking support

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { buildUserContext } from '@/lib/userContext'

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

// ============================================
// Rate Limiting
// ============================================
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 20
const rateBucket = new Map<string, { count: number; resetAt: number }>()

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
interface StuckCoachRequest {
  step: 'initial' | 'block_selected' | 'reframe' | 'action'
  stuckLevel?: number
  selectedBlock?: string
  customBlock?: string
  selectedThought?: string
  customThought?: string
}

interface BlockSuggestion {
  id: string
  label: string
  description: string
  icon: string
  isAIGenerated: boolean
}

interface ReframeSuggestion {
  harshVoice: string
  kindVoice: string
  affirmation: string
}

interface ActionSuggestion {
  id: string
  text: string
  why: string
  timeEstimate: string
  difficulty: 'easy' | 'medium'
}

// ============================================
// Fetch Recent Ally Sessions
// ============================================
async function fetchRecentAllySessions(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 10
) {
  const { data, error } = await supabase
    .from('ally_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching ally sessions:', error)
    return []
  }
  return data || []
}

// ============================================
// Fetch Active Commitments
// ============================================
async function fetchActiveCommitments(
  supabase: SupabaseClient,
  userId: string
) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  
  const { data, error } = await supabase
    .from('stuck_commitments')
    .select('*')
    .eq('user_id', userId)
    .eq('completed', false)
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    // Table might not exist yet, that's okay
    return []
  }
  return data || []
}

// ============================================
// Generate Personalized Blocks (Step 1)
// ============================================
async function generatePersonalizedBlocks(
  apiKey: string,
  userContext: any,
  allySessions: any[]
): Promise<BlockSuggestion[]> {
  // Static blocks as fallback and base
  const staticBlocks: BlockSuggestion[] = [
    { id: 'initiation', label: 'Getting started', description: "Can't begin the task", icon: '🚀', isAIGenerated: false },
    { id: 'focus', label: 'Staying focused', description: 'Mind keeps wandering', icon: '🎯', isAIGenerated: false },
    { id: 'motivation', label: 'Finding motivation', description: "Don't see the point", icon: '💪', isAIGenerated: false },
    { id: 'overwhelm', label: 'Feeling overwhelmed', description: 'Too much to handle', icon: '🌊', isAIGenerated: false },
    { id: 'decision', label: 'Making decisions', description: "Can't choose what to do", icon: '🤔', isAIGenerated: false },
  ]

  // If no context, return static
  if (!userContext || userContext.totalCheckIns < 3) {
    return staticBlocks
  }

  // Build context for AI
  const recentThemes = userContext.recurringThemes?.slice(0, 3) || []
  const recentPattern = userContext.currentPattern
  const recentBlocks = allySessions.slice(0, 5).map((s: any) => s.block_type)
  
  // If user has patterns, ask AI to suggest personalized blocks
  const contextSummary = `
USER PATTERNS:
- Recent mood: ${userContext.recentAverageMood}/10
- Pattern: ${recentPattern?.description || 'none detected'}
- Themes from notes: ${recentThemes.map((t: any) => t.theme).join(', ') || 'none yet'}
- Recent stuck-on: ${recentBlocks.join(', ') || 'nothing recorded'}
- Last check-in note: "${userContext.lastCheckIn?.note?.slice(0, 100) || 'none'}"
`

  const prompt = `You're analyzing an ADHD user's patterns to suggest what might be blocking them RIGHT NOW.

${contextSummary}

Based on their recent patterns, generate 2 PERSONALIZED block suggestions that feel specific to THEIR situation (not generic). Each should have:
- id: snake_case identifier
- label: 3-5 words
- description: One short sentence about THIS user's specific struggle
- icon: Single emoji

RESPOND ONLY with valid JSON array, no markdown:
[{"id":"...", "label":"...", "description":"...", "icon":"..."}]

Keep it real and specific to what you see in their data. If they've been overwhelmed at work, name that. If sleep is an issue, name that.`

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
      }),
    })

    if (!response.ok) {
      return staticBlocks
    }

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    // Parse JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const aiBlocks = JSON.parse(jsonMatch[0]) as BlockSuggestion[]
      // Mark as AI generated and add to beginning
      const personalized = aiBlocks.map(b => ({ ...b, isAIGenerated: true }))
      return [...personalized, ...staticBlocks.slice(0, 3)]
    }
  } catch (e) {
    console.error('Error generating personalized blocks:', e)
  }

  return staticBlocks
}

// ============================================
// Generate Personalized Reframe (Step 3)
// ============================================
async function generatePersonalizedReframe(
  apiKey: string,
  userContext: any,
  selectedBlock: string,
  customThought?: string
): Promise<ReframeSuggestion> {
  const defaultReframe: ReframeSuggestion = {
    harshVoice: customThought || "Why can't you just do this like everyone else?",
    kindVoice: "Your brain works differently—not wrongly. This challenge is about neurology, not character.",
    affirmation: "I'm doing the best I can with the brain I have."
  }

  if (!apiKey) return defaultReframe

  // Build context about what the user struggles with
  const recentThemes = userContext?.recurringThemes?.filter((t: any) => t.sentiment === 'negative').slice(0, 2) || []
  const pattern = userContext?.currentPattern

  const prompt = `You're an ADHD coach helping someone reframe their inner critic.

CONTEXT:
- They're stuck on: ${selectedBlock}
- The harsh voice says: "${customThought || 'Why can\'t I just do this?'}"
- Their recent struggles: ${recentThemes.map((t: any) => t.theme).join(', ') || 'typical ADHD challenges'}
- Pattern: ${pattern?.description || 'none detected'}

Generate a compassionate reframe that:
1. Acknowledges the specific struggle (not generic platitudes)
2. Connects it to ADHD neurology (executive function, dopamine, working memory)
3. Offers a grounded affirmation they can actually believe

RESPOND with valid JSON only:
{
  "harshVoice": "the critical thought they had",
  "kindVoice": "2-3 sentences of compassionate truth, specific to their situation",
  "affirmation": "A short, grounded statement they can repeat (not cheesy)"
}`

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 300 },
      }),
    })

    if (!response.ok) return defaultReframe

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const reframe = JSON.parse(jsonMatch[0]) as ReframeSuggestion
      return {
        harshVoice: reframe.harshVoice || defaultReframe.harshVoice,
        kindVoice: reframe.kindVoice || defaultReframe.kindVoice,
        affirmation: reframe.affirmation || defaultReframe.affirmation
      }
    }
  } catch (e) {
    console.error('Error generating reframe:', e)
  }

  return defaultReframe
}

// ============================================
// Generate Personalized Actions (Step 4)
// ============================================
async function generatePersonalizedActions(
  apiKey: string,
  userContext: any,
  selectedBlock: string,
  allySessions: any[]
): Promise<ActionSuggestion[]> {
  const staticActions: ActionSuggestion[] = [
    { id: 'timer', text: 'Set a 5-minute timer and just begin', why: 'Starting is the hardest part', timeEstimate: '5 min', difficulty: 'easy' },
    { id: 'tiny_step', text: 'Write down the very first tiny step', why: 'Clarity reduces overwhelm', timeEstimate: '2 min', difficulty: 'easy' },
    { id: 'location', text: 'Move to a different location', why: 'Change of scene can help', timeEstimate: '1 min', difficulty: 'easy' },
    { id: 'body_double', text: "Text a friend you're about to start", why: 'Accountability helps', timeEstimate: '1 min', difficulty: 'easy' },
    { id: 'easiest', text: 'Do the easiest part first', why: 'Build momentum with a quick win', timeEstimate: '10 min', difficulty: 'medium' },
  ]

  if (!apiKey || !userContext || userContext.totalCheckIns < 3) {
    return staticActions
  }

  // Look at what's worked before
  const successfulSessions = allySessions.filter((s: any) => 
    s.challenge_before && s.challenge_after && s.challenge_after < s.challenge_before
  )
  const previousActions = successfulSessions.map((s: any) => s.micro_action).slice(0, 3)

  // Get positive themes (what's worked)
  const positiveThemes = userContext.recurringThemes?.filter((t: any) => t.sentiment === 'positive') || []

  const prompt = `You're an ADHD coach suggesting micro-actions for someone who's stuck.

CONTEXT:
- They're stuck on: ${selectedBlock}
- Current mood: ${userContext.recentAverageMood}/10
- What's worked before: ${previousActions.join(', ') || 'no data yet'}
- Positive patterns: ${positiveThemes.map((t: any) => t.theme).join(', ') || 'none identified'}
- Time of day: ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}

Generate 3 PERSONALIZED micro-actions that:
1. Are TINY (under 10 minutes, ideally under 5)
2. Match their ${selectedBlock} block specifically
3. Reference what's worked for them if we have data
4. Are concrete and actionable (not vague)

RESPOND with valid JSON array only:
[{"id":"snake_case", "text":"the action", "why":"one sentence why this helps", "timeEstimate":"X min", "difficulty":"easy|medium"}]`

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 400 },
      }),
    })

    if (!response.ok) return staticActions

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const aiActions = JSON.parse(jsonMatch[0]) as ActionSuggestion[]
      // Combine AI suggestions with some static fallbacks
      return [...aiActions, ...staticActions.slice(0, 2)]
    }
  } catch (e) {
    console.error('Error generating actions:', e)
  }

  return staticActions
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
    const ip = getIp(request)
    if (isRateLimited(ip)) {
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
    const body = (await request.json()) as StuckCoachRequest

    // Get user context
    const serviceClient = getServiceClient()
    const contextClient = serviceClient || supabase
    const userContext = await buildUserContext(contextClient, userId)
    const allySessions = await fetchRecentAllySessions(contextClient, userId)
    const activeCommitments = await fetchActiveCommitments(contextClient, userId)

    // Handle different steps
    switch (body.step) {
      case 'initial': {
        // Return personalized blocks and any active commitments
        const blocks = apiKey 
          ? await generatePersonalizedBlocks(apiKey, userContext, allySessions)
          : [
              { id: 'initiation', label: 'Getting started', description: "Can't begin the task", icon: '🚀', isAIGenerated: false },
              { id: 'focus', label: 'Staying focused', description: 'Mind keeps wandering', icon: '🎯', isAIGenerated: false },
              { id: 'motivation', label: 'Finding motivation', description: "Don't see the point", icon: '💪', isAIGenerated: false },
              { id: 'overwhelm', label: 'Feeling overwhelmed', description: 'Too much to handle', icon: '🌊', isAIGenerated: false },
              { id: 'decision', label: 'Making decisions', description: "Can't choose what to do", icon: '🤔', isAIGenerated: false },
            ]

        // Build context-aware greeting
        let greeting = "What's getting in the way?"
        if (userContext.currentStreak?.type === 'low_mood' && userContext.currentStreak.days >= 2) {
          greeting = "I can see it's been a tough stretch. What feels stuck right now?"
        } else if (activeCommitments.length > 0) {
          greeting = `Before we dive in: you committed to "${activeCommitments[0].action_text}" earlier. Did that happen?`
        } else if (userContext.daysSinceLastCheckIn > 3) {
          greeting = "Welcome back. What's blocking you today?"
        }

        return NextResponse.json({
          blocks,
          greeting,
          activeCommitments: activeCommitments.slice(0, 1),
          context: {
            recentMood: userContext.recentAverageMood,
            totalCheckIns: userContext.totalCheckIns,
            streak: userContext.currentStreak
          }
        })
      }

      case 'block_selected': {
        // Generate inner critic thoughts based on the block
        const selectedBlock = body.selectedBlock || body.customBlock || 'getting started'
        
        // Generate personalized harsh thoughts based on user's patterns
        const defaultThoughts = [
          "Why can't you just do it like everyone else?",
          "You're so lazy. Just try harder.",
          "You always mess things up.",
          "You should have started this ages ago.",
          "What's wrong with you?",
        ]

        // If we have context, personalize
        let thoughts = defaultThoughts
        if (apiKey && userContext.totalCheckIns >= 3) {
          const recentNotes = userContext.recentEntries
            ?.filter((e: any) => e.note && e.mood_score <= 5)
            .map((e: any) => e.note)
            .slice(0, 3) || []

          if (recentNotes.length > 0) {
            // Try to extract self-critical language from their own notes
            const prompt = `Based on these mood journal entries from someone with ADHD:
${recentNotes.map((n: string) => `"${n.slice(0, 100)}"`).join('\n')}

What self-critical thoughts might they have when stuck on ${selectedBlock}?
Generate 3 realistic inner critic statements that sound like THEIR voice (based on their notes), plus 2 common ADHD ones.

RESPOND with valid JSON array of 5 strings only:
["thought 1", "thought 2", ...]`

            try {
              const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }],
                  generationConfig: { temperature: 0.8, maxOutputTokens: 200 },
                }),
              })

              if (response.ok) {
                const data = await response.json()
                const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
                const jsonMatch = text.match(/\[[\s\S]*\]/)
                if (jsonMatch) {
                  thoughts = JSON.parse(jsonMatch[0])
                }
              }
            } catch (e) {
              console.error('Error generating thoughts:', e)
            }
          }
        }

        return NextResponse.json({ thoughts })
      }

      case 'reframe': {
        const reframe = apiKey
          ? await generatePersonalizedReframe(
              apiKey,
              userContext,
              body.selectedBlock || 'getting started',
              body.selectedThought || body.customThought
            )
          : {
              harshVoice: body.selectedThought || "Why can't you just do it?",
              kindVoice: "Your brain works differently—not wrongly. This challenge is about neurology, not character.",
              affirmation: "I'm doing the best I can with the brain I have."
            }

        return NextResponse.json({ reframe })
      }

      case 'action': {
        const actions = apiKey
          ? await generatePersonalizedActions(
              apiKey,
              userContext,
              body.selectedBlock || 'getting started',
              allySessions
            )
          : [
              { id: 'timer', text: 'Set a 5-minute timer and just begin', why: 'Starting is the hardest part', timeEstimate: '5 min', difficulty: 'easy' as const },
              { id: 'tiny_step', text: 'Write down the very first tiny step', why: 'Clarity reduces overwhelm', timeEstimate: '2 min', difficulty: 'easy' as const },
              { id: 'location', text: 'Move to a different location', why: 'Change of scene can help', timeEstimate: '1 min', difficulty: 'easy' as const },
            ]

        return NextResponse.json({ actions })
      }

      default:
        return NextResponse.json({ error: 'Invalid step' }, { status: 400 })
    }
  } catch (error) {
    console.error('Stuck coach API error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
