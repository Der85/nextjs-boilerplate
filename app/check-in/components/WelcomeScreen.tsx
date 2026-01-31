'use client'

import { useEffect } from 'react'
import ProgressRing from '@/components/gamification/ProgressRing'
import { getMoodGradient } from '@/lib/gamification'

interface WelcomeScreenProps {
  onComplete: () => void
  currentStreak: number
  lastMoodScore: number | null
  greeting: string
}

export default function WelcomeScreen({
  onComplete,
  currentStreak,
  lastMoodScore,
  greeting
}: WelcomeScreenProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete()
    }, 3000)

    return () => clearTimeout(timer)
  }, [onComplete])

  const backgroundGradient = lastMoodScore !== null
    ? getMoodGradient(lastMoodScore)
    : 'linear-gradient(135deg, #f7f9fa 0%, #e5e7eb 100%)'

  return (
    <div className="welcome-screen" style={{ background: backgroundGradient }}>
      <div className="welcome-content">
        <h1 className="welcome-greeting">{greeting} 👋</h1>

        {currentStreak > 0 && (
          <div className="streak-display">
            <ProgressRing
              progress={(currentStreak / 7) * 100}
              size={120}
              strokeWidth={10}
              color="#f97316"
              label="streak"
              value={`${currentStreak}${currentStreak >= 7 ? '+' : ''}`}
            />
            <p className="streak-text">
              {currentStreak === 1
                ? "You're back!"
                : currentStreak < 7
                ? `${currentStreak} days strong!`
                : "You're on fire! 🔥"}
            </p>
          </div>
        )}

        <p className="welcome-message">Starting your daily check-in...</p>
        <p className="breathe-prompt">Take a deep breath</p>
      </div>

      <style jsx>{`
        .welcome-screen {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(20px, 5vw, 32px);
          animation: fadeIn 0.5s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .welcome-content {
          text-align: center;
          animation: slideUp 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes slideUp {
          from {
            transform: translateY(30px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .welcome-greeting {
          font-size: clamp(28px, 7vw, 36px);
          font-weight: 700;
          color: #0f1419;
          margin: 0 0 clamp(24px, 6vw, 36px) 0;
        }

        .streak-display {
          margin-bottom: clamp(32px, 8vw, 48px);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: clamp(16px, 4vw, 24px);
        }

        .streak-text {
          font-size: clamp(16px, 4.5vw, 20px);
          font-weight: 600;
          color: #f97316;
          margin: 0;
        }

        .welcome-message {
          font-size: clamp(16px, 4.5vw, 20px);
          color: #536471;
          margin: 0 0 clamp(12px, 3vw, 16px) 0;
        }

        .breathe-prompt {
          font-size: clamp(14px, 3.8vw, 16px);
          color: #8899a6;
          margin: 0;
          font-style: italic;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 0.6;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
