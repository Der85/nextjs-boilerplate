'use client'

import { useLocation } from '@/lib/contexts/LocationContext'

// Full-screen overlay when GPS permission is denied.
// The app is unusable without location — this is intentional per spec.
export function LocationGate() {
  const { permissionDenied } = useLocation()

  if (!permissionDenied) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: '#fff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '48px', marginBottom: '24px' }}>📍</div>

      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '12px', color: 'var(--color-text-primary)' }}>
        Location Required
      </h1>

      <p style={{ color: 'var(--color-text-secondary)', maxWidth: '360px', lineHeight: 1.6, marginBottom: '20px' }}>
        ADHDer.io is a location-based social app. Your posts are anchored to your
        neighbourhood and you can only interact with posts from where you physically are.
      </p>

      <p style={{ color: 'var(--color-text-secondary)', maxWidth: '360px', lineHeight: 1.6, fontSize: '0.875rem' }}>
        To enable: open your browser settings, find ADHDer.io under{' '}
        <strong>Site permissions → Location</strong>, set it to &quot;Allow&quot;,
        then refresh this page.
      </p>
    </div>
  )
}
