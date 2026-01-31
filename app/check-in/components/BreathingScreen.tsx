'use client'

import { useState, useEffect } from 'react'

interface BreathingScreenProps {
  onComplete: () => void
  onSkip: () => void
}

type BreathPhase = 'in' | 'hold' | 'out'

export default function BreathingScreen({ onComplete, onSkip }: BreathingScreenProps) {
  const [phase, setPhase] = useState<BreathPhase>('in')
  const [breathCount, setBreathCount] = useState(0)

  useEffect(() => {
    // Single 12-second breath cycle: 4s in, 4s hold, 4s out
    const timeline = [
      { phase: 'in', duration: 4000 },
      { phase: 'hold', duration: 4000 },
      { phase: 'out', duration: 4000 }
    ]

    let currentIndex = 0

    const runCycle = () => {
      if (currentIndex < timeline.length) {
        const current = timeline[currentIndex]
        setPhase(current.phase as BreathPhase)

        setTimeout(() => {
          currentIndex++
          if (currentIndex < timeline.length) {
            runCycle()
          } else {
            // Cycle complete
            onComplete()
          }
        }, current.duration)
      }
    }

    runCycle()
  }, [onComplete])

  const getPhaseText = () => {
    switch (phase) {
      case 'in':
        return 'Breathe in'
      case 'hold':
        return 'Hold'
      case 'out':
        return 'Breathe out'
    }
  }

  const getCircleScale = () => {
    switch (phase) {
      case 'in':
      case 'hold':
        return 1.2
      default:
        return 1
    }
  }

  const getGradient = () => {
    switch (phase) {
      case 'in':
        return 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)'
      case 'hold':
        return 'linear-gradient(135deg, #bae6fd 0%, #7dd3fc 100%)'
      case 'out':
        return 'linear-gradient(135deg, #7dd3fc 0%, #a7f3d0 100%)'
    }
  }

  return (
    <div className="breathing-screen">
      <div className="breathing-content">
        <h2 className="breathing-title">Quick Breathing Moment</h2>
        <p className="breathing-subtitle">One calming breath before we start</p>

        <div className="breath-container">
          <div
            className="breath-circle"
            style={{
              transform: `scale(${getCircleScale()})`,
              background: getGradient()
            }}
          />

          <div className="breath-text">{getPhaseText()}</div>
        </div>

        <button onClick={onSkip} className="skip-btn">
          Skip →
        </button>
      </div>

      <style jsx>{`
        .breathing-screen {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(20px, 5vw, 32px);
          background: #f7f9fa;
        }

        .breathing-content {
          text-align: center;
          max-width: 500px;
          width: 100%;
        }

        .breathing-title {
          font-size: clamp(22px, 6vw, 28px);
          font-weight: 700;
          color: #0f1419;
          margin: 0 0 clamp(8px, 2vw, 12px) 0;
        }

        .breathing-subtitle {
          font-size: clamp(14px, 3.8vw, 16px);
          color: #536471;
          margin: 0 0 clamp(32px, 8vw, 48px) 0;
        }

        .breath-container {
          position: relative;
          width: 100%;
          max-width: clamp(200px, 50vw, 280px);
          aspect-ratio: 1;
          margin: 0 auto clamp(32px, 8vw, 48px);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .breath-circle {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          transition: transform 4s cubic-bezier(0.4, 0, 0.2, 1), background 1s ease;
        }

        .breath-text {
          position: relative;
          z-index: 2;
          font-size: clamp(18px, 5vw, 24px);
          font-weight: 600;
          color: #0f1419;
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
