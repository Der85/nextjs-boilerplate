'use client'

import { usePathname, useRouter } from 'next/navigation'

const TABS = [
  {
    id: 'dump',
    label: 'Dump',
    path: '/dump',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3a9 9 0 0 1 9 9c0 3.9-3.1 7.1-7 7.9V22h-4v-2.1c-3.9-.8-7-4-7-7.9a9 9 0 0 1 9-9z" />
        <path d="M12 8v4" />
        <circle cx="12" cy="16" r="0.5" />
      </svg>
    ),
  },
  {
    id: 'tasks',
    label: 'Tasks',
    path: '/tasks',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    id: 'insights',
    label: 'Insights',
    path: '/insights',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 20V10" />
        <path d="M12 20V4" />
        <path d="M6 20v-6" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    path: '/settings',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ),
  },
]

export default function TabBar() {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <nav
      role="tablist"
      aria-label="Main navigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: `calc(var(--tab-bar-height) + var(--safe-area-bottom))`,
        paddingBottom: 'var(--safe-area-bottom)',
        background: 'var(--color-bg)',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 50,
      }}
    >
      {TABS.map((tab) => {
        const isActive = pathname === tab.path || pathname?.startsWith(tab.path + '/')
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-label={tab.label}
            onClick={() => router.push(tab.path)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              flex: 1,
              height: 'var(--tab-bar-height)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: isActive ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
              transition: 'color 0.15s ease',
              padding: 0,
              minWidth: '44px',
            }}
          >
            {tab.icon}
            <span style={{
              fontSize: '11px',
              fontWeight: isActive ? 600 : 400,
              lineHeight: 1,
            }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
