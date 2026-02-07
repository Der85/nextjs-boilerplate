'use client'

import { useRouter } from 'next/navigation'

interface NotificationBar {
  text: string
  color: string
  icon?: string
}

interface AppHeaderProps {
  onlineCount?: number
  notificationBar?: NotificationBar | null
  brakeVariant?: 'urgent' | 'neutral'
  userMode?: 'recovery' | 'maintenance' | 'growth'
}

export default function AppHeader({
  notificationBar,
  brakeVariant = 'neutral',
  userMode = 'maintenance',
}: AppHeaderProps) {
  const router = useRouter()

  const isRecovery = userMode === 'recovery'

  return (
    <>
      <header className={`app-header ${isRecovery ? 'compact' : ''}`}>
        {/* Logo - always clickable to go home */}
        <button onClick={() => router.push('/dashboard')} className={`logo ${isRecovery ? 'logo-compact' : ''}`}>
          {isRecovery ? '🏠' : 'ADHDer.io'}
        </button>

        {/* Spacer */}
        <div className="header-spacer" />

        {/* Brake button - safety feature always available */}
        <button
          onClick={() => router.push('/brake')}
          className={`icon-btn ${brakeVariant === 'urgent' ? 'brake-urgent' : 'brake-neutral'} ${isRecovery ? 'brake-prominent' : ''}`}
          title={brakeVariant === 'urgent' ? 'BREAK - Reset Now' : 'Quick Breathe'}
        >
          {brakeVariant === 'urgent' ? '🛑' : '🫁'}
        </button>
      </header>

      {notificationBar && (
        <div
          className="notification-bar"
          style={{
            background: `${notificationBar.color}15`,
            borderLeft: `3px solid ${notificationBar.color}`,
          }}
        >
          {notificationBar.icon && <span className="notif-icon" style={{ color: notificationBar.color }}>{notificationBar.icon}</span>}
          <span className="notif-text">{notificationBar.text}</span>
        </div>
      )}

      <style jsx>{`
        .app-header {
          position: sticky;
          top: 0;
          background: white;
          border-bottom: 1px solid #eee;
          padding: clamp(10px, 2.5vw, 14px) clamp(14px, 4vw, 20px);
          display: flex;
          align-items: center;
          gap: clamp(8px, 2vw, 12px);
          z-index: 100;
        }

        .app-header.compact {
          padding: clamp(8px, 2vw, 12px) clamp(12px, 3vw, 16px);
        }

        .logo {
          background: none;
          border: none;
          cursor: pointer;
          font-size: clamp(15px, 4vw, 19px);
          font-weight: 800;
          color: #1D9BF0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .logo.logo-compact {
          font-size: clamp(20px, 5.5vw, 26px);
        }

        .logo:hover {
          opacity: 0.8;
        }

        .header-spacer {
          flex: 1;
        }

        .icon-btn {
          width: clamp(36px, 9vw, 44px);
          height: clamp(36px, 9vw, 44px);
          border-radius: 50%;
          border: none;
          cursor: pointer;
          font-size: clamp(16px, 4vw, 20px);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.15s ease;
          flex-shrink: 0;
        }

        .icon-btn:hover {
          transform: scale(1.05);
        }

        .icon-btn.brake-urgent {
          background: rgba(239, 68, 68, 0.1);
        }

        .icon-btn.brake-neutral {
          background: rgba(148, 163, 184, 0.1);
        }

        .icon-btn.brake-prominent {
          width: clamp(48px, 13vw, 60px);
          height: clamp(48px, 13vw, 60px);
          font-size: clamp(22px, 6vw, 28px);
          background: rgba(239, 68, 68, 0.15);
          box-shadow: 0 2px 8px rgba(239, 68, 68, 0.2);
        }

        .icon-btn.brake-prominent:hover {
          transform: scale(1.08);
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
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
          color: #1f2937;
        }
      `}</style>
    </>
  )
}
