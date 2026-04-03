'use client'

import { useEffect, useState } from 'react'
import { ZoneCard } from '@/components/ZoneCard'
import type { ZoneWithMeta } from '@/lib/types'

export function ZoneBrowser() {
  const [zones, setZones] = useState<ZoneWithMeta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/zones')
      .then((r) => r.json())
      .then((d: { zones: ZoneWithMeta[] }) => setZones(d.zones ?? []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ padding: '12px 16px' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="skeleton" style={{ height: '14px', width: '120px', marginBottom: '6px' }} />
              <div className="skeleton" style={{ height: '11px', width: '60px' }} />
            </div>
            <div className="skeleton" style={{ height: '28px', width: '72px', borderRadius: '999px' }} />
          </div>
        ))}
      </div>
    )
  }

  if (zones.length === 0) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>
          No active zones yet. Be the first to post somewhere.
        </p>
      </div>
    )
  }

  return (
    <div>
      {zones.map((zone) => (
        <ZoneCard key={zone.zone_id} zone={zone} />
      ))}
    </div>
  )
}
