// app/api/goals-coach/route.ts
// AI-Powered Goals Coach API
// Integrates with mood, energy, and stuck sessions to provide smart goal support

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { buildUserContext } from '@/lib/userContext'
import { goalsRateLimiter } from '@/lib/rateLimiter'

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
interface GoalsCoachRequest {
  action: 'breakdown' | 'suggest_next' | 'celebrate' | 'adjust' | 'context_check'
  goalId?: string
  goalTitle?: string
  goalDescription?: string
  currentProgress?: number
  timeZone?: string
}

interface MicroStep {
  id: string
  text: string
  timeEstimate: string
  energyLevel: 'low' | 'medium' | 'high'
  completed: boolean
}

// ============================================
// Fetch User's Energy State
// ============================================
async function fetchEnergyState(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('burnout_logs')
    .select('severity_level, total_score, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (data && data.length > 0) {
    const hoursSince = (Date.now() - new Date(data[0].created_at).getTime()) / (1000 * 60 * 60)
    return {
      level: data[0].severity_level as 'green' | 'yellow' | 'red',
      score: data[0].total_score,
      hoursAgo: Math.round(hoursSince),
      isRecent: hoursSince < 24
    }
  }
  return null
}

// ============================================
// Fetch User's Active Goals
// ============================================
async function fetchActiveGoals(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('goals')
    .select('id, title, description, progress_percent, micro_steps, created_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(10)

  return data || []
}

// ============================================
// Fetch Recent Stuck Sessions Related to Goals
// ============================================
async function fetchGoalRelatedStuck(supabase: SupabaseClient, userId: string, goalTitle: string) {
  // Look for ally sessions where the block might relate to this goal
  const { data } = await supabase
    .from('ally_sessions')
    .select('block_type, drill_sergeant_thought, micro_action, challenge_before, challenge_after')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  // Simple keyword matching to find related sessions
  const keywords = goalTitle.toLowerCase().split(' ').filter(w => w.length > 3)
  const related = (data || []).filter(session => {
    const text = `${session.drill_sergeant_thought} ${session.micro_action}`.toLowerCase()
    return keywords.some(k => text.includes(k))
  })

  return related.slice(0, 3)
}

// ============================================
// Generate Goal Breakdown (AI)
// ============================================
async function generateGoalBreakdown(
  apiKey: string,
  goalTitle: string,
  goalDescription: string | null,
  userContext: any,
  energyState: any
): Promise<MicroStep[]> {
  const energyContext = energyState?.isRecent
    ? `Current energy: ${energyState.level} (${energyState.level === 'red' ? 'low - suggest very small steps' : energyState.level === 'yellow' ? 'moderate - balance effort' : 'good - can handle more'})`
    : 'Energy level unknown'

  const moodContext = userContext?.recentAverageMood
    ? `Recent mood: ${userContext.recentAverageMood}/10`
    : ''

  const prompt = `You're an ADHD coach helping break down a goal into micro-steps.

GOAL: ${goalTitle}
${goalDescription ? `DETAILS: ${goalDescription}` : ''}

USER CONTEXT:
- ${energyContext}
- ${moodContext}
- Total check-ins: ${userContext?.totalCheckIns || 0}
${userContext?.currentStreak?.type === 'low_mood' ? '- ⚠️ User has been in a low mood streak - suggest VERY gentle first steps' : ''}

ADHD-FRIENDLY PRINCIPLES:
1. Each step should take 5-15 minutes MAX
2. First step should be embarrassingly easy (reduce activation energy)
3. Include "body double" or accountability options where relevant
4. Vary energy levels so they have options based on how they feel
5. Make steps concrete and specific (not vague)

Generate 5-7 micro-steps for this goal.

RESPOND with valid JSON array only:
[{"id":"step_1", "text":"specific action", "timeEstimate":"X min", "energyLevel":"low|medium|high", "completed":false}]`

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 600 },
      }),
    })

    if (!response.ok) throw new Error('API failed')

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.error('Error generating breakdown:', e)
  }

  // Fallback
  return [
    { id: 'step_1', text: 'Write down ONE specific thing you want to accomplish', timeEstimate: '2 min', energyLevel: 'low', completed: false },
    { id: 'step_2', text: 'Gather any materials or information you need', timeEstimate: '5 min', energyLevel: 'low', completed: false },
    { id: 'step_3', text: 'Set a 10-minute timer and start the smallest piece', timeEstimate: '10 min', energyLevel: 'medium', completed: false },
  ]
}

// ============================================
// Types for Enhanced Suggestions
// ============================================
interface EnhancedSuggestion {
  goalId: string | null
  goalTitle: string | null
  suggestion: string
  reason: string
  timeEstimate: string
  effortLevel: 'low' | 'medium' | 'high'
  url: string
}

// ============================================
// Effort Level Matching Based on Mood
// ============================================
function getEffortBandForMood(mood: number): ('low' | 'medium' | 'high')[] {
  if (mood <= 5) return ['low']
  if (mood <= 6) return ['low', 'medium']
  if (mood <= 7) return ['medium']
  if (mood <= 8) return ['medium', 'high']
  return ['high']
}

// ============================================
// Suggest Next Action Based on Context (Enhanced)
// ============================================
async function suggestNextAction(
  apiKey: string,
  goals: any[],
  userContext: any,
  energyState: any,
  moodScore: number,
  excludeIds: string[] = []
): Promise<EnhancedSuggestion[]> {
  const suggestions: EnhancedSuggestion[] = []
  const energyLevel = energyState?.level || 'unknown'
  const mood = moodScore || userContext?.recentAverageMood || 6
  const effortBand = getEffortBandForMood(mood)
  const timeOfDay = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'

  // Filter goals not in excludeIds
  const availableGoals = goals.filter(g => !excludeIds.includes(g.id))

  if (!availableGoals.length && !goals.length) {
    return []
  }

  const prompt = `You're an ADHD coach helping someone decide what to work on RIGHT NOW.

THEIR ACTIVE GOALS:
${(availableGoals.length ? availableGoals : goals).map((g, i) => `${i + 1}. "${g.title}" - ${g.progress_percent}% complete${g.micro_steps ? ` (has ${Array.isArray(g.micro_steps) ? g.micro_steps.filter((s: any) => !s.completed).length : 0} pending steps)` : ''}`).join('\n')}

CURRENT STATE:
- Energy level: ${energyLevel}
- Current mood: ${mood}/10
- Time of day: ${timeOfDay}
- Suitable effort levels: ${effortBand.join(' or ')}
${userContext?.currentStreak?.type === 'low_mood' ? '- ⚠️ Low mood streak - suggest gentlest option' : ''}

Generate 3 task suggestions ranked by best fit for their current state.
Each suggestion should:
1. Be specific and actionable (can start in the next 2 minutes)
2. Match their energy/effort capacity (${effortBand.join('/')})
3. Include a realistic time estimate
4. Include a short, honest reason (1 sentence max)

RESPOND with valid JSON array only:
[{"goalIndex": 0, "suggestion": "specific action", "reason": "short reason", "timeEstimate": "~X min", "effortLevel": "low|medium|high"}]`

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 400 },
      }),
    })

    if (response.ok) {
      const data = await response.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''

      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const results = JSON.parse(jsonMatch[0])
        const goalsToUse = availableGoals.length ? availableGoals : goals

        for (const result of results) {
          const goal = goalsToUse[result.goalIndex] || goalsToUse[0]
          suggestions.push({
            goalId: goal?.id || null,
            goalTitle: goal?.title || null,
            suggestion: result.suggestion,
            reason: result.reason,
            timeEstimate: result.timeEstimate || '~10 min',
            effortLevel: result.effortLevel || 'medium',
            url: goal ? `/focus?create=true&taskName=${encodeURIComponent(result.suggestion)}&goalId=${goal.id}` : `/focus?create=true&taskName=${encodeURIComponent(result.suggestion)}`
          })
        }
      }
    }
  } catch (e) {
    console.error('Error suggesting next action:', e)
  }

  // Fallback suggestions if AI fails
  if (suggestions.length === 0) {
    const goal = (availableGoals.length ? availableGoals : goals)[0]
    suggestions.push({
      goalId: goal?.id || null,
      goalTitle: goal?.title || null,
      suggestion: 'Pick the easiest next step and do just that',
      reason: 'Starting small builds momentum',
      timeEstimate: '~5 min',
      effortLevel: 'low',
      url: goal ? `/focus?create=true&taskName=Quick%20step&goalId=${goal.id}` : '/focus'
    })
    if (goal) {
      suggestions.push({
        goalId: goal.id,
        goalTitle: goal.title,
        suggestion: 'Review your goal and pick one tiny action',
        reason: 'Next up on your list',
        timeEstimate: '~10 min',
        effortLevel: 'low',
        url: `/goals`
      })
    }
    suggestions.push({
      goalId: null,
      goalTitle: null,
      suggestion: 'Clear one small thing from your mind',
      reason: 'Quick win to build momentum',
      timeEstimate: '~5 min',
      effortLevel: 'low',
      url: '/focus'
    })
  }

  return suggestions.slice(0, 3)
}

// ============================================
// Generate Celebration Message
// ============================================
async function generateCelebration(
  apiKey: string,
  goalTitle: string,
  userContext: any
): Promise<string> {
  const prompt = `You're an ADHD coach celebrating a user completing a goal.

COMPLETED GOAL: "${goalTitle}"

USER CONTEXT:
- Total check-ins: ${userContext?.totalCheckIns || 0}
- This shows real follow-through!

Write a SHORT (2-3 sentences) warm celebration message that:
1. Acknowledges the specific achievement
2. Notes what this says about them (persistence, not just luck)
3. Suggests they savor this feeling

Keep it genuine, not cheesy. UK English, casual tone.`

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 150 },
      }),
    })

    if (response.ok) {
      const data = await response.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
      if (text) return text.trim()
    }
  } catch (e) {
    console.error('Error generating celebration:', e)
  }

  return `You did it! "${goalTitle}" is complete. This took real persistence—take a moment to feel that.`
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
    if (goalsRateLimiter.isLimited(ip)) {
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
    const body = (await request.json()) as GoalsCoachRequest

    // Get context
    const serviceClient = getServiceClient()
    const contextClient = serviceClient || supabase
    const userContext = await buildUserContext(contextClient, userId, body.timeZone)
    const energyState = await fetchEnergyState(contextClient, userId)

    switch (body.action) {
      case 'breakdown': {
        if (!body.goalTitle) {
          return NextResponse.json({ error: 'Goal title required' }, { status: 400 })
        }

        const steps = apiKey
          ? await generateGoalBreakdown(apiKey, body.goalTitle, body.goalDescription || null, userContext, energyState)
          : [
              { id: 'step_1', text: 'Write down the first tiny action', timeEstimate: '2 min', energyLevel: 'low' as const, completed: false },
              { id: 'step_2', text: 'Gather what you need', timeEstimate: '5 min', energyLevel: 'low' as const, completed: false },
              { id: 'step_3', text: 'Set a timer and start', timeEstimate: '10 min', energyLevel: 'medium' as const, completed: false },
            ]

        return NextResponse.json({ steps })
      }

      case 'suggest_next': {
        const goals = await fetchActiveGoals(contextClient, userId)
        const moodScore = (body as any).moodScore || userContext?.recentAverageMood || 6
        const excludeIds = (body as any).excludeIds || []

        if (!goals.length) {
          // Still provide suggestions even without goals
          const fallbackSuggestions: EnhancedSuggestion[] = [
            {
              goalId: null,
              goalTitle: null,
              suggestion: 'Start with one tiny thing on your mind',
              reason: 'Getting started is the hardest part',
              timeEstimate: '~5 min',
              effortLevel: 'low',
              url: '/focus'
            },
            {
              goalId: null,
              goalTitle: null,
              suggestion: 'Plant a goal seed for something you care about',
              reason: "You don't have any active goals yet",
              timeEstimate: '~3 min',
              effortLevel: 'low',
              url: '/goals'
            }
          ]
          return NextResponse.json({
            suggestions: fallbackSuggestions,
            energyState: energyState ? { level: energyState.level, isRecent: energyState.isRecent } : null,
            mood: moodScore,
            effortBand: getEffortBandForMood(moodScore)
          })
        }

        const suggestions = apiKey
          ? await suggestNextAction(apiKey, goals, userContext, energyState, moodScore, excludeIds)
          : [
              {
                goalId: goals[0].id,
                goalTitle: goals[0].title,
                suggestion: 'Pick the easiest next step and do just that',
                reason: 'Starting small builds momentum',
                timeEstimate: '~5 min',
                effortLevel: 'low' as const,
                url: `/focus?create=true&taskName=Quick%20step&goalId=${goals[0].id}`
              }
            ]

        return NextResponse.json({
          suggestions,
          // Legacy field for backwards compatibility
          suggestion: suggestions[0] || null,
          energyState: energyState ? { level: energyState.level, isRecent: energyState.isRecent } : null,
          mood: moodScore,
          effortBand: getEffortBandForMood(moodScore)
        })
      }

      case 'celebrate': {
        if (!body.goalTitle) {
          return NextResponse.json({ error: 'Goal title required' }, { status: 400 })
        }

        const message = apiKey
          ? await generateCelebration(apiKey, body.goalTitle, userContext)
          : `You completed "${body.goalTitle}"! That took real persistence. Take a moment to feel proud.`

        return NextResponse.json({ message })
      }

      case 'context_check': {
        // Return current context for the goals page
        const goals = await fetchActiveGoals(contextClient, userId)
        
        let contextMessage = null
        if (userContext?.currentStreak?.type === 'low_mood' && userContext.currentStreak.days >= 2) {
          contextMessage = "I notice you've been having a tough stretch. Be extra gentle with yourself on goal progress today."
        } else if (energyState?.level === 'red' && energyState.isRecent) {
          contextMessage = "Your energy is low right now. Consider focusing on your smallest, easiest goal step."
        } else if (energyState?.level === 'green' && energyState.isRecent && userContext?.recentAverageMood >= 7) {
          contextMessage = "You're in a good zone! This might be a great time to tackle something you've been putting off."
        }

        return NextResponse.json({
          goals,
          energyState: energyState ? { level: energyState.level, isRecent: energyState.isRecent } : null,
          mood: userContext?.recentAverageMood,
          contextMessage,
          streak: userContext?.currentStreak
        })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Goals coach API error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
