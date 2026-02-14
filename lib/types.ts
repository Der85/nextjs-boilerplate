// ============================
// ADHDer.io v2 Core Types
// ============================

export interface UserProfile {
  id: string
  user_id: string
  display_name: string | null
  timezone: string
  created_at: string
  updated_at: string
}

export interface Dump {
  id: string
  user_id: string
  raw_text: string
  source: 'text' | 'voice'
  task_count: number
  created_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  color: string
  icon: string
  position: number
  is_ai_generated: boolean
  is_system: boolean
  created_at: string
  updated_at: string
}

export type TaskStatus = 'active' | 'done' | 'dropped' | 'skipped'

export type RecurrenceFrequency = 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly'

export interface RecurrenceRule {
  frequency: RecurrenceFrequency
  interval?: number  // e.g., every 2 weeks
  end_date?: string  // ISO date string
}

export interface Task {
  id: string
  user_id: string
  dump_id: string | null
  category_id: string | null
  category_confidence: number | null
  title: string
  status: TaskStatus
  due_date: string | null
  due_time: string | null
  priority: 'low' | 'medium' | 'high' | null
  original_fragment: string | null
  ai_confidence: number
  position: number
  completed_at: string | null
  dropped_at: string | null
  skipped_at: string | null
  // Recurrence fields
  is_recurring: boolean
  recurrence_rule: RecurrenceRule | null
  recurrence_parent_id: string | null
  recurring_streak: number
  created_at: string
  updated_at: string
}

export interface TaskWithCategory extends Task {
  category?: Category | null
}

export interface CategorySuggestion {
  id: string
  user_id: string
  suggestion_type: 'initial' | 'evolution'
  suggested_categories: SuggestedCategory[]
  status: 'pending' | 'accepted' | 'dismissed'
  task_count_at_suggestion: number
  resolved_at: string | null
  created_at: string
}

export interface SuggestedCategory {
  name: string
  icon: string
  color: string
  task_ids: string[]
}

// AI Response Types
export interface ParsedTask {
  title: string
  due_date: string | null
  due_time: string | null
  priority: 'low' | 'medium' | 'high'
  confidence: number
  original_fragment: string
  category?: string // AI-suggested category name
  category_confidence?: number // AI confidence in category (0-1)
}

export interface DumpParseResult {
  tasks: ParsedTask[]
}

// API Request/Response types
export interface DumpRequest {
  raw_text: string
  source: 'text' | 'voice'
}

export interface DumpResponse {
  dump: Dump
  tasks: ParsedTask[]
}

export interface TaskCreateRequest {
  dump_id: string
  tasks: ParsedTask[]
}

// Insight types
export interface InsightSummary {
  total_tasks: number
  completed_today: number
  completed_this_week: number
  current_streak: number
  completion_rate: number
}

export interface WeeklyTrend {
  week_start: string
  completed: number
  created: number
}

export interface CategoryBreakdown {
  [key: string]: string | number
  category_name: string
  category_color: string
  count: number
}

// ============================
// Sherlock Insight Engine Types
// ============================

export type InsightType = 'correlation' | 'streak' | 'warning' | 'praise' | 'category'

export interface Insight {
  type: InsightType
  title: string
  message: string
  icon: string
  // Category-specific fields
  category_id?: string
  category_color?: string
}

export interface InsightRow extends Insight {
  id: string
  user_id: string
  is_dismissed: boolean
  is_helpful: boolean | null
  data_window_start: string
  data_window_end: string
  created_at: string
}

// Per-category statistics for Sherlock analysis
export interface CategoryStats {
  categoryId: string
  categoryName: string
  categoryIcon: string
  categoryColor: string
  totalTasks: number
  completedTasks: number
  completionRate: number // 0.0 to 1.0
  droppedCount: number
  skippedCount: number
  avgDaysToComplete: number | null // average days from created to completed
}

// Cross-category analysis patterns
export interface CategoryPatterns {
  // Category balance: % of tasks per category
  balance: Array<{ name: string; icon: string; color: string; percentage: number }>
  // Categories with completion streaks
  streaks: Array<{ name: string; icon: string; days: number }>
  // Categories with no completions in 14 days
  gaps: Array<{ name: string; icon: string; lastCompleted: string | null }>
  // Total categorized tasks
  totalCategorizedTasks: number
  // Total categories with tasks
  activeCategoryCount: number
}

// ============================
// Task Templates
// ============================

export interface TaskTemplate {
  id: string
  user_id: string
  name: string
  task_name: string
  description: string | null
  priority: 'low' | 'medium' | 'high' | null
  category_id: string | null
  is_recurring_default: boolean
  recurrence_rule: RecurrenceRule | null
  tags: string[]
  use_count: number
  last_used_at: string | null
  created_at: string
  updated_at: string
}

export interface TaskTemplateWithCategory extends TaskTemplate {
  category?: Category | null
}

export interface CreateTemplateRequest {
  name: string
  task_name: string
  description?: string
  priority?: 'low' | 'medium' | 'high'
  category_id?: string
  is_recurring_default?: boolean
  recurrence_rule?: RecurrenceRule
  tags?: string[]
}

export interface CreateTemplateFromTaskRequest {
  task_id: string
  template_name: string
}

export interface CreateTaskFromTemplateRequest {
  due_date?: string
  due_time?: string
}

// ============================
// User Priorities
// ============================

export type PriorityDomain =
  | 'Work'
  | 'Health'
  | 'Home'
  | 'Finance'
  | 'Social'
  | 'Personal Growth'
  | 'Admin'
  | 'Family'

export const PRIORITY_DOMAINS: PriorityDomain[] = [
  'Work',
  'Health',
  'Home',
  'Finance',
  'Social',
  'Personal Growth',
  'Admin',
  'Family',
]

export type PriorityReviewTrigger = 'onboarding' | 'quarterly_prompt' | 'manual' | 'life_event'

export interface UserPriority {
  id: string
  user_id: string
  domain: PriorityDomain
  rank: number // 1-8, 1 = highest
  importance_score: number // 1-10
  aspirational_note: string | null
  last_reviewed_at: string
  created_at: string
  updated_at: string
}

export interface PriorityReview {
  id: string
  user_id: string
  previous_rankings: PriorityRankingSnapshot[]
  new_rankings: PriorityRankingSnapshot[]
  trigger: PriorityReviewTrigger
  created_at: string
}

export interface PriorityRankingSnapshot {
  domain: PriorityDomain
  rank: number
  importance_score: number
  aspirational_note: string | null
}

// API Request/Response types for priorities
export interface PriorityInput {
  domain: PriorityDomain
  rank: number
  importance_score: number
  aspirational_note?: string
}

export interface SetPrioritiesRequest {
  priorities: PriorityInput[]
  trigger?: PriorityReviewTrigger
}

export interface PriorityReviewDueResponse {
  isDue: boolean
  lastReviewedAt: string | null
  daysSinceReview: number | null
}
