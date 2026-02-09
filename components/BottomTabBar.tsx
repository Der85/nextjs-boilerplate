'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import MoreSheet from './MoreSheet'

interface Tab {
  id: string
  label: string
  icon: string
  activeIcon: string
  path: string
}

const TABS: Tab[] = [
  { id: 'home', label: 'Home', icon: '🏠', activeIcon: '🏠', path: '/dashboard' },
  { id: 'focus', label: 'Focus', icon: '⏱️', activeIcon: '⏱️', path: '/focus' },
  { id: 'now', label: 'Now', icon: '🎯', activeIcon: '🎯', path: '/now-mode' },
  { id: 'goals', label: 'Goals', icon: '🌱', activeIcon: '🌱', path: '/goals' },
]

export default function BottomTabBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/')

  // "More" is active if current page isn't one of the main tabs
  const isMoreActive = !TABS.some(tab => isActive(tab.path))

  return (
    <>
      <nav className="bottom-tab-bar" role="tablist" aria-label="Main navigation">
        {TABS.map(tab => {
          const active = isActive(tab.path)
          return (
            <button
              key={tab.id}
              className={`tab-item ${active ? 'active' : ''}`}
              onClick={() => router.push(tab.path)}
              role="tab"
              aria-selected={active}
              aria-label={tab.label}
            >
              <span className="tab-icon">{active ? tab.activeIcon : tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          )
        })}
        <button
          className={`tab-item ${isMoreActive || moreOpen ? 'active' : ''}`}
          onClick={() => setMoreOpen(true)}
          role="tab"
          aria-label="More options"
        >
          <span className="tab-icon">☰</span>
          <span className="tab-label">More</span>
        </button>
      </nav>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />

      <style jsx>{`
        .bottom-tab-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: calc(56px + var(--safe-area-bottom));
          padding-bottom: var(--safe-area-bottom);
          background: white;
          border-top: 1px solid #eff3f4;
          display: flex;
          align-items: center;
          justify-content: space-around;
          z-index: 90;
        }

        .tab-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          flex: 1;
          height: 56px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px 0;
          transition: color 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          -webkit-tap-highlight-color: transparent;
        }

        .tab-icon {
          font-size: 22px;
          line-height: 1;
        }

        .tab-label {
          font-size: 11px;
          font-weight: 500;
          color: #8899a6;
        }

        .tab-item.active .tab-label {
          color: #1da1f2;
          font-weight: 600;
        }
      `}</style>
    </>
  )
}
