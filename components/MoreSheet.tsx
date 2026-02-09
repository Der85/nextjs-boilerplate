'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type UserMode = 'recovery' | 'maintenance' | 'growth'

const MODE_CONFIG: Record<UserMode, { icon: string; label: string }> = {
  recovery: { icon: '🫂', label: 'Recovery' },
  maintenance: { icon: '⚖️', label: 'Steady' },
  growth: { icon: '🚀', label: 'Growth' },
}

const SECTIONS = [
  {
    label: 'Plan & Organize',
    items: [
      { icon: '📋', label: 'Weekly Plan', path: '/weekly-planning' },
      { icon: '🔀', label: 'Triage', path: '/triage' },
      { icon: '📊', label: 'History', path: '/history' },
    ],
  },
  {
    label: 'Wellbeing',
    items: [
      { icon: '🫁', label: 'Breathe', path: '/brake' },
      { icon: '🌙', label: 'Wind Down', path: '/wind-down' },
      { icon: '💜', label: 'Village', path: '/village' },
      { icon: '🏆', label: 'Wins', path: '/wins' },
    ],
  },
  {
    label: 'Quick Actions',
    items: [
      { icon: '📝', label: 'Check In', path: '/check-in' },
      { icon: '🤝', label: 'Ally', path: '/ally' },
    ],
  },
]

interface MoreSheetProps {
  open: boolean
  onClose: () => void
}

export default function MoreSheet({ open, onClose }: MoreSheetProps) {
  const router = useRouter()
  const supabase = createClient()
  const [closing, setClosing] = useState(false)
  const [userMode, setUserMode] = useState<UserMode>('maintenance')

  useEffect(() => {
    if (open) {
      const saved = localStorage.getItem('user-mode') as UserMode | null
      if (saved && ['recovery', 'maintenance', 'growth'].includes(saved)) {
        setUserMode(saved)
      }
    }
  }, [open])

  const handleClose = () => {
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      onClose()
    }, 150)
  }

  const navigateTo = (path: string) => {
    handleClose()
    router.push(path)
  }

  const handleModeChange = (mode: UserMode) => {
    setUserMode(mode)
    localStorage.setItem('user-mode', mode)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!open) return null

  return (
    <>
      <div className={`sheet-backdrop ${closing ? 'closing' : ''}`} onClick={handleClose} />
      <div className={`sheet-panel ${closing ? 'closing' : ''}`}>
        <div className="sheet-handle" />

        {SECTIONS.map(section => (
          <div key={section.label} className="sheet-section">
            <div className="section-label">{section.label}</div>
            {section.items.map(item => (
              <button key={item.path} className="sheet-item" onClick={() => navigateTo(item.path)}>
                <span className="item-icon">{item.icon}</span>
                <span className="item-label">{item.label}</span>
              </button>
            ))}
          </div>
        ))}

        <div className="sheet-section">
          <div className="section-label">Mode</div>
          <div className="mode-row">
            {(Object.keys(MODE_CONFIG) as UserMode[]).map(mode => (
              <button
                key={mode}
                className={`mode-btn ${userMode === mode ? 'active' : ''}`}
                onClick={() => handleModeChange(mode)}
              >
                <span>{MODE_CONFIG[mode].icon}</span>
                <span className="mode-label">{MODE_CONFIG[mode].label}</span>
              </button>
            ))}
          </div>
        </div>

        <button className="logout-btn" onClick={handleLogout}>
          Log out
        </button>
      </div>

      <style jsx>{`
        .sheet-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          z-index: 200;
          animation: fade-in 0.15s ease;
        }
        .sheet-backdrop.closing {
          animation: fade-out 0.15s ease forwards;
        }

        .sheet-panel {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          max-height: 80vh;
          background: white;
          border-radius: 16px 16px 0 0;
          z-index: 201;
          padding: 8px 16px calc(20px + var(--safe-area-bottom));
          overflow-y: auto;
          animation: slide-up 0.2s ease;
        }
        .sheet-panel.closing {
          animation: slide-down 0.15s ease forwards;
        }

        .sheet-handle {
          width: 36px;
          height: 4px;
          background: #d1d5db;
          border-radius: 2px;
          margin: 0 auto 12px;
        }

        .sheet-section {
          margin-bottom: 12px;
        }

        .section-label {
          font-size: 11px;
          font-weight: 600;
          color: #8899a6;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 8px 4px 4px;
        }

        .sheet-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 12px 8px;
          background: none;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: background 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          text-align: left;
        }
        .sheet-item:hover { background: #f7f9fa; }

        .item-icon { font-size: 20px; flex-shrink: 0; }
        .item-label { font-size: 16px; font-weight: 500; color: #0f1419; }

        .mode-row {
          display: flex;
          gap: 8px;
          padding: 4px 0;
        }

        .mode-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 10px 8px;
          background: #f7f9fa;
          border: 2px solid transparent;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .mode-btn:hover { background: #eff3f4; }
        .mode-btn.active {
          background: rgba(29, 155, 240, 0.08);
          border-color: #1da1f2;
        }

        .mode-label {
          font-size: 12px;
          font-weight: 600;
          color: #536471;
        }
        .mode-btn.active .mode-label { color: #1da1f2; }

        .logout-btn {
          width: 100%;
          padding: 14px;
          margin-top: 8px;
          background: none;
          border: 1px solid #ef4444;
          border-radius: 12px;
          color: #ef4444;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .logout-btn:hover { background: rgba(239, 68, 68, 0.06); }
      `}</style>
    </>
  )
}
