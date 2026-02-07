// Types for Daily State Check-in and Adaptive UX

// ===================================================================
// CONSTANTS
// ===================================================================

export const CHECKIN_SCALE_MIN = 1
export const CHECKIN_SCALE_MAX = 5

// Threshold values for adaptive behavior
export const THRESHOLDS = {
  HIGH_OVERWHELM: 4,
  HIGH_ANXIETY: 4,
  LOW_ENERGY: 2,
  LOW_CLARITY: 2,
} as const

// ===================================================================
// SCALE TYPES
// ===================================================================

export type CheckinScale = 1 | 2 | 3 | 4 | 5

export function isValidCheckinScale(value: unknown): value is CheckinScale {
  return typeof value === 'number' && value >= 1 && value <= 5 && Number.isInteger(value)
}

// ===================================================================
// ENTITY INTERFACES
// ===================================================================

export interface DailyCheckin {
  id: string
  user_id: string
  date: string // YYYY-MM-DD
  overwhelm: CheckinScale
  anxiety: CheckinScale
  energy: CheckinScale
  clarity: CheckinScale
  note: string | null
  created_at: string
  updated_at: string
}

export interface DailyCheckinWithMetadata extends DailyCheckin {
  is_today: boolean
}

export interface CheckinTrendPoint {
  date: string
  overwhelm: CheckinScale
  anxiety: CheckinScale
  energy: CheckinScale
  clarity: CheckinScale
}

export interface CheckinCorrelations {
  high_overwhelm_avg_untriaged: number | null
  low_overwhelm_avg_untriaged: number | null
  high_energy_tasks_completed: number | null
  low_energy_tasks_completed: number | null
  total_checkins: number
}

// ===================================================================
// ADAPTIVE MODE TYPES
// ===================================================================

export type AdaptiveTrigger =
  | 'high_overwhelm'
  | 'high_anxiety'
  | 'low_energy'
  | 'low_clarity'
  | 'combined_stress'

export interface AdaptiveState {
  simplifiedUIEnabled: boolean
  reducedTasksMode: boolean
  suggestLowCognitiveLoad: boolean
  prioritizeShortTasks: boolean
  showPlanningMicroStep: boolean
  triggers: AdaptiveTrigger[]
  recommendations: AdaptiveRecommendation[]
}

export interface AdaptiveRecommendation {
  id: string
  type: 'action' | 'suggestion' | 'resource'
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  actionType?: 'navigate' | 'enable_feature' | 'dismiss'
  actionPath?: string
}

export const DEFAULT_ADAPTIVE_STATE: AdaptiveState = {
  simplifiedUIEnabled: false,
  reducedTasksMode: false,
  suggestLowCognitiveLoad: false,
  prioritizeShortTasks: false,
  showPlanningMicroStep: false,
  triggers: [],
  recommendations: [],
}

// ===================================================================
// ADAPTIVE EVENT TYPES
// ===================================================================

export type AdaptiveEventType =
  | 'daily_checkin_submitted'
  | 'adaptive_mode_triggered'
  | 'simplified_ui_enabled'
  | 'state_based_recommendation_shown'
  | 'state_based_recommendation_accepted'
  | 'state_based_recommendation_dismissed'

export interface AdaptiveModeEvent {
  id: string
  user_id: string
  event_type: AdaptiveEventType
  trigger_reason: AdaptiveTrigger | null
  checkin_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

// ===================================================================
// REQUEST TYPES
// ===================================================================

export interface UpsertCheckinRequest {
  overwhelm: CheckinScale
  anxiety: CheckinScale
  energy: CheckinScale
  clarity: CheckinScale
  note?: string | null
  date?: string // Defaults to today
}

export interface FetchCheckinsRequest {
  range: 'week' | 'month' | 'all'
  limit?: number
}

// ===================================================================
// RESPONSE TYPES
// ===================================================================

export interface UpsertCheckinResponse {
  checkin: DailyCheckin
  adaptive_state: AdaptiveState
  is_new: boolean
}

export interface LatestCheckinResponse {
  checkin: DailyCheckinWithMetadata | null
  needs_checkin_today: boolean
  adaptive_state: AdaptiveState
}

export interface CheckinTrendResponse {
  trend: CheckinTrendPoint[]
  correlations: CheckinCorrelations | null
}

// ===================================================================
// ANALYTICS TYPES
// ===================================================================

export interface CheckinAnalyticsPayload {
  event: 'daily_checkin_submitted'
  overwhelm: CheckinScale
  anxiety: CheckinScale
  energy: CheckinScale
  clarity: CheckinScale
  has_note: boolean
  is_update: boolean
}

export interface AdaptiveAnalyticsPayload {
  event: 'adaptive_mode_triggered' | 'state_based_recommendation_accepted'
  triggers: AdaptiveTrigger[]
  recommendations_shown: number
}

// ===================================================================
// UI HELPER TYPES
// ===================================================================

export interface CheckinMetricConfig {
  key: keyof Pick<DailyCheckin, 'overwhelm' | 'anxiety' | 'energy' | 'clarity'>
  label: string
  lowLabel: string
  highLabel: string
  icon: string
  color: string
  invertedScale?: boolean // For overwhelm/anxiety, lower is better
}

export const CHECKIN_METRICS: CheckinMetricConfig[] = [
  {
    key: 'overwhelm',
    label: 'Overwhelm',
    lowLabel: 'Calm',
    highLabel: 'Overwhelmed',
    icon: '🌊',
    color: '#ef4444',
    invertedScale: true,
  },
  {
    key: 'anxiety',
    label: 'Anxiety',
    lowLabel: 'Relaxed',
    highLabel: 'Anxious',
    icon: '💭',
    color: '#f59e0b',
    invertedScale: true,
  },
  {
    key: 'energy',
    label: 'Energy',
    lowLabel: 'Exhausted',
    highLabel: 'Energized',
    icon: '⚡',
    color: '#10b981',
    invertedScale: false,
  },
  {
    key: 'clarity',
    label: 'Clarity',
    lowLabel: 'Foggy',
    highLabel: 'Clear',
    icon: '🎯',
    color: '#1D9BF0',
    invertedScale: false,
  },
]

// ===================================================================
// VALIDATION HELPERS
// ===================================================================

export interface CheckinValidationResult {
  valid: boolean
  errors: string[]
}

export function validateCheckinData(data: Partial<UpsertCheckinRequest>): CheckinValidationResult {
  const errors: string[] = []

  if (!isValidCheckinScale(data.overwhelm)) {
    errors.push('Overwhelm must be between 1 and 5')
  }
  if (!isValidCheckinScale(data.anxiety)) {
    errors.push('Anxiety must be between 1 and 5')
  }
  if (!isValidCheckinScale(data.energy)) {
    errors.push('Energy must be between 1 and 5')
  }
  if (!isValidCheckinScale(data.clarity)) {
    errors.push('Clarity must be between 1 and 5')
  }

  if (data.date !== undefined) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(data.date)) {
      errors.push('Date must be in YYYY-MM-DD format')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// ===================================================================
// SPARKLINE HELPER TYPES
// ===================================================================

export interface SparklineData {
  values: number[]
  labels: string[]
  min: number
  max: number
  average: number
  trend: 'up' | 'down' | 'stable'
}

export function calculateSparklineData(
  points: CheckinTrendPoint[],
  metric: keyof Pick<CheckinTrendPoint, 'overwhelm' | 'anxiety' | 'energy' | 'clarity'>
): SparklineData {
  if (points.length === 0) {
    return { values: [], labels: [], min: 1, max: 5, average: 0, trend: 'stable' }
  }

  const values = points.map((p) => p[metric])
  const labels = points.map((p) => p.date)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const average = values.reduce((a, b) => a + b, 0) / values.length

  // Calculate trend from first half vs second half average
  const midpoint = Math.floor(values.length / 2)
  const firstHalf = values.slice(0, midpoint)
  const secondHalf = values.slice(midpoint)
  const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0
  const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0

  let trend: 'up' | 'down' | 'stable' = 'stable'
  if (secondAvg > firstAvg + 0.5) trend = 'up'
  else if (secondAvg < firstAvg - 0.5) trend = 'down'

  return { values, labels, min, max, average, trend }
}
