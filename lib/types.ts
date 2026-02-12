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
  created_at: string
  updated_at: string
}

export type TaskStatus = 'active' | 'done' | 'dropped'

export interface Task {
  id: string
  user_id: string
  dump_id: string | null
  category_id: string | null
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
