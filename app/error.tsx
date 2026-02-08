'use client'

import { useEffect } from 'react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to console in development
    console.error('Global error caught:', error)
  }, [error])

  return (
    <div className="error-page">
      <div className="error-card">
        <div className="error-icon">🛠️</div>
        <h1 className="error-title">We hit a snag</h1>
        <p className="error-message">
          Something unexpected happened, but your data is safe.
          <br />
          Take a breath — this isn't your fault.
        </p>

        <div className="error-actions">
          <button onClick={reset} className="btn-hero-action">
            Try again
          </button>
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="btn-text-link"
          >
            Go to Dashboard
          </button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details className="error-details">
            <summary>Technical details</summary>
            <pre>{error.message}</pre>
            {error.digest && <p>Error ID: {error.digest}</p>}
          </details>
        )}
      </div>

      <style jsx>{`
        .error-page {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(20px, 5vw, 40px);
          background: linear-gradient(180deg, #f7f9fa 0%, #fff 100%);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
          font-size: clamp(24px, 6vw, 32px);
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
