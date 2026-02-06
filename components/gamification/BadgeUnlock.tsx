'use client'

import { useEffect, useState } from 'react'
import type { Badge } from '@/lib/gamification'
import { useGamificationPrefsSafe } from '@/context/GamificationPrefsContext'

interface BadgeUnlockProps {
  badge: Badge
  onClose?: () => void
}

export default function BadgeUnlock({ badge, onClose }: BadgeUnlockProps) {
  const { prefs } = useGamificationPrefsSafe()
  const [showConfetti, setShowConfetti] = useState(true)

  // Hide if badges display is disabled
  if (!prefs.showBadges) {
    return null
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowConfetti(false)
    }, 3000)

    return () => clearTimeout(timer)
  }, [])

  const confettiColors = ['#1D9BF0', '#f4212e', '#00ba7c', '#f97316', '#a855f7']

  return (
    <div className="badge-unlock">
      {showConfetti && (
        <div className="confetti-container">
          {[...Array(30)].map((_, i) => (
            <span
              key={i}
              className="confetti-piece"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.5}s`,
                backgroundColor: confettiColors[i % 5],
                transform: `rotate(${Math.random() * 360}deg)`
              }}
            />
          ))}
        </div>
      )}

      <div className="badge-card">
        <div className="badge-icon-large">{badge.icon}</div>
        <h3 className="badge-title">{badge.title}</h3>
        <p className="badge-description">{badge.description}</p>
        {onClose && (
          <button onClick={onClose} className="badge-close">
            ✓ Got it
          </button>
        )}
      </div>

      <style jsx>{`
        .badge-unlock {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(20px, 5vw, 32px);
        }

        .confetti-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          pointer-events: none;
          z-index: 1;
        }

        .confetti-piece {
          position: absolute;
          width: clamp(8px, 2vw, 12px);
          height: clamp(8px, 2vw, 12px);
          top: -10%;
          animation: confetti-fall 3s ease-out forwards;
        }

        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(720deg);
            opacity: 0;
          }
        }

        .badge-card {
          position: relative;
          z-index: 2;
          background: white;
          border-radius: clamp(16px, 4vw, 24px);
          padding: clamp(24px, 6vw, 36px);
          text-align: center;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
          animation: badge-popup 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          max-width: 320px;
          width: 100%;
        }

        @keyframes badge-popup {
          0% {
            transform: scale(0.5);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .badge-icon-large {
          font-size: clamp(48px, 12vw, 72px);
          line-height: 1;
          margin-bottom: clamp(12px, 3vw, 16px);
        }

        .badge-title {
          font-size: clamp(20px, 5.5vw, 26px);
          font-weight: 700;
          color: #0f1419;
          margin: 0 0 clamp(8px, 2vw, 12px) 0;
        }

        .badge-description {
          font-size: clamp(14px, 3.8vw, 16px);
          color: #536471;
          margin: 0 0 clamp(16px, 4vw, 24px) 0;
          line-height: 1.5;
        }

        .badge-close {
          background: #1D9BF0;
          color: white;
          border: none;
          border-radius: clamp(8px, 2vw, 12px);
          padding: clamp(10px, 3vw, 14px) clamp(20px, 5vw, 28px);
          font-size: clamp(14px, 3.8vw, 16px);
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .badge-close:hover {
          background: #1a8cd8;
        }

        .badge-close:active {
          transform: scale(0.98);
        }
      `}</style>
    </div>
  )
}
