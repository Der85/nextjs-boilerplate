'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/local',     label: 'Local',     icon: '📍' },
  { href: '/following', label: 'Following',  icon: '🔔' },
  { href: '/explore',   label: 'Explore',    icon: '🌍' },
] as const

export function TabBar() {
  const pathname = usePathname()

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      background: '#fff',
      borderTop: '1px solid var(--color-border)',
      display: 'flex',
      alignItems: 'stretch',
      // Account for iOS home indicator
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {TABS.map(({ href, label, icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              padding: '10px 0',
              textDecoration: 'none',
              color: active ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
              fontSize: '0.7rem',
              fontWeight: active ? 600 : 400,
              transition: 'color 0.1s',
            }}
          >
            <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{icon}</span>
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
