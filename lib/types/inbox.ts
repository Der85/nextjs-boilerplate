// Types for Rapid Capture and Triage System

// ===================================================================
// ENUM TYPES
// ===================================================================

export type CaptureSource = 'quick_capture' | 'mobile' | 'email_forward' | 'voice' | 'other'
export type TriageStatus = 'pending' | 'triaged' | 'discarded'
export type TriageAction = 'do_now' | 'schedule' | 'delegate' | 'park' | 'drop'

// ===================================================================
// PARSED TOKENS
// ===================================================================

export interface ParsedTokens {
  due?: 'today' | 'this_week' | null
  project?: string | null
  priority?: 'high' | 'medium' | 'low' | null
  tags?: string[]
}

// Token patterns for parsing raw text
export const TOKEN_PATTERNS = {
  today: /@today\b/i,
  thisWeek: /@this_?week\b/i,
  high: /!high\b/i,
  medium: /!medium\b/i,
  low: /!low\b/i,
  project: /#(\w+)/g,
} as const

// ===================================================================
// TRIAGE METADATA TYPES
// ===================================================================

export interface DoNowMetadata {
  started_timer?: boolean
  timer_duration_minutes?: number
}

export interface ScheduleMetadata {
  scheduled_date: string
  timebox_minutes?: number
}

export interface DelegateMetadata {
  assignee: string
  followup_date?: string
  notes?: string
}

export interface ParkMetadata {
  someday_reason?: string
}

export interface DropMetadata {
  drop_reason?: string
}

export type TriageMetadata =
  | DoNowMetadata
  | ScheduleMetadata
  | DelegateMetadata
  | ParkMetadata
  | DropMetadata
  | Record<string, unknown>

// ===================================================================
// ENTITY INTERFACES
// ===================================================================

export interface InboxItem {
  id: string
  user_id: string
  raw_text: string
  source: CaptureSource
  parsed_tokens: ParsedTokens
  triage_status: TriageStatus
  triage_action: TriageAction | null
  triage_metadata: TriageMetadata
  triaged_at: string | null
  proposed_task_id: string | null
  converted_at: string | null
  captured_at: string
  created_at: string
  updated_at: string
}

export interface InboxItemWithAge extends InboxItem {
  age_minutes: number
  age_display: string
  inferred_urgency: 'high' | 'medium' | 'low'
}

// ===================================================================
// TYPE GUARDS
// ===================================================================

export function isValidCaptureSource(value: unknown): value is CaptureSource {
  return value === 'quick_capture' || value === 'mobile' || value === 'email_forward' || value === 'voice' || value === 'other'
}

export function isValidTriageStatus(value: unknown): value is TriageStatus {
  return value === 'pending' || value === 'triaged' || value === 'discarded'
}

export function isValidTriageAction(value: unknown): value is TriageAction {
  return value === 'do_now' || value === 'schedule' || value === 'delegate' || value === 'park' || value === 'drop'
}

// ===================================================================
// REQUEST TYPES
// ===================================================================

export interface CreateCaptureRequest {
  raw_text: string
  source?: CaptureSource
}

export interface TriageItemRequest {
  inbox_item_id: string
  action: TriageAction
  metadata?: TriageMetadata
  // For conversion to task
  outcome_id?: string | null
  commitment_id?: string | null
}

export interface BatchTriageRequest {
  items: Array<{
    inbox_item_id: string
    action: TriageAction
    metadata?: TriageMetadata
  }>
}

export interface UndoTriageRequest {
  inbox_item_id: string
}

// ===================================================================
// RESPONSE TYPES
// ===================================================================

export interface CaptureResponse {
  inbox_item: InboxItem
  parsed_tokens: ParsedTokens
}

export interface TriageResponse {
  inbox_item: InboxItem
  task?: {
    id: string
    task_name: string
    status: string
  } | null
}

export interface InboxSummary {
  pending_count: number
  oldest_pending_age_minutes: number
  triaged_today_count: number
  streak_days: number
}

// ===================================================================
// ANALYTICS EVENT TYPES
// ===================================================================

export type InboxAnalyticsEvent =
  | 'capture_created'
  | 'triage_opened'
  | 'inbox_item_triaged'
  | 'inbox_item_discarded'
  | 'capture_to_triage_time_ms'
  | 'triage_undo'
  | 'batch_triage_completed'

export interface CaptureAnalyticsPayload {
  event: 'capture_created'
  source: CaptureSource
  text_length: number
  has_tokens: boolean
}

export interface TriageAnalyticsPayload {
  event: 'inbox_item_triaged' | 'inbox_item_discarded'
  action: TriageAction
  capture_to_triage_ms: number
  item_age_minutes: number
}

// ===================================================================
// UI HELPER TYPES
// ===================================================================

export interface TriageCardData {
  item: InboxItemWithAge
  position: number
  total: number
}

export interface TriageActionConfig {
  action: TriageAction
  label: string
  icon: string
  shortcut: string
  color: string
  description: string
}

// ===================================================================
// CONSTANTS
// ===================================================================

export const TRIAGE_ACTIONS: TriageActionConfig[] = [
  {
    action: 'do_now',
    label: 'Do Now',
    icon: '⚡',
    shortcut: 'D',
    color: '#10b981',
    description: 'Start working on this immediately',
  },
  {
    action: 'schedule',
    label: 'Schedule',
    icon: '📅',
    shortcut: 'S',
    color: '#1D9BF0',
    description: 'Set a date and time',
  },
  {
    action: 'delegate',
    label: 'Delegate',
    icon: '👤',
    shortcut: 'G',
    color: '#8b5cf6',
    description: 'Assign to someone else',
  },
  {
    action: 'park',
    label: 'Park',
    icon: '🅿️',
    shortcut: 'P',
    color: '#f59e0b',
    description: 'Save for someday/maybe',
  },
  {
    action: 'drop',
    label: 'Drop',
    icon: '🗑️',
    shortcut: 'X',
    color: '#6b7280',
    description: 'Not worth doing',
  },
]

export const URGENCY_THRESHOLDS = {
  high: 60 * 24, // 24 hours in minutes
  medium: 60 * 24 * 3, // 3 days in minutes
} as const

// ===================================================================
// UTILITY FUNCTIONS
// ===================================================================

/**
 * Parse raw text for tokens like @today, #project, !high
 */
export function parseTokens(rawText: string): ParsedTokens {
  const tokens: ParsedTokens = {
    tags: [],
  }

  // Check for due date tokens
  if (TOKEN_PATTERNS.today.test(rawText)) {
    tokens.due = 'today'
  } else if (TOKEN_PATTERNS.thisWeek.test(rawText)) {
    tokens.due = 'this_week'
  }

  // Check for priority tokens
  if (TOKEN_PATTERNS.high.test(rawText)) {
    tokens.priority = 'high'
  } else if (TOKEN_PATTERNS.medium.test(rawText)) {
    tokens.priority = 'medium'
  } else if (TOKEN_PATTERNS.low.test(rawText)) {
    tokens.priority = 'low'
  }

  // Extract project/tags
  const projectMatches = rawText.matchAll(TOKEN_PATTERNS.project)
  for (const match of projectMatches) {
    if (match[1]) {
      if (!tokens.project) {
        tokens.project = match[1]
      }
      tokens.tags?.push(match[1])
    }
  }

  return tokens
}

/**
 * Remove tokens from raw text to get clean task text
 */
export function stripTokens(rawText: string): string {
  return rawText
    .replace(TOKEN_PATTERNS.today, '')
    .replace(TOKEN_PATTERNS.thisWeek, '')
    .replace(TOKEN_PATTERNS.high, '')
    .replace(TOKEN_PATTERNS.medium, '')
    .replace(TOKEN_PATTERNS.low, '')
    .replace(TOKEN_PATTERNS.project, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Calculate age display string
 */
export function getAgeDisplay(capturedAt: string): string {
  const now = new Date()
  const captured = new Date(capturedAt)
  const diffMs = now.getTime() - captured.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return captured.toLocaleDateString()
}

/**
 * Calculate inferred urgency based on age and tokens
 */
export function inferUrgency(
  ageMinutes: number,
  tokens: ParsedTokens
): 'high' | 'medium' | 'low' {
  // Priority token takes precedence
  if (tokens.priority === 'high' || tokens.due === 'today') {
    return 'high'
  }
  if (tokens.priority === 'low') {
    return 'low'
  }

  // Age-based urgency
  if (ageMinutes > URGENCY_THRESHOLDS.medium) {
    return 'high' // Old items become urgent
  }
  if (ageMinutes > URGENCY_THRESHOLDS.high) {
    return 'medium'
  }

  return tokens.priority || 'low'
}

/**
 * Enhance inbox item with computed fields
 */
export function enrichInboxItem(item: InboxItem): InboxItemWithAge {
  const capturedAt = new Date(item.captured_at)
  const now = new Date()
  const ageMinutes = Math.floor((now.getTime() - capturedAt.getTime()) / 60000)

  return {
    ...item,
    age_minutes: ageMinutes,
    age_display: getAgeDisplay(item.captured_at),
    inferred_urgency: inferUrgency(ageMinutes, item.parsed_tokens),
  }
}
