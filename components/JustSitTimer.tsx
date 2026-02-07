'use client'

import { useState, useEffect, useRef } from 'react'

interface JustSitTimerProps {
  duration?: number // in seconds, default 120 (2 minutes)
  onComplete?: () => void
  onClose?: () => void
}

export default function JustSitTimer({
  duration = 120,
  onComplete,
  onClose
}: JustSitTimerProps) {
  const [elapsed, setElapsed] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1
        if (next >= duration) {
          setIsComplete(true)
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
          }
        }
        return next
      })
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [duration])

  // Format time as M:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Calculate breathing phase (4s in, 4s hold, 4s out = 12s cycle)
  const breathingPhase = Math.floor((elapsed % 12) / 4)
  const phaseProgress = (elapsed % 4) / 4

  // Breathing circle scale
  const getBreathingScale = (): number => {
    if (breathingPhase === 0) {
      // Breathing in - scale 1 to 1.15
      return 1 + (0.15 * phaseProgress)
    } else if (breathingPhase === 1) {
      // Holding - stay at 1.15
      return 1.15
    } else {
      // Breathing out - scale 1.15 to 1
      return 1.15 - (0.15 * phaseProgress)
    }
  }

  const handleDone = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    onComplete?.()
  }

  const handleClose = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    onClose?.()
  }

  return (
    <div className="just-sit-container">
      {/* Ambient breathing circle */}
      <div className="breathing-circle-container">
        <div
          className="breathing-circle"
          style={{ transform: `scale(${getBreathingScale()})` }}
        />
        <div className="time-display">
          {formatTime(elapsed)}
        </div>
      </div>

      {/* Subtle guidance */}
      <p className="guidance-text">
        {isComplete
          ? 'You made it.'
          : 'Just be here. No instructions.'}
      </p>

      {/* Actions */}
      <div className="timer-actions">
        {isComplete ? (
          <button className="done-btn" onClick={handleDone}>
            Done
          </button>
        ) : (
          <>
            <button className="done-btn" onClick={handleDone}>
              I'm good
            </button>
            <button className="close-btn" onClick={handleClose}>
              Back
            </button>
          </>
        )}
      </div>

      <style jsx>{`
        .just-sit-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          padding: clamp(16px, 4vw, 24px);
        }

        .breathing-circle-container {
          position: relative;
          width: clamp(140px, 40vw, 180px);
          height: clamp(140px, 40vw, 180px);
          margin-bottom: clamp(24px, 6vw, 32px);
        }

        .breathing-circle {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: linear-gradient(
            135deg,
            rgba(139, 92, 246, 0.15) 0%,
            rgba(99, 102, 241, 0.1) 50%,
            rgba(139, 92, 246, 0.08) 100%
          );
          transition: transform 0.5s ease-in-out;
        }

        .breathing-circle::before {
          content: '';
          position: absolute;
          inset: 8px;
          border-radius: 50%;
          background: linear-gradient(
            135deg,
            rgba(139, 92, 246, 0.08) 0%,
            rgba(255, 255, 255, 0.9) 100%
          );
        }

        .time-display {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: clamp(28px, 8vw, 36px);
          font-weight: 300;
          color: #6b7280;
          font-variant-numeric: tabular-nums;
          letter-spacing: 2px;
        }

        .guidance-text {
          font-size: clamp(14px, 3.5vw, 16px);
          color: #9ca3af;
          margin: 0 0 clamp(20px, 5vw, 28px) 0;
          text-align: center;
          font-style: italic;
        }

        .timer-actions {
          display: flex;
          gap: clamp(10px, 2.5vw, 14px);
          flex-wrap: wrap;
          justify-content: center;
        }

        .done-btn {
          padding: clamp(12px, 3vw, 16px) clamp(28px, 7vw, 36px);
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
          color: white;
          border: none;
          border-radius: 100px;
          font-size: clamp(14px, 3.5vw, 16px);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .done-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(139, 92, 246, 0.35);
        }

        .close-btn {
          padding: clamp(12px, 3vw, 16px) clamp(20px, 5vw, 28px);
          background: transparent;
          color: #9ca3af;
          border: 1px solid #e5e7eb;
          border-radius: 100px;
          font-size: clamp(14px, 3.5vw, 16px);
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .close-btn:hover {
          background: #f9fafb;
          border-color: #d1d5db;
          color: #6b7280;
        }
      `}</style>
    </div>
  )
}
