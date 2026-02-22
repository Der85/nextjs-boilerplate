import { z } from 'zod'
import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'

// ============================
// Shared primitives
// ============================

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/
const timeRegex = /^\d{2}:\d{2}$/
const hexColorRegex = /^#[0-9a-fA-F]{3,8}$/

const isoDate = z.string().regex(isoDateRegex, 'Expected YYYY-MM-DD format')
const timeString = z.string().regex(timeRegex, 'Expected HH:MM format')
const priority = z.enum(['low', 'medium', 'high'])
const taskStatus = z.enum(['active', 'done', 'dropped', 'skipped'])
const recurrenceFrequency = z.enum(['daily', 'weekdays', 'weekly', 'biweekly', 'monthly'])

const recurrenceRule = z.object({
  frequency: recurrenceFrequency,
  interval: z.number().int().min(1).max(365).optional(),
  end_date: isoDate.optional(),
})

// ============================
// Task schemas
// ============================

const parsedTaskItem = z.object({
  title: z.string().min(1).max(500),
  due_date: isoDate.nullable().optional(),
  due_time: timeString.nullable().optional(),
  priority: priority.optional().default('medium'),
  confidence: z.number().min(0).max(1).optional(),
  original_fragment: z.string().max(2000).nullable().optional(),
  category: z.string().max(100).optional(),
  category_confidence: z.number().min(0).max(1).optional(),
})

export const taskCreateSchema = z.object({
  dump_id: z.string().min(1, 'dump_id is required'),
  tasks: z.array(parsedTaskItem).min(1).max(100),
})

export const taskPatchSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  status: taskStatus.optional(),
  due_date: isoDate.nullable().optional(),
  due_time: timeString.nullable().optional(),
  priority: priority.nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  position: z.number().int().min(0).optional(),
  is_recurring: z.boolean().optional(),
  recurrence_rule: recurrenceRule.nullable().optional(),
})

export const taskReorderSchema = z.object({
  tasks: z.array(
    z.object({
      id: z.string().min(1),
      position: z.number().int().min(0),
    })
  ).min(1).max(500),
})

// ============================
// Dump schema
// ============================

export const dumpCreateSchema = z.object({
  raw_text: z.string().min(3, 'Please enter at least a few words.').max(5000, 'Text too long (max 5000 characters).'),
  source: z.enum(['text', 'voice']).default('text'),
})

// ============================
// Category schemas
// ============================

export const categoryCreateSchema = z.object({
  name: z.string().min(1, 'Category name is required.').max(50),
  color: z.string().regex(hexColorRegex, 'Invalid color format.').optional().default('#3B82F6'),
  icon: z.string().max(10).optional(),
})

export const categoryPatchSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(hexColorRegex, 'Invalid color format.').optional(),
  icon: z.string().max(10).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'No valid fields to update.',
})

// ============================
// Template schemas
// ============================

export const templateCreateSchema = z.object({
  name: z.string().min(1, 'Template name is required.').max(100),
  task_name: z.string().min(1, 'Task name is required.').max(500),
  description: z.string().max(1000).nullable().optional(),
  priority: priority.nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  is_recurring_default: z.boolean().optional().default(false),
  recurrence_rule: recurrenceRule.nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
})

export const templatePatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  task_name: z.string().min(1).max(500).optional(),
  description: z.string().max(1000).nullable().optional(),
  priority: priority.nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  is_recurring_default: z.boolean().optional(),
  recurrence_rule: recurrenceRule.nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
})

export const templateFromTaskSchema = z.object({
  task_id: z.string().min(1, 'Task ID is required.'),
  template_name: z.string().min(1, 'Template name is required.').max(100),
})

export const templateCreateTaskSchema = z.object({
  due_date: isoDate.optional(),
  due_time: timeString.optional(),
})

// ============================
// Priority schemas
// ============================

const priorityDomain = z.enum([
  'Work', 'Health', 'Home', 'Finance',
  'Social', 'Personal Growth', 'Admin', 'Family',
])

const priorityReviewTrigger = z.enum(['onboarding', 'quarterly_prompt', 'manual', 'life_event'])

export const prioritiesSetSchema = z.object({
  priorities: z.array(
    z.object({
      domain: priorityDomain,
      rank: z.number().int().min(1).max(8),
      importance_score: z.number().int().min(1).max(10),
      aspirational_note: z.string().max(500).optional(),
    })
  ).length(8),
  trigger: priorityReviewTrigger.optional().default('manual'),
})

// ============================
// Reminder preferences schema
// ============================

export const reminderPreferencesSchema = z.object({
  reminders_enabled: z.boolean().optional(),
  quiet_hours_start: timeString.optional(),
  quiet_hours_end: timeString.optional(),
  max_reminders_per_day: z.number().int().min(1).max(15).optional(),
  reminder_lead_time_minutes: z.enum(['15', '30', '60', '120']).transform(Number).or(z.literal(15).or(z.literal(30)).or(z.literal(60)).or(z.literal(120))).optional(),
  preferred_reminder_times: z.array(timeString).max(3).optional(),
  weekend_reminders: z.boolean().optional(),
  high_priority_override: z.boolean().optional(),
})

// ============================
// Snooze schemas
// ============================

export const reminderSnoozeSchema = z.object({
  duration: z.enum(['10min', '30min', '1hour', 'after_lunch', 'tomorrow_morning']),
})

export const suggestionSnoozeSchema = z.object({
  until: z.enum(['tomorrow', 'next_week', 'next_month']),
})

export const categorySuggestionActionSchema = z.object({
  action: z.enum(['accept', 'dismiss']),
})

// ============================
// Profile schema
// ============================

export const profilePatchSchema = z.object({
  display_name: z.string().max(100).optional(),
  timezone: z.string().max(100).optional(),
}).refine(data => data.display_name !== undefined || data.timezone !== undefined, {
  message: 'No valid fields to update.',
})

// ============================
// Weekly review schema
// ============================

export const weeklyReviewPatchSchema = z.object({
  user_reflection: z.string().max(5000).optional(),
  is_read: z.boolean().optional(),
}).refine(data => data.user_reflection !== undefined || data.is_read !== undefined, {
  message: 'No updates provided.',
})

// ============================
// Validation helper
// ============================

/**
 * Parse and validate a request body with a Zod schema.
 * Returns the parsed data on success, or a NextResponse error on failure.
 */
export function parseBody<T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }

  const firstIssue = result.error.issues[0]
  const message = firstIssue
    ? `${firstIssue.path.join('.')}: ${firstIssue.message}`.replace(/^: /, '')
    : 'Invalid request body.'

  return {
    success: false,
    response: apiError(message, 400, 'VALIDATION_ERROR') as NextResponse,
  }
}
