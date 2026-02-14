// app/api/insights/generate/route.ts
// Pattern Engine — "Sherlock" Insight Generator with Category Analysis
// Fetches 14 days of task data, computes category patterns,
// and uses Gemini to find hidden correlations.
//
// Cache constraint: only generates a new insight if none exists
// from the last 10 minutes (prevents spam and saves API costs).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { insightsRateLimiter } from '@/lib/rateLimiter'
import type { Insight, InsightRow, InsightType, CategoryStats, CategoryPatterns, PriorityDrift, UserPriority, PriorityDomain, DriftDirection } from '@/lib/types'

const CACHE_MINUTES = 10
const MIN_CATEGORIZED_TASKS = 5

// ============================================
// Types
// ============================================
interface TaskWithCategory {
  id: string
  status: string
  category_id: string | null
  completed_at: string | null
  dropped_at: string | null
  skipped_at: string | null
  created_at: string
  category: {
    id: string
    name: string
    icon: string
    color: string
  } | null
}

// ============================================
// Data Gathering — last 14 days
// ============================================
function fourteenDaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 14)
  return d.toISOString()
}

async function fetchRecentTasks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<TaskWithCategory[]> {
  const { data } = await supabase
    .from('tasks')
    .select('id, status, category_id, completed_at, dropped_at, skipped_at, created_at, category:categories(id, name, icon, color)')
    .eq('user_id', userId)
    .gte('created_at', fourteenDaysAgo())
    .order('created_at', { ascending: true })

  // Supabase returns category as single object when FK relationship exists
  return ((data || []) as unknown as TaskWithCategory[]).map(task => ({
    ...task,
    // Ensure category is single object or null (not array)
    category: Array.isArray(task.category) ? task.category[0] || null : task.category,
  }))
}

// ============================================
// Category Statistics Computation
// ============================================
function computeCategoryStats(tasks: TaskWithCategory[]): CategoryStats[] {
  const statsMap = new Map<string, {
    id: string
    name: string
    icon: string
    color: string
    total: number
    completed: number
    dropped: number
    skipped: number
    completionDays: number[]
  }>()

  for (const task of tasks) {
    if (!task.category_id || !task.category) continue

    const cat = task.category
    let stat = statsMap.get(cat.id)
    if (!stat) {
      stat = {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        total: 0,
        completed: 0,
        dropped: 0,
        skipped: 0,
        completionDays: [],
      }
      statsMap.set(cat.id, stat)
    }

    stat.total++

    if (task.status === 'done' && task.completed_at) {
      stat.completed++
      const created = new Date(task.created_at)
      const completed = new Date(task.completed_at)
      const days = Math.ceil((completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
      stat.completionDays.push(days)
    } else if (task.status === 'dropped') {
      stat.dropped++
    } else if (task.status === 'skipped') {
      stat.skipped++
    }
  }

  return Array.from(statsMap.values()).map(s => ({
    categoryId: s.id,
    categoryName: s.name,
    categoryIcon: s.icon,
    categoryColor: s.color,
    totalTasks: s.total,
    completedTasks: s.completed,
    completionRate: s.total > 0 ? s.completed / s.total : 0,
    droppedCount: s.dropped,
    skippedCount: s.skipped,
    avgDaysToComplete: s.completionDays.length > 0
      ? s.completionDays.reduce((a, b) => a + b, 0) / s.completionDays.length
      : null,
  }))
}

// ============================================
// Cross-Category Pattern Computation
// ============================================
function computeCategoryPatterns(
  tasks: TaskWithCategory[],
  categoryStats: CategoryStats[]
): CategoryPatterns {
  const totalCategorizedTasks = tasks.filter(t => t.category_id).length

  // Balance: % of tasks per category
  const balance = categoryStats.map(s => ({
    name: s.categoryName,
    icon: s.categoryIcon,
    color: s.categoryColor,
    percentage: totalCategorizedTasks > 0 ? (s.totalTasks / totalCategorizedTasks) * 100 : 0,
  })).sort((a, b) => b.percentage - a.percentage)

  // Streaks: consecutive days with completions per category
  const streaks: Array<{ name: string; icon: string; days: number }> = []
  const categoryCompletionDays = new Map<string, Set<string>>()

  for (const task of tasks) {
    if (task.status === 'done' && task.completed_at && task.category) {
      const cat = task.category
      const dateStr = task.completed_at.split('T')[0]
      if (!categoryCompletionDays.has(cat.id)) {
        categoryCompletionDays.set(cat.id, new Set())
      }
      categoryCompletionDays.get(cat.id)!.add(dateStr)
    }
  }

  // Calculate streaks for each category
  for (const stat of categoryStats) {
    const completionDates = categoryCompletionDays.get(stat.categoryId)
    if (!completionDates || completionDates.size === 0) continue

    // Sort dates and find current streak (ending today or yesterday)
    const sortedDates = Array.from(completionDates).sort().reverse()
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    // Only count if streak is current (includes today or yesterday)
    if (sortedDates[0] !== today && sortedDates[0] !== yesterday) continue

    let streak = 1
    for (let i = 1; i < sortedDates.length; i++) {
      const curr = new Date(sortedDates[i - 1])
      const prev = new Date(sortedDates[i])
      const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
      if (diffDays === 1) {
        streak++
      } else {
        break
      }
    }

    if (streak >= 3) {
      streaks.push({
        name: stat.categoryName,
        icon: stat.categoryIcon,
        days: streak,
      })
    }
  }

  // Gaps: categories with no completions in 14 days
  const gaps: Array<{ name: string; icon: string; lastCompleted: string | null }> = []
  for (const stat of categoryStats) {
    if (stat.completedTasks === 0 && stat.totalTasks >= 2) {
      gaps.push({
        name: stat.categoryName,
        icon: stat.categoryIcon,
        lastCompleted: null,
      })
    }
  }

  return {
    balance,
    streaks: streaks.sort((a, b) => b.days - a.days),
    gaps,
    totalCategorizedTasks,
    activeCategoryCount: categoryStats.length,
  }
}

// ============================================
// Fetch User Priorities
// ============================================
async function fetchUserPriorities(
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

// ============================================
// Compute Priority Drift Metrics
// ============================================
function computePriorityDrift(
  priorities: UserPriority[],
  categoryStats: CategoryStats[],
  totalTasks: number
): PriorityDrift[] {
  if (priorities.length === 0 || totalTasks === 0) return []

  // Create a map of category name (lowercase) to stats
  const categoryStatsByName = new Map<string, CategoryStats>()
  for (const stat of categoryStats) {
    categoryStatsByName.set(stat.categoryName.toLowerCase(), stat)
  }

  // Calculate total weight for expected share computation
  // Rank 1 gets weight 8, rank 8 gets weight 1
  const totalWeight = priorities.reduce((sum, p) => sum + (9 - p.rank), 0)

  const driftResults: PriorityDrift[] = []

  for (const priority of priorities) {
    // Map domain name to category (they should share names)
    const categoryName = priority.domain.toLowerCase()
    const stats = categoryStatsByName.get(categoryName)

    // Calculate expected vs actual share
    const expectedShare = (9 - priority.rank) / totalWeight
    const actualShare = stats ? stats.totalTasks / totalTasks : 0
    const driftScore = actualShare - expectedShare

    // Determine drift direction
    let driftDirection: DriftDirection = 'aligned'

    // Only flag as neglected if:
    // - Significant negative drift (< -0.10)
    // - AND (high rank <= 3 OR importance_score >= 7)
    // Don't flag low-priority areas as neglected unless explicitly important
    if (driftScore < -0.10) {
      if (priority.rank <= 3 || priority.importance_score >= 7) {
        driftDirection = 'neglected'
      }
    } else if (driftScore > 0.15) {
      driftDirection = 'overinvested'
    }

    driftResults.push({
      domain: priority.domain as PriorityDomain,
      priorityRank: priority.rank,
      importanceScore: priority.importance_score,
      taskPercentage: Math.round(actualShare * 100),
      completionRate: stats ? stats.completionRate : 0,
      driftScore,
      driftDirection,
      categoryId: stats?.categoryId || null,
      categoryIcon: stats?.categoryIcon || null,
      categoryColor: stats?.categoryColor || null,
    })
  }

  return driftResults
}

// ============================================
// Check if high-priority drift exists
// ============================================
function hasHighPriorityDrift(driftData: PriorityDrift[]): boolean {
  // Returns true if any top-3 priority domain is neglected
  return driftData.some(d => d.driftDirection === 'neglected' && d.priorityRank <= 3)
}

// ============================================
// Check for cached insight (< 10 minutes old)
// ============================================
async function fetchCachedInsight(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<InsightRow | null> {
  const cutoff = new Date()
  cutoff.setMinutes(cutoff.getMinutes() - CACHE_MINUTES)

  const { data } = await supabase
    .from('user_insights')
    .select('id, type, title, message, icon, category_id, category_color, priority_rank, is_dismissed, is_helpful, data_window_start, data_window_end, created_at, user_id')
    .eq('user_id', userId)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)

  if (data && data.length > 0) {
    return data[0] as InsightRow
  }
  return null
}

// ============================================
// Check recent insight types for rotation
// ============================================
async function getRecentInsightTypes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<InsightType[]> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data } = await supabase
    .from('user_insights')
    .select('type')
    .eq('user_id', userId)
    .eq('is_dismissed', false)
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(10)

  return (data || []).map(d => d.type as InsightType)
}

// ============================================
// Save insight to DB and return with id
// ============================================
async function saveInsight(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  insight: Insight
): Promise<InsightRow | null> {
  const now = new Date()
  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - 14)

  const { data } = await supabase.from('user_insights').insert({
    user_id: userId,
    type: insight.type,
    title: insight.title,
    message: insight.message,
    icon: insight.icon,
    category_id: insight.category_id || null,
    category_color: insight.category_color || null,
    priority_rank: insight.priority_rank || null,
    data_window_start: windowStart.toISOString().split('T')[0],
    data_window_end: now.toISOString().split('T')[0],
  }).select('id, type, title, message, icon, category_id, category_color, priority_rank, is_dismissed, is_helpful, data_window_start, data_window_end, created_at, user_id').single()

  return data as InsightRow | null
}

// ============================================
// Build the Gemini prompt — "Sherlock" mode with Categories & Priority Drift
// ============================================
function buildInsightPrompt(
  categoryStats: CategoryStats[],
  patterns: CategoryPatterns,
  recentInsightTypes: InsightType[],
  preferCategory: boolean,
  priorities: UserPriority[],
  driftData: PriorityDrift[],
  preferDrift: boolean
): string {
  // Summarize category stats for the prompt
  const categorySummary = categoryStats.map(s => ({
    name: s.categoryName,
    icon: s.categoryIcon,
    tasks: s.totalTasks,
    completed: s.completedTasks,
    completion_rate: `${Math.round(s.completionRate * 100)}%`,
    dropped: s.droppedCount,
    skipped: s.skippedCount,
  }))

  const recentTypesStr = recentInsightTypes.length > 0
    ? `Recent insight types shown: ${recentInsightTypes.join(', ')}`
    : 'No recent insights'

  // Build priority alignment section if priorities exist
  let prioritySection = ''
  if (priorities.length > 0 && driftData.length > 0) {
    const priorityList = priorities.map(p => {
      const note = p.aspirational_note ? ` - "${p.aspirational_note}"` : ''
      return `${p.rank}. ${p.domain} (importance: ${p.importance_score}/10)${note}`
    }).join('\n')

    const alignmentList = driftData.map(d => {
      const status = d.driftDirection === 'neglected'
        ? 'NEGLECTED'
        : d.driftDirection === 'overinvested'
          ? 'OVERINVESTED'
          : 'ALIGNED'
      return `- ${d.domain}: Priority #${d.priorityRank}, ${d.taskPercentage}% of tasks (${status})`
    }).join('\n')

    prioritySection = `
=== PRIORITY ALIGNMENT DATA ===

[USER'S LIFE PRIORITIES (ranked by importance)]
${priorityList}

[ACTIVITY vs PRIORITY ALIGNMENT (last 14 days)]
${alignmentList}

=== PRIORITY DRIFT PATTERNS TO LOOK FOR ===
- Is the user's daily activity aligned with what they say matters most?
- Are high-priority areas being neglected while low-priority areas consume attention?
- Frame neglect gently: "Your #2 priority hasn't gotten attention" not "You're ignoring Family"
- Frame overinvestment as a question: "Work is taking 60% of your tasks — is that intentional?"
- If aligned, celebrate: "Your activity matches your priorities beautifully this week"
- For "aligned" domains, positive reinforcement matters for ADHD brains!
`
  }

  // Determine which type to prioritize
  let priorityInstruction = 'Generate the most relevant insight type.'
  if (preferDrift && driftData.some(d => d.driftDirection !== 'aligned')) {
    priorityInstruction = 'PRIORITY: Generate a priority_drift insight about activity-priority alignment.'
  } else if (preferCategory) {
    priorityInstruction = 'PRIORITY: Generate a category-type insight this time.'
  }

  const validTypes = priorities.length > 0
    ? '"category", "priority_drift", "streak", "warning", "praise", or "correlation"'
    : '"category", "streak", "warning", "praise", or "correlation"'

  return `You are an expert ADHD Life Balance Analyst.
I am sending you 14 days of task category data from an ADHD user.
Your goal is to find ONE specific, actionable insight about their life balance.

=== CATEGORY DATA ===

[PER-CATEGORY STATS]
${JSON.stringify(categorySummary, null, 2)}

[BALANCE ANALYSIS]
Top categories by task %: ${patterns.balance.slice(0, 3).map(b => `${b.icon}${b.name}: ${Math.round(b.percentage)}%`).join(', ')}
Total categorized tasks: ${patterns.totalCategorizedTasks}
Active categories: ${patterns.activeCategoryCount}

[CATEGORY STREAKS (3+ days)]
${patterns.streaks.length > 0 ? patterns.streaks.map(s => `${s.icon}${s.name}: ${s.days} days`).join(', ') : 'None'}

[CATEGORY GAPS (no completions)]
${patterns.gaps.length > 0 ? patterns.gaps.map(g => `${g.icon}${g.name}`).join(', ') : 'None'}
${prioritySection}
=== ROTATION INFO ===
${recentTypesStr}
${priorityInstruction}

=== CATEGORY PATTERNS TO LOOK FOR ===
- IMBALANCE: Is the user spending disproportionate time on one category while neglecting others?
- COMPLETION GAPS: Are certain categories consistently incomplete while others are always done?
- AVOIDANCE: Is there a category with many dropped/skipped tasks? (potential avoidance pattern — frame with curiosity, not judgment)
- STRENGTH: Which category has the highest completion rate? (superpower discovery)
- STREAK: Any impressive category streaks worth celebrating?
- BALANCE: Overall life balance across work, health, personal categories

=== OUTPUT RULES ===
- If you find a negative pattern, phrase it as a gentle "Did you know?" observation, not a judgment.
- If you find a positive pattern, phrase it as a "Superpower" discovery.
- ADHD-friendly language: gentle, curious, celebratory where appropriate.
- Make it ACTIONABLE: "73% Work" is a fact, "Maybe shift one task slot to Family?" is actionable.
- Keep the title punchy (max 6 words).
- Keep the message short (max 2 sentences).
- Include the category/domain emoji in the title when relevant.
- For priority_drift type: include "priority_rank" field with the domain's rank number.
- Use strictly valid JSON format.
- Valid types are: ${validTypes}

JSON TEMPLATE (for category or priority_drift):
{
  "type": "priority_drift",
  "title": "Family gap 📊",
  "message": "Family is your #1 priority, but only 3% of your tasks this fortnight were Family-related. Even one small Family task per day could shift this.",
  "icon": "👨‍👩‍👧",
  "category_name": "Family",
  "category_color": "#EC4899",
  "priority_rank": 1
}`
}

// ============================================
// Call Gemini
// ============================================
async function callGemini(apiKey: string, prompt: string): Promise<Insight | null> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 400 },
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

    // Extract JSON from response (Gemini sometimes wraps in markdown fences)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      // Validate required fields
      if (parsed.title && parsed.message) {
        const validTypes: InsightType[] = ['correlation', 'streak', 'warning', 'praise', 'category', 'priority_drift']
        return {
          type: validTypes.includes(parsed.type) ? parsed.type : 'category',
          title: parsed.title,
          message: parsed.message,
          icon: parsed.icon || '🔍',
          category_color: parsed.category_color || undefined,
          priority_rank: parsed.priority_rank || undefined,
        }
      }
    }
  } catch (e) {
    console.error('Gemini insight error:', e)
  }
  return null
}

// ============================================
// Fallbacks
// ============================================
function sparseDataFallback(): Insight {
  return {
    type: 'praise',
    title: 'Keep using categories!',
    message:
      "Once I have more categorized tasks, I'll spot patterns across your life areas. Keep going!",
    icon: '🌱',
  }
}

function limitedCategoriesFallback(categoryCount: number): Insight {
  return {
    type: 'praise',
    title: 'Building your balance picture',
    message:
      categoryCount === 1
        ? "You're focused on one area — that's fine! As you add variety, I'll find balance insights."
        : `${categoryCount} categories tracked so far. Add a bit more variety and I'll analyze your life balance.`,
    icon: '📊',
  }
}

// ============================================
// Main Handler
// ============================================
export async function POST(_request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Rate limit
    if (insightsRateLimiter.isLimited(user.id)) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
    }

    // 1. Check cache — return existing insight if < 10 min old
    const cached = await fetchCachedInsight(supabase, user.id)
    if (cached) {
      return NextResponse.json({ insight: cached, cached: true })
    }

    // 2. Gather last 14 days of task data
    const tasks = await fetchRecentTasks(supabase, user.id)

    // 3. Compute category stats
    const categoryStats = computeCategoryStats(tasks)
    const categorizedTaskCount = tasks.filter(t => t.category_id).length

    // 4. Handle sparse data
    if (categorizedTaskCount < MIN_CATEGORIZED_TASKS) {
      const fallback = sparseDataFallback()
      return NextResponse.json({ insight: fallback, cached: false })
    }

    // 5. Handle limited categories
    if (categoryStats.length <= 2) {
      const fallback = limitedCategoriesFallback(categoryStats.length)
      return NextResponse.json({ insight: fallback, cached: false })
    }

    // 6. Compute cross-category patterns
    const patterns = computeCategoryPatterns(tasks, categoryStats)

    // 7. Check recent insight types for rotation
    const recentTypes = await getRecentInsightTypes(supabase, user.id)
    const categoryInsightCount = recentTypes.filter(t => t === 'category').length
    const driftInsightCount = recentTypes.filter(t => t === 'priority_drift').length
    const otherInsightCount = recentTypes.length - categoryInsightCount - driftInsightCount

    // Prefer category insights if we haven't shown many recently
    const preferCategory = categoryInsightCount < otherInsightCount || recentTypes.length === 0

    // 8. Fetch user priorities and compute drift
    const priorities = await fetchUserPriorities(supabase, user.id)
    const driftData = computePriorityDrift(priorities, categoryStats, categorizedTaskCount)

    // Prefer drift insight if high-priority drift detected and not recently shown
    const preferDrift = hasHighPriorityDrift(driftData) && driftInsightCount < 2

    // 9. Call Gemini
    if (!apiKey) {
      const fallback = sparseDataFallback()
      return NextResponse.json({ insight: fallback, cached: false })
    }

    const prompt = buildInsightPrompt(categoryStats, patterns, recentTypes, preferCategory, priorities, driftData, preferDrift)
    const insight = await callGemini(apiKey, prompt)

    if (!insight) {
      const fallback = sparseDataFallback()
      return NextResponse.json({ insight: fallback, cached: false })
    }

    // 10. Save to user_insights and return with id
    const saved = await saveInsight(supabase, user.id, insight)

    return NextResponse.json({
      insight: saved || insight,
      cached: false,
    })
  } catch (error) {
    console.error('Insights generate API error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
