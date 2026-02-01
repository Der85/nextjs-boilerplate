'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface NotificationBar {
  text: string
  color: string
  icon?: string
}

interface AppHeaderProps {
  onlineCount?: number
  notificationBar?: NotificationBar | null
}

const navItems = [
  { path: '/dashboard', label: 'Home', icon: '🏠', matchPaths: ['/dashboard', '/check-in'] },
  { path: '/tools', label: 'Tools', icon: '🧰', matchPaths: ['/tools', '/ally', '/brake', '/focus', '/goals'] },
  { path: '/history', label: 'You', icon: '📊', matchPaths: ['/history', '/burnout', '/settings', '/village'] },
]

export default function AppHeader({
  onlineCount = 0,
  notificationBar,
}: AppHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [showMenu, setShowMenu] = useState(false)

  const isActive = (item: typeof navItems[0]) => {
    return item.matchPaths.some(p => pathname.startsWith(p))
  }

  return (
    <>
      <header className="app-header">
        <button onClick={() => router.push('/dashboard')} className="logo">
          ADHDer.io
        </button>

        <nav className="header-nav">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`nav-link ${isActive(item) ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-text">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="header-actions">
          <button onClick={() => router.push('/brake')} className="icon-btn red" title="BREAK">
            🛑
          </button>
          <button onClick={() => setShowMenu(!showMenu)} className="icon-btn menu">
            ☰
          </button>
        </div>

        {showMenu && (
          <div className="dropdown-menu">
            <button onClick={() => { router.push('/tools'); setShowMenu(false) }} className="menu-item">
              🧰 All Tools
            </button>
            <div className="menu-divider" />
            <button onClick={() => { router.push('/ally'); setShowMenu(false) }} className="menu-item">
              💜 Get Unstuck (Ally)
            </button>
            <button onClick={() => { router.push('/focus'); setShowMenu(false) }} className="menu-item">
              ⏱️ Focus Mode
            </button>
            <button onClick={() => { router.push('/goals'); setShowMenu(false) }} className="menu-item">
              🎯 Goals
            </button>
            <button onClick={() => { router.push('/burnout'); setShowMenu(false) }} className="menu-item">
              ⚡ Energy Tracker
            </button>
            <div className="menu-divider" />
            <button onClick={() => { router.push('/village'); setShowMenu(false) }} className="menu-item">
              👥 Village {onlineCount > 0 && `(${onlineCount} online)`}
            </button>
            <button onClick={() => { router.push('/history'); setShowMenu(false) }} className="menu-item">
              📊 History & Insights
            </button>
            <div className="menu-divider" />
            <button
              onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
              className="menu-item logout"
            >
              Log out
            </button>
          </div>
        )}
      </header>

      {showMenu && <div className="menu-overlay" onClick={() => setShowMenu(false)} />}

      {notificationBar && (
        <div
          className="notification-bar"
          style={{
            background: `${notificationBar.color}12`,
            color: notificationBar.color,
          }}
        >
          {notificationBar.icon && <span className="notif-icon">{notificationBar.icon}</span>}
          <span className="notif-text">{notificationBar.text}</span>
        </div>
      )}

      <style jsx>{`
        .app-header {
          position: sticky;
          top: 0;
          background: white;
          border-bottom: 1px solid #eee;
          padding: clamp(8px, 2vw, 12px) clamp(12px, 4vw, 20px);
          display: flex;
          align-items: center;
          gap: clamp(6px, 1.5vw, 10px);
          z-index: 100;
        }

        .logo {
          background: none;
          border: none;
          cursor: pointer;
          font-size: clamp(15px, 3.8vw, 19px);
          font-weight: 800;
          color: #1D9BF0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .logo:hover {
          opacity: 0.8;
        }

        .header-nav {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: clamp(2px, 1vw, 6px);
          flex: 1;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: clamp(3px, 0.8vw, 6px);
          padding: clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 14px);
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          color: #8899a6;
          font-size: clamp(12px, 3.2vw, 14px);
          font-weight: 500;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          transition: color 0.15s ease, border-color 0.15s ease;
          white-space: nowrap;
        }

        .nav-link:hover {
          color: #536471;
        }

        .nav-link.active {
          color: #1D9BF0;
          font-weight: 600;
          border-bottom-color: #1D9BF0;
        }

        .nav-icon {
          font-size: clamp(16px, 4vw, 20px);
          line-height: 1;
        }

        .nav-text {
          display: none;
        }

        .header-actions {
          display: flex;
          gap: clamp(4px, 1.5vw, 8px);
          flex-shrink: 0;
        }

        .icon-btn {
          width: clamp(32px, 8vw, 40px);
          height: clamp(32px, 8vw, 40px);
          border-radius: 50%;
          border: none;
          cursor: pointer;
          font-size: clamp(14px, 3.5vw, 18px);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.15s ease;
        }

        .icon-btn:hover {
          transform: scale(1.05);
        }

        .icon-btn.red {
          background: rgba(239, 68, 68, 0.1);
        }

        .icon-btn.menu {
          background: white;
          border: 1px solid #ddd;
          font-size: clamp(12px, 3vw, 16px);
        }

        .dropdown-menu {
          position: absolute;
          top: clamp(48px, 12vw, 58px);
          right: clamp(12px, 4vw, 20px);
          background: white;
          border-radius: clamp(10px, 2.5vw, 14px);
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          padding: clamp(6px, 1.5vw, 10px);
          min-width: clamp(160px, 45vw, 200px);
          z-index: 200;
        }

        .menu-item {
          display: block;
          width: 100%;
          padding: clamp(8px, 2.5vw, 12px) clamp(10px, 3vw, 14px);
          text-align: left;
          background: none;
          border: none;
          border-radius: clamp(6px, 1.5vw, 10px);
          cursor: pointer;
          font-size: clamp(13px, 3.5vw, 15px);
          color: #536471;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          transition: background 0.15s ease;
        }

        .menu-item:hover {
          background: #f7f9fa;
        }

        .menu-item.logout {
          color: #ef4444;
        }

        .menu-divider {
          border-top: 1px solid #eee;
          margin: clamp(4px, 1.5vw, 8px) 0;
        }

        .menu-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 99;
        }

        .notification-bar {
          padding: clamp(8px, 2vw, 10px) clamp(12px, 4vw, 20px);
          font-size: clamp(12px, 3.2vw, 14px);
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: clamp(6px, 1.5vw, 8px);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .notif-icon {
          font-size: clamp(14px, 3.5vw, 16px);
          flex-shrink: 0;
        }

        .notif-text {
          line-height: 1.3;
        }

        @media (min-width: 480px) {
          .nav-text {
            display: inline;
          }
        }
      `}</style>
    </>
  )
}
