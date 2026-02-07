'use client'

import { useState, useRef, useEffect } from 'react'
import { useGamificationPrefsSafe } from '@/context/GamificationPrefsContext'
import { getMoodEmoji } from '@/lib/utils/ui-helpers'

interface VitalsCheckProps {
  onSubmit: (moodScore: number, energyLevel: number, note: string) => void
  greeting: string
  currentStreak: number
}

type EnergyLevel = 'low' | 'medium' | 'high'

// Maps 3-button toggle to 1-10 scale (3, 5, 8 represents low/mid/high points)
const energyToNumber = (energy: EnergyLevel): number => {
  switch (energy) {
    case 'low': return 3
    case 'medium': return 5
    case 'high': return 8
  }
}

export default function VitalsCheck({
  onSubmit,
  greeting,
  currentStreak,
}: VitalsCheckProps) {
  const { prefs } = useGamificationPrefsSafe()
  const [moodScore, setMoodScore] = useState(5)
  const [energy, setEnergy] = useState<EnergyLevel>('medium')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus note input on mount (mobile keyboard opens immediately)
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      noteRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  const handleSubmit = () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    onSubmit(moodScore, energyToNumber(energy), note)
  }

  return (
    <div className="vitals-screen">
      <div className="vitals-content">
        {/* Header */}
        <div className="vitals-header">
          <h1 className="vitals-greeting">{greeting} 👋</h1>
          {prefs.showStreaks && currentStreak >= 2 && (
            <p className="vitals-streak">🔥 {currentStreak}-day streak!</p>
          )}
        </div>

        {/* Mood Slider */}
        <div className="vitals-section">
          <div className="section-header">
            <span className="section-label">How are you feeling?</span>
            <span className="section-emoji">{getMoodEmoji(moodScore)}</span>
          </div>
          <div className="slider-container">
            <input
              type="range"
              min="1"
              max="10"
              value={moodScore}
              onChange={(e) => setMoodScore(Number(e.target.value))}
              className="mood-slider"
            />
            <div className="slider-labels">
              <span>Low</span>
              <span className="slider-value">{moodScore}/10</span>
              <span>Great</span>
            </div>
          </div>
        </div>

        {/* Energy Segmented Control */}
        <div className="vitals-section">
          <div className="section-header">
            <span className="section-label">Energy level?</span>
            <span className="energy-value">{energyToNumber(energy)}/10</span>
          </div>
          <div className="energy-control">
            <button
              className={`energy-btn ${energy === 'low' ? 'active low' : ''}`}
              onClick={() => setEnergy('low')}
              type="button"
            >
              <span className="energy-icon">🔋</span>
              <span className="energy-label">Low</span>
            </button>
            <button
              className={`energy-btn ${energy === 'medium' ? 'active medium' : ''}`}
              onClick={() => setEnergy('medium')}
              type="button"
            >
              <span className="energy-icon">⚡</span>
              <span className="energy-label">Medium</span>
            </button>
            <button
              className={`energy-btn ${energy === 'high' ? 'active high' : ''}`}
              onClick={() => setEnergy('high')}
              type="button"
            >
              <span className="energy-icon">🚀</span>
              <span className="energy-label">High</span>
            </button>
          </div>
        </div>

        {/* Optional Note */}
        <div className="vitals-section note-section">
          <span className="section-label">Quick note? <span className="optional">(optional)</span></span>
          <textarea
            ref={noteRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What's on your mind..."
            className="note-input"
            rows={2}
            maxLength={200}
          />
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="submit-btn"
        >
          {isSubmitting ? 'Saving...' : 'Log Check-in →'}
        </button>
      </div>

      <style jsx>{`
        .vitals-screen {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: clamp(20px, 5vw, 32px);
          padding-top: clamp(40px, 10vw, 60px);
          background: linear-gradient(180deg, #f0f9ff 0%, #f7f9fa 100%);
        }

        .vitals-content {
          max-width: 480px;
          width: 100%;
          padding-bottom: 100px; /* Space for fixed button on mobile */
        }

        @media (min-width: 768px) {
          .vitals-content {
            padding-bottom: 0;
          }
        }

        .vitals-header {
          text-align: center;
          margin-bottom: clamp(28px, 7vw, 40px);
        }

        .vitals-greeting {
          font-size: clamp(26px, 7vw, 34px);
          font-weight: 700;
          color: #0f1419;
          margin: 0 0 clamp(6px, 1.5vw, 10px) 0;
        }

        .vitals-streak {
          font-size: clamp(14px, 3.8vw, 16px);
          color: #f97316;
          font-weight: 600;
          margin: 0;
        }

        .vitals-section {
          background: white;
          border-radius: clamp(14px, 4vw, 20px);
          padding: clamp(18px, 5vw, 24px);
          margin-bottom: clamp(14px, 3.5vw, 18px);
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: clamp(14px, 3.5vw, 18px);
        }

        .section-label {
          display: block;
          font-size: clamp(15px, 4vw, 17px);
          font-weight: 600;
          color: #0f1419;
          margin-bottom: clamp(12px, 3vw, 16px);
        }

        .section-header .section-label {
          margin-bottom: 0;
        }

        .section-emoji {
          font-size: clamp(28px, 7vw, 36px);
        }

        .energy-value {
          font-size: clamp(16px, 4.5vw, 20px);
          font-weight: 700;
          color: #1D9BF0;
        }

        .optional {
          font-weight: 400;
          color: #8899a6;
          font-size: clamp(13px, 3.5vw, 15px);
        }

        /* Mood Slider */
        .slider-container {
          padding: 0 clamp(4px, 1vw, 8px);
        }

        .mood-slider {
          width: 100%;
          height: 8px;
          -webkit-appearance: none;
          appearance: none;
          background: linear-gradient(to right, #f4212e, #ffad1f, #00ba7c);
          border-radius: 100px;
          outline: none;
          margin-bottom: clamp(10px, 2.5vw, 14px);
        }

        .mood-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: clamp(28px, 7vw, 36px);
          height: clamp(28px, 7vw, 36px);
          border-radius: 50%;
          background: white;
          border: 3px solid #1D9BF0;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          transition: transform 0.1s ease;
        }

        .mood-slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }

        .mood-slider::-moz-range-thumb {
          width: clamp(28px, 7vw, 36px);
          height: clamp(28px, 7vw, 36px);
          border-radius: 50%;
          background: white;
          border: 3px solid #1D9BF0;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        .slider-labels {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: clamp(12px, 3.2vw, 14px);
          color: #8899a6;
        }

        .slider-value {
          font-size: clamp(20px, 5.5vw, 26px);
          font-weight: 700;
          color: #1D9BF0;
        }

        /* Energy Segmented Control */
        .energy-control {
          display: flex;
          gap: clamp(8px, 2vw, 12px);
        }

        .energy-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: clamp(6px, 1.5vw, 8px);
          padding: clamp(14px, 3.5vw, 18px) clamp(8px, 2vw, 12px);
          background: #f7f9fa;
          border: 2px solid #e5e7eb;
          border-radius: clamp(12px, 3vw, 16px);
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .energy-btn:hover {
          border-color: #d1d5db;
          background: white;
        }

        .energy-btn.active {
          background: white;
          transform: scale(1.02);
        }

        .energy-btn.active.low {
          border-color: #f97316;
          box-shadow: 0 2px 12px rgba(249, 115, 22, 0.2);
        }

        .energy-btn.active.medium {
          border-color: #1D9BF0;
          box-shadow: 0 2px 12px rgba(29, 155, 240, 0.2);
        }

        .energy-btn.active.high {
          border-color: #00ba7c;
          box-shadow: 0 2px 12px rgba(0, 186, 124, 0.2);
        }

        .energy-icon {
          font-size: clamp(22px, 5.5vw, 28px);
          line-height: 1;
        }

        .energy-label {
          font-size: clamp(12px, 3.2vw, 14px);
          font-weight: 600;
          color: #536471;
        }

        .energy-btn.active .energy-label {
          color: #0f1419;
        }

        /* Note Input */
        .note-section .section-label {
          margin-bottom: clamp(10px, 2.5vw, 14px);
        }

        .note-input {
          width: 100%;
          padding: clamp(12px, 3vw, 16px);
          font-size: clamp(14px, 3.8vw, 16px);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          border: 1px solid #e5e7eb;
          border-radius: clamp(10px, 2.5vw, 14px);
          background: #f7f9fa;
          resize: none;
          transition: border-color 0.2s ease, background 0.2s ease;
        }

        .note-input:focus {
          outline: none;
          border-color: #1D9BF0;
          background: white;
        }

        .note-input::placeholder {
          color: #8899a6;
        }

        /* Submit Button - Unified Hero Action Button */
        .submit-btn {
          width: 100%;
          padding: 16px 24px;
          margin-top: clamp(8px, 2vw, 12px);
          background: #1D9BF0;
          color: white;
          border: none;
          border-radius: 14px;
          font-size: 1.1rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-shadow: 0 4px 12px rgba(29, 155, 240, 0.3);
          min-height: 56px;
        }

        /* Mobile: Fixed bottom button for thumb zone ergonomics */
        @media (max-width: 767px) {
          .submit-btn {
            position: fixed;
            bottom: 20px;
            left: 16px;
            right: 16px;
            width: auto;
            margin-top: 0;
            z-index: 50;
          }
        }

        .submit-btn:hover:not(:disabled) {
          background: #1a8cd8;
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(29, 155, 240, 0.4);
        }

        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 4px 12px rgba(29, 155, 240, 0.3);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}
