// ===================================================================
// Task Renegotiation Types
// ===================================================================
// Shame-safe rescheduling system for overdue and missed tasks

// ===========================================
// Constants
// ===========================================

export const RENEGOTIATION_PATTERN_THRESHOLD = 3 // Number of renegotiations to trigger pattern detection
export const RENEGOTIATION_PATTERN_DAYS = 14 // Days to look back for patterns

// ===========================================
// Enums / Union Types
// ===========================================

export type RenegotiationAction = 'reschedule' | 'split' | 'park' | 'drop'

export type RenegotiationReasonCode =
  | 'underestimated'
  | 'interruption'
  | 'low_energy'
  | 'dependencies_blocked'
  | 'changed_priorities'
  | 'forgot'
  | 'life_happened'
  | 'other'

// ===========================================
// Action Configurations
// ===========================================

export interface RenegotiationActionConfig {
  id: RenegotiationAction
  label: string
  description: string
  icon: string
  supportiveMessage: string
}

export const RENEGOTIATION_ACTIONS: RenegotiationActionConfig[] = [
  {
    id: 'reschedule',
    label: 'Still important, reschedule',
    description: 'Move to a new date that works better',
    icon: '📅',
    supportiveMessage: "Plans change, and that's okay. Let's find a better time.",
  },
  {
    id: 'split',
    label: 'Break into smaller steps',
    description: 'Create smaller, more manageable subtasks',
    icon: '✂️',
    supportiveMessage: "Sometimes big tasks need to be broken down. That's smart planning.",
  },
  {
    id: 'park',
    label: 'Not important now, park',
    description: 'Put aside for later without pressure',
    icon: '🅿️',
    supportiveMessage: "It's wise to focus on what matters most right now.",
  },
  {
    id: 'drop',
    label: 'No longer relevant, drop',
    description: 'Remove this task entirely',
    icon: '🗑️',
    supportiveMessage: 'Letting go of tasks that no longer serve you is a sign of clarity.',
  },
]

// ===========================================
// Reason Configurations
// ===========================================

export interface RenegotiationReasonConfig {
  code: RenegotiationReasonCode
  label: string
  shortLabel: string
  icon: string
}

export const RENEGOTIATION_REASONS: RenegotiationReasonConfig[] = [
  {
    code: 'underestimated',
    label: 'I underestimated the effort',
    shortLabel: 'Underestimated',
    icon: '📏',
  },
  {
    code: 'interruption',
    label: 'Got interrupted or distracted',
    shortLabel: 'Interrupted',
    icon: '🔔',
  },
  {
    code: 'low_energy',
    label: "Didn't have the energy",
    shortLabel: 'Low energy',
    icon: '🔋',
  },
  {
    code: 'dependencies_blocked',
    label: 'Waiting on something else',
    shortLabel: 'Blocked',
    icon: '🚧',
  },
  {
    code: 'changed_priorities',
    label: 'Other things took priority',
    shortLabel: 'Priorities changed',
    icon: '🔀',
  },
  {
    code: 'forgot',
    label: 'It slipped my mind',
    shortLabel: 'Forgot',
    icon: '💭',
  },
  {
    code: 'life_happened',
    label: 'Life happened',
    shortLabel: 'Life happened',
    icon: '🌊',
  },
  {
    code: 'other',
    label: 'Something else',
    shortLabel: 'Other',
    icon: '💬',
  },
]

// ===========================================
// Quick Reschedule Options
// ===========================================

export interface QuickRescheduleOption {
  id: string
  label: string
  getDueDate: () => Date
}

export const QUICK_RESCHEDULE_OPTIONS: QuickRescheduleOption[] = [
  {
    id: 'tomorrow',
    label: 'Tomorrow',
    getDueDate: () => {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      return d
    },
  },
  {
    id: 'next_week',
    label: 'Next week',
    getDueDate: () => {
      const d = new Date()
      d.setDate(d.getDate() + 7)
      return d
    },
  },
  {
    id: 'next_month',
    label: 'Next month',
    getDueDate: () => {
      const d = new Date()
      d.setMonth(d.getMonth() + 1)
      return d
    },
  },
]

// ===========================================
// Core Interfaces
// ===========================================

export interface TaskRenegotiation {
  id: string
  task_id: string
  user_id: string
  action: RenegotiationAction
  from_due_date: string | null
  to_due_date: string | null
  reason_code: RenegotiationReasonCode
  reason_text: string | null
  split_into_task_ids: string[] | null
  created_at: string
}

export interface TaskNeedingRenegotiation {
  id: string
  title: string
  due_date: string
  days_overdue: number
  renegotiation_count: number
  outcome_title: string | null
}

export interface RenegotiationPattern {
  task_id: string
  task_title: string
  renegotiation_count: number
  most_common_reason: RenegotiationReasonCode
  suggestion: string
}

// ===========================================
// Request Types
// ===========================================

export interface RenegotiateTaskRequest {
  task_id: string
  action: RenegotiationAction
  reason_code: RenegotiationReasonCode
  reason_text?: string
  new_due_date?: string // For reschedule action
  subtasks?: SubtaskInput[] // For split action
}

export interface SubtaskInput {
  title: string
  estimated_minutes?: number
  due_date?: string
}

export interface QuickRescheduleRequest {
  task_id: string
  new_due_date: string
  reason_code: RenegotiationReasonCode
}

// ===========================================
// Response Types
// ===========================================

export interface RenegotiationResult {
  renegotiation: TaskRenegotiation
  updated_task: {
    id: string
    title: string
    status: string
    due_date: string | null
    renegotiation_count: number
  }
  created_subtasks?: Array<{
    id: string
    title: string
    due_date: string | null
  }>
  pattern_warning?: RenegotiationPattern
}

// ===========================================
// Type Guards
// ===========================================

export function isValidRenegotiationAction(value: unknown): value is RenegotiationAction {
  return (
    typeof value === 'string' &&
    ['reschedule', 'split', 'park', 'drop'].includes(value)
  )
}

export function isValidRenegotiationReasonCode(value: unknown): value is RenegotiationReasonCode {
  return (
    typeof value === 'string' &&
    [
      'underestimated',
      'interruption',
      'low_energy',
      'dependencies_blocked',
      'changed_priorities',
      'forgot',
      'life_happened',
      'other',
    ].includes(value)
  )
}

// ===========================================
// Utility Functions
// ===========================================

export function getActionConfig(action: RenegotiationAction): RenegotiationActionConfig {
  return RENEGOTIATION_ACTIONS.find(a => a.id === action) || RENEGOTIATION_ACTIONS[0]
}

export function getReasonConfig(code: RenegotiationReasonCode): RenegotiationReasonConfig {
  return RENEGOTIATION_REASONS.find(r => r.code === code) || RENEGOTIATION_REASONS[RENEGOTIATION_REASONS.length - 1]
}

export function formatDaysOverdue(days: number): string {
  if (days === 0) return 'Due today'
  if (days === 1) return 'Since yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 14) return 'Over a week ago'
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  return 'Over a month ago'
}

export function getTaskStatusLabel(
  status: string,
  dueDate: string | null,
  renegotiationCount: number
): { label: string; color: string; supportive: boolean } {
  // Check if overdue
  if (dueDate && status !== 'completed' && status !== 'parked' && status !== 'dropped') {
    const due = new Date(dueDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    due.setHours(0, 0, 0, 0)

    if (due < today) {
      // Use supportive language instead of punitive
      if (renegotiationCount > 0) {
        return {
          label: 'Replanned',
          color: '#f59e0b', // Amber, not red
          supportive: true,
        }
      }
      return {
        label: 'Needs attention',
        color: '#f59e0b',
        supportive: true,
      }
    }
  }

  // Standard status labels
  switch (status) {
    case 'active':
      return { label: 'Active', color: '#3b82f6', supportive: false }
    case 'completed':
      return { label: 'Completed', color: '#10b981', supportive: false }
    case 'parked':
      return { label: 'Parked', color: '#8b8ba7', supportive: false }
    case 'dropped':
      return { label: 'Dropped', color: '#6b6b8e', supportive: false }
    case 'needs_linking':
      return { label: 'Needs linking', color: '#a855f7', supportive: false }
    default:
      return { label: status, color: '#8b8ba7', supportive: false }
  }
}

// ===========================================
// Pattern Detection
// ===========================================

export function shouldShowPatternWarning(
  renegotiationCount: number,
  threshold: number = RENEGOTIATION_PATTERN_THRESHOLD
): boolean {
  return renegotiationCount >= threshold
}

export function getPatternSuggestion(
  mostCommonReason: RenegotiationReasonCode,
  renegotiationCount: number
): string {
  if (renegotiationCount >= 5) {
    return 'This task has been renegotiated many times. Consider if it should be dropped, delegated, or converted to a recurring habit.'
  }

  switch (mostCommonReason) {
    case 'underestimated':
      return 'This keeps taking longer than expected. Consider breaking it into smaller tasks.'
    case 'low_energy':
      return 'Energy is often a blocker. Try scheduling this during your peak energy hours.'
    case 'dependencies_blocked':
      return 'This is frequently blocked. Focus on clearing dependencies first.'
    case 'changed_priorities':
      return 'Priorities keep shifting around this task. Consider if it\'s still important.'
    case 'interruption':
      return 'Interruptions are common. Try time-blocking or finding a quiet space.'
    case 'forgot':
      return 'This slips your mind often. Set up reminders or put it in a more visible place.'
    case 'life_happened':
      return 'Life happens! Consider building more buffer into your planning.'
    default:
      return 'Consider whether this task is still serving you.'
  }
}

// ===========================================
// Split Task Helpers
// ===========================================

export function generateDefaultSubtasks(
  originalTitle: string,
  count: number = 2
): SubtaskInput[] {
  const subtasks: SubtaskInput[] = []
  for (let i = 1; i <= count; i++) {
    subtasks.push({
      title: `${originalTitle} - Part ${i}`,
      estimated_minutes: 30,
    })
  }
  return subtasks
}

export function validateSubtasks(subtasks: SubtaskInput[]): { valid: boolean; error?: string } {
  if (!Array.isArray(subtasks) || subtasks.length === 0) {
    return { valid: false, error: 'At least one subtask is required' }
  }

  if (subtasks.length > 10) {
    return { valid: false, error: 'Maximum 10 subtasks allowed' }
  }

  for (const subtask of subtasks) {
    if (!subtask.title || subtask.title.trim().length === 0) {
      return { valid: false, error: 'All subtasks must have a title' }
    }
    if (subtask.title.length > 500) {
      return { valid: false, error: 'Subtask titles must be under 500 characters' }
    }
  }

  return { valid: true }
}

// ===========================================
// Analytics Event Types
// ===========================================

export type RenegotiationEventType =
  | 'task_renegotiated'
  | 'task_split_from_renegotiation'
  | 'task_dropped_after_review'
  | 'task_parked_for_later'
  | 'repeat_renegotiation_pattern_detected'
  | 'renegotiation_modal_shown'
  | 'renegotiation_modal_dismissed'
  | 'quick_reschedule_used'

export interface RenegotiationEvent {
  id: string
  user_id: string
  event_type: RenegotiationEventType
  task_id: string | null
  renegotiation_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

// ===========================================
// Supportive Copy
// ===========================================

export const SUPPORTIVE_COPY = {
  modalTitle: 'Let\'s adjust this task',
  modalSubtitle: 'Plans change, and that\'s okay. What would you like to do?',
  overdueNotice: 'This task needs your attention',
  noShame: 'No judgment here — life happens.',
  patternNotice: 'We\'ve noticed a pattern with this task',
  successReschedule: 'Task rescheduled successfully',
  successSplit: 'Task broken down into smaller steps',
  successPark: 'Task parked for later',
  successDrop: 'Task removed from your list',
  encouragement: [
    'Making adjustments is part of the process.',
    'Flexibility is a superpower.',
    'You\'re still making progress.',
    'One step at a time.',
    'Self-compassion leads to better outcomes.',
  ],
} as const

export function getRandomEncouragement(): string {
  const messages = SUPPORTIVE_COPY.encouragement
  return messages[Math.floor(Math.random() * messages.length)]
}
