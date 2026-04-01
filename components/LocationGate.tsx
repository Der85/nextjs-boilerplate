'use client'

import { useLocation } from '@/lib/contexts/LocationContext'

/**
 * Full-screen gate shown when location permission is denied.
 * Explains why location is needed and offers a way to enable it.
 */
export default function LocationGate({ children }: { children: React.ReactNode }) {
  const { permission, isLoading, requestPermission } = useLocation()

  // While loading, show nothing (or a loading state)
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        color: 'var(--color-text-tertiary)',
        fontSize: 'var(--text-caption)',
      }}>
        Getting your location...
      </div>
    )
  }

  // If permission is denied, show the gate
  if (permission === 'denied' || permission === 'unsupported') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '24px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#x1F4CD;</div>
        <h2 style={{
          fontSize: 'var(--text-heading)',
          fontWeight: 'var(--font-heading)',
          marginBottom: '8px',
        }}>
          Location Required
        </h2>
        <p style={{
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--text-caption)',
          maxWidth: '360px',
          marginBottom: '24px',
          lineHeight: 1.6,
        }}>
          ADHDer.io uses your location to connect you with posts from where you are.
          Your location determines what you can interact with — that&apos;s what makes this different.
        </p>
        {permission === 'denied' ? (
          <p style={{
            color: 'var(--color-text-tertiary)',
            fontSize: 'var(--text-small)',
          }}>
            Please enable location in your browser settings and refresh.
          </p>
        ) : (
          <button
            onClick={requestPermission}
            style={{
              padding: '12px 32px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              background: 'var(--color-accent)',
              color: '#fff',
              fontSize: 'var(--text-body)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Enable Location
          </button>
        )}
      </div>
    )
  }

  return <>{children}</>
}
