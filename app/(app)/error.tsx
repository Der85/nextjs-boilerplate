'use client'

import { useEffect } from 'react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AppError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('App error caught:', error)
  }, [error])

  return (
    <div style={{
      minHeight: '60dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        maxWidth: '440px',
        width: '100%',
        background: 'var(--color-bg)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        padding: '48px 32px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>🛠️</div>
        <h1 style={{
          fontSize: 'var(--text-heading)',
          fontWeight: 'var(--font-heading)',
          color: 'var(--color-text-primary)',
          marginBottom: '12px',
        }}>
          Something went a bit sideways
        </h1>
        <p style={{
          fontSize: 'var(--text-body)',
          color: 'var(--color-text-secondary)',
          lineHeight: 1.6,
          marginBottom: '32px',
        }}>
          Not your fault. Your data is safe — something just hiccuped on our end.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={reset}
            style={{
              width: '100%',
              height: '48px',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-accent)',
              color: '#fff',
              fontSize: 'var(--text-body)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          <button
            onClick={() => window.history.back()}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--text-caption)',
              cursor: 'pointer',
              padding: '8px',
            }}
          >
            Go back
          </button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details style={{
            marginTop: '24px',
            padding: '16px',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-sm)',
            textAlign: 'left',
            fontSize: '13px',
            color: 'var(--color-text-secondary)',
          }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: '8px' }}>
              Technical details
            </summary>
            <pre style={{
              margin: '8px 0 0 0',
              padding: '12px',
              background: 'var(--color-bg)',
              borderRadius: 'var(--radius-sm)',
              overflowX: 'auto',
              fontSize: '12px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {error.message}
            </pre>
            {error.digest && <p>Error ID: {error.digest}</p>}
          </details>
        )}
      </div>
    </div>
  )
}
