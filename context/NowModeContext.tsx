'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import { createClient } from '@/utils/supabase/client'
import type {
  NowModeState,
  NowModeSlotState,
  NowSlot,
  NowModePreferences,
  NowModeTask,
  DEFAULT_NOW_MODE_PREFERENCES,
} from '@/lib/types/now-mode'

interface NowModeContextType {
  state: NowModeState
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  pinTask: (taskId: string, slot?: NowSlot, overrideTimeWarning?: boolean) => Promise<{ success: boolean; warning?: string; error?: string }>
  unpinTask: (taskId: string) => Promise<{ success: boolean; error?: string }>
  swapTask: (currentTaskId: string, replacementTaskId: string) => Promise<{ success: boolean; error?: string }>
  completeTask: (taskId: string) => Promise<{ success: boolean; error?: string }>
  updatePreferences: (prefs: Partial<NowModePreferences>) => Promise<{ success: boolean; error?: string }>
}

const defaultState: NowModeState = {
  slots: [
    { slot: 1, task: null, isEmpty: true },
    { slot: 2, task: null, isEmpty: true },
    { slot: 3, task: null, isEmpty: true },
  ],
  occupiedCount: 0,
  allCompleted: false,
  enabled: true,
  strictLimit: true,
}

const NowModeContext = createContext<NowModeContextType | null>(null)

export function NowModeProvider({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const [state, setState] = useState<NowModeState>(defaultState)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const getAuthToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }, [])

  const refresh = useCallback(async () => {
    try {
      const token = await getAuthToken()
      if (!token) {
        setLoading(false)
        return
      }

      const res = await fetch('/api/now-mode', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        const data = await res.json()
        setState(data.state)
        setError(null)
      } else {
        const errData = await res.json()
        setError(errData.error || 'Failed to fetch Now Mode state')
      }
    } catch (err) {
      console.error('Now Mode refresh error:', err)
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }, [getAuthToken])

  useEffect(() => {
    refresh()
  }, [refresh])

  const pinTask = useCallback(async (
    taskId: string,
    slot?: NowSlot,
    overrideTimeWarning?: boolean
  ): Promise<{ success: boolean; warning?: string; error?: string }> => {
    try {
      const token = await getAuthToken()
      if (!token) return { success: false, error: 'Not authenticated' }

      const res = await fetch('/api/now-mode/pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          task_id: taskId,
          slot,
          override_time_warning: overrideTimeWarning,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        await refresh()
        return { success: true, warning: data.warning }
      }

      // Handle time override requirement
      if (data.requires_override) {
        return { success: false, warning: data.warning, error: data.error }
      }

      return { success: false, error: data.error }
    } catch (err) {
      console.error('Pin task error:', err)
      return { success: false, error: 'Failed to pin task' }
    }
  }, [getAuthToken, refresh])

  const unpinTask = useCallback(async (taskId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const token = await getAuthToken()
      if (!token) return { success: false, error: 'Not authenticated' }

      const res = await fetch('/api/now-mode/unpin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ task_id: taskId }),
      })

      if (res.ok) {
        await refresh()
        return { success: true }
      }

      const data = await res.json()
      return { success: false, error: data.error }
    } catch (err) {
      console.error('Unpin task error:', err)
      return { success: false, error: 'Failed to unpin task' }
    }
  }, [getAuthToken, refresh])

  const swapTask = useCallback(async (
    currentTaskId: string,
    replacementTaskId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const token = await getAuthToken()
      if (!token) return { success: false, error: 'Not authenticated' }

      const res = await fetch('/api/now-mode/swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_task_id: currentTaskId,
          replacement_task_id: replacementTaskId,
        }),
      })

      if (res.ok) {
        await refresh()
        return { success: true }
      }

      const data = await res.json()
      return { success: false, error: data.error }
    } catch (err) {
      console.error('Swap task error:', err)
      return { success: false, error: 'Failed to swap tasks' }
    }
  }, [getAuthToken, refresh])

  const completeTask = useCallback(async (taskId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Update task status to completed via Supabase directly
      const { error: updateError } = await supabase
        .from('focus_plans')
        .update({ status: 'completed', is_completed: true })
        .eq('id', taskId)

      if (updateError) {
        return { success: false, error: updateError.message }
      }

      // Check if all slots are now completed
      await refresh()

      // Log analytics event if all completed
      const token = await getAuthToken()
      if (token && state.occupiedCount > 0) {
        const allCompleted = state.slots
          .filter((s) => s.task !== null)
          .every((s) => s.task?.id === taskId || s.task?.status === 'completed')

        if (allCompleted) {
          await fetch('/api/now-mode', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ event: 'all_slots_completed' }),
          }).catch(() => {}) // Ignore analytics errors
        }
      }

      return { success: true }
    } catch (err) {
      console.error('Complete task error:', err)
      return { success: false, error: 'Failed to complete task' }
    }
  }, [getAuthToken, refresh, state])

  const updatePreferences = useCallback(async (
    prefs: Partial<NowModePreferences>
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const token = await getAuthToken()
      if (!token) return { success: false, error: 'Not authenticated' }

      const res = await fetch('/api/now-mode', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(prefs),
      })

      if (res.ok) {
        await refresh()
        return { success: true }
      }

      const data = await res.json()
      return { success: false, error: data.error }
    } catch (err) {
      console.error('Update preferences error:', err)
      return { success: false, error: 'Failed to update preferences' }
    }
  }, [getAuthToken, refresh])

  return (
    <NowModeContext.Provider
      value={{
        state,
        loading,
        error,
        refresh,
        pinTask,
        unpinTask,
        swapTask,
        completeTask,
        updatePreferences,
      }}
    >
      {children}
    </NowModeContext.Provider>
  )
}

export function useNowMode(): NowModeContextType {
  const context = useContext(NowModeContext)
  if (!context) {
    throw new Error('useNowMode must be used within NowModeProvider')
  }
  return context
}

export function useNowModeSafe(): NowModeContextType {
  const context = useContext(NowModeContext)
  return context || {
    state: defaultState,
    loading: false,
    error: null,
    refresh: async () => {},
    pinTask: async () => ({ success: false, error: 'Not in provider' }),
    unpinTask: async () => ({ success: false, error: 'Not in provider' }),
    swapTask: async () => ({ success: false, error: 'Not in provider' }),
    completeTask: async () => ({ success: false, error: 'Not in provider' }),
    updatePreferences: async () => ({ success: false, error: 'Not in provider' }),
  }
}
