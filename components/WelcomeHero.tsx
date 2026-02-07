'use client'

import { useState, useEffect } from 'react'

interface UserInsights {
  totalCheckIns: number
  currentStreak: { type: string; days: number } | null
  lastMood: number | null
  lastNote: string | null
  daysSinceLastCheckIn: number
  recentAverage: number | null
  trend: 'up' | 'down' | 'stable' | null
}

interface WelcomeHeroProps {
  insights: UserInsights | null
  yesterdayWinsCount: number
  onMoodSelect: (mood: 'low' | 'okay' | 'good') => void
  onSkip: () => void
}

// ADHD tips for new users - rotates each session
const ADHD_TIPS = [
  "Your brain isn't broken, it's just wired for interest-based motivation. Let's work with that today.",
  "Small wins compound. One tiny action now beats a perfect plan later.",
  "ADHD brains often need external structure. That's what this app is for.",
  "Body doubling works — even virtually. That's why we show who's online.",
  "Starting is the hardest part. Once you're moving, momentum helps.",
  "Low energy days aren't failures. They're data about what you need.",
  "ADHD paralysis is real. The solution? Just pick the tiniest next step.",
  "Your worth isn't measured by productivity. Rest is productive too.",
]

// Get a consistent tip for the current day (so it doesn't change on every render)
const getDailyTip = (): string => {
  const today = new Date().toDateString()
  // Simple hash of the date string to pick a tip
  let hash = 0
  for (let i = 0; i < today.length; i++) {
    hash = ((hash << 5) - hash) + today.charCodeAt(i)
    hash = hash & hash
  }
  const index = Math.abs(hash) % ADHD_TIPS.length
  return ADHD_TIPS[index]
}

const getTimeGreeting = (): string => {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function WelcomeHero({
  insights,
  yesterdayWinsCount,
  onMoodSelect,
  onSkip,
}: WelcomeHeroProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [selectedMood, setSelectedMood] = useState<'low' | 'okay' | 'good' | null>(null)

  // Generate the value nugget based on user history
  const getValueNugget = (): { text: string; icon: string } => {
    if (!insights) {
      // Brand new user - show ADHD tip
      return {
        text: getDailyTip(),
        icon: '💡',
      }
    }

    // Returning user with history
    const { totalCheckIns, currentStreak, daysSinceLastCheckIn, trend } = insights

    // Priority 1: Active streak
    if (currentStreak && currentStreak.days >= 2) {
      return {
        text: `You've checked in ${currentStreak.days} days in a row`,
        icon: '🔥',
      }
    }

    // Priority 2: Yesterday's wins
    if (yesterdayWinsCount > 0 && daysSinceLastCheckIn <= 1) {
      return {
        text: `You crushed ${yesterdayWinsCount} task${yesterdayWinsCount !== 1 ? 's' : ''} yesterday`,
        icon: '💪',
      }
    }

    // Priority 3: Pattern insight (for users with enough history)
    if (totalCheckIns > 5) {
      if (trend === 'up') {
        return {
          text: "Your mood has been trending up lately. Keep it going!",
          icon: '📈',
        }
      }
      if (trend === 'stable') {
        return {
          text: "You've been consistent. That's the real superpower.",
          icon: '⚡',
        }
      }
    }

    // Priority 4: Returning after absence (3+ days)
    if (daysSinceLastCheckIn >= 3) {
      return {
        text: "Welcome back. No catching up needed — let's just start from here.",
        icon: '🌱',
      }
    }

    // Priority 5: Default for returning user with some history
    if (totalCheckIns > 0) {
      return {
        text: "One small step. That's all it takes to start the day.",
        icon: '✨',
      }
    }

    // Fallback: New user
    return {
      text: getDailyTip(),
      icon: '💡',
    }
  }

  const handleMoodSelect = (mood: 'low' | 'okay' | 'good') => {
    setSelectedMood(mood)
    // Brief delay for visual feedback before transition
    setTimeout(() => {
      onMoodSelect(mood)
    }, 200)
  }

  const valueNugget = getValueNugget()

  if (!isVisible) return null

  return (
    <div className={`welcome-hero ${selectedMood ? 'exiting' : ''}`}>
      {/* Time-aware greeting */}
      <div className="welcome-greeting">
        <h1 className="greeting-text">{getTimeGreeting()} 👋</h1>
      </div>

      {/* Value nugget */}
      <div className="value-nugget">
        <span className="nugget-icon">{valueNugget.icon}</span>
        <p className="nugget-text">{valueNugget.text}</p>
      </div>

      {/* Mood selection - 3 simple options */}
      <div className="mood-section">
        <p className="mood-prompt">How are you feeling?</p>
        <div className="mood-buttons">
          <button
            className={`mood-btn low ${selectedMood === 'low' ? 'selected' : ''}`}
            onClick={() => handleMoodSelect('low')}
            disabled={selectedMood !== null}
          >
            <span className="mood-icon">🔋</span>
            <span className="mood-label">Running low</span>
          </button>
          <button
            className={`mood-btn okay ${selectedMood === 'okay' ? 'selected' : ''}`}
            onClick={() => handleMoodSelect('okay')}
            disabled={selectedMood !== null}
          >
            <span className="mood-icon">🙂</span>
            <span className="mood-label">I'm okay</span>
          </button>
          <button
            className={`mood-btn good ${selectedMood === 'good' ? 'selected' : ''}`}
            onClick={() => handleMoodSelect('good')}
            disabled={selectedMood !== null}
          >
            <span className="mood-icon">⚡</span>
            <span className="mood-label">Feeling good</span>
          </button>
        </div>
      </div>

      {/* Skip option */}
      <button className="skip-btn" onClick={onSkip} disabled={selectedMood !== null}>
        Not now
      </button>

      <style jsx>{`
        .welcome-hero {
          background: white;
          border-radius: clamp(16px, 4vw, 24px);
          padding: clamp(20px, 5vw, 32px);
          margin-bottom: clamp(16px, 4vw, 24px);
          text-align: center;
          animation: slideIn 0.4s ease-out;
          transition: opacity 0.3s ease, transform 0.3s ease;
        }

        .welcome-hero.exiting {
          opacity: 0;
          transform: translateY(-10px);
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

        /* Greeting */
        .welcome-greeting {
          margin-bottom: clamp(16px, 4vw, 24px);
        }

        .greeting-text {
          font-size: clamp(24px, 6vw, 32px);
          font-weight: 800;
          color: #0f1419;
          margin: 0;
        }

        /* Value Nugget */
        .value-nugget {
          display: flex;
          align-items: flex-start;
          gap: clamp(10px, 2.5vw, 14px);
          padding: clamp(14px, 3.5vw, 20px);
          background: linear-gradient(135deg, rgba(29, 155, 240, 0.06) 0%, rgba(29, 155, 240, 0.02) 100%);
          border-radius: clamp(12px, 3vw, 16px);
          margin-bottom: clamp(20px, 5vw, 28px);
          text-align: left;
        }

        .nugget-icon {
          font-size: clamp(24px, 6vw, 28px);
          flex-shrink: 0;
        }

        .nugget-text {
          font-size: clamp(14px, 3.8vw, 16px);
          color: #536471;
          line-height: 1.5;
          margin: 0;
        }

        /* Mood Section */
        .mood-section {
          margin-bottom: clamp(16px, 4vw, 24px);
        }

        .mood-prompt {
          font-size: clamp(14px, 3.8vw, 16px);
          font-weight: 600;
          color: #536471;
          margin: 0 0 clamp(12px, 3vw, 16px) 0;
        }

        .mood-buttons {
          display: flex;
          gap: clamp(8px, 2vw, 12px);
          justify-content: center;
        }

        .mood-btn {
          flex: 1;
          max-width: 120px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: clamp(6px, 1.5vw, 8px);
          padding: clamp(14px, 3.5vw, 18px) clamp(8px, 2vw, 12px);
          background: #f7f9fa;
          border: 2px solid transparent;
          border-radius: clamp(12px, 3vw, 16px);
          cursor: pointer;
          transition: all 0.2s ease;
          min-height: 48px;
        }

        .mood-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .mood-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .mood-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .mood-btn.selected {
          opacity: 1;
          transform: scale(1.05);
        }

        .mood-btn.low {
          border-color: rgba(244, 33, 46, 0.2);
        }

        .mood-btn.low:hover:not(:disabled),
        .mood-btn.low.selected {
          background: rgba(244, 33, 46, 0.08);
          border-color: #f4212e;
        }

        .mood-btn.okay {
          border-color: rgba(29, 155, 240, 0.2);
        }

        .mood-btn.okay:hover:not(:disabled),
        .mood-btn.okay.selected {
          background: rgba(29, 155, 240, 0.08);
          border-color: #1D9BF0;
        }

        .mood-btn.good {
          border-color: rgba(0, 186, 124, 0.2);
        }

        .mood-btn.good:hover:not(:disabled),
        .mood-btn.good.selected {
          background: rgba(0, 186, 124, 0.08);
          border-color: #00ba7c;
        }

        .mood-icon {
          font-size: clamp(24px, 6vw, 28px);
        }

        .mood-label {
          font-size: clamp(12px, 3.2vw, 14px);
          font-weight: 600;
          color: #0f1419;
        }

        /* Skip Button */
        .skip-btn {
          background: none;
          border: none;
          color: #8899a6;
          font-size: clamp(13px, 3.5vw, 15px);
          font-weight: 500;
          cursor: pointer;
          padding: clamp(8px, 2vw, 12px) clamp(16px, 4vw, 24px);
          transition: color 0.15s ease;
        }

        .skip-btn:hover:not(:disabled) {
          color: #536471;
        }

        .skip-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Responsive adjustments */
        @media (max-width: 360px) {
          .mood-buttons {
            flex-direction: column;
            align-items: stretch;
          }

          .mood-btn {
            max-width: 100%;
            flex-direction: row;
            justify-content: flex-start;
            padding: clamp(12px, 3vw, 16px);
          }
        }
      `}</style>
    </div>
  )
}
