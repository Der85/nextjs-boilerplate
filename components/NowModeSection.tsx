'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import NowModePanel from './NowModePanel'
import TaskPickerModal from './TaskPickerModal'
import type {
  NowModeState,
  NowModeSlotState,
  NowSlot,
  NowModeTask,
  NowModePreferences,
} from '@/lib/types/now-mode'

interface NowModeSectionProps {
  userId: string
  onStartTask?: (taskId: string) => void
  onTaskCompleted?: () => void
  className?: string
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

export default function NowModeSection({
  userId,
  onStartTask,
  onTaskCompleted,
  className = '',
}: NowModeSectionProps) {
  const [state, setState] = useState<NowModeState>(defaultState)
  const [loading, setLoading] = useState(true)
  const [backlogVisible, setBacklogVisible] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<NowSlot | null>(null)
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
      }
    } catch (err) {
      console.error('Now Mode refresh error:', err)
    } finally {
      setLoading(false)
    }
  }, [getAuthToken])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handlePinTask = useCallback(async (taskId: string, slot?: NowSlot) => {
    try {
      const token = await getAuthToken()
      if (!token) return

      const res = await fetch('/api/now-mode/pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ task_id: taskId, slot }),
      })

      if (res.ok) {
        await refresh()
        setPickerOpen(false)
        setSelectedSlot(null)
      } else {
        const data = await res.json()
        setError(data.error)
      }
    } catch (err) {
      console.error('Pin task error:', err)
    }
  }, [getAuthToken, refresh])

  const handleUnpinTask = useCallback(async (taskId: string) => {
    try {
      const token = await getAuthToken()
      if (!token) return

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
      }
    } catch (err) {
      console.error('Unpin task error:', err)
    }
  }, [getAuthToken, refresh])

  const handleSwapTask = useCallback(async (currentTaskId: string, replacementTaskId: string) => {
    try {
      const token = await getAuthToken()
      if (!token) return

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
      }
    } catch (err) {
      console.error('Swap task error:', err)
    }
  }, [getAuthToken, refresh])

  const handleCompleteTask = useCallback(async (taskId: string) => {
    try {
      const { error: updateError } = await supabase
        .from('focus_plans')
        .update({ status: 'completed', is_completed: true })
        .eq('id', taskId)

      if (!updateError) {
        await refresh()
        onTaskCompleted?.()
      }
    } catch (err) {
      console.error('Complete task error:', err)
    }
  }, [refresh, onTaskCompleted])

  const handleStartTask = useCallback((taskId: string) => {
    onStartTask?.(taskId)
  }, [onStartTask])

  const handleSelectEmptySlot = useCallback((slot: NowSlot) => {
    setSelectedSlot(slot)
    setPickerOpen(true)
  }, [])

  const handleTaskSelected = useCallback((taskId: string) => {
    handlePinTask(taskId, selectedSlot || undefined)
  }, [handlePinTask, selectedSlot])

  // Don't render if Now Mode is disabled
  if (!state.enabled && !loading) {
    return null
  }

  const excludeTaskIds = state.slots
    .filter((s) => s.task !== null)
    .map((s) => s.task!.id)

  return (
    <div className={`now-mode-section ${className}`}>
      {error && (
        <div className="error-toast" role="alert">
          {error}
          <button onClick={() => setError(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      <NowModePanel
        state={state}
        onPinTask={handlePinTask}
        onUnpinTask={handleUnpinTask}
        onStartTask={handleStartTask}
        onCompleteTask={handleCompleteTask}
        onSwapTask={handleSwapTask}
        onRevealBacklog={() => setBacklogVisible(!backlogVisible)}
        onSelectEmptySlot={handleSelectEmptySlot}
        backlogVisible={backlogVisible}
        loading={loading}
      />

      <TaskPickerModal
        isOpen={pickerOpen}
        onClose={() => {
          setPickerOpen(false)
          setSelectedSlot(null)
        }}
        onSelect={handleTaskSelected}
        slot={selectedSlot}
        excludeTaskIds={excludeTaskIds}
      />

      <style jsx>{`
        .now-mode-section {
          position: relative;
        }

        .error-toast {
          position: fixed;
          top: 20px;
          right: 20px;
          background: #ef4444;
          color: white;
          padding: 12px 16px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 12px;
          z-index: 400;
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .error-toast button {
          background: none;
          border: none;
          color: white;
          font-size: 20px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }
      `}</style>
    </div>
  )
}
