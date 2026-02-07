// Types for Now Mode - Limited Cognitive Load System

// ===================================================================
// CONSTANTS
// ===================================================================

export const NOW_MODE_MAX_SLOTS = 3
export const NOW_MODE_MAX_MINUTES = 90 // Default max time estimate without warning

// ===================================================================
// SLOT TYPES
// ===================================================================

export type NowSlot = 1 | 2 | 3

export function isValidNowSlot(value: unknown): value is NowSlot {
  return value === 1 || value === 2 || value === 3
}

// ===================================================================
// USER PREFERENCES
// ===================================================================

export interface NowModePreferences {
  now_mode_enabled: boolean
  now_mode_strict_limit: boolean
}

export const DEFAULT_NOW_MODE_PREFERENCES: NowModePreferences = {
  now_mode_enabled: true,
  now_mode_strict_limit: true,
}

// ===================================================================
// TASK IN NOW MODE
// ===================================================================

export interface NowModeTask {
  id: string
  user_id: string
  task_name: string
  status: 'active' | 'completed' | 'needs_linking'
  now_slot: NowSlot
  estimated_minutes: number | null
  due_date: string | null
  outcome_id: string | null
  commitment_id: string | null
  // Populated from join
  outcome_title?: string
  commitment_title?: string
  steps?: Array<{
    id: string
    text: string
    completed: boolean
  }>
}

export interface NowModeSlotState {
  slot: NowSlot
  task: NowModeTask | null
  isEmpty: boolean
}

export interface NowModeState {
  slots: [NowModeSlotState, NowModeSlotState, NowModeSlotState]
  occupiedCount: number
  allCompleted: boolean
  enabled: boolean
  strictLimit: boolean
}

// ===================================================================
// API REQUEST TYPES
// ===================================================================

export interface PinToNowModeRequest {
  task_id: string
  slot?: NowSlot // Auto-assign if not specified
  override_time_warning?: boolean // Allow tasks > 90 min
}

export interface UnpinFromNowModeRequest {
  task_id: string
}

export interface SwapNowModeTaskRequest {
  current_task_id: string
  replacement_task_id: string
}

export interface UpdateNowModePrefsRequest {
  now_mode_enabled?: boolean
  now_mode_strict_limit?: boolean
}

// ===================================================================
// API RESPONSE TYPES
// ===================================================================

export interface NowModeResponse {
  state: NowModeState
}

export interface PinToNowModeResponse {
  success: boolean
  task: NowModeTask
  slot: NowSlot
  warning?: string // Time override warning
}

export interface UnpinFromNowModeResponse {
  success: boolean
  task_id: string
}

export interface SwapNowModeTaskResponse {
  success: boolean
  unpinned_task_id: string
  pinned_task: NowModeTask
  slot: NowSlot
}

export interface RecommendedTasksResponse {
  tasks: Array<{
    id: string
    task_name: string
    estimated_minutes: number | null
    outcome_title: string | null
    commitment_title: string | null
    due_date: string | null
    score: number // Recommendation score
  }>
}

// ===================================================================
// ANALYTICS EVENT TYPES
// ===================================================================

export type NowModeAnalyticsEvent =
  | 'now_mode_enabled'
  | 'now_mode_disabled'
  | 'task_pinned_now_mode'
  | 'task_unpinned_now_mode'
  | 'task_swapped_now_mode'
  | 'now_mode_all_slots_completed'
  | 'now_mode_time_override'

export interface NowModeEventPayload {
  event: NowModeAnalyticsEvent
  task_id?: string
  slot?: NowSlot
  metadata?: Record<string, unknown>
}

// ===================================================================
// VALIDATION HELPERS
// ===================================================================

export interface PinValidationResult {
  canPin: boolean
  error?: string
  warning?: string
}

/**
 * Validate if a task can be pinned to Now Mode
 */
export function validatePinToNowMode(
  task: {
    status: string
    outcome_id: string | null
    commitment_id: string | null
    estimated_minutes: number | null
    now_slot: number | null
  },
  currentSlotCount: number,
  preferences: NowModePreferences
): PinValidationResult {
  // Already in Now Mode
  if (task.now_slot !== null) {
    return { canPin: false, error: 'Task is already in Now Mode' }
  }

  // Check slot availability
  if (currentSlotCount >= NOW_MODE_MAX_SLOTS) {
    if (preferences.now_mode_strict_limit) {
      return { canPin: false, error: 'All 3 Now Mode slots are occupied. Complete or unpin a task first.' }
    }
    return { canPin: false, warning: 'All slots occupied - consider completing current tasks' }
  }

  // Check linkage
  if (task.outcome_id === null && task.commitment_id === null) {
    return { canPin: false, error: 'Task must be linked to an Outcome or Commitment before pinning to Now Mode' }
  }

  // Check status
  if (task.status === 'completed') {
    return { canPin: false, error: 'Cannot pin a completed task' }
  }

  // Check time estimate
  if (task.estimated_minutes && task.estimated_minutes > NOW_MODE_MAX_MINUTES) {
    return {
      canPin: true,
      warning: `Task estimate (${task.estimated_minutes} min) exceeds ${NOW_MODE_MAX_MINUTES} min. Consider breaking it down.`,
    }
  }

  return { canPin: true }
}

/**
 * Check if all Now Mode slots are completed
 */
export function areAllSlotsCompleted(slots: NowModeSlotState[]): boolean {
  const occupiedSlots = slots.filter((s) => s.task !== null)
  if (occupiedSlots.length === 0) return false
  return occupiedSlots.every((s) => s.task?.status === 'completed')
}

// ===================================================================
// UI HELPER TYPES
// ===================================================================

export interface NowModeSlotCardProps {
  slot: NowSlot
  task: NowModeTask | null
  onStart?: () => void
  onComplete?: () => void
  onUnpin?: () => void
  onSwap?: () => void
  isActive?: boolean
}

export interface NowModePanelProps {
  state: NowModeState
  onPinTask: (taskId: string, slot?: NowSlot) => void
  onUnpinTask: (taskId: string) => void
  onStartTask: (taskId: string) => void
  onCompleteTask: (taskId: string) => void
  onSwapTask: (currentTaskId: string, replacementTaskId: string) => void
  onRevealBacklog: () => void
  backlogVisible: boolean
}

// ===================================================================
// KEYBOARD SHORTCUTS
// ===================================================================

export const NOW_MODE_SHORTCUTS = {
  slot1: '1',
  slot2: '2',
  slot3: '3',
  revealBacklog: 'b',
  startSelected: 'Enter',
  completeSelected: 'c',
  swapSelected: 's',
} as const
