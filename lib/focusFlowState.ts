/**
 * Focus Flow State Persistence
 *
 * Dual persistence strategy:
 * 1. sessionStorage - for quick access within the same browser session
 * 2. Database (focus_plans with is_draft=true) - for persistence across sessions/devices
 *
 * This prevents data loss on accidental page refresh, browser close, or navigation.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const STORAGE_KEY = 'focus-flow-draft'

export interface FocusFlowDraft {
  step: 'brain-dump' | 'triage' | 'context' | 'breakdown' | 'dashboard'
  brainDumpText?: string
  parsedTasks?: Array<{ id: string; text: string }>
  tasksWithContext?: Array<{
    id: string
    text: string
    dueDate: string
    energyLevel: string
  }>
  breakdowns?: Array<{
    taskName: string
    dueDate: string
    energyLevel: string
    steps: Array<{
      id: string
      text: string
      dueBy: string
      timeEstimate: string
      completed: boolean
    }>
  }>
  handoffGoalId?: string | null
  handoffStepId?: string | null
  userMode?: 'recovery' | 'growth' | 'maintenance'
  energyLevel?: 'high' | 'low' | null
  updatedAt: number
}

/**
 * Save current focus flow state to sessionStorage
 */
export function saveFocusFlowDraft(draft: Omit<FocusFlowDraft, 'updatedAt'>): void {
  try {
    const draftWithTimestamp: FocusFlowDraft = {
      ...draft,
      updatedAt: Date.now(),
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draftWithTimestamp))
  } catch (e) {
    console.warn('Failed to save focus flow draft:', e)
  }
}

/**
 * Load saved focus flow state from sessionStorage
 * Returns null if no draft exists or if it's expired (> 2 hours old)
 */
export function loadFocusFlowDraft(): FocusFlowDraft | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (!stored) return null

    const draft = JSON.parse(stored) as FocusFlowDraft

    // Expire drafts older than 2 hours
    const TWO_HOURS = 2 * 60 * 60 * 1000
    if (Date.now() - draft.updatedAt > TWO_HOURS) {
      clearFocusFlowDraft()
      return null
    }

    return draft
  } catch (e) {
    console.warn('Failed to load focus flow draft:', e)
    return null
  }
}

/**
 * Clear saved focus flow state
 * Call this when the flow is completed successfully
 */
export function clearFocusFlowDraft(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch (e) {
    console.warn('Failed to clear focus flow draft:', e)
  }
}

/**
 * Check if there's a resumable draft
 */
export function hasResumableDraft(): boolean {
  return loadFocusFlowDraft() !== null
}

// ============================================
// DATABASE PERSISTENCE (focus_plans table)
// ============================================

/**
 * Save focus flow draft to database for cross-session persistence.
 * Uses upsert to ensure only one draft per user exists.
 */
export async function saveFocusFlowDraftToDb(
  supabase: SupabaseClient,
  userId: string,
  draft: Omit<FocusFlowDraft, 'updatedAt'>
): Promise<{ success: boolean; error?: string }> {
  try {
    const draftData: FocusFlowDraft = {
      ...draft,
      updatedAt: Date.now(),
    }

    // First, try to find existing draft
    const { data: existing } = await supabase
      .from('focus_plans')
      .select('id')
      .eq('user_id', userId)
      .eq('is_draft', true)
      .single()

    if (existing) {
      // Update existing draft
      const { error } = await supabase
        .from('focus_plans')
        .update({
          draft_data: draftData,
          task_name: `Draft: ${draft.step}`, // Visual indicator
        })
        .eq('id', existing.id)

      if (error) {
        console.error('Failed to update draft in database:', error)
        return { success: false, error: error.message }
      }
    } else {
      // Insert new draft
      const { error } = await supabase
        .from('focus_plans')
        .insert({
          user_id: userId,
          is_draft: true,
          draft_data: draftData,
          task_name: `Draft: ${draft.step}`,
          steps: [],
          is_completed: false,
        })

      if (error) {
        console.error('Failed to save draft to database:', error)
        return { success: false, error: error.message }
      }
    }

    // Also save to sessionStorage for quick access
    saveFocusFlowDraft(draft)

    return { success: true }
  } catch (e) {
    console.error('Failed to save focus flow draft to database:', e)
    return { success: false, error: String(e) }
  }
}

/**
 * Load focus flow draft from database.
 * Returns null if no draft exists or if it's expired (> 24 hours old for DB drafts).
 */
export async function loadFocusFlowDraftFromDb(
  supabase: SupabaseClient,
  userId: string
): Promise<FocusFlowDraft | null> {
  try {
    const { data, error } = await supabase
      .from('focus_plans')
      .select('draft_data')
      .eq('user_id', userId)
      .eq('is_draft', true)
      .single()

    if (error || !data?.draft_data) {
      return null
    }

    const draft = data.draft_data as FocusFlowDraft

    // Expire drafts older than 24 hours (longer than sessionStorage)
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000
    if (Date.now() - draft.updatedAt > TWENTY_FOUR_HOURS) {
      await clearFocusFlowDraftFromDb(supabase, userId)
      return null
    }

    return draft
  } catch (e) {
    console.error('Failed to load focus flow draft from database:', e)
    return null
  }
}

/**
 * Clear focus flow draft from database.
 * Call this when the flow is completed successfully.
 */
export async function clearFocusFlowDraftFromDb(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  try {
    await supabase
      .from('focus_plans')
      .delete()
      .eq('user_id', userId)
      .eq('is_draft', true)

    // Also clear sessionStorage
    clearFocusFlowDraft()
  } catch (e) {
    console.error('Failed to clear focus flow draft from database:', e)
  }
}
