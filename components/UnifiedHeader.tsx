'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

interface UnifiedHeaderProps {
  subtitle?: string
  showMenu?: boolean
}

type UserMode = 'recovery' | 'maintenance' | 'growth'

const MODE_CONFIG: Record<UserMode, { icon: string; label: string; description: string }> = {
  recovery: { icon: '🫂', label: 'Recovery', description: 'Low energy, need rest' },
  maintenance: { icon: '⚖️', label: 'Steady', description: 'Consistent and sustainable' },
  growth: { icon: '🚀', label: 'Growth', description: 'High energy, push harder' },
}

// Navigation items for the menu
const NAV_ITEMS = [
  { id: 'dashboard', icon: '🏠', label: 'Home', path: '/dashboard' },
  { id: 'focus', icon: '⏱️', label: 'Focus', path: '/focus' },
  { id: 'goals', icon: '🎯', label: 'Goals', path: '/goals' },
  { id: 'history', icon: '📊', label: 'History', path: '/history' },
  { id: 'village', icon: '💜', label: 'Village', path: '/village' },
  { id: 'brake', icon: '🫁', label: 'Breathe', path: '/brake' },
  { id: 'winddown', icon: '🌙', label: 'Wind Down', path: '/wind-down' },
]

export default function UnifiedHeader({ subtitle, showMenu = true }: UnifiedHeaderProps) {
  const router = useRouter()
  const supabase = createClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const [animatingOut, setAnimatingOut] = useState(false)
  const [userMode, setUserMode] = useState<UserMode>('maintenance')

  // Load mode from localStorage on mount
  useEffect(() => {
    const savedMode = localStorage.getItem('user-mode') as UserMode | null
    if (savedMode && ['recovery', 'maintenance', 'growth'].includes(savedMode)) {
      setUserMode(savedMode)
    }
  }, [])

  const handleModeChange = (mode: UserMode) => {
    setUserMode(mode)
    localStorage.setItem('user-mode', mode)
  }

  const handleClose = () => {
    setAnimatingOut(true)
    setTimeout(() => {
      setMenuOpen(false)
      setAnimatingOut(false)
    }, 150)
  }

  const navigateTo = (path: string) => {
    handleClose()
    router.push(path)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      <header className="unified-header">
        {/* Logo */}
        <button onClick={() => router.push('/dashboard')} className="header-logo">
          adhder.io
        </button>

        {/* Dynamic Subtitle */}
        {subtitle && <span className="header-subtitle">{subtitle}</span>}

        {/* Spacer */}
        <div className="header-spacer" />

        {/* Menu Button */}
        {showMenu && (
          <button
            onClick={() => setMenuOpen(true)}
            className="header-menu-btn"
            aria-label="Open menu"
          >
            <span className="menu-icon">☰</span>
          </button>
        )}
      </header>

      {/* Menu Overlay */}
      {menuOpen && (
        <>
          <div
            className={`menu-overlay ${animatingOut ? 'closing' : ''}`}
            onClick={handleClose}
          />
          <div className={`menu-panel ${animatingOut ? 'closing' : ''}`}>
            <div className="menu-header">
              <span className="menu-title">Menu</span>
              <button className="menu-close" onClick={handleClose}>×</button>
            </div>

            <nav className="menu-nav">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  className="menu-nav-item"
                  onClick={() => navigateTo(item.path)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </button>
              ))}
            </nav>

            {/* Mode Selector */}
            <div className="mode-section">
              <div className="mode-section-label">Current Mode</div>
              <div className="mode-options">
                {(Object.keys(MODE_CONFIG) as UserMode[]).map((mode) => (
                  <button
                    key={mode}
                    className={`mode-option-btn ${userMode === mode ? 'active' : ''}`}
                    onClick={() => handleModeChange(mode)}
                  >
                    <span className="mode-btn-icon">{MODE_CONFIG[mode].icon}</span>
                    <span className="mode-btn-label">{MODE_CONFIG[mode].label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="menu-footer">
              <button onClick={handleLogout} className="menu-logout-btn">
                Log out
              </button>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .unified-header {
          position: sticky;
          top: 0;
          background: white;
          border-bottom: 1px solid #eff3f4;
          padding: clamp(12px, 3vw, 16px) clamp(16px, 4vw, 24px);
          display: flex;
          align-items: center;
          gap: clamp(8px, 2vw, 12px);
          z-index: 100;
        }

        .header-logo {
          background: none;
          border: none;
          cursor: pointer;
          font-size: clamp(16px, 4.5vw, 20px);
          font-weight: 800;
          color: #1D9BF0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          white-space: nowrap;
          flex-shrink: 0;
          transition: opacity 0.15s ease;
          letter-spacing: -0.5px;
        }

        .header-logo:hover {
          opacity: 0.8;
        }

        .header-subtitle {
          font-size: clamp(12px, 3.2vw, 14px);
          color: #8899a6;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .header-spacer {
          flex: 1;
        }

        .header-menu-btn {
          width: clamp(40px, 10vw, 44px);
          height: clamp(40px, 10vw, 44px);
          border-radius: 50%;
          border: none;
          background: #f7f9fa;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s ease;
          flex-shrink: 0;
        }

        .header-menu-btn:hover {
          background: #eff3f4;
        }

        .menu-icon {
          font-size: clamp(18px, 4.5vw, 22px);
          color: #536471;
        }

        /* Menu Overlay */
        .menu-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 200;
          animation: fade-in 0.15s ease;
        }

        .menu-overlay.closing {
          animation: fade-out 0.15s ease forwards;
        }

        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes fade-out {
          from { opacity: 1; }
          to { opacity: 0; }
        }

        /* Menu Panel */
        .menu-panel {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: clamp(280px, 80vw, 320px);
          background: white;
          z-index: 201;
          animation: slide-in 0.2s ease;
          display: flex;
          flex-direction: column;
          box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
        }

        .menu-panel.closing {
          animation: slide-out 0.15s ease forwards;
        }

        @keyframes slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        @keyframes slide-out {
          from { transform: translateX(0); }
          to { transform: translateX(100%); }
        }

        .menu-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: clamp(16px, 4vw, 20px);
          border-bottom: 1px solid #eff3f4;
        }

        .menu-title {
          font-size: clamp(16px, 4.5vw, 18px);
          font-weight: 700;
          color: #0f1419;
        }

        .menu-close {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          background: #eff3f4;
          color: #536471;
          font-size: 20px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s ease;
        }

        .menu-close:hover {
          background: #e5e7eb;
        }

        .menu-nav {
          flex: 1;
          padding: clamp(12px, 3vw, 16px);
          display: flex;
          flex-direction: column;
          gap: clamp(4px, 1vw, 8px);
          overflow-y: auto;
        }

        .menu-nav-item {
          display: flex;
          align-items: center;
          gap: clamp(12px, 3vw, 16px);
          padding: clamp(12px, 3vw, 16px);
          background: none;
          border: none;
          border-radius: clamp(10px, 2.5vw, 14px);
          cursor: pointer;
          transition: background 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          width: 100%;
          text-align: left;
        }

        .menu-nav-item:hover {
          background: #f7f9fa;
        }

        .nav-icon {
          font-size: clamp(20px, 5vw, 24px);
          flex-shrink: 0;
        }

        .nav-label {
          font-size: clamp(15px, 4vw, 17px);
          font-weight: 600;
          color: #0f1419;
        }

        /* Mode Selector */
        .mode-section {
          padding: clamp(12px, 3vw, 16px);
          border-top: 1px solid #eff3f4;
        }

        .mode-section-label {
          font-size: 12px;
          font-weight: 600;
          color: #8899a6;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 10px;
          padding-left: 4px;
        }

        .mode-options {
          display: flex;
          gap: 8px;
        }

        .mode-option-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 12px 8px;
          background: #f7f9fa;
          border: 2px solid transparent;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .mode-option-btn:hover {
          background: #eff3f4;
        }

        .mode-option-btn.active {
          background: rgba(29, 155, 240, 0.08);
          border-color: #1D9BF0;
        }

        .mode-btn-icon {
          font-size: 20px;
        }

        .mode-btn-label {
          font-size: 12px;
          font-weight: 600;
          color: #536471;
        }

        .mode-option-btn.active .mode-btn-label {
          color: #1D9BF0;
        }

        .menu-footer {
          padding: clamp(16px, 4vw, 20px);
          border-top: 1px solid #eff3f4;
        }

        .menu-logout-btn {
          width: 100%;
          padding: clamp(12px, 3vw, 16px);
          background: none;
          border: 1px solid #ef4444;
          border-radius: clamp(10px, 2.5vw, 14px);
          color: #ef4444;
          font-size: clamp(14px, 3.8vw, 16px);
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .menu-logout-btn:hover {
          background: rgba(239, 68, 68, 0.08);
        }
      `}</style>
    </>
  )
}
