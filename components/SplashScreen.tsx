'use client'

import { useState, useEffect } from 'react'

interface SplashScreenProps {
  showSecondaryMessage?: boolean
  message?: string
}

export default function SplashScreen({
  showSecondaryMessage = false,
  message
}: SplashScreenProps) {
  const [showDelayedMessage, setShowDelayedMessage] = useState(false)

  // Show "Almost ready..." after 2 seconds if still loading
  useEffect(() => {
    if (showSecondaryMessage) {
      setShowDelayedMessage(true)
      return
    }

    const timer = setTimeout(() => {
      setShowDelayedMessage(true)
    }, 2000)

    return () => clearTimeout(timer)
  }, [showSecondaryMessage])

  return (
    <div className="splash-screen">
      {/* Logo with gentle pulse animation */}
      <div className="logo-container">
        <div className="logo-icon">
          <span className="brain-emoji">🧠</span>
        </div>
        <h1 className="logo-text">ADHDer.io</h1>
      </div>

      {/* Breathing dots animation - subtle, calming */}
      <div className="breathing-dots">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>

      {/* Secondary message (appears after delay or when forced) */}
      {showDelayedMessage && (
        <p className="secondary-message">
          {message || 'Almost ready...'}
        </p>
      )}

      <style jsx>{`
        .splash-screen {
          position: fixed;
          inset: 0;
          background: linear-gradient(135deg, #f7f9fa 0%, #e8f4fd 50%, #f0f9ff 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .logo-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: clamp(12px, 3vw, 16px);
          animation: fadeIn 0.5s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .logo-icon {
          width: clamp(72px, 20vw, 96px);
          height: clamp(72px, 20vw, 96px);
          background: linear-gradient(135deg, #1D9BF0 0%, #1a8cd8 100%);
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 32px rgba(29, 155, 240, 0.25);
          animation: gentle-pulse 2s ease-in-out infinite;
        }

        @keyframes gentle-pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.03);
          }
        }

        .brain-emoji {
          font-size: clamp(36px, 10vw, 48px);
          filter: brightness(0) invert(1);
        }

        .logo-text {
          font-size: clamp(24px, 6vw, 32px);
          font-weight: 800;
          color: #1D9BF0;
          margin: 0;
          letter-spacing: -0.5px;
        }

        /* Breathing dots - subtle rhythm indicator */
        .breathing-dots {
          display: flex;
          gap: clamp(8px, 2vw, 12px);
          margin-top: clamp(32px, 8vw, 48px);
        }

        .dot {
          width: clamp(8px, 2vw, 10px);
          height: clamp(8px, 2vw, 10px);
          background: rgba(29, 155, 240, 0.3);
          border-radius: 50%;
          animation: breathing 3s ease-in-out infinite;
        }

        .dot:nth-child(2) {
          animation-delay: 0.3s;
        }

        .dot:nth-child(3) {
          animation-delay: 0.6s;
        }

        @keyframes breathing {
          0%, 100% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.4);
            opacity: 0.8;
          }
        }

        /* Secondary message - fades in gently */
        .secondary-message {
          position: absolute;
          bottom: clamp(60px, 15vw, 80px);
          font-size: clamp(14px, 3.5vw, 16px);
          color: #8899a6;
          margin: 0;
          animation: fadeInSlow 0.5s ease-out;
        }

        @keyframes fadeInSlow {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        /* Subtle background gradient animation */
        @keyframes gradient-shift {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
      `}</style>
    </div>
  )
}
