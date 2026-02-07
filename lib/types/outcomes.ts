// Types for Outcome-Linked Tasks System

// ===================================================================
// ENUM TYPES
// ===================================================================

export type OutcomeHorizon = 'weekly' | 'monthly' | 'quarterly'
export type OutcomeStatus = 'active' | 'paused' | 'completed' | 'archived'
export type CommitmentStatus = 'active' | 'paused' | 'completed' | 'archived'
export type TaskLinkStatus = 'active' | 'completed' | 'parked' | 'needs_linking'

// ===================================================================
// ENTITY INTERFACES
// ===================================================================

export interface Outcome {
  id: string
  user_id: string
  title: string
  description: string | null
  horizon: OutcomeHorizon
  status: OutcomeStatus
  priority_rank: number
  created_at: string
  updated_at: string
}

export interface OutcomeWithCounts extends Outcome {
  commitments_count: number
  tasks_count: number
  active_tasks_count: number
}

export interface Commitment {
  id: string
  user_id: string
  outcome_id: string
  title: string
  description: string | null
  status: CommitmentStatus
  created_at: string
  updated_at: string
}

export interface CommitmentWithOutcome extends Commitment {
  outcome?: Pick<Outcome, 'id' | 'title' | 'horizon'>
}

export interface CommitmentWithTasks extends Commitment {
  tasks_count: number
  active_tasks_count: number
  outcome?: Pick<Outcome, 'id' | 'title' | 'horizon'>
}

// Extended focus plan with outcome linking
export interface LinkedFocusPlan {
  id: string
  user_id: string
  task_name: string
  status: TaskLinkStatus
  due_date: string | null
  outcome_id: string | null
  commitment_id: string | null
  created_at: string
  // Joined data
  outcome?: Pick<Outcome, 'id' | 'title' | 'horizon'> | null
  commitment?: Pick<Commitment, 'id' | 'title'> | null
}

// ===================================================================
// TYPE GUARDS (following existing pattern in codebase)
// ===================================================================

export function isValidOutcomeHorizon(value: unknown): value is OutcomeHorizon {
  return value === 'weekly' || value === 'monthly' || value === 'quarterly'
}

export function isValidOutcomeStatus(value: unknown): value is OutcomeStatus {
  return value === 'active' || value === 'paused' || value === 'completed' || value === 'archived'
}

export function isValidCommitmentStatus(value: unknown): value is CommitmentStatus {
  return value === 'active' || value === 'paused' || value === 'completed' || value === 'archived'
}

export function isValidTaskLinkStatus(value: unknown): value is TaskLinkStatus {
  return value === 'active' || value === 'completed' || value === 'parked' || value === 'needs_linking'
}

export function isValidUUID(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(value)
}

// ===================================================================
// REQUEST TYPES
// ===================================================================

export interface CreateOutcomeRequest {
  title: string
  description?: string | null
  horizon: OutcomeHorizon
  priority_rank?: number
}

export interface UpdateOutcomeRequest {
  title?: string
  description?: string | null
  horizon?: OutcomeHorizon
  status?: OutcomeStatus
  priority_rank?: number
}

export interface CreateCommitmentRequest {
  outcome_id: string
  title: string
  description?: string | null
}

export interface UpdateCommitmentRequest {
  title?: string
  description?: string | null
  status?: CommitmentStatus
  outcome_id?: string  // For relinking to a different outcome
}

export interface LinkTaskRequest {
  task_id: string
  outcome_id?: string | null
  commitment_id?: string | null
}

export interface BulkRelinkRequest {
  task_ids: string[]
  target_outcome_id?: string | null
  target_commitment_id?: string | null
}

// ===================================================================
// RESPONSE TYPES
// ===================================================================

export interface OutcomeDetailResponse {
  outcome: Outcome
  commitments: CommitmentWithTasks[]
  tasks: LinkedFocusPlan[]
}

export interface DeleteOutcomeBlockedResponse {
  error: string
  activeTasks: Array<{ id: string; task_name: string }>
  requiresRelink: true
}

export interface BulkRelinkResponse {
  success: boolean
  relinked_count: number
}

// ===================================================================
// ANALYTICS EVENT TYPES
// ===================================================================

export type OutcomeAnalyticsEvent =
  | 'outcome_created'
  | 'outcome_updated'
  | 'outcome_completed'
  | 'outcome_archived'
  | 'commitment_created'
  | 'commitment_updated'
  | 'commitment_relinked'
  | 'task_linked_to_outcome'
  | 'task_linked_to_commitment'
  | 'task_relinked'
  | 'bulk_tasks_relinked'

export interface AnalyticsEventPayload {
  event: OutcomeAnalyticsEvent
  user_id: string
  outcome_id?: string
  commitment_id?: string
  task_id?: string
  task_ids?: string[]
  metadata?: Record<string, unknown>
}

// ===================================================================
// UI HELPER TYPES
// ===================================================================

export interface OutcomeOption {
  id: string
  title: string
  horizon: OutcomeHorizon
  status: OutcomeStatus
}

export interface CommitmentOption {
  id: string
  title: string
  outcome_id: string
  outcome_title?: string
}

export type ParentSelectorTab = 'outcome' | 'commitment'

export interface ParentSelection {
  type: ParentSelectorTab
  outcomeId: string | null
  commitmentId: string | null
}

// ===================================================================
// CONSTANTS
// ===================================================================

export const HORIZON_LABELS: Record<OutcomeHorizon, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
}

export const HORIZON_COLORS: Record<OutcomeHorizon, string> = {
  weekly: '#10b981',   // Green
  monthly: '#1D9BF0',  // Blue
  quarterly: '#8b5cf6', // Purple
}

export const STATUS_LABELS: Record<OutcomeStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
}
