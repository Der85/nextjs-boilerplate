'use client'

import { createContext, useContext } from 'react'
import { useReminders } from '@/lib/hooks/useReminders'
import type { ReminderWithTask, SnoozeDuration } from '@/lib/types'

interface RemindersContextValue {
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

const RemindersContext = createContext<RemindersContextValue | null>(null)

export function RemindersProvider({ children }: { children: React.ReactNode }) {
  const reminders = useReminders()

  return (
    <RemindersContext.Provider value={reminders}>
      {children}
    </RemindersContext.Provider>
  )
}

export function useRemindersContext(): RemindersContextValue {
  const context = useContext(RemindersContext)
  if (!context) {
    throw new Error('useRemindersContext must be used within a RemindersProvider')
  }
  return context
}
