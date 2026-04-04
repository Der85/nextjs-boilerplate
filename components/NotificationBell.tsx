'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface NotificationBellProps {
  userId: string
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const supabase = supabaseRef.current

    // Initial fetch
    fetch('/api/notifications')
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.unreadCount === 'number') {
          setUnreadCount(data.unreadCount)
        }
      })
      .catch(() => {})

    // Realtime subscription
    const channel = supabase
      .channel('notifications-bell')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          setUnreadCount((n) => n + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  return (
    <Link
      href="/notifications"
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        textDecoration: 'none',
        fontSize: '1.1rem',
        width: '32px',
        height: '32px',
      }}
      title="Notifications"
    >
      🔔
      {unreadCount > 0 && (
        <span
          style={{
            position: 'absolute',
            top: '0',
            right: '0',
            background: 'var(--color-danger)',
            color: '#fff',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.65rem',
            fontWeight: 700,
            minWidth: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            lineHeight: 1,
          }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  )
}
