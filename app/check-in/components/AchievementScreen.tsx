'use client'

import { useState, useEffect } from 'react'
import BadgeUnlock from '@/components/gamification/BadgeUnlock'
import XPBar from '@/components/gamification/XPBar'
import type { Badge } from '@/lib/gamification'
import { useGamificationPrefsSafe } from '@/context/GamificationPrefsContext'

interface AchievementScreenProps {
  coachAdvice: string
  xpEarned: number
  newBadges: Badge[]
  currentXP: number
  xpForNextLevel: number
  currentLevel: number
  onContinue: () => void
}

export default function AchievementScreen({
  coachAdvice,
  xpEarned,
  newBadges,
  currentXP,
  xpForNextLevel,
  currentLevel,
  onContinue
}: AchievementScreenProps) {
  const { prefs } = useGamificationPrefsSafe()
  const [currentBadgeIndex, setCurrentBadgeIndex] = useState(0)

  // Filter badges based on preference
  const visibleBadges = prefs.showBadges ? newBadges : []

  const handleBadgeClose = () => {
    if (currentBadgeIndex < visibleBadges.length - 1) {
      setCurrentBadgeIndex(prev => prev + 1)
    } else {
      // All badges shown, move to next screen
      onContinue()
    }
  }

  // Auto-continue if both XP and badges are hidden and there's no coach advice
  useEffect(() => {
    if (!prefs.showXP && !prefs.showBadges && (!coachAdvice || coachAdvice.length === 0)) {
      onContinue()
    }
  }, [prefs.showXP, prefs.showBadges, coachAdvice, onContinue])

  // If there are no visible badges, just show the coach advice
  if (visibleBadges.length === 0) {
    return (
      <div className="achievement-screen">
        <div className="achievement-content">
          <div className="coach-card">
            <div className="coach-header">
              <span className="coach-icon">💭</span>
              <span className="coach-label">Der's advice</span>
            </div>
            <p className="coach-text">{coachAdvice}</p>
          </div>

          <XPBar
            currentXP={currentXP}
            xpForNextLevel={xpForNextLevel}
            currentLevel={currentLevel}
            xpGained={xpEarned}
            animated
          />

          <button onClick={onContinue} className="continue-btn">
            Continue →
          </button>
        </div>

        <style jsx>{styles}</style>
      </div>
    )
  }

  // Show badges one at a time
  return (
    <div className="achievement-screen">
      <BadgeUnlock
        badge={visibleBadges[currentBadgeIndex]}
        onClose={handleBadgeClose}
      />
      <style jsx>{styles}</style>
    </div>
  )
}

const styles = `
  .achievement-screen {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(20px, 5vw, 32px);
    background: linear-gradient(135deg, #f7f9fa 0%, #e0f2fe 100%);
  }

  .achievement-content {
    max-width: 600px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: clamp(24px, 6vw, 32px);
  }

  .coach-card {
    background: white;
    border-left: 4px solid #1D9BF0;
    border-radius: clamp(12px, 3vw, 16px);
    padding: clamp(18px, 5vw, 24px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    animation: slideIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .coach-header {
    display: flex;
    align-items: center;
    gap: clamp(8px, 2vw, 12px);
    margin-bottom: clamp(12px, 3vw, 16px);
  }

  .coach-icon {
    font-size: clamp(20px, 5.5vw, 24px);
  }

  .coach-label {
    font-size: clamp(12px, 3.2vw, 14px);
    font-weight: 700;
    color: #1D9BF0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .coach-text {
    font-size: clamp(15px, 4vw, 17px);
    color: #0f1419;
    line-height: 1.6;
    margin: 0;
  }

  .continue-btn {
    background: #1D9BF0;
    color: white;
    border: none;
    border-radius: clamp(10px, 2.5vw, 14px);
    padding: clamp(14px, 4vw, 18px);
    font-size: clamp(15px, 4vw, 17px);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.1s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .continue-btn:hover {
    background: #1a8cd8;
  }

  .continue-btn:active {
    transform: scale(0.98);
  }
`
