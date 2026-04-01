'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { FeedType } from '@/lib/types'

const TABS: { label: string; href: string; type: FeedType }[] = [
  { label: 'Local', href: '/local', type: 'local' },
  { label: 'Following', href: '/feed', type: 'following' },
  { label: 'Explore', href: '/explore', type: 'explore' },
]

export default function FeedTabs() {
  const pathname = usePathname()

  const activeTab = TABS.find(t => pathname.startsWith(t.href))?.type || 'local'

  return (
    <nav style={{
      display: 'flex',
      borderBottom: '1px solid var(--color-border)',
      background: 'var(--color-bg)',
      maxWidth: 'var(--content-max-width)',
      margin: '0 auto',
      width: '100%',
    }}>
      {TABS.map(tab => {
        const isActive = tab.type === activeTab
        return (
          <Link
            key={tab.type}
            href={tab.href}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '12px 0',
              fontSize: 'var(--text-caption)',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              borderBottom: isActive ? '2px solid var(--color-accent)' : '2px solid transparent',
              textDecoration: 'none',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
