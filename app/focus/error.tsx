'use client'

import { useEffect } from 'react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function FocusError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Focus error:', error)
  }, [error])

  return (
    <div className="error-page">
      <header className="error-header">
        <button onClick={() => window.location.href = '/dashboard'} className="header-logo">
          adhder.io
        </button>
      </header>

      <div className="error-content">
        <div className="error-card">
          <div className="error-icon">⏱️</div>
          <h1 className="error-title">Focus session interrupted</h1>
          <p className="error-message">
            Something went wrong, but don't worry — your progress is saved.
            <br />
            Ready to jump back in?
          </p>

          <div className="error-actions">
            <button onClick={reset} className="btn-hero-action">
              Resume Focus
            </button>
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="btn-text-link"
            >
              Back to Dashboard
            </button>
          </div>

          <div className="breathing-hint">
            <span className="breathing-icon">🫁</span>
            <span>Take a breath while we sort this out</span>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <details className="error-details">
              <summary>Technical details</summary>
              <pre>{error.message}</pre>
              {error.digest && <p>Error ID: {error.digest}</p>}
            </details>
          )}
        </div>
      </div>

      <style jsx>{`
        .error-page {
          min-height: 100vh;
          min-height: 100dvh;
          background: linear-gradient(180deg, #f7f9fa 0%, #fff 100%);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .error-header {
          position: sticky;
          top: 0;
          background: white;
          border-bottom: 1px solid #eff3f4;
          padding: clamp(12px, 3vw, 16px) clamp(16px, 4vw, 24px);
          display: flex;
          align-items: center;
          z-index: 100;
        }

        .header-logo {
          background: none;
          border: none;
          cursor: pointer;
          font-size: clamp(16px, 4.5vw, 20px);
          font-weight: 800;
          color: #1D9BF0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          letter-spacing: -0.5px;
        }

        .header-logo:hover {
          opacity: 0.8;
        }

        .error-content {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: calc(100vh - 60px);
          padding: clamp(20px, 5vw, 40px);
        }

        .error-card {
          max-width: 440px;
          width: 100%;
          background: white;
          border-radius: clamp(20px, 5vw, 28px);
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
          padding: clamp(32px, 8vw, 48px);
          text-align: center;
        }

        .error-icon {
          font-size: clamp(48px, 12vw, 64px);
          margin-bottom: clamp(16px, 4vw, 24px);
        }

        .error-title {
          font-size: clamp(22px, 5.5vw, 28px);
          font-weight: 700;
          color: #0f1419;
          margin: 0 0 clamp(12px, 3vw, 16px) 0;
        }

        .error-message {
          font-size: clamp(15px, 4vw, 17px);
          color: #536471;
          line-height: 1.6;
          margin: 0 0 clamp(24px, 6vw, 32px) 0;
        }

        .error-actions {
          display: flex;
          flex-direction: column;
          gap: clamp(12px, 3vw, 16px);
        }

        .breathing-hint {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: clamp(20px, 5vw, 28px);
          padding: clamp(12px, 3vw, 16px);
          background: rgba(139, 92, 246, 0.08);
          border-radius: 12px;
          font-size: clamp(13px, 3.5vw, 15px);
          color: #8b5cf6;
        }

        .breathing-icon {
          font-size: clamp(18px, 4.5vw, 22px);
          animation: breathe 4s ease-in-out infinite;
        }

        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        .error-details {
          margin-top: clamp(24px, 6vw, 32px);
          padding: clamp(12px, 3vw, 16px);
          background: #f7f9fa;
          border-radius: 12px;
          text-align: left;
          font-size: 13px;
          color: #536471;
        }

        .error-details summary {
          cursor: pointer;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .error-details pre {
          margin: 8px 0 0 0;
          padding: 12px;
          background: white;
          border-radius: 8px;
          overflow-x: auto;
          font-size: 12px;
          white-space: pre-wrap;
          word-break: break-word;
        }
      `}</style>
    </div>
  )
}
