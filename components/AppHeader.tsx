'use client'

import Link from 'next/link'
import { useLocation } from '@/lib/contexts/LocationContext'
import ZoneBadge from './ZoneBadge'

export default function AppHeader() {
  const { currentZone, isLoading, permission } = useLocation()

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'var(--color-bg)',
      borderBottom: '1px solid var(--color-border)',
      height: 'var(--header-height)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      maxWidth: 'var(--content-max-width)',
      margin: '0 auto',
      width: '100%',
    }}>
      <Link href="/local" style={{
        fontSize: '1.25rem',
        fontWeight: 700,
        color: 'var(--color-text-primary)',
        textDecoration: 'none',
        letterSpacing: '-0.02em',
      }}>
        ADHDer.io
      </Link>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        {isLoading ? (
          <span style={{
            fontSize: 'var(--text-small)',
            color: 'var(--color-text-tertiary)',
          }}>
            Locating...
          </span>
        ) : currentZone ? (
          <ZoneBadge label={currentZone.label} />
        ) : permission === 'denied' ? (
          <span style={{
            fontSize: 'var(--text-small)',
            color: 'var(--color-danger)',
          }}>
            No location
          </span>
        ) : null}
      </div>
    </header>
  )
}
