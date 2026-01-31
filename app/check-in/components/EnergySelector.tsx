'use client'

import { useState } from 'react'
import { getEnergyColor, getEnergyLabel, getEnergyEmoji } from '@/lib/gamification'

interface EnergySelectorProps {
  onSelect: (level: number) => void
}

export default function EnergySelector({ onSelect }: EnergySelectorProps) {
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null)
  const [hoverLevel, setHoverLevel] = useState<number | null>(null)

  const handleSelect = (level: number) => {
    setSelectedLevel(level)

    // Vibrate on mobile
    if ('vibrate' in navigator) {
      navigator.vibrate(10)
    }

    // Auto-advance after selection
    setTimeout(() => {
      onSelect(level)
    }, 300)
  }

  const displayLevel = hoverLevel !== null ? hoverLevel : selectedLevel

  return (
    <div className="energy-selector-screen">
      <div className="energy-content">
        <h2 className="energy-title">How's your energy?</h2>
        <p className="energy-subtitle">Your battery level right now</p>

        <div className="battery-container">
          {/* Battery visualization */}
          <div className="battery-shell">
            <div className="battery-terminal" />
            <div
              className="battery-fill"
              style={{
                height: displayLevel !== null ? `${((displayLevel + 1) / 5) * 100}%` : '0%',
                backgroundColor: displayLevel !== null ? getEnergyColor(displayLevel) : '#e5e7eb',
                transition: 'height 0.3s ease, background-color 0.3s ease'
              }}
            />
          </div>

          {/* Energy level display */}
          {displayLevel !== null && (
            <div className="energy-display">
              <div className="energy-emoji">{getEnergyEmoji(displayLevel)}</div>
              <div className="energy-label-text">{getEnergyLabel(displayLevel)}</div>
            </div>
          )}
        </div>

        {/* Level selector buttons */}
        <div className="level-buttons">
          {[0, 1, 2, 3, 4].map((level) => (
            <button
              key={level}
              onClick={() => handleSelect(level)}
              onMouseEnter={() => setHoverLevel(level)}
              onMouseLeave={() => setHoverLevel(null)}
              className={`level-btn ${selectedLevel === level ? 'selected' : ''}`}
              style={{
                borderColor: getEnergyColor(level),
                backgroundColor: selectedLevel === level ? getEnergyColor(level) : 'transparent'
              }}
            >
              <span className="level-emoji">{getEnergyEmoji(level)}</span>
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        .energy-selector-screen {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(20px, 5vw, 32px);
          background: #f7f9fa;
        }

        .energy-content {
          text-align: center;
          max-width: 500px;
          width: 100%;
        }

        .energy-title {
          font-size: clamp(22px, 6vw, 28px);
          font-weight: 700;
          color: #0f1419;
          margin: 0 0 clamp(8px, 2vw, 12px) 0;
        }

        .energy-subtitle {
          font-size: clamp(14px, 3.8vw, 16px);
          color: #536471;
          margin: 0 0 clamp(32px, 8vw, 48px) 0;
        }

        .battery-container {
          position: relative;
          margin: 0 auto clamp(32px, 8vw, 48px);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: clamp(20px, 5vw, 28px);
        }

        .battery-shell {
          position: relative;
          width: clamp(80px, 20vw, 120px);
          height: clamp(160px, 40vw, 240px);
          border: 4px solid #0f1419;
          border-radius: clamp(8px, 2vw, 12px);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }

        .battery-terminal {
          position: absolute;
          top: -clamp(8px, 2vw, 12px);
          left: 50%;
          transform: translateX(-50%);
          width: 40%;
          height: clamp(8px, 2vw, 12px);
          background: #0f1419;
          border-radius: clamp(4px, 1vw, 6px) clamp(4px, 1vw, 6px) 0 0;
        }

        .battery-fill {
          width: 100%;
          transition: height 0.3s ease, background-color 0.3s ease;
        }

        .energy-display {
          text-align: center;
        }

        .energy-emoji {
          font-size: clamp(32px, 8vw, 48px);
          margin-bottom: clamp(8px, 2vw, 12px);
        }

        .energy-label-text {
          font-size: clamp(18px, 5vw, 24px);
          font-weight: 600;
          color: #0f1419;
        }

        .level-buttons {
          display: flex;
          justify-content: center;
          gap: clamp(8px, 2vw, 12px);
          flex-wrap: wrap;
        }

        .level-btn {
          width: clamp(48px, 12vw, 64px);
          height: clamp(48px, 12vw, 64px);
          border-radius: 50%;
          border: 3px solid;
          background: transparent;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          will-change: transform;
          position: relative;
        }

        .level-btn:hover {
          border-width: 4px;
          box-shadow: 0 0 0 2px currentColor;
        }

        .level-btn:active {
          transform: scale(0.95);
        }

        .level-btn.selected {
          border-width: 5px;
          box-shadow: 0 4px 16px currentColor;
        }

        .level-emoji {
          font-size: clamp(20px, 5.5vw, 28px);
          filter: ${selectedLevel !== null ? 'none' : 'grayscale(1)'};
        }

        .level-btn.selected .level-emoji {
          filter: brightness(1.2);
        }
      `}</style>
    </div>
  )
}
