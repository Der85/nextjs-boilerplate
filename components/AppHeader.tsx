'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface AppHeaderProps {
  showBackButton?: boolean
  backPath?: string
  backLabel?: string
  title?: string
  onlineCount?: number
}

export default function AppHeader({
  showBackButton = false,
  backPath = '/dashboard',
  backLabel = 'Home',
  title,
  onlineCount = 0
}: AppHeaderProps) {
  const router = useRouter()
  const [showMenu, setShowMenu] = useState(false)

  return (
    <>
      <header className="app-header">
        {showBackButton ? (
          <button onClick={() => router.push(backPath)} className="back-btn">
            <span className="back-arrow">←</span>
            <span className="back-label">{backLabel}</span>
          </button>
        ) : (
          <button onClick={() => router.push('/dashboard')} className="logo">
            ADHDer.io
          </button>
        )}

        {title && <h1 className="page-title">{title}</h1>}

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

      <style jsx>{`
        .app-header {
          position: sticky;
          top: 0;
          background: white;
          border-bottom: 1px solid #eee;
          padding: clamp(10px, 2.5vw, 14px) clamp(12px, 4vw, 20px);
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 100;
        }

        .logo {
          background: none;
          border: none;
          cursor: pointer;
          font-size: clamp(16px, 4vw, 20px);
          font-weight: 800;
          color: #1D9BF0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .back-btn {
          display: flex;
          align-items: center;
          gap: clamp(4px, 1.5vw, 6px);
          background: none;
          border: none;
          cursor: pointer;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #536471;
          padding: 0;
        }

        .back-btn:hover {
          color: #0f1419;
        }

        .back-arrow {
          font-size: clamp(18px, 5vw, 22px);
          line-height: 1;
        }

        .back-label {
          font-size: clamp(14px, 3.8vw, 16px);
          font-weight: 500;
        }

        .page-title {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          font-size: clamp(15px, 4vw, 18px);
          font-weight: 600;
          color: #0f1419;
          margin: 0;
          pointer-events: none;
        }

        .header-actions {
          display: flex;
          gap: clamp(6px, 2vw, 10px);
          margin-left: auto;
        }

        .icon-btn {
          width: clamp(32px, 8vw, 42px);
          height: clamp(32px, 8vw, 42px);
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
          top: clamp(50px, 12vw, 60px);
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

        @media (max-width: 480px) {
          .page-title {
            max-width: 50%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
      `}</style>
    </>
  )
}
