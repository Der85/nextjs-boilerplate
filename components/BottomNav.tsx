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
    matchPaths: ['/tools', '/ally', '/brake', '/focus', '/burnout']
  },
  { 
    path: '/goals', 
    label: 'Goals', 
    icon: '🌱',
    matchPaths: ['/goals']
  },
  { 
    path: '/village', 
    label: 'Village', 
    icon: '👥',
    matchPaths: ['/village']
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
    <nav 
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="max-w-lg mx-auto flex">
        {navItems.map((item) => {
          const active = isActive(item)
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`flex-1 flex flex-col items-center justify-center py-3 transition-colors ${
                active 
                  ? 'text-teal-600' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="text-xl mb-0.5" aria-hidden="true">
                {item.icon}
              </span>
              <span className={`text-xs font-medium ${active ? 'text-teal-600' : ''}`}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
      
      {/* Safe area for phones with home indicators */}
      <div className="h-safe-area-bottom bg-white" />
    </nav>
  )
}
