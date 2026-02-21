// app/api/weekly-review/generate/route.ts
// Generates an AI-powered weekly review for the most recently completed week

import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { weeklyReviewRateLimiter } from '@/lib/rateLimiter'
import { GEMINI_MODEL } from '@/lib/ai/gemini'
import type {
  WeeklyReview,
  WeeklyReviewAIResponse,
  UserPriority,
  BalanceScoreTrendDirection,
} from '@/lib/types'

// ============================================
// Date Utilities
// ============================================
function getLastWeekRange(): { weekStart: string; weekEnd: string } {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0 = Sunday, 1 = Monday, etc.

  // Find last Monday
  const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const lastMonday = new Date(now)
  lastMonday.setDate(now.getDate() - daysToLastMonday - 7)
  lastMonday.setHours(0, 0, 0, 0)

  // Find last Sunday (6 days after last Monday)
  const lastSunday = new Date(lastMonday)
  lastSunday.setDate(lastMonday.getDate() + 6)

  return {
    weekStart: lastMonday.toISOString().split('T')[0],
    weekEnd: lastSunday.toISOString().split('T')[0],
  }
}

function isValidGenerationDay(): boolean {
  const dayOfWeek = new Date().getDay()
  // Monday = 1, Tuesday = 2, Wednesday = 3
  return dayOfWeek >= 1 && dayOfWeek <= 3
}

function inDateRange(dateStr: string, startStr: string, endStr: string): boolean {
  const date = new Date(dateStr)
  const start = new Date(startStr)
  const end = new Date(endStr)
  end.setHours(23, 59, 59, 999) // Include full end day
  return date >= start && date <= end
}

// ============================================
// Data Gathering Functions
// ============================================
interface TaskForReview {
  id: string
  title: string
  status: string
  category_id: string | null
  is_recurring: boolean
  recurring_streak: number
  created_at: string
  updated_at: string
  completed_at: string | null
  dropped_at: string | null
  skipped_at: string | null
  category: { id: string; name: string; icon: string; color: string } | null
}

async function getTasksForWeek(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  weekStart: string,
  weekEnd: string
): Promise<TaskForReview[]> {
  // Get tasks that were either created or updated during the week
  const { data } = await supabase
    .from('tasks')
    .select('id, title, status, category_id, is_recurring, recurring_streak, created_at, updated_at, completed_at, dropped_at, skipped_at, category:categories(id, name, icon, color)')
    .eq('user_id', userId)
    .or(`created_at.gte.${weekStart},updated_at.gte.${weekStart}`)
    .lte('created_at', `${weekEnd}T23:59:59.999Z`)
    .order('created_at', { ascending: true })

  return ((data || []) as unknown as TaskForReview[]).map(task => ({
    ...task,
    category: Array.isArray(task.category) ? task.category[0] || null : task.category,
  }))
}

async function getBalanceScoresForWeek(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  weekStart: string,
  weekEnd: string
): Promise<{ score: number; computed_for_date: string }[]> {
  const { data } = await supabase
    .from('balance_scores')
    .select('score, computed_for_date')
    .eq('user_id', userId)
    .gte('computed_for_date', weekStart)
    .lte('computed_for_date', weekEnd)
    .order('computed_for_date', { ascending: true })

  return data || []
}

async function getUserPriorities(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<UserPriority[]> {
  const { data } = await supabase
    .from('user_priorities')
    .select('*')
    .eq('user_id', userId)
    .order('rank', { ascending: true })

  return (data || []) as UserPriority[]
}

async function getSuggestionsForWeek(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  weekStart: string,
  weekEnd: string
): Promise<{ accepted: number; dismissed: number; pending: number }> {
  const { data } = await supabase
    .from('task_suggestions')
    .select('status')
    .eq('user_id', userId)
    .gte('created_at', weekStart)
    .lte('created_at', `${weekEnd}T23:59:59.999Z`)

  const suggestions = data || []
  return {
    accepted: suggestions.filter(s => s.status === 'accepted').length,
    dismissed: suggestions.filter(s => s.status === 'dismissed').length,
    pending: suggestions.filter(s => s.status === 'pending').length,
  }
}

async function getInsightsForWeek(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  weekStart: string,
  weekEnd: string
): Promise<{ type: string; title: string }[]> {
  const { data } = await supabase
    .from('user_insights')
    .select('type, title')
    .eq('user_id', userId)
    .gte('created_at', weekStart)
    .lte('created_at', `${weekEnd}T23:59:59.999Z`)
    .eq('is_dismissed', false)
    .limit(5)

  return data || []
}

async function getReviewCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<number> {
  const { count } = await supabase
    .from('weekly_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  return count || 0
}

async function getExistingReview(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  weekStart: string
): Promise<WeeklyReview | null> {
  const { data } = await supabase
    .from('weekly_reviews')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .single()

  return data as WeeklyReview | null
}

// ============================================
// Stats Computation
// ============================================
interface WeekStats {
  created: number
  completed: number
  dropped: number
  skipped: number
  completionRate: number
  byCategory: Record<string, { name: string; icon: string; created: number; completed: number }>
  recurringStreaks: Array<{ title: string; streak: number }>
  topCategory: string | null
  neglectedCategories: string[]
}

function computeWeekStats(
  tasks: TaskForReview[],
  weekStart: string,
  weekEnd: string,
  priorities: UserPriority[]
): WeekStats {
  const created = tasks.filter(t => inDateRange(t.created_at, weekStart, weekEnd)).length
  const completed = tasks.filter(t =>
    t.status === 'done' && t.completed_at && inDateRange(t.completed_at, weekStart, weekEnd)
  ).length
  const dropped = tasks.filter(t =>
    t.status === 'dropped' && t.dropped_at && inDateRange(t.dropped_at, weekStart, weekEnd)
  ).length
  const skipped = tasks.filter(t =>
    t.status === 'skipped' && t.skipped_at && inDateRange(t.skipped_at, weekStart, weekEnd)
  ).length

  // Group by category
  const byCategory: Record<string, { name: string; icon: string; created: number; completed: number }> = {}
  for (const task of tasks) {
    if (!task.category) continue
    const catName = task.category.name
    if (!byCategory[catName]) {
      byCategory[catName] = { name: catName, icon: task.category.icon, created: 0, completed: 0 }
    }
    if (inDateRange(task.created_at, weekStart, weekEnd)) {
      byCategory[catName].created++
    }
    if (task.status === 'done' && task.completed_at && inDateRange(task.completed_at, weekStart, weekEnd)) {
      byCategory[catName].completed++
    }
  }

  // Find recurring streaks
  const recurringStreaks = tasks
    .filter(t => t.is_recurring && t.recurring_streak >= 3)
    .map(t => ({ title: t.title, streak: t.recurring_streak }))
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 5)

  // Find top category (most completed)
  let topCategory: string | null = null
  let maxCompleted = 0
  for (const [name, stats] of Object.entries(byCategory)) {
    if (stats.completed > maxCompleted) {
      maxCompleted = stats.completed
      topCategory = name
    }
  }

  // Find neglected categories (high priority with < 2 completed)
  const neglectedCategories: string[] = []
  for (const priority of priorities) {
    if (priority.rank <= 3) {
      const catStats = byCategory[priority.domain]
      if (!catStats || catStats.completed < 2) {
        neglectedCategories.push(priority.domain)
      }
    }
  }

  return {
    created,
    completed,
    dropped,
    skipped,
    completionRate: created > 0 ? completed / created : 0,
    byCategory,
    recurringStreaks,
    topCategory,
    neglectedCategories,
  }
}

function computeBalanceTrend(
  balanceScores: { score: number; computed_for_date: string }[]
): { avg: number | null; trend: BalanceScoreTrendDirection | null } {
  if (balanceScores.length === 0) {
    return { avg: null, trend: null }
  }

  const avg = Math.round(
    balanceScores.reduce((sum, s) => sum + s.score, 0) / balanceScores.length
  )

  if (balanceScores.length < 2) {
    return { avg, trend: 'stable' }
  }

  const firstHalf = balanceScores.slice(0, Math.floor(balanceScores.length / 2))
  const secondHalf = balanceScores.slice(Math.floor(balanceScores.length / 2))

  const firstAvg = firstHalf.reduce((sum, s) => sum + s.score, 0) / firstHalf.length
  const secondAvg = secondHalf.reduce((sum, s) => sum + s.score, 0) / secondHalf.length

  const diff = secondAvg - firstAvg
  if (diff > 3) return { avg, trend: 'improving' }
  if (diff < -3) return { avg, trend: 'declining' }
  return { avg, trend: 'stable' }
}

// ============================================
// AI Generation
// ============================================
function buildWeeklyReviewPrompt(
  weekStart: string,
  weekEnd: string,
  stats: WeekStats,
  balanceAvg: number | null,
  balanceTrend: BalanceScoreTrendDirection | null,
  priorities: UserPriority[],
  suggestions: { accepted: number; dismissed: number; pending: number },
  insights: { type: string; title: string }[],
  isFirstReview: boolean
): string {
  const categoryLines = Object.entries(stats.byCategory)
    .sort((a, b) => b[1].completed - a[1].completed)
    .map(([, cat]) => `- ${cat.icon} ${cat.name}: ${cat.created} created, ${cat.completed} completed`)
    .join('\n')

  const priorityLines = priorities.length > 0
    ? priorities.map(p => `${p.rank}. ${p.domain} (importance: ${p.importance_score}/10)`).join('\n')
    : 'No priorities set'

  const streakLines = stats.recurringStreaks.length > 0
    ? stats.recurringStreaks.map(s => `- "${s.title}": ${s.streak} day streak`).join('\n')
    : 'No active streaks'

  const insightLines = insights.length > 0
    ? insights.map(i => `- ${i.type}: ${i.title}`).join('\n')
    : 'No insights generated this week'

  const firstReviewNote = isFirstReview
    ? '\n\nIMPORTANT: This is the user\'s FIRST weekly review! Add extra encouragement. Mention that even reading this review is an accomplishment. Welcome them to the habit of reflection.\n'
    : ''

  return `You are an ADHD-friendly weekly review coach. Generate a warm, encouraging weekly review based on this data.

WEEK: ${weekStart} to ${weekEnd}

TASK STATS:
- Created: ${stats.created} tasks
- Completed: ${stats.completed} tasks (${Math.round(stats.completionRate * 100)}% completion rate)
- Dropped: ${stats.dropped} tasks (intentional decisions!)
- Skipped (recurring): ${stats.skipped} tasks

ACTIVITY BY CATEGORY:
${categoryLines || 'No categorized tasks this week'}

USER'S PRIORITIES:
${priorityLines}

BALANCE SCORE: ${balanceAvg !== null ? `Average ${balanceAvg}/100 this week, trend: ${balanceTrend}` : 'Not available (priorities not set)'}

NEGLECTED HIGH-PRIORITY CATEGORIES: ${stats.neglectedCategories.length > 0 ? stats.neglectedCategories.join(', ') : 'None - great job!'}

RECURRING TASK STREAKS:
${streakLines}

AI SUGGESTIONS: ${suggestions.accepted} accepted, ${suggestions.dismissed} dismissed, ${suggestions.pending} still pending

RECENT INSIGHTS:
${insightLines}
${firstReviewNote}
FORMAT YOUR RESPONSE AS JSON:
{
  "summary_markdown": "A 3-5 paragraph markdown review. Start with wins. Acknowledge effort. Gently note gaps. End with encouragement. Use emoji sparingly. Keep it under 300 words.",
  "wins": ["Win statement 1", "Win statement 2", ...],
  "gaps": ["Gap observation 1", ...],
  "patterns": ["Pattern 1", ...],
  "suggested_focus": ["Focus suggestion 1", ...]
}

RULES:
- wins: 2-5 wins, even from small things. Find something positive even if completion rate is 10%.
- gaps: 1-3 gaps, framed gently with curiosity, not judgment.
- patterns: 1-3 patterns noticed in behavior or categories.
- suggested_focus: 2-4 specific, actionable focus areas for next week.

TONE RULES:
- Lead with wins. ALWAYS find something positive.
- Dropped tasks are NOT failures. "You made ${stats.dropped} intentional decisions to drop tasks that weren't serving you."
- Gaps should be framed as curiosity: "Home didn't get much love this week — intentional or accidental?"
- Suggested focus must be SPECIFIC: "Complete 2 Health tasks" not "Focus on health"
- Never use guilt, shame, or "you should have" language.
- If it was a bad week statistically, focus on resilience: "Tough weeks happen. You still showed up."
- Keep the whole review scannable — short paragraphs, bullet points for lists.`
}

async function generateReviewWithGemini(prompt: string): Promise<WeeklyReviewAIResponse | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1500 },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          ],
        }),
      }
    )

    if (!response.ok) {
      console.error('Gemini API returned', response.status)
      return null
    }

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        summary_markdown: parsed.summary_markdown || 'Review generated.',
        wins: Array.isArray(parsed.wins) ? parsed.wins : [],
        gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
        patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
        suggested_focus: Array.isArray(parsed.suggested_focus) ? parsed.suggested_focus : [],
      }
    }
  } catch (e) {
    console.error('Gemini weekly review error:', e)
  }
  return null
}

// ============================================
// Fallback Review
// ============================================
function generateFallbackReview(stats: WeekStats, weekStart: string): WeeklyReviewAIResponse {
  const wins: string[] = []
  const gaps: string[] = []
  const patterns: string[] = []
  const suggested_focus: string[] = []

  // Generate wins
  if (stats.completed > 0) {
    wins.push(`You completed ${stats.completed} task${stats.completed > 1 ? 's' : ''} this week!`)
  }
  if (stats.dropped > 0) {
    wins.push(`You made ${stats.dropped} intentional decision${stats.dropped > 1 ? 's' : ''} to drop tasks that weren't serving you.`)
  }
  if (stats.recurringStreaks.length > 0) {
    const topStreak = stats.recurringStreaks[0]
    wins.push(`"${topStreak.title}" is on a ${topStreak.streak}-day streak!`)
  }
  if (wins.length === 0) {
    wins.push('You showed up this week. That counts.')
  }

  // Generate gaps
  if (stats.neglectedCategories.length > 0) {
    gaps.push(`${stats.neglectedCategories[0]} could use some attention — is that intentional?`)
  }

  // Generate patterns
  if (stats.topCategory) {
    patterns.push(`You were most active in ${stats.topCategory} this week.`)
  }

  // Generate focus suggestions
  if (stats.neglectedCategories.length > 0) {
    suggested_focus.push(`Complete 1-2 ${stats.neglectedCategories[0]} tasks`)
  }
  suggested_focus.push('Pick your top priority task for Monday')

  const summary = `## Week of ${weekStart}

${wins.length > 0 ? '**Wins:**\n' + wins.map(w => `- ${w}`).join('\n') : ''}

${gaps.length > 0 ? '\n**Areas to explore:**\n' + gaps.map(g => `- ${g}`).join('\n') : ''}

${patterns.length > 0 ? '\n**Patterns:**\n' + patterns.map(p => `- ${p}`).join('\n') : ''}

Keep going! Every week is a fresh start.`

  return {
    summary_markdown: summary,
    wins,
    gaps,
    patterns,
    suggested_focus,
  }
}

// ============================================
// Main Handler
// ============================================
export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }
    if (weeklyReviewRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }


    // Check if it's a valid day to generate (Monday-Wednesday)
    if (!isValidGenerationDay()) {
      return NextResponse.json({
        error: 'Weekly reviews are generated on Monday-Wednesday only',
        message: 'Come back on Monday for your weekly review!',
      }, { status: 400 })
    }

    // Get last week's date range
    const { weekStart, weekEnd } = getLastWeekRange()

    // Check if review already exists
    const existingReview = await getExistingReview(supabase, user.id, weekStart)
    if (existingReview) {
      return NextResponse.json({
        review: existingReview,
        cached: true,
      })
    }

    // Gather data
    const [tasks, balanceScores, priorities, suggestions, insights, reviewCount] = await Promise.all([
      getTasksForWeek(supabase, user.id, weekStart, weekEnd),
      getBalanceScoresForWeek(supabase, user.id, weekStart, weekEnd),
      getUserPriorities(supabase, user.id),
      getSuggestionsForWeek(supabase, user.id, weekStart, weekEnd),
      getInsightsForWeek(supabase, user.id, weekStart, weekEnd),
      getReviewCount(supabase, user.id),
    ])

    // Compute stats
    const stats = computeWeekStats(tasks, weekStart, weekEnd, priorities)
    const { avg: balanceAvg, trend: balanceTrend } = computeBalanceTrend(balanceScores)
    const isFirstReview = reviewCount === 0

    // Generate review with AI
    const prompt = buildWeeklyReviewPrompt(
      weekStart,
      weekEnd,
      stats,
      balanceAvg,
      balanceTrend,
      priorities,
      suggestions,
      insights,
      isFirstReview
    )

    let aiResponse = await generateReviewWithGemini(prompt)

    // Fallback if AI fails
    if (!aiResponse) {
      aiResponse = generateFallbackReview(stats, weekStart)
    }

    // Save to database
    const { data: savedReview, error: saveError } = await supabase
      .from('weekly_reviews')
      .insert({
        user_id: user.id,
        week_start: weekStart,
        week_end: weekEnd,
        summary_markdown: aiResponse.summary_markdown,
        wins: aiResponse.wins,
        gaps: aiResponse.gaps,
        patterns: aiResponse.patterns,
        suggested_focus: aiResponse.suggested_focus,
        tasks_completed: stats.completed,
        tasks_created: stats.created,
        tasks_dropped: stats.dropped,
        tasks_rescheduled: 0, // Not tracked currently
        completion_rate: stats.completionRate,
        balance_score_avg: balanceAvg,
        balance_score_trend: balanceTrend,
        top_category: stats.topCategory,
        neglected_categories: stats.neglectedCategories,
      })
      .select()
      .single()

    if (saveError) {
      console.error('Failed to save weekly review:', saveError)
      return apiError('Failed to save review', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({
      review: savedReview as WeeklyReview,
      cached: false,
      isFirstReview,
    })
  } catch (error) {
    console.error('Weekly review generate error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
