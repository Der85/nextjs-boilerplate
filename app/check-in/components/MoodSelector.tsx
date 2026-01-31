'use client'

import { useState } from 'react'
import { getMoodGradient } from '@/lib/gamification'

interface MoodSelectorProps {
  onSelect: (score: number) => void
  yesterdayMood: number | null
}

const getMoodEmoji = (score: number): string => {
  if (score <= 2) return '😢'
  if (score <= 4) return '😔'
  if (score <= 6) return '😐'
  if (score <= 8) return '🙂'
  return '😄'
}

export default function MoodSelector({ onSelect, yesterdayMood }: MoodSelectorProps) {
  const [selectedMood, setSelectedMood] = useState<number | null>(null)
  const [hoverMood, setHoverMood] = useState<number | null>(null)

  const handleSelect = (score: number) => {
    setSelectedMood(score)

    // Vibrate on mobile
    if ('vibrate' in navigator) {
      navigator.vibrate(10)
    }

    // Auto-advance after selection
    setTimeout(() => {
      onSelect(score)
    }, 300)
  }

  const displayMood = hoverMood !== null ? hoverMood : selectedMood

  return (
    <div
      className="mood-selector-screen"
      style={{
        background: displayMood !== null
          ? getMoodGradient(displayMood)
          : '#f7f9fa'
      }}
    >
      <div className="mood-content">
        <h2 className="mood-title">How are you feeling?</h2>
        <p className="mood-subtitle">Pick the number that feels right</p>

        {yesterdayMood !== null && (
          <div className="yesterday-badge">
            Yesterday you felt {getMoodEmoji(yesterdayMood)} {yesterdayMood}/10
          </div>
        )}

        {displayMood !== null && (
          <div className="selected-mood-display">
            <div className="mood-emoji-large">{getMoodEmoji(displayMood)}</div>
            <div className="mood-score-large">{displayMood}/10</div>
          </div>
        )}

        <div className="mood-grid">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
            <button
              key={score}
              onClick={() => handleSelect(score)}
              onMouseEnter={() => setHoverMood(score)}
              onMouseLeave={() => setHoverMood(null)}
              className={`mood-btn ${selectedMood === score ? 'selected' : ''}`}
              style={{
                background: getMoodGradient(score)
              }}
            >
              <span className="mood-number">{score}</span>
              <span className="mood-emoji-small">{getMoodEmoji(score)}</span>
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        .mood-selector-screen {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(20px, 5vw, 32px);
          transition: background 0.3s ease;
        }

        .mood-content {
          text-align: center;
          max-width: 600px;
          width: 100%;
        }

        .mood-title {
          font-size: clamp(22px, 6vw, 28px);
          font-weight: 700;
          color: #0f1419;
          margin: 0 0 clamp(8px, 2vw, 12px) 0;
        }

        .mood-subtitle {
          font-size: clamp(14px, 3.8vw, 16px);
          color: #536471;
          margin: 0 0 clamp(24px, 6vw, 32px) 0;
        }

        .yesterday-badge {
          display: inline-block;
          padding: clamp(6px, 2vw, 10px) clamp(12px, 3vw, 16px);
          background: rgba(255, 255, 255, 0.9);
          border-radius: 100px;
          font-size: clamp(12px, 3.2vw, 14px);
          font-weight: 600;
          color: #536471;
          margin-bottom: clamp(24px, 6vw, 32px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .selected-mood-display {
          margin-bottom: clamp(24px, 6vw, 32px);
          animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @keyframes scaleUp {
          from {
            transform: scale(0.8);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        .mood-emoji-large {
          font-size: clamp(64px, 16vw, 96px);
          line-height: 1;
          margin-bottom: clamp(12px, 3vw, 16px);
        }

        .mood-score-large {
          font-size: clamp(32px, 8vw, 48px);
          font-weight: 800;
          color: #0f1419;
        }

        .mood-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(clamp(60px, 15vw, 80px), 1fr));
          gap: clamp(8px, 2vw, 12px);
          max-width: 560px;
          margin: 0 auto;
        }

        .mood-btn {
          aspect-ratio: 1;
          border-radius: clamp(12px, 3vw, 16px);
          border: 2px solid transparent;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: clamp(4px, 1vw, 6px);
          transition: all 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .mood-btn:hover {
          border-width: 3px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
          border-color: #0f1419;
        }

        .mood-btn:active {
          transform: scale(0.95);
        }

        .mood-btn.selected {
          transform: scale(1.15);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
          border-color: #0f1419;
          border-width: 3px;
        }

        .mood-number {
          font-size: clamp(16px, 4.5vw, 20px);
          font-weight: 700;
          color: #0f1419;
        }

        .mood-emoji-small {
          font-size: clamp(18px, 5vw, 24px);
          line-height: 1;
        }
      `}</style>
    </div>
  )
}
