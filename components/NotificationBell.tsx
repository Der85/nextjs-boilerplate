'use client'

import { useState } from 'react'
import NotificationPanel from './NotificationPanel'
import { useRemindersContext } from '@/lib/contexts/RemindersContext'

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const { unreadCount } = useRemindersContext()

  const handleToggle = () => {
    setIsOpen(prev => !prev)
  }

  const handleClose = () => {
    setIsOpen(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={handleToggle}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '40px',
          height: '40px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          background: isOpen ? 'var(--color-surface)' : 'var(--color-bg)',
          color: unreadCount > 0 ? 'var(--color-accent)' : 'var(--color-text-secondary)',
          cursor: 'pointer',
          position: 'relative',
          transition: 'all 0.15s ease',
        }}
      >
        {/* Bell icon */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Badge */}
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              minWidth: '18px',
              height: '18px',
              padding: '0 5px',
              borderRadius: '9px',
              background: 'var(--color-danger)',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <NotificationPanel
          onClose={handleClose}
        />
      )}

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          onClick={handleClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.3)',
            zIndex: 99,
          }}
        />
      )}
    </div>
  )
}
