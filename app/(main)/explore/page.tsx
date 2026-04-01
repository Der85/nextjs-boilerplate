'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api-client'
import type { Zone } from '@/lib/types'

export default function ExplorePage() {
  const [zones, setZones] = useState<Zone[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const loadZones = useCallback(async () => {
    setIsLoading(true)
    const params = new URLSearchParams({ limit: '30' })
    if (search) params.set('search', search)

    const res = await apiFetch(`/api/zones?${params}`)
    if (res.ok) {
      const data = await res.json()
      setZones(data.zones)
    }
    setIsLoading(false)
  }, [search])

  useEffect(() => {
    const timer = setTimeout(loadZones, search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [loadZones, search])

  return (
    <div>
      {/* Search */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search locations..."
          style={{
            width: '100%',
            padding: '10px 14px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-caption)',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Zone list */}
      {isLoading ? (
        <div style={{ padding: '24px 16px' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton" style={{ height: '48px', marginBottom: '8px' }} />
          ))}
        </div>
      ) : zones.length === 0 ? (
        <div style={{
          padding: '48px 16px',
          textAlign: 'center',
          color: 'var(--color-text-tertiary)',
          fontSize: 'var(--text-caption)',
        }}>
          {search ? 'No locations found.' : 'No active locations yet.'}
        </div>
      ) : (
        <div>
          {zones.map(zone => (
            <Link
              key={zone.id}
              href={`/zone/${encodeURIComponent(zone.id)}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: '1px solid var(--color-border)',
                textDecoration: 'none',
                color: 'var(--color-text-primary)',
              }}
            >
              <div>
                <div style={{ fontWeight: 500 }}>
                  {zone.label.length > 20 ? `${zone.label.slice(0, 16)}...` : zone.label}
                </div>
                <div style={{
                  fontSize: 'var(--text-small)',
                  color: 'var(--color-text-tertiary)',
                  marginTop: '2px',
                }}>
                  {zone.post_count} post{zone.post_count !== 1 ? 's' : ''}
                  {' · '}
                  {zone.follower_count} follower{zone.follower_count !== 1 ? 's' : ''}
                </div>
              </div>
              <span style={{ color: 'var(--color-text-tertiary)' }}>&rsaquo;</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
