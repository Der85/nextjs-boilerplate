'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { ReminderWithTask, SnoozeDuration } from '@/lib/types'
import { apiFetch } from '@/lib/api-client'

const POLL_INTERVAL = 5 * 60 * 1000 // 5 minutes

interface UseRemindersReturn {
  reminders: ReminderWithTask[]
  unreadCount: number
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  dismiss: (id: string) => Promise<void>
  snooze: (id: string, duration: SnoozeDuration) => Promise<void>
  clearAll: () => Promise<void>
  completeTask: (taskId: string) => Promise<void>
}

export function useReminders(): UseRemindersReturn {
  const [reminders, setReminders] = useState<ReminderWithTask[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isVisibleRef = useRef(true)

  // Keep a ref in sync with reminders to avoid stale closures in callbacks
  const remindersRef = useRef<ReminderWithTask[]>([])
  useEffect(() => { remindersRef.current = reminders }, [reminders])

  // Fetch reminders from API
  const fetchReminders = useCallback(async () => {
    try {
      const res = await fetch('/api/reminders')
      if (res.ok) {
        const data = await res.json()
        setReminders(data.reminders || [])
        setUnreadCount(data.unread_count || 0)
        setError(null)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to fetch reminders')
      }
    } catch (err) {
      console.error('Failed to fetch reminders:', err)
      setError('Failed to fetch reminders')
    } finally {
      setLoading(false)
    }
  }, [])

  // Generate reminders then fetch
  const refresh = useCallback(async () => {
    try {
      // Generate new reminders
      await apiFetch('/api/reminders/generate', { method: 'POST' })
      // Then fetch all reminders
      await fetchReminders()
    } catch (err) {
      console.error('Failed to refresh reminders:', err)
    }
  }, [fetchReminders])

  // Mark reminder as read
  const markAsRead = useCallback(async (id: string) => {
    try {
      const res = await apiFetch(`/api/reminders/${id}/read`, { method: 'POST' })
      if (res.ok) {
        setReminders(prev =>
          prev.map(r => r.id === id ? { ...r, read_at: new Date().toISOString() } : r)
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (err) {
      console.error('Failed to mark reminder as read:', err)
    }
  }, [])

  // Dismiss reminder
  const dismiss = useCallback(async (id: string) => {
    // Optimistic update — read from ref to avoid stale closure
    const reminder = remindersRef.current.find(r => r.id === id)
    setReminders(prev => prev.filter(r => r.id !== id))
    if (reminder && !reminder.read_at) {
      setUnreadCount(prev => Math.max(0, prev - 1))
    }

    try {
      await apiFetch(`/api/reminders/${id}/dismiss`, { method: 'POST' })
    } catch (err) {
      console.error('Failed to dismiss reminder:', err)
      await fetchReminders()
    }
  }, [fetchReminders])

  // Snooze reminder
  const snooze = useCallback(async (id: string, duration: SnoozeDuration) => {
    // Optimistic update — read from ref to avoid stale closure
    const reminder = remindersRef.current.find(r => r.id === id)
    setReminders(prev => prev.filter(r => r.id !== id))
    if (reminder && !reminder.read_at) {
      setUnreadCount(prev => Math.max(0, prev - 1))
    }

    try {
      await apiFetch(`/api/reminders/${id}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration }),
      })
    } catch (err) {
      console.error('Failed to snooze reminder:', err)
      await fetchReminders()
    }
  }, [fetchReminders])

  // Clear all reminders
  const clearAll = useCallback(async () => {
    // Optimistic update
    setReminders([])
    setUnreadCount(0)

    try {
      await apiFetch('/api/reminders', { method: 'DELETE' })
    } catch (err) {
      console.error('Failed to clear reminders:', err)
      // Refetch to restore state
      await fetchReminders()
    }
  }, [fetchReminders])

  // Complete task (mark as done) - uses optimized endpoint that handles
  // both task completion and reminder dismissal in a single transaction
  const completeTask = useCallback(async (taskId: string) => {
    // Optimistic update — read from ref to avoid stale closure
    const unreadCount = remindersRef.current.filter(r => r.task_id === taskId && !r.read_at).length

    setReminders(prev => prev.filter(r => r.task_id !== taskId))
    if (unreadCount > 0) {
      setUnreadCount(prev => Math.max(0, prev - unreadCount))
    }

    try {
      const res = await apiFetch(`/api/tasks/${taskId}/complete`, {
        method: 'POST',
      })

      if (!res.ok) {
        await fetchReminders()
      }
    } catch (err) {
      console.error('Failed to complete task:', err)
      await fetchReminders()
    }
  }, [fetchReminders])

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === 'visible'

      // Refresh when tab becomes visible again
      if (isVisibleRef.current) {
        fetchReminders()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchReminders])

  // Initial fetch and polling
  useEffect(() => {
    // Initial load: generate + fetch
    refresh()

    // Set up polling
    pollIntervalRef.current = setInterval(() => {
      // Only poll when tab is visible
      if (isVisibleRef.current) {
        fetchReminders()
      }
    }, POLL_INTERVAL)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [refresh, fetchReminders])

  return {
    reminders,
    unreadCount,
    loading,
    error,
    refresh,
    markAsRead,
    dismiss,
    snooze,
    clearAll,
    completeTask,
  }
}
