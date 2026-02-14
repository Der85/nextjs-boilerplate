'use client'

import NotificationBell from './NotificationBell'
import { useReminders } from '@/lib/hooks/useReminders'

interface AppHeaderProps {
  title?: string
}

export default function AppHeader({ title }: AppHeaderProps) {
  const {
    reminders,
    unreadCount,
    markAsRead,
    dismiss,
    snooze,
    clearAll,
    completeTask,
  } = useReminders()

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 0',
      marginBottom: '8px',
    }}>
      {/* Title or spacer */}
      <div style={{ flex: 1 }}>
        {title && (
          <h1 style={{
            fontSize: 'var(--text-heading)',
            fontWeight: 'var(--font-heading)',
            color: 'var(--color-text-primary)',
            margin: 0,
          }}>
            {title}
          </h1>
        )}
      </div>

      {/* Notification bell */}
      <NotificationBell
        reminders={reminders}
        unreadCount={unreadCount}
        onMarkAsRead={markAsRead}
        onDismiss={dismiss}
        onSnooze={snooze}
        onClearAll={clearAll}
        onCompleteTask={completeTask}
      />
    </header>
  )
}
