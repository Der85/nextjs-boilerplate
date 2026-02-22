'use client'

import NotificationBell from './NotificationBell'

interface AppHeaderProps {
  title?: string
}

export default function AppHeader({ title }: AppHeaderProps) {
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
      <NotificationBell />
    </header>
  )
}
