/**
 * Emergency State Persistence
 *
 * Saves component state to localStorage before a crash, ensuring no data is lost.
 * Used by StateSavingErrorBoundary to preserve user progress during errors.
 *
 * For ADHD users, losing work is a trust-breaking experience. This ensures
 * that even if a component crashes, their progress is preserved.
 */

const EMERGENCY_STATE_PREFIX = 'emergency-state-'
const MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

export interface EmergencyStateEntry<T = unknown> {
  state: T
  savedAt: number
  componentName: string
  errorMessage?: string
  errorStack?: string
}

/**
 * Save emergency state before a crash
 */
export function saveEmergencyState<T>(
  componentName: string,
  state: T,
  error?: Error
): void {
  try {
    const key = `${EMERGENCY_STATE_PREFIX}${componentName}`
    const entry: EmergencyStateEntry<T> = {
      state,
      savedAt: Date.now(),
      componentName,
      errorMessage: error?.message,
      errorStack: error?.stack,
    }
    localStorage.setItem(key, JSON.stringify(entry))
    console.log(`[Emergency] Saved state for ${componentName}`)
  } catch (e) {
    console.error('[Emergency] Failed to save state:', e)
  }
}

/**
 * Load emergency state if available and not expired
 */
export function loadEmergencyState<T>(componentName: string): T | null {
  try {
    const key = `${EMERGENCY_STATE_PREFIX}${componentName}`
    const stored = localStorage.getItem(key)
    if (!stored) return null

    const entry = JSON.parse(stored) as EmergencyStateEntry<T>

    // Check expiry
    if (Date.now() - entry.savedAt > MAX_AGE_MS) {
      clearEmergencyState(componentName)
      return null
    }

    return entry.state
  } catch (e) {
    console.error('[Emergency] Failed to load state:', e)
    return null
  }
}

/**
 * Clear emergency state after successful recovery
 */
export function clearEmergencyState(componentName: string): void {
  try {
    const key = `${EMERGENCY_STATE_PREFIX}${componentName}`
    localStorage.removeItem(key)
  } catch (e) {
    console.error('[Emergency] Failed to clear state:', e)
  }
}

/**
 * Check if emergency state exists for a component
 */
export function hasEmergencyState(componentName: string): boolean {
  try {
    const key = `${EMERGENCY_STATE_PREFIX}${componentName}`
    const stored = localStorage.getItem(key)
    if (!stored) return false

    const entry = JSON.parse(stored) as EmergencyStateEntry
    return Date.now() - entry.savedAt <= MAX_AGE_MS
  } catch {
    return false
  }
}

/**
 * Get emergency state metadata (for showing recovery UI)
 */
export function getEmergencyStateInfo(componentName: string): {
  exists: boolean
  savedAt?: Date
  errorMessage?: string
} {
  try {
    const key = `${EMERGENCY_STATE_PREFIX}${componentName}`
    const stored = localStorage.getItem(key)
    if (!stored) return { exists: false }

    const entry = JSON.parse(stored) as EmergencyStateEntry
    if (Date.now() - entry.savedAt > MAX_AGE_MS) {
      return { exists: false }
    }

    return {
      exists: true,
      savedAt: new Date(entry.savedAt),
      errorMessage: entry.errorMessage,
    }
  } catch {
    return { exists: false }
  }
}

/**
 * Clean up all expired emergency states
 * Call this periodically or on app startup
 */
export function cleanupExpiredEmergencyStates(): void {
  try {
    const keysToRemove: string[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(EMERGENCY_STATE_PREFIX)) {
        const stored = localStorage.getItem(key)
        if (stored) {
          try {
            const entry = JSON.parse(stored) as EmergencyStateEntry
            if (Date.now() - entry.savedAt > MAX_AGE_MS) {
              keysToRemove.push(key)
            }
          } catch {
            keysToRemove.push(key) // Remove invalid entries
          }
        }
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key))
    if (keysToRemove.length > 0) {
      console.log(`[Emergency] Cleaned up ${keysToRemove.length} expired states`)
    }
  } catch (e) {
    console.error('[Emergency] Failed to cleanup states:', e)
  }
}
