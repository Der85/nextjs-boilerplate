/**
 * Focus Flow State Persistence
 *
 * Saves focus flow progress to sessionStorage to prevent data loss
 * on accidental page refresh or navigation.
 */

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
