'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'

type HeaderMode = 'pre-checkin' | 'recovery' | 'maintenance' | 'growth'
type BrakeState = 'calm' | 'suggested' | 'urgent'

interface AppHeaderProps {
  mode?: HeaderMode
  isReturningUser?: boolean          // true if 3+ days since last check-in
  userName?: string                   // for personalized greeting
  streakCount?: number               // for Growth mode message
  moodTrending?: 'up' | 'down' | 'stable'  // for Brake button suggested state
  sessionDuration?: number           // minutes in-app, for Brake suggested trigger
  onNotificationAction?: () => void  // callback for the inline action tap
  onBrakePress?: () => void          // callback for Brake button
  // Legacy props for backward compatibility
  notificationBar?: { text: string; color: string; icon?: string } | null
  brakeVariant?: 'urgent' | 'neutral'
  userMode?: 'recovery' | 'maintenance' | 'growth'
  onlineCount?: number
}

const getTimeGreeting = (): string => {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function AppHeader({
  mode,
  isReturningUser = false,
  userName,
  streakCount = 0,
  moodTrending,
  sessionDuration = 0,
  onNotificationAction,
  onBrakePress,
  // Legacy props
  notificationBar,
  brakeVariant,
  userMode,
}: AppHeaderProps) {
  const router = useRouter()
  const [notifFaded, setNotifFaded] = useState(false)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Determine the effective mode (new prop takes precedence over legacy)
  const effectiveMode: HeaderMode = mode || (userMode === 'recovery' ? 'recovery' : userMode === 'growth' ? 'growth' : 'maintenance')

  // Determine brake button state
  const getBrakeState = (): BrakeState => {
    if (effectiveMode === 'recovery') return 'urgent'
    if (effectiveMode === 'pre-checkin') return 'suggested'
    if (moodTrending === 'down') return 'suggested'
    if (sessionDuration >= 20) return 'suggested'
    // Legacy fallback
    if (brakeVariant === 'urgent') return 'urgent'
    return 'calm'
  }

  const brakeState = getBrakeState()

  // Get notification content based on mode
  const getNotificationContent = (): { message: string; action: string; icon: string; color: string } | null => {
    // If using legacy notificationBar prop, adapt it
    if (notificationBar && !mode) {
      return {
        message: notificationBar.text,
        action: '',
        icon: notificationBar.icon || '💭',
        color: notificationBar.color,
      }
    }

    const greeting = userName ? `Hey ${userName}` : getTimeGreeting()

    switch (effectiveMode) {
      case 'pre-checkin':
        if (isReturningUser) {
          return {
            message: 'Welcome back. Fresh start, no baggage.',
            action: "Let's go →",
            icon: '🌱',
            color: '#6366f1', // Warm indigo
          }
        }
        return {
          message: `${greeting}. Ready when you are.`,
          action: 'Check in →',
          icon: '👋',
          color: '#6366f1', // Warm indigo
        }
      case 'recovery':
        return {
          message: 'Gentle mode. Only the essentials right now.',
          action: 'Breathe with me →',
          icon: '🌿',
          color: '#8b5cf6', // Soft purple (not red!)
        }
      case 'growth':
        return {
          message: streakCount > 0
            ? `You're on a roll — ${streakCount} days strong.`
            : "You're on a roll today.",
          action: 'Keep going →',
          icon: '🚀',
          color: '#10b981', // Emerald
        }
      case 'maintenance':
      default:
        return {
          message: "You're here. That counts.",
          action: "What's my one thing? →",
          icon: '💪',
          color: '#1D9BF0', // Primary blue
        }
    }
  }

  const notifContent = getNotificationContent()

  // Auto-dismiss logic for maintenance/growth modes
  useEffect(() => {
    if (effectiveMode === 'maintenance' || effectiveMode === 'growth') {
      fadeTimerRef.current = setTimeout(() => {
        setNotifFaded(true)
      }, 10000) // Fade after 10 seconds
    } else {
      // Reset for other modes
      setNotifFaded(false)
    }

    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    }
  }, [effectiveMode])

  const handleNotificationAction = () => {
    if (onNotificationAction) {
      onNotificationAction()
    } else {
      // Default behavior based on mode
      if (effectiveMode === 'recovery') {
        router.push('/brake')
      } else {
        // Scroll to hero card
        const heroCard = document.querySelector('.hero-card, .welcome-hero')
        if (heroCard) {
          heroCard.scrollIntoView({ behavior: 'smooth', block: 'center' })
          // Pulse animation on mood buttons if pre-checkin
          if (effectiveMode === 'pre-checkin') {
            const moodButtons = document.querySelectorAll('.mood-btn')
            moodButtons.forEach(btn => {
              btn.classList.add('pulse-highlight')
              setTimeout(() => btn.classList.remove('pulse-highlight'), 1000)
            })
          }
        }
      }
    }
  }

  const handleBrakePress = () => {
    if (onBrakePress) {
      onBrakePress()
    } else {
      router.push('/brake')
    }
  }

  // Brake button config based on state
  const brakeConfig = {
    calm: {
      icon: '🫁',
      label: 'Take a breath',
      className: 'brake-calm',
    },
    suggested: {
      icon: '🌊',
      label: 'Need a pause?',
      className: 'brake-suggested',
    },
    urgent: {
      icon: '🤲',
      label: "I'm here. Breathe.",
      className: 'brake-urgent',
    },
  }

  const brake = brakeConfig[brakeState]
  const isRecovery = effectiveMode === 'recovery'
  const isPreCheckin = effectiveMode === 'pre-checkin'

  return (
    <>
      <header className={`app-header ${isRecovery ? 'recovery' : ''} ${isPreCheckin ? 'pre-checkin' : ''}`}>
        {/* Logo - always clickable to go home */}
        <button onClick={() => router.push('/dashboard')} className="logo">
          {isRecovery ? '🏠' : 'ADHDer.io'}
        </button>

        {/* Spacer */}
        <div className="header-spacer" />

        {/* Weekly Plan button - hidden in recovery mode */}
        {!isRecovery && (
          <button
            onClick={() => router.push('/weekly-planning')}
            className="weekly-plan-btn"
            title="Weekly Planning"
            aria-label="Weekly Planning"
          >
            <span className="weekly-plan-icon">📅</span>
          </button>
        )}

        {/* Brake button - always present, graduated states */}
        <button
          onClick={handleBrakePress}
          className={`brake-btn ${brake.className}`}
          title={brake.label}
          aria-label={brake.label}
        >
          <span className="brake-icon">{brake.icon}</span>
        </button>
      </header>

      {/* Notification bar with action */}
      {notifContent && (
        <div
          className={`notification-bar ${notifFaded ? 'faded' : ''}`}
          style={{
            '--notif-color': notifContent.color,
          } as React.CSSProperties}
        >
          <span className="notif-icon">{notifContent.icon}</span>
          <span className="notif-message">{notifContent.message}</span>
          {notifContent.action && (
            <button
              className="notif-action"
              onClick={handleNotificationAction}
            >
              {notifContent.action}
            </button>
          )}
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
          transition: background 0.3s ease, border-color 0.3s ease, opacity 0.3s ease;
          /* Zen Mode: Dim secondary elements */
          opacity: 0.6;
        }

        .app-header:hover {
          opacity: 1;
        }

        .app-header.pre-checkin {
          background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%);
          border-bottom-color: #fde047;
        }

        .app-header.recovery {
          background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
          border-bottom-color: #c4b5fd;
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
          transition: opacity 0.15s ease;
        }

        .logo:hover {
          opacity: 0.8;
        }

        .header-spacer {
          flex: 1;
        }

        /* ===== Weekly Plan Button ===== */
        .weekly-plan-btn {
          width: clamp(36px, 9vw, 42px);
          height: clamp(36px, 9vw, 42px);
          border-radius: 50%;
          border: none;
          background: rgba(29, 155, 240, 0.08);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .weekly-plan-btn:hover {
          background: rgba(29, 155, 240, 0.15);
          transform: scale(1.05);
        }

        .weekly-plan-icon {
          font-size: clamp(16px, 4vw, 18px);
        }

        /* ===== Brake Button - 3 States ===== */
        .brake-btn {
          width: clamp(40px, 10vw, 48px);
          height: clamp(40px, 10vw, 48px);
          border-radius: 50%;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
          flex-shrink: 0;
          position: relative;
        }

        .brake-icon {
          font-size: clamp(18px, 4.5vw, 22px);
          transition: transform 0.3s ease;
        }

        .brake-btn:hover .brake-icon {
          transform: scale(1.1);
        }

        /* Calm state - subtle, muted */
        .brake-btn.brake-calm {
          background: rgba(148, 163, 184, 0.08);
        }

        .brake-btn.brake-calm::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid transparent;
          animation: subtle-pulse 60s ease-in-out infinite;
        }

        @keyframes subtle-pulse {
          0%, 95%, 100% { border-color: transparent; }
          97%, 98% { border-color: rgba(148, 163, 184, 0.3); }
        }

        /* Suggested state - soft highlight, gentle glow */
        .brake-btn.brake-suggested {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.12) 100%);
          box-shadow: 0 0 12px rgba(99, 102, 241, 0.2);
        }

        .brake-btn.brake-suggested::after {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: 50%;
          border: 2px solid rgba(99, 102, 241, 0.3);
          animation: gentle-glow 3s ease-in-out infinite;
        }

        @keyframes gentle-glow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }

        /* Urgent state - warm, calming (NOT red/alarm) */
        .brake-btn.brake-urgent {
          width: clamp(52px, 13vw, 60px);
          height: clamp(52px, 13vw, 60px);
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%);
          box-shadow: 0 2px 12px rgba(139, 92, 246, 0.25);
        }

        .brake-btn.brake-urgent .brake-icon {
          font-size: clamp(24px, 6vw, 28px);
          animation: breathing 8s ease-in-out infinite;
        }

        @keyframes breathing {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(1.08); }
          50% { transform: scale(1); }
          75% { transform: scale(1.08); }
        }

        .brake-btn.brake-urgent::after {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          border: 2px solid rgba(139, 92, 246, 0.4);
          animation: breathing-ring 8s ease-in-out infinite;
        }

        @keyframes breathing-ring {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          25% { transform: scale(1.1); opacity: 0.8; }
          50% { transform: scale(1); opacity: 0.6; }
          75% { transform: scale(1.1); opacity: 0.8; }
        }

        /* ===== Notification Bar ===== */
        .notification-bar {
          padding: clamp(10px, 2.5vw, 14px) clamp(14px, 4vw, 20px);
          font-size: clamp(13px, 3.5vw, 15px);
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: clamp(8px, 2vw, 12px);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: color-mix(in srgb, var(--notif-color) 8%, white);
          border-left: 3px solid var(--notif-color);
          transition: opacity 0.5s ease, max-height 0.5s ease;
          flex-wrap: wrap;
        }

        .notification-bar.faded {
          opacity: 0.6;
        }

        .notification-bar.faded .notif-message {
          display: none;
        }

        .notif-icon {
          font-size: clamp(16px, 4vw, 18px);
          flex-shrink: 0;
        }

        .notif-message {
          color: #374151;
          line-height: 1.4;
          flex: 1;
          min-width: 0;
        }

        .notif-action {
          background: none;
          border: none;
          color: var(--notif-color);
          font-size: clamp(13px, 3.5vw, 15px);
          font-weight: 600;
          cursor: pointer;
          padding: clamp(6px, 1.5vw, 10px) clamp(10px, 2.5vw, 14px);
          margin: clamp(-4px, -1vw, -6px) clamp(-6px, -1.5vw, -10px);
          border-radius: 8px;
          transition: background 0.15s ease, transform 0.15s ease;
          white-space: nowrap;
          min-height: 44px;
          display: flex;
          align-items: center;
        }

        .notif-action:hover {
          background: color-mix(in srgb, var(--notif-color) 12%, transparent);
          transform: translateX(2px);
        }

        .notif-action:active {
          transform: translateX(0);
        }

        /* Responsive adjustments */
        @media (max-width: 400px) {
          .notification-bar {
            flex-direction: column;
            align-items: flex-start;
            gap: clamp(6px, 1.5vw, 10px);
          }

          .notif-action {
            margin: 0;
            align-self: flex-end;
          }
        }
      `}</style>

      {/* Global styles for pulse highlight animation */}
      <style jsx global>{`
        .pulse-highlight {
          animation: pulse-attention 0.5s ease-out 2;
        }

        @keyframes pulse-attention {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
          50% { transform: scale(1.05); box-shadow: 0 0 0 8px rgba(99, 102, 241, 0); }
        }
      `}</style>
    </>
  )
}
