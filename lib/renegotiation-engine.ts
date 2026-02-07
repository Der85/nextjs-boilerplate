// ===================================================================
// Renegotiation Engine
// ===================================================================
// Core logic for shame-safe task rescheduling

import {
  type RenegotiationAction,
  type RenegotiationReasonCode,
  type TaskNeedingRenegotiation,
  type RenegotiationPattern,
  type SubtaskInput,
  RENEGOTIATION_PATTERN_THRESHOLD,
  RENEGOTIATION_PATTERN_DAYS,
  shouldShowPatternWarning,
  getPatternSuggestion,
  validateSubtasks,
} from './types/renegotiation'

// ===========================================
// Task Analysis
// ===========================================

export interface TaskForRenegotiation {
  id: string
  title: string
  due_date: string | null
  status: string
  renegotiation_count: number
  outcome_id: string | null
  commitment_id: string | null
  estimated_minutes: number | null
}

export function isTaskOverdue(task: TaskForRenegotiation): boolean {
  if (!task.due_date) return false
  if (['completed', 'parked', 'dropped'].includes(task.status)) return false

  const dueDate = new Date(task.due_date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  dueDate.setHours(0, 0, 0, 0)

  return dueDate < today
}

export function getDaysOverdue(dueDate: string): number {
  const due = new Date(dueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)

  const diffTime = today.getTime() - due.getTime()
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)))
}

export function filterOverdueTasks(tasks: TaskForRenegotiation[]): TaskNeedingRenegotiation[] {
  return tasks
    .filter(isTaskOverdue)
    .map(task => ({
      id: task.id,
      title: task.title,
      due_date: task.due_date!,
      days_overdue: getDaysOverdue(task.due_date!),
      renegotiation_count: task.renegotiation_count,
      outcome_title: null, // Can be enriched separately
    }))
    .sort((a, b) => b.days_overdue - a.days_overdue) // Most overdue first
}

// ===========================================
// Action Handlers
// ===========================================

export interface RenegotiationActionResult {
  success: boolean
  newStatus?: string
  newDueDate?: string | null
  subtaskIds?: string[]
  error?: string
}

export function prepareRescheduleAction(
  newDueDate: string
): RenegotiationActionResult {
  // Validate the new due date
  const date = new Date(newDueDate)
  if (isNaN(date.getTime())) {
    return { success: false, error: 'Invalid date format' }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)

  if (date < today) {
    return { success: false, error: 'New due date cannot be in the past' }
  }

  return {
    success: true,
    newDueDate,
    newStatus: 'active',
  }
}

export function prepareParkAction(): RenegotiationActionResult {
  return {
    success: true,
    newStatus: 'parked',
    newDueDate: null,
  }
}

export function prepareDropAction(): RenegotiationActionResult {
  return {
    success: true,
    newStatus: 'dropped',
    newDueDate: null,
  }
}

export function prepareSplitAction(
  originalTask: TaskForRenegotiation,
  subtasks: SubtaskInput[]
): RenegotiationActionResult {
  const validation = validateSubtasks(subtasks)
  if (!validation.valid) {
    return { success: false, error: validation.error }
  }

  return {
    success: true,
    newStatus: 'completed', // Original task is marked as re-scoped (completed)
    newDueDate: null,
  }
}

// ===========================================
// Pattern Detection
// ===========================================

export interface PatternAnalysis {
  hasPattern: boolean
  pattern?: RenegotiationPattern
  suggestion?: string
  recommendedActions: RenegotiationAction[]
}

export function analyzeRenegotiationPattern(
  taskId: string,
  taskTitle: string,
  renegotiationCount: number,
  recentReasons: RenegotiationReasonCode[]
): PatternAnalysis {
  if (!shouldShowPatternWarning(renegotiationCount)) {
    return { hasPattern: false, recommendedActions: ['reschedule', 'split', 'park', 'drop'] }
  }

  // Find most common reason
  const reasonCounts = recentReasons.reduce((acc, reason) => {
    acc[reason] = (acc[reason] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const mostCommonReason = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] as RenegotiationReasonCode || 'other'

  const suggestion = getPatternSuggestion(mostCommonReason, renegotiationCount)

  // Determine recommended actions based on pattern
  const recommendedActions = getRecommendedActionsForPattern(mostCommonReason, renegotiationCount)

  return {
    hasPattern: true,
    pattern: {
      task_id: taskId,
      task_title: taskTitle,
      renegotiation_count: renegotiationCount,
      most_common_reason: mostCommonReason,
      suggestion,
    },
    suggestion,
    recommendedActions,
  }
}

function getRecommendedActionsForPattern(
  reason: RenegotiationReasonCode,
  count: number
): RenegotiationAction[] {
  // For heavily renegotiated tasks, suggest more drastic actions first
  if (count >= 5) {
    return ['drop', 'park', 'split', 'reschedule']
  }

  switch (reason) {
    case 'underestimated':
      return ['split', 'reschedule', 'park', 'drop']
    case 'changed_priorities':
      return ['drop', 'park', 'reschedule', 'split']
    case 'dependencies_blocked':
      return ['park', 'reschedule', 'split', 'drop']
    case 'low_energy':
      return ['reschedule', 'split', 'park', 'drop']
    default:
      return ['reschedule', 'split', 'park', 'drop']
  }
}

// ===========================================
// Smart Suggestions
// ===========================================

export interface RescheduleSuggestion {
  date: Date
  label: string
  reason: string
}

export function suggestNewDueDate(
  originalDueDate: string,
  reason: RenegotiationReasonCode,
  renegotiationCount: number
): RescheduleSuggestion[] {
  const suggestions: RescheduleSuggestion[] = []
  const now = new Date()

  // Tomorrow - always offered
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  suggestions.push({
    date: tomorrow,
    label: 'Tomorrow',
    reason: 'A fresh start',
  })

  // Based on reason, offer different suggestions
  switch (reason) {
    case 'low_energy':
      // Suggest later in the week (weekend recovery)
      const weekend = getNextWeekend()
      if (weekend) {
        suggestions.push({
          date: weekend,
          label: 'This weekend',
          reason: 'Time to recharge',
        })
      }
      break

    case 'underestimated':
      // Suggest more time
      const nextWeek = new Date(now)
      nextWeek.setDate(nextWeek.getDate() + 7)
      suggestions.push({
        date: nextWeek,
        label: 'Next week',
        reason: 'More time to tackle it',
      })
      break

    case 'dependencies_blocked':
      // Suggest checking back in a few days
      const inThreeDays = new Date(now)
      inThreeDays.setDate(inThreeDays.getDate() + 3)
      suggestions.push({
        date: inThreeDays,
        label: 'In 3 days',
        reason: 'Time for blockers to clear',
      })
      break

    default:
      // Default: next week
      const defaultNextWeek = new Date(now)
      defaultNextWeek.setDate(defaultNextWeek.getDate() + 7)
      suggestions.push({
        date: defaultNextWeek,
        label: 'Next week',
        reason: 'A realistic buffer',
      })
  }

  // For tasks renegotiated multiple times, suggest longer timeframes
  if (renegotiationCount >= 2) {
    const inTwoWeeks = new Date(now)
    inTwoWeeks.setDate(inTwoWeeks.getDate() + 14)
    suggestions.push({
      date: inTwoWeeks,
      label: 'In 2 weeks',
      reason: 'Taking pressure off',
    })
  }

  return suggestions
}

function getNextWeekend(): Date | null {
  const now = new Date()
  const dayOfWeek = now.getDay()

  // If it's already weekend, suggest next weekend
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    const nextSaturday = new Date(now)
    nextSaturday.setDate(now.getDate() + (6 - dayOfWeek + 7) % 7 + 1)
    return nextSaturday
  }

  // Days until Saturday (6)
  const daysUntilSaturday = 6 - dayOfWeek
  const saturday = new Date(now)
  saturday.setDate(now.getDate() + daysUntilSaturday)
  return saturday
}

// ===========================================
// Split Task Generation
// ===========================================

export interface SplitSuggestion {
  title: string
  estimatedMinutes: number
  suggestedDueDate?: Date
}

export function generateSplitSuggestions(
  originalTitle: string,
  originalEstimatedMinutes: number | null
): SplitSuggestion[] {
  const baseMinutes = originalEstimatedMinutes || 60
  const partMinutes = Math.max(15, Math.floor(baseMinutes / 2))

  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dayAfter = new Date(now)
  dayAfter.setDate(dayAfter.getDate() + 2)

  return [
    {
      title: `${originalTitle} - Part 1 (setup/prep)`,
      estimatedMinutes: partMinutes,
      suggestedDueDate: tomorrow,
    },
    {
      title: `${originalTitle} - Part 2 (main work)`,
      estimatedMinutes: partMinutes,
      suggestedDueDate: dayAfter,
    },
  ]
}

// ===========================================
// Validation
// ===========================================

export function validateRenegotiationRequest(
  action: unknown,
  reasonCode: unknown,
  newDueDate: unknown,
  subtasks: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Validate action
  if (!action || typeof action !== 'string') {
    errors.push('Action is required')
  } else if (!['reschedule', 'split', 'park', 'drop'].includes(action)) {
    errors.push('Invalid action')
  }

  // Validate reason code
  if (!reasonCode || typeof reasonCode !== 'string') {
    errors.push('Reason is required')
  } else if (![
    'underestimated',
    'interruption',
    'low_energy',
    'dependencies_blocked',
    'changed_priorities',
    'forgot',
    'life_happened',
    'other',
  ].includes(reasonCode)) {
    errors.push('Invalid reason')
  }

  // Action-specific validation
  if (action === 'reschedule') {
    if (!newDueDate || typeof newDueDate !== 'string') {
      errors.push('New due date is required for rescheduling')
    } else {
      const date = new Date(newDueDate)
      if (isNaN(date.getTime())) {
        errors.push('Invalid date format')
      }
    }
  }

  if (action === 'split') {
    if (!subtasks || !Array.isArray(subtasks)) {
      errors.push('Subtasks are required for splitting')
    } else {
      const subtaskValidation = validateSubtasks(subtasks)
      if (!subtaskValidation.valid) {
        errors.push(subtaskValidation.error || 'Invalid subtasks')
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

// ===========================================
// Date Formatting
// ===========================================

export function formatDateForDisplay(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateForAPI(date: Date): string {
  return date.toISOString().split('T')[0]
}
