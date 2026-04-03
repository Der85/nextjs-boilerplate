'use client'

import { useRouter } from 'next/navigation'
import { useLocation } from '@/lib/contexts/LocationContext'
import { CSRF_COOKIE_NAME } from '@/lib/csrf'

interface AppHeaderProps {
  handle: string
}

export function AppHeader({ handle }: AppHeaderProps) {
  const router = useRouter()
  const { zoneLabel, isLoading } = useLocation()

  async function handleLogout() {
    const csrfToken =
      document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${CSRF_COOKIE_NAME}=`))
        ?.split('=')[1] ?? ''

    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'x-csrf-token': csrfToken },
    })

    router.push('/login')
    router.refresh()
  }

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: '#fff',
      borderBottom: '1px solid var(--color-border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      height: '52px',
      gap: '12px',
    }}>
      {/* Logo */}
      <div style={{ fontWeight: 700, fontSize: '1rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
        🧠 ADHDer.io
      </div>

      {/* Current zone — centred */}
      <div style={{
        flex: 1,
        textAlign: 'center',
        fontSize: '0.875rem',
        color: isLoading ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        minWidth: 0,
      }}>
        📍 {zoneLabel ?? (isLoading ? 'Detecting location…' : 'Unknown zone')}
      </div>

      {/* Handle + logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
          @{handle}
        </span>
        <button
          onClick={handleLogout}
          style={{
            fontSize: '0.75rem',
            color: 'var(--color-text-tertiary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
          }}
        >
          Log out
        </button>
      </div>
    </header>
  )
}
