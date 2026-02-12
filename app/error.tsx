'use client'

import { useEffect } from 'react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Global error caught:', error)
  }, [error])

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'var(--color-surface)',
      fontFamily: 'var(--font-inter, Inter), -apple-system, sans-serif',
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
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>
          &#x1F6E0;&#xFE0F;
        </div>
        <h1 style={{
          fontSize: 'var(--text-heading)',
          fontWeight: 'var(--font-heading)',
          color: 'var(--color-text-primary)',
          marginBottom: '12px',
        }}>
          We hit a snag
        </h1>
        <p style={{
          fontSize: 'var(--text-body)',
          color: 'var(--color-text-secondary)',
          lineHeight: 1.6,
          marginBottom: '32px',
        }}>
          Something unexpected happened, but your data is safe.
          <br />
          Take a breath — this isn&apos;t your fault.
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
            onClick={() => window.location.href = '/dump'}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--text-caption)',
              cursor: 'pointer',
              padding: '8px',
            }}
          >
            Go to Brain Dump
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
