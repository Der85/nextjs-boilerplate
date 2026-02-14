import type { TaskWithCategory, TaskStatus } from '@/lib/types'
import { isToday, isTomorrow, isThisWeek, isOverdue } from './dates'

// ============================
// Filter Types
// ============================

export type DueRange = 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'no_date'

export interface TaskFilters {
  categories: string[] // category IDs, empty = all
  statuses: TaskStatus[]
  priorities: ('low' | 'medium' | 'high')[]
  dueRange: DueRange | null
  isRecurring: boolean | null // null = all
}

export const DEFAULT_FILTERS: TaskFilters = {
  categories: [],
  statuses: [],
  priorities: [],
  dueRange: null,
  isRecurring: null,
}

// ============================
// Saved View Types
// ============================

export interface SavedView {
  id: string
  name: string
  filters: TaskFilters
  isSystem: boolean
  createdAt: string
}

// Pre-built system views
export const SYSTEM_VIEWS: SavedView[] = [
  {
    id: 'all',
    name: 'All Tasks',
    filters: { ...DEFAULT_FILTERS },
    isSystem: true,
    createdAt: '',
  },
  {
    id: 'today',
    name: "Today's Focus",
    filters: { ...DEFAULT_FILTERS, dueRange: 'today', statuses: ['active'] },
    isSystem: true,
    createdAt: '',
  },
  {
    id: 'overdue',
    name: 'Needs Attention',
    filters: { ...DEFAULT_FILTERS, dueRange: 'overdue', statuses: ['active'] },
    isSystem: true,
    createdAt: '',
  },
  {
    id: 'recurring',
    name: 'Recurring',
    filters: { ...DEFAULT_FILTERS, isRecurring: true, statuses: ['active'] },
    isSystem: true,
    createdAt: '',
  },
]

export const STORAGE_KEY = 'adhd_saved_views'
export const MAX_CUSTOM_VIEWS = 10

// ============================
// Filter Logic
// ============================

/**
 * Apply filters to tasks (client-side filtering)
 * All filters are AND-combined
 * Within a multi-select dimension, values are OR-combined
 */
export function applyFilters(tasks: TaskWithCategory[], filters: TaskFilters): TaskWithCategory[] {
  return tasks.filter(task => {
    // Category filter (OR within categories)
    if (filters.categories.length > 0) {
      const taskCategoryId = task.category_id || 'uncategorized'
      if (!filters.categories.includes(taskCategoryId)) {
        return false
      }
    }

    // Status filter (OR within statuses)
    if (filters.statuses.length > 0) {
      if (!filters.statuses.includes(task.status)) {
        return false
      }
    }

    // Priority filter (OR within priorities)
    if (filters.priorities.length > 0) {
      if (!task.priority || !filters.priorities.includes(task.priority)) {
        return false
      }
    }

    // Due range filter
    if (filters.dueRange) {
      if (!matchesDueRange(task.due_date, filters.dueRange)) {
        return false
      }
    }

    // Recurring filter
    if (filters.isRecurring !== null) {
      if (task.is_recurring !== filters.isRecurring) {
        return false
      }
    }

    return true
  })
}

/**
 * Check if a due date matches a due range filter
 */
function matchesDueRange(dueDate: string | null, range: DueRange): boolean {
  switch (range) {
    case 'no_date':
      return !dueDate
    case 'overdue':
      return !!dueDate && isOverdue(dueDate)
    case 'today':
      return !!dueDate && (isToday(dueDate) || isOverdue(dueDate))
    case 'tomorrow':
      return !!dueDate && isTomorrow(dueDate)
    case 'this_week':
      return !!dueDate && isThisWeek(dueDate)
    case 'next_week':
      return !!dueDate && isNextWeek(dueDate)
    default:
      return true
  }
}

/**
 * Check if a date is in the next week (not this week)
 */
function isNextWeek(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // End of this week
  const endOfThisWeek = new Date(today)
  endOfThisWeek.setDate(endOfThisWeek.getDate() + (7 - endOfThisWeek.getDay()))

  // End of next week
  const endOfNextWeek = new Date(endOfThisWeek)
  endOfNextWeek.setDate(endOfNextWeek.getDate() + 7)

  return d > endOfThisWeek && d <= endOfNextWeek
}

// ============================
// URL State Helpers
// ============================

/**
 * Convert filters to URL search params
 */
export function filtersToSearchParams(filters: TaskFilters): URLSearchParams {
  const params = new URLSearchParams()

  if (filters.categories.length > 0) {
    params.set('category', filters.categories.join(','))
  }
  if (filters.statuses.length > 0) {
    params.set('status', filters.statuses.join(','))
  }
  if (filters.priorities.length > 0) {
    params.set('priority', filters.priorities.join(','))
  }
  if (filters.dueRange) {
    params.set('due', filters.dueRange)
  }
  if (filters.isRecurring !== null) {
    params.set('recurring', filters.isRecurring ? '1' : '0')
  }

  return params
}

/**
 * Parse filters from URL search params
 */
export function searchParamsToFilters(params: URLSearchParams): TaskFilters {
  const filters: TaskFilters = { ...DEFAULT_FILTERS }

  const category = params.get('category')
  if (category) {
    filters.categories = category.split(',').filter(Boolean)
  }

  const status = params.get('status')
  if (status) {
    filters.statuses = status.split(',').filter(Boolean) as TaskStatus[]
  }

  const priority = params.get('priority')
  if (priority) {
    filters.priorities = priority.split(',').filter(Boolean) as ('low' | 'medium' | 'high')[]
  }

  const due = params.get('due')
  if (due && ['overdue', 'today', 'tomorrow', 'this_week', 'next_week', 'no_date'].includes(due)) {
    filters.dueRange = due as DueRange
  }

  const recurring = params.get('recurring')
  if (recurring === '1') {
    filters.isRecurring = true
  } else if (recurring === '0') {
    filters.isRecurring = false
  }

  return filters
}

// ============================
// Saved Views Storage
// ============================

/**
 * Load custom saved views from localStorage
 */
export function loadSavedViews(): SavedView[] {
  if (typeof window === 'undefined') return []

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const views = JSON.parse(stored) as SavedView[]
      return views.filter(v => !v.isSystem)
    }
  } catch {
    // Ignore parse errors
  }
  return []
}

/**
 * Save custom views to localStorage
 */
export function saveSavedViews(views: SavedView[]): void {
  if (typeof window === 'undefined') return

  const customViews = views.filter(v => !v.isSystem)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customViews))
}

/**
 * Add a new custom view
 */
export function addSavedView(views: SavedView[], name: string, filters: TaskFilters): SavedView[] {
  if (views.filter(v => !v.isSystem).length >= MAX_CUSTOM_VIEWS) {
    throw new Error(`Maximum ${MAX_CUSTOM_VIEWS} custom views allowed`)
  }

  const newView: SavedView = {
    id: crypto.randomUUID(),
    name,
    filters: { ...filters },
    isSystem: false,
    createdAt: new Date().toISOString(),
  }

  const updated = [...views, newView]
  saveSavedViews(updated)
  return updated
}

/**
 * Delete a custom view
 */
export function deleteSavedView(views: SavedView[], viewId: string): SavedView[] {
  const updated = views.filter(v => v.id !== viewId || v.isSystem)
  saveSavedViews(updated)
  return updated
}

/**
 * Update a custom view
 */
export function updateSavedView(
  views: SavedView[],
  viewId: string,
  updates: { name?: string; filters?: TaskFilters }
): SavedView[] {
  const updated = views.map(v => {
    if (v.id === viewId && !v.isSystem) {
      return {
        ...v,
        name: updates.name ?? v.name,
        filters: updates.filters ?? v.filters,
      }
    }
    return v
  })
  saveSavedViews(updated)
  return updated
}

// ============================
// Filter State Helpers
// ============================

/**
 * Check if any filters are active
 */
export function hasActiveFilters(filters: TaskFilters): boolean {
  return (
    filters.categories.length > 0 ||
    filters.statuses.length > 0 ||
    filters.priorities.length > 0 ||
    filters.dueRange !== null ||
    filters.isRecurring !== null
  )
}

/**
 * Count active filter dimensions
 */
export function countActiveFilters(filters: TaskFilters): number {
  let count = 0
  if (filters.categories.length > 0) count++
  if (filters.statuses.length > 0) count++
  if (filters.priorities.length > 0) count++
  if (filters.dueRange !== null) count++
  if (filters.isRecurring !== null) count++
  return count
}

/**
 * Check if filters match a saved view
 */
export function filtersMatchView(filters: TaskFilters, view: SavedView): boolean {
  const f = filters
  const v = view.filters

  return (
    JSON.stringify(f.categories.sort()) === JSON.stringify(v.categories.sort()) &&
    JSON.stringify(f.statuses.sort()) === JSON.stringify(v.statuses.sort()) &&
    JSON.stringify(f.priorities.sort()) === JSON.stringify(v.priorities.sort()) &&
    f.dueRange === v.dueRange &&
    f.isRecurring === v.isRecurring
  )
}

// ============================
// Display Helpers
// ============================

export const DUE_RANGE_LABELS: Record<DueRange, string> = {
  overdue: 'Overdue',
  today: 'Today',
  tomorrow: 'Tomorrow',
  this_week: 'This Week',
  next_week: 'Next Week',
  no_date: 'No Date',
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  active: 'Active',
  done: 'Done',
  dropped: 'Dropped',
  skipped: 'Skipped',
}

export const PRIORITY_LABELS: Record<'low' | 'medium' | 'high', string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}
