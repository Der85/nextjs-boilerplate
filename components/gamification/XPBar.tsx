'use client'

import { useGamificationPrefsSafe } from '@/context/GamificationPrefsContext'

interface XPBarProps {
  currentXP: number
  xpForNextLevel: number
  currentLevel: number
  xpGained?: number
  animated?: boolean
}

export default function XPBar({
  currentXP,
  xpForNextLevel,
  currentLevel,
  xpGained = 0,
  animated = true
}: XPBarProps) {
  const { prefs } = useGamificationPrefsSafe()

  // Hide if XP display is disabled
  if (!prefs.showXP) {
    return null
  }
  // Calculate XP at current level start
  let xpAtLevelStart = 0
  if (currentLevel > 5) xpAtLevelStart = 500
  if (currentLevel > 10) xpAtLevelStart = 1500
  if (currentLevel > 20) xpAtLevelStart = 5000

  if (currentLevel <= 5) {
    xpAtLevelStart = (currentLevel - 1) * 100
  } else if (currentLevel <= 10) {
    xpAtLevelStart = 500 + (currentLevel - 6) * 200
  } else if (currentLevel <= 20) {
    xpAtLevelStart = 1500 + (currentLevel - 11) * 350
  } else {
    xpAtLevelStart = 5000 + (currentLevel - 21) * 500
  }

  const xpInCurrentLevel = currentXP - xpAtLevelStart
  const xpNeeded = xpForNextLevel - xpAtLevelStart

  const progress = Math.min((xpInCurrentLevel / xpNeeded) * 100, 100)

  return (
    <div className="xp-bar-container">
      <div className="xp-header">
        <div className="level-badge">
          Level {currentLevel}
        </div>
        <div className="xp-text">
          {xpInCurrentLevel.toLocaleString()} / {xpNeeded.toLocaleString()} XP
        </div>
      </div>

      <div className="xp-bar-track">
        <div
          className={`xp-bar-fill ${animated ? 'animated' : ''}`}
          style={{ width: `${progress}%` }}
        >
          {xpGained > 0 && (
            <span className="xp-gained">+{xpGained} XP</span>
          )}
        </div>
      </div>

      <div className="next-level-text">
        {xpNeeded - xpInCurrentLevel} XP to Level {currentLevel + 1}
      </div>

      <style jsx>{`
        .xp-bar-container {
          width: 100%;
        }

        .xp-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: clamp(8px, 2vw, 12px);
        }

        .level-badge {
          background: linear-gradient(135deg, #1D9BF0 0%, #1a8cd8 100%);
          color: white;
          padding: clamp(4px, 1.5vw, 6px) clamp(12px, 3vw, 16px);
          border-radius: 100px;
          font-size: clamp(12px, 3.2vw, 14px);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .xp-text {
          font-size: clamp(12px, 3.2vw, 14px);
          font-weight: 600;
          color: #536471;
        }

        .xp-bar-track {
          width: 100%;
          height: clamp(12px, 3vw, 16px);
          background: #e5e7eb;
          border-radius: 100px;
          overflow: hidden;
          position: relative;
        }

        .xp-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #00ba7c 0%, #22c55e 100%);
          border-radius: 100px;
          transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding-right: clamp(8px, 2vw, 12px);
        }

        .xp-bar-fill.animated {
          animation: pulse-glow 2s ease-in-out;
        }

        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 0 rgba(34, 197, 94, 0);
          }
          50% {
            box-shadow: 0 0 clamp(8px, 2vw, 12px) rgba(34, 197, 94, 0.6);
          }
        }

        .xp-gained {
          color: white;
          font-size: clamp(10px, 2.8vw, 12px);
          font-weight: 700;
          white-space: nowrap;
          animation: xp-popup 0.5s ease-out;
        }

        @keyframes xp-popup {
          0% {
            transform: translateY(10px);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .next-level-text {
          font-size: clamp(11px, 3vw, 13px);
          color: #8899a6;
          margin-top: clamp(6px, 1.5vw, 8px);
          text-align: center;
        }
      `}</style>
    </div>
  )
}
