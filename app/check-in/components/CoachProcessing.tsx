'use client'

import { useState, useEffect } from 'react'
import { getEnergyEmoji } from '@/lib/gamification'

interface CoachProcessingProps {
  energyLevel: number | null
  moodScore: number | null
}

const getMoodEmoji = (score: number): string => {
  if (score <= 2) return '😢'
  if (score <= 4) return '😔'
  if (score <= 6) return '😐'
  if (score <= 8) return '🙂'
  return '😄'
}

const messages = [
  "Analyzing your patterns...",
  "Checking your streaks...",
  "Crafting personalized advice...",
  "Almost there..."
]

export default function CoachProcessing({ energyLevel, moodScore }: CoachProcessingProps) {
  const [currentMessage, setCurrentMessage] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessage(prev => (prev + 1) % messages.length)
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="coach-processing-screen">
      <div className="processing-content">
        <div className="brain-icon">🧠</div>

        <p className="processing-message">{messages[currentMessage]}</p>

        {/* Show what user selected */}
        <div className="selection-summary">
          {energyLevel !== null && (
            <div className="summary-item">
              <span>Energy:</span>
              <span className="summary-value">{getEnergyEmoji(energyLevel)}</span>
            </div>
          )}
          {moodScore !== null && (
            <div className="summary-item">
              <span>Mood:</span>
              <span className="summary-value">{getMoodEmoji(moodScore)} {moodScore}/10</span>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .coach-processing-screen {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(20px, 5vw, 32px);
          background: linear-gradient(135deg, #e0f2fe 0%, #ddd6fe 100%);
        }

        .processing-content {
          text-align: center;
          max-width: 500px;
          width: 100%;
        }

        .brain-icon {
          font-size: clamp(64px, 16vw, 96px);
          animation: pulse 1.5s ease-in-out infinite;
          margin-bottom: clamp(24px, 6vw, 36px);
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
        }

        .processing-message {
          font-size: clamp(18px, 5vw, 24px);
          font-weight: 600;
          color: #0f1419;
          margin: 0 0 clamp(32px, 8vw, 48px) 0;
          animation: fadeInOut 2s ease-in-out infinite;
        }

        @keyframes fadeInOut {
          0%, 100% {
            opacity: 0.6;
          }
          50% {
            opacity: 1;
          }
        }

        .selection-summary {
          background: rgba(255, 255, 255, 0.9);
          border-radius: clamp(12px, 3vw, 16px);
          padding: clamp(16px, 4vw, 24px);
          display: flex;
          justify-content: center;
          gap: clamp(24px, 6vw, 36px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
        }

        .summary-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: clamp(8px, 2vw, 12px);
          font-size: clamp(14px, 3.8vw, 16px);
          color: #536471;
        }

        .summary-value {
          font-size: clamp(24px, 6vw, 32px);
          font-weight: 700;
          color: #0f1419;
        }
      `}</style>
    </div>
  )
}
