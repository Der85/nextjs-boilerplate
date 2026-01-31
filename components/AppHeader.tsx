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
        <div className="header-left">
          {showBackButton && (
            <button onClick={() => router.push(backPath)} className="back-btn" aria-label={`Back to ${backLabel}`}>
              <span className="back-arrow">←</span>
            </button>
          )}
          <button onClick={() => router.push('/dashboard')} className="logo">
            ADHDer.io
          </button>
        </div>

        {title && (
          <div className="header-center">
            <h1 className="page-title">{title}</h1>
          </div>
        )}

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
          gap: clamp(8px, 2vw, 12px);
          z-index: 100;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: clamp(8px, 2vw, 12px);
          flex-shrink: 0;
        }

        .logo {
          background: none;
          border: none;
          cursor: pointer;
          font-size: clamp(16px, 4vw, 20px);
          font-weight: 800;
          color: #1D9BF0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          white-space: nowrap;
        }

        .logo:hover {
          opacity: 0.8;
        }

        .back-btn {
          display: flex;
          align-items: center;
          background: none;
          border: none;
          cursor: pointer;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #536471;
          padding: 0;
          width: clamp(28px, 7vw, 36px);
          height: clamp(28px, 7vw, 36px);
          border-radius: 50%;
          justify-content: center;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .back-btn:hover {
          background: rgba(29, 155, 240, 0.1);
          color: #1D9BF0;
        }

        .back-arrow {
          font-size: clamp(20px, 5.5vw, 24px);
          line-height: 1;
        }

        .header-center {
          flex: 1;
          display: flex;
          justify-content: center;
          min-width: 0;
        }

        .page-title {
          font-size: clamp(14px, 3.8vw, 16px);
          font-weight: 600;
          color: #536471;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 100%;
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
          .header-center {
            flex: 0 1 auto;
            max-width: 35%;
          }

          .logo {
            font-size: clamp(14px, 3.5vw, 16px);
          }
        }
      `}</style>
    </>
  )
}
