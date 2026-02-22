// Shared task statistics utilities
// Used by both Sherlock insights engine and Balance Score computation

import type { CategoryStats } from '@/lib/types'

// ============================================
// Types
// ============================================
export interface TaskWithCategory {
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

export interface ExtendedCategoryStats extends CategoryStats {
  lastCompletedDaysAgo: number | null
}

// ============================================
// Date Utilities
// ============================================
export function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

export function fourteenDaysAgo(): string {
  return daysAgo(14)
}

// ============================================
// Supabase Task Fetching
// ============================================
export async function fetchRecentTasks(
  supabase: { from: (table: string) => unknown },
  userId: string,
  days: number = 14
): Promise<TaskWithCategory[]> {
  const cutoff = daysAgo(days)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('tasks')
    .select('id, status, category_id, completed_at, dropped_at, skipped_at, created_at, category:categories(id, name, icon, color)')
    .eq('user_id', userId)
    .gte('created_at', cutoff)
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
export function computeCategoryStats(tasks: TaskWithCategory[]): CategoryStats[] {
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
// Extended Category Stats (with recency)
// Delegates to computeCategoryStats and adds lastCompletedDaysAgo
// ============================================
export function computeExtendedCategoryStats(tasks: TaskWithCategory[]): ExtendedCategoryStats[] {
  const baseStats = computeCategoryStats(tasks)
  const now = new Date()

  // Single pass to find last completion date per category
  const lastCompletedMap = new Map<string, Date>()
  for (const task of tasks) {
    if (!task.category_id || task.status !== 'done' || !task.completed_at) continue
    const completed = new Date(task.completed_at)
    const prev = lastCompletedMap.get(task.category_id)
    if (!prev || completed > prev) {
      lastCompletedMap.set(task.category_id, completed)
    }
  }

  return baseStats.map(stat => {
    const lastCompleted = lastCompletedMap.get(stat.categoryId)
    return {
      ...stat,
      lastCompletedDaysAgo: lastCompleted
        ? Math.floor((now.getTime() - lastCompleted.getTime()) / (1000 * 60 * 60 * 24))
        : null,
    }
  })
}
