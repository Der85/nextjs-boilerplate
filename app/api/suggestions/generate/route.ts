// POST /api/suggestions/generate
// AI-powered task suggestion generator based on user priorities and activity gaps
// Only generates new suggestions if:
// 1. User has fewer than 3 pending suggestions
// 2. Last generation was >24 hours ago
// 3. User has priorities set

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { suggestionsRateLimiter } from '@/lib/rateLimiter'
import type {
  UserPriority,
  TaskSuggestion,
  AISuggestionResponse,
  SuggestionType,
  PriorityDomain,
  Category,
  TaskTemplate,
} from '@/lib/types'

const MAX_PENDING_SUGGESTIONS = 3
const MIN_GENERATION_INTERVAL_HOURS = 24
const SUGGESTION_EXPIRY_DAYS = 7

// ============================================
// Types
// ============================================
interface TaskWithCategory {
  id: string
  title: string
  status: string
  category_id: string | null
  completed_at: string | null
  created_at: string
  is_recurring: boolean
  category: {
    id: string
    name: string
  } | null
}

interface CategoryActivity {
  name: string
  categoryId: string | null
  tasksCreated: number
  tasksCompleted: number
  completionRate: number
  lastCompletedAt: string | null
  hasRecurringTasks: boolean
}

// ============================================
// Data Fetchers
// ============================================
function fourteenDaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 14)
  return d.toISOString()
}

async function fetchPriorities(
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

async function fetchRecentTasks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<TaskWithCategory[]> {
  const { data } = await supabase
    .from('tasks')
    .select('id, title, status, category_id, completed_at, created_at, is_recurring, category:categories(id, name)')
    .eq('user_id', userId)
    .gte('created_at', fourteenDaysAgo())

  return ((data || []) as unknown as TaskWithCategory[]).map(task => ({
    ...task,
    category: Array.isArray(task.category) ? task.category[0] || null : task.category,
  }))
}

async function fetchActiveTasks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('tasks')
    .select('title')
    .eq('user_id', userId)
    .eq('status', 'active')

  return (data || []).map(t => t.title.toLowerCase())
}

async function fetchCategories(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<Category[]> {
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)

  return (data || []) as Category[]
}

async function fetchTemplates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<TaskTemplate[]> {
  const { data } = await supabase
    .from('task_templates')
    .select('*')
    .eq('user_id', userId)
    .order('use_count', { ascending: false })
    .limit(10)

  return (data || []) as TaskTemplate[]
}

async function fetchPendingSuggestions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<TaskSuggestion[]> {
  const now = new Date().toISOString()

  // Fetch pending and unsnoozed suggestions
  const { data } = await supabase
    .from('task_suggestions')
    .select('*')
    .eq('user_id', userId)
    .or(`status.eq.pending,and(status.eq.snoozed,snoozed_until.lt.${now})`)
    .order('created_at', { ascending: false })

  return (data || []) as TaskSuggestion[]
}

async function getLastGenerationTime(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<Date | null> {
  const { data } = await supabase
    .from('task_suggestions')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (data && data.length > 0) {
    return new Date(data[0].created_at)
  }
  return null
}

// ============================================
// Analysis Functions
// ============================================
function computeCategoryActivity(
  tasks: TaskWithCategory[],
  categories: Category[]
): CategoryActivity[] {
  const activityMap = new Map<string, CategoryActivity>()

  // Initialize all categories
  for (const cat of categories) {
    activityMap.set(cat.name, {
      name: cat.name,
      categoryId: cat.id,
      tasksCreated: 0,
      tasksCompleted: 0,
      completionRate: 0,
      lastCompletedAt: null,
      hasRecurringTasks: false,
    })
  }

  // Compute activity from tasks
  for (const task of tasks) {
    const catName = task.category?.name
    if (!catName) continue

    let activity = activityMap.get(catName)
    if (!activity) {
      activity = {
        name: catName,
        categoryId: task.category_id,
        tasksCreated: 0,
        tasksCompleted: 0,
        completionRate: 0,
        lastCompletedAt: null,
        hasRecurringTasks: false,
      }
      activityMap.set(catName, activity)
    }

    activity.tasksCreated++

    if (task.is_recurring) {
      activity.hasRecurringTasks = true
    }

    if (task.status === 'done' && task.completed_at) {
      activity.tasksCompleted++
      if (!activity.lastCompletedAt || task.completed_at > activity.lastCompletedAt) {
        activity.lastCompletedAt = task.completed_at
      }
    }
  }

  // Compute completion rates
  for (const activity of activityMap.values()) {
    activity.completionRate = activity.tasksCreated > 0
      ? Math.round((activity.tasksCompleted / activity.tasksCreated) * 100)
      : 0
  }

  return Array.from(activityMap.values())
}

function findGapCategories(
  priorities: UserPriority[],
  categoryActivity: CategoryActivity[]
): { domain: string; rank: number; hasGap: boolean; reason: string }[] {
  const gaps: { domain: string; rank: number; hasGap: boolean; reason: string }[] = []

  for (const priority of priorities) {
    const activity = categoryActivity.find(a => a.name === priority.domain)

    // Skip if category has recurring tasks (not a true gap)
    if (activity?.hasRecurringTasks && activity.tasksCreated > 0) {
      continue
    }

    // Check for gaps
    if (!activity || activity.tasksCreated === 0) {
      gaps.push({
        domain: priority.domain,
        rank: priority.rank,
        hasGap: true,
        reason: `No tasks in last 14 days`,
      })
    } else if (activity.tasksCompleted === 0) {
      gaps.push({
        domain: priority.domain,
        rank: priority.rank,
        hasGap: true,
        reason: `${activity.tasksCreated} tasks created but 0 completed`,
      })
    }
  }

  // Sort by priority rank (lower rank = higher priority)
  return gaps.sort((a, b) => a.rank - b.rank)
}

// ============================================
// Gemini Prompt Builder
// ============================================
function buildSuggestionPrompt(
  priorities: UserPriority[],
  categoryActivity: CategoryActivity[],
  templates: TaskTemplate[],
  activeTasks: string[],
  gaps: { domain: string; rank: number; hasGap: boolean; reason: string }[]
): string {
  const priorityList = priorities
    .map(p => `${p.rank}. ${p.domain} (importance: ${p.importance_score}/10)${p.aspirational_note ? ` - "${p.aspirational_note}"` : ''}`)
    .join('\n')

  const activityList = categoryActivity
    .map(a => {
      const gapMarker = gaps.find(g => g.domain === a.name) ? ' ← GAP' : ''
      return `- ${a.name}: ${a.tasksCreated} tasks created, ${a.tasksCompleted} completed (${a.completionRate}%)${gapMarker}`
    })
    .join('\n')

  const templateList = templates.length > 0
    ? templates.map(t => `- "${t.name}" (${t.task_name})`).join('\n')
    : 'No templates yet'

  const activeTaskList = activeTasks.length > 0
    ? activeTasks.slice(0, 10).map(t => `- ${t}`).join('\n')
    : 'No active tasks'

  return `You are an ADHD-friendly life coach AI. Based on the user's priorities and recent activity, suggest 3-5 specific, actionable tasks they should consider adding.

USER'S LIFE PRIORITIES (ranked):
${priorityList}

RECENT ACTIVITY BY CATEGORY (last 14 days):
${activityList}

USER'S EXISTING TEMPLATES:
${templateList}

CURRENT ACTIVE TASKS (do not suggest duplicates):
${activeTaskList}

SUGGESTION RULES:
1. Prioritize GAP categories that rank HIGH in user priorities. If Health is priority #2 but has 0 tasks, that's the biggest opportunity.
2. Keep tasks ADHD-friendly: specific, small, completable in one sitting.
3. Each suggestion needs: task_name, 2-4 micro steps, category, energy level, time estimate, and a one-sentence "why" that references their priority.
4. If the user has a relevant template, suggest using it rather than creating from scratch.
5. Don't suggest things that already exist in their active task list.
6. Be warm and encouraging, not guilt-tripping. Frame gaps as opportunities, not failures.
7. Include at least one "quick win" (under 15 minutes, low energy).
8. Never suggest more than 5 tasks. 3 is ideal.

Return as JSON array:
[{
  "task_name": "Short, actionable task name",
  "steps": ["step 1", "step 2", "step 3"],
  "category": "Health",
  "energy": "low",
  "estimated_minutes": 15,
  "reasoning": "Health is your #2 priority but you haven't done any Health tasks in 10 days. A short walk is a gentle way back in.",
  "suggestion_type": "gap_fill",
  "source_template_name": null
}]

Suggestion types:
- "gap_fill": Filling a neglected high-priority area
- "priority_boost": Supporting a top-3 priority that's doing well
- "routine_suggestion": Building a healthy routine
- "template_based": Using an existing template
- "seasonal": Time-appropriate task (morning routine, end of day review, etc.)`
}

// ============================================
// Gemini API Call
// ============================================
async function callGemini(
  apiKey: string,
  prompt: string
): Promise<AISuggestionResponse[] | null> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000,
            responseMimeType: 'application/json',
          },
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
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as AISuggestionResponse[]

      // Validate and sanitize
      const validTypes: SuggestionType[] = ['gap_fill', 'priority_boost', 'routine_suggestion', 'template_based', 'seasonal']
      const validEnergy = ['low', 'medium', 'high']

      return parsed
        .filter(s => s.task_name && s.reasoning)
        .slice(0, 5)
        .map(s => ({
          task_name: String(s.task_name).slice(0, 200),
          steps: Array.isArray(s.steps) ? s.steps.slice(0, 5).map(step => String(step).slice(0, 300)) : [],
          category: String(s.category || 'Admin'),
          energy: validEnergy.includes(s.energy) ? s.energy : 'medium',
          estimated_minutes: typeof s.estimated_minutes === 'number' ? Math.min(Math.max(s.estimated_minutes, 5), 180) : 30,
          reasoning: String(s.reasoning).slice(0, 500),
          suggestion_type: validTypes.includes(s.suggestion_type) ? s.suggestion_type : 'gap_fill',
          source_template_name: s.source_template_name || null,
        }))
    }
  } catch (e) {
    console.error('Gemini suggestion error:', e)
  }
  return null
}

// ============================================
// Cleanup expired suggestions
// ============================================
async function cleanupExpiredSuggestions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<void> {
  const expiredDate = new Date()
  expiredDate.setDate(expiredDate.getDate() - SUGGESTION_EXPIRY_DAYS)

  await supabase
    .from('task_suggestions')
    .update({
      status: 'dismissed',
      dismissed_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('status', 'pending')
    .lt('created_at', expiredDate.toISOString())
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

    if (suggestionsRateLimiter.isLimited(user.id)) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
    }

    // Cleanup expired suggestions first
    await cleanupExpiredSuggestions(supabase, user.id)

    // Check if user has priorities
    const priorities = await fetchPriorities(supabase, user.id)
    if (priorities.length === 0) {
      return NextResponse.json({
        suggestions: [],
        message: 'Set your priorities first to get personalized suggestions.',
        needsPriorities: true,
      })
    }

    // Check pending suggestions count
    const pendingSuggestions = await fetchPendingSuggestions(supabase, user.id)
    if (pendingSuggestions.length >= MAX_PENDING_SUGGESTIONS) {
      return NextResponse.json({
        suggestions: pendingSuggestions,
        cached: true,
        message: 'You have pending suggestions to review.',
      })
    }

    // Check last generation time
    const lastGeneration = await getLastGenerationTime(supabase, user.id)
    if (lastGeneration) {
      const hoursSince = (Date.now() - lastGeneration.getTime()) / (1000 * 60 * 60)
      if (hoursSince < MIN_GENERATION_INTERVAL_HOURS && pendingSuggestions.length > 0) {
        return NextResponse.json({
          suggestions: pendingSuggestions,
          cached: true,
          message: 'Check back tomorrow for fresh suggestions.',
          hoursUntilRefresh: Math.ceil(MIN_GENERATION_INTERVAL_HOURS - hoursSince),
        })
      }
    }

    // Gather context
    const [recentTasks, categories, templates, activeTasks] = await Promise.all([
      fetchRecentTasks(supabase, user.id),
      fetchCategories(supabase, user.id),
      fetchTemplates(supabase, user.id),
      fetchActiveTasks(supabase, user.id),
    ])

    // Compute activity and gaps
    const categoryActivity = computeCategoryActivity(recentTasks, categories)
    const gaps = findGapCategories(priorities, categoryActivity)

    // Build prompt and call Gemini
    if (!apiKey) {
      return NextResponse.json({
        suggestions: pendingSuggestions,
        message: 'AI suggestions are temporarily unavailable.',
      })
    }

    const prompt = buildSuggestionPrompt(priorities, categoryActivity, templates, activeTasks, gaps)
    const aiSuggestions = await callGemini(apiKey, prompt)

    if (!aiSuggestions || aiSuggestions.length === 0) {
      return NextResponse.json({
        suggestions: pendingSuggestions,
        message: 'No new suggestions at this time.',
      })
    }

    // Map AI suggestions to database records
    const suggestionsToInsert = aiSuggestions.map(s => {
      // Match category name to category_id
      const category = categories.find(c =>
        c.name.toLowerCase() === s.category.toLowerCase()
      )

      // Match template name if provided
      let templateId: string | null = null
      if (s.source_template_name) {
        const template = templates.find(t =>
          t.name.toLowerCase().includes(s.source_template_name!.toLowerCase()) ||
          s.source_template_name!.toLowerCase().includes(t.name.toLowerCase())
        )
        templateId = template?.id || null
      }

      return {
        user_id: user.id,
        suggested_task_name: s.task_name,
        suggested_steps: s.steps,
        suggested_category_id: category?.id || null,
        suggested_energy: s.energy,
        suggested_estimated_minutes: s.estimated_minutes,
        reasoning: s.reasoning,
        priority_domain: s.category as PriorityDomain,
        suggestion_type: s.suggestion_type,
        status: 'pending' as const,
        source_template_id: templateId,
      }
    })

    // Insert suggestions
    const { data: insertedSuggestions, error: insertError } = await supabase
      .from('task_suggestions')
      .insert(suggestionsToInsert)
      .select('*, category:categories(id, name, color, icon)')

    if (insertError) {
      console.error('Suggestion insert error:', insertError)
      return NextResponse.json({
        suggestions: pendingSuggestions,
        message: 'Failed to save suggestions.',
      })
    }

    // Format response
    const suggestions = (insertedSuggestions || []).map(s => ({
      ...s,
      category: Array.isArray(s.category) ? s.category[0] || null : s.category,
    }))

    return NextResponse.json({
      suggestions,
      cached: false,
      generated: true,
    })
  } catch (error) {
    console.error('Suggestions generate error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
