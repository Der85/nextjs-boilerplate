'use client'

import { useState } from 'react'

interface BrainDumpScreenProps {
  onSubmit: (text: string) => void
  onSkip: () => void
  onQuickStart?: () => void
}

export default function BrainDumpScreen({ onSubmit, onSkip, onQuickStart }: BrainDumpScreenProps) {
  const [text, setText] = useState('')
  const maxChars = 2000
  const charCount = text.length

  return (
    <div className="braindump-screen">
      <div className="braindump-content">
        <div className="braindump-icon">🧠</div>
        <h2 className="braindump-title">Brain Dump</h2>
        <p className="braindump-subtitle">
          What&apos;s weighing on your mind? Don&apos;t worry about formatting, just dump it here.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Need to finish the report and buy milk and maybe email mom and figure out that thing at work..."
          maxLength={maxChars}
          className="braindump-textarea"
          rows={8}
          autoFocus
        />

        <div className="char-counter">
          <span className={charCount > maxChars * 0.9 ? 'warning' : ''}>
            {charCount} / {maxChars}
          </span>
        </div>

        <div className="action-buttons">
          <button
            onClick={() => onSubmit(text)}
            disabled={text.trim().length < 3}
            className="submit-btn"
          >
            Let&apos;s sort this out →
          </button>
          <button onClick={onSkip} className="skip-btn">
            Skip →
          </button>
        </div>

        {/* Express Lane: Quick Start */}
        {onQuickStart && (
          <button onClick={onQuickStart} className="quick-start-link">
            ⚡ Skip planning, just start timer
          </button>
        )}
      </div>

      <style jsx>{`
        .braindump-screen {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(20px, 5vw, 32px);
          background: #f7f9fa;
        }

        .braindump-content {
          max-width: 600px;
          width: 100%;
          text-align: center;
        }

        .braindump-icon {
          font-size: clamp(48px, 14vw, 64px);
          margin-bottom: clamp(12px, 3vw, 18px);
        }

        .braindump-title {
          font-size: clamp(22px, 6vw, 28px);
          font-weight: 700;
          color: #0f1419;
          margin: 0 0 clamp(8px, 2vw, 12px) 0;
        }

        .braindump-subtitle {
          font-size: clamp(14px, 3.8vw, 16px);
          color: #536471;
          margin: 0 0 clamp(24px, 6vw, 32px) 0;
          line-height: 1.5;
        }

        .braindump-textarea {
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
          text-align: left;
        }

        .braindump-textarea:focus {
          outline: none;
          border-color: #1D9BF0;
        }

        .braindump-textarea::placeholder {
          color: #8899a6;
        }

        .char-counter {
          display: flex;
          justify-content: flex-end;
          margin-top: clamp(8px, 2vw, 12px);
          font-size: clamp(12px, 3.2vw, 14px);
          color: #8899a6;
        }

        .char-counter .warning {
          color: #f97316;
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

        .submit-btn:hover:not(:disabled) {
          background: #1a8cd8;
        }

        .submit-btn:active:not(:disabled) {
          transform: scale(0.98);
        }

        .submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Stepped Clarity: Skip and Quick Start as text-only links */
        .skip-btn {
          background: none;
          border: none;
          color: #b0b8c1;
          font-size: clamp(13px, 3.5vw, 14px);
          font-weight: 400;
          cursor: pointer;
          padding: clamp(6px, 1.5vw, 8px);
          transition: color 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .skip-btn:hover {
          color: #8899a6;
        }

        .quick-start-link {
          display: inline-block;
          margin-top: clamp(20px, 5vw, 28px);
          padding: clamp(6px, 1.5vw, 8px);
          background: none;
          border: none;
          color: #b0b8c1;
          font-size: clamp(13px, 3.5vw, 14px);
          font-weight: 400;
          cursor: pointer;
          transition: color 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .quick-start-link:hover {
          color: #8899a6;
        }
      `}</style>
    </div>
  )
}
