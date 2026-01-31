'use client'

import { usePathname, useRouter } from 'next/navigation'

interface NavItem {
  path: string
  label: string
  icon: string
  matchPaths?: string[] // Additional paths that should highlight this item
}

const navItems: NavItem[] = [
  {
    path: '/dashboard',
    label: 'Home',
    icon: '🏠',
    matchPaths: ['/dashboard', '/']
  },
  {
    path: '/tools',
    label: 'Tools',
    icon: '🧰',
    matchPaths: ['/tools', '/ally', '/brake', '/focus', '/goals']
  },
  {
    path: '/history',
    label: 'You',
    icon: '📊',
    matchPaths: ['/history', '/burnout', '/settings', '/village']
  },
]

export default function BottomNav() {
  const router = useRouter()
  const pathname = usePathname()

  const isActive = (item: NavItem) => {
    if (item.matchPaths) {
      return item.matchPaths.some(p => pathname.startsWith(p))
    }
    return pathname === item.path
  }

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Main navigation">
      {navItems.map((item) => {
        const active = isActive(item)
        return (
          <button
            key={item.path}
            onClick={() => router.push(item.path)}
            className={`nav-btn ${active ? 'active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <span className="nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="nav-label">
              {item.label}
            </span>
          </button>
        )
      })}

      <style jsx>{`
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: white;
          border-top: 1px solid #eee;
          display: flex;
          justify-content: space-around;
          padding: clamp(6px, 2vw, 10px) 0;
          padding-bottom: max(clamp(6px, 2vw, 10px), env(safe-area-inset-bottom));
          z-index: 100;
        }

        .nav-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: clamp(2px, 1vw, 4px);
          background: none;
          border: none;
          cursor: pointer;
          padding: clamp(6px, 2vw, 10px) clamp(14px, 4vw, 20px);
          color: #8899a6;
          transition: color 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .nav-btn:hover {
          color: #536471;
        }

        .nav-btn.active {
          color: #1D9BF0;
        }

        .nav-icon {
          font-size: clamp(20px, 5.5vw, 24px);
          line-height: 1;
        }

        .nav-label {
          font-size: clamp(10px, 2.8vw, 12px);
          font-weight: 500;
        }

        .nav-btn.active .nav-label {
          font-weight: 600;
        }
      `}</style>
    </nav>
  )
}
