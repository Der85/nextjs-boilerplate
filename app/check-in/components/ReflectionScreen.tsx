'use client'

import { useState, useEffect } from 'react'
import { getNotePlaceholder } from '@/lib/gamification'

interface ReflectionScreenProps {
  onSubmit: (note: string) => void
  onSkip: () => void
  energyLevel: number | null
  moodScore: number | null
}

export default function ReflectionScreen({
  onSubmit,
  onSkip,
  energyLevel,
  moodScore
}: ReflectionScreenProps) {
  const [note, setNote] = useState('')
  const [timeSpent, setTimeSpent] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeSpent(prev => prev + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const placeholder = getNotePlaceholder(energyLevel, moodScore)
  const charCount = note.length
  const maxChars = 500

  const handleSubmit = () => {
    onSubmit(note)
  }

  return (
    <div className="reflection-screen">
      <div className="reflection-content">
        <h2 className="reflection-title">Quick reflection</h2>
        <p className="reflection-subtitle">Optional, but helps me give better advice</p>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={placeholder}
          maxLength={maxChars}
          className="note-textarea"
          rows={6}
          autoFocus
        />

        <div className="char-counter">
          <span className={charCount > maxChars * 0.9 ? 'warning' : ''}>
            {charCount} / {maxChars}
          </span>
          {charCount > 10 && charCount < 50 && (
            <span className="encouragement">Keep going! 💪</span>
          )}
          {charCount >= 50 && (
            <span className="encouragement">Great detail! ⭐</span>
          )}
        </div>

        <div className="action-buttons">
          <button onClick={handleSubmit} className="submit-btn">
            {note.length > 0 ? 'Continue with Note' : 'Continue without Note'} →
          </button>
          <button onClick={onSkip} className="skip-btn">
            Skip →
          </button>
        </div>
      </div>

      <style jsx>{`
        .reflection-screen {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(20px, 5vw, 32px);
          background: #f7f9fa;
        }

        .reflection-content {
          max-width: 600px;
          width: 100%;
        }

        .reflection-title {
          font-size: clamp(22px, 6vw, 28px);
          font-weight: 700;
          color: #0f1419;
          margin: 0 0 clamp(8px, 2vw, 12px) 0;
          text-align: center;
        }

        .reflection-subtitle {
          font-size: clamp(14px, 3.8vw, 16px);
          color: #536471;
          margin: 0 0 clamp(24px, 6vw, 32px) 0;
          text-align: center;
        }

        .note-textarea {
          width: 100%;
          padding: clamp(16px, 4vw, 20px);
          border: 2px solid #e5e7eb;
          border-radius: clamp(12px, 3vw, 16px);
          font-size: clamp(14px, 3.8vw, 16px);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          resize: none;
          transition: border-color 0.2s ease;
          background: white;
          line-height: 1.6;
        }

        .note-textarea:focus {
          outline: none;
          border-color: #1D9BF0;
        }

        .note-textarea::placeholder {
          color: #8899a6;
        }

        .char-counter {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: clamp(8px, 2vw, 12px);
          font-size: clamp(12px, 3.2vw, 14px);
          color: #8899a6;
        }

        .char-counter .warning {
          color: #f97316;
        }

        .encouragement {
          color: #00ba7c;
          font-weight: 600;
          animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .action-buttons {
          display: flex;
          flex-direction: column;
          gap: clamp(12px, 3vw, 16px);
          margin-top: clamp(24px, 6vw, 32px);
        }

        .submit-btn {
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

        .submit-btn:hover {
          background: #1a8cd8;
        }

        .submit-btn:active {
          transform: scale(0.98);
        }

        .skip-btn {
          background: none;
          border: none;
          color: #8899a6;
          font-size: clamp(14px, 3.8vw, 16px);
          font-weight: 500;
          cursor: pointer;
          padding: clamp(8px, 2vw, 12px);
          transition: color 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .skip-btn:hover {
          color: #536471;
        }
      `}</style>
    </div>
  )
}
