'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DEFAULT_CATEGORIES } from '@/lib/utils/categories'
import type { UserPriority, PriorityDomain } from '@/lib/types'

export default function PrioritySummary() {
  const router = useRouter()
  const [priorities, setPriorities] = useState<UserPriority[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchPriorities() {
      try {
        const res = await fetch('/api/priorities')
        if (res.ok) {
          const data = await res.json()
          setPriorities(data.priorities || [])
        }
      } catch (err) {
        console.error('Failed to fetch priorities:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchPriorities()
  }, [])

  if (loading || priorities.length === 0) {
    return null
  }

  // Get top 3 priorities
  const topPriorities = priorities.slice(0, 3)

  // Get domain info (icon, color) from DEFAULT_CATEGORIES
  const getDomainInfo = (domain: PriorityDomain) => {
    const cat = DEFAULT_CATEGORIES.find(c => c.name === domain)
    return {
      icon: cat?.icon || '📋',
      color: cat?.color || '#6B7280',
    }
  }

  return (
    <button
      onClick={() => router.push('/priorities')}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
        marginBottom: '16px',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flex: 1,
      }}>
        <span style={{
          fontSize: 'var(--text-small)',
          color: 'var(--color-text-tertiary)',
          marginRight: '4px',
        }}>
          Priorities:
        </span>
        {topPriorities.map((p, index) => {
          const info = getDomainInfo(p.domain)
          return (
            <span
              key={p.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                background: `${info.color}15`,
                fontSize: 'var(--text-small)',
              }}
            >
              <span style={{
                width: '16px',
                height: '16px',
                borderRadius: 'var(--radius-full)',
                background: info.color,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 700,
              }}>
                {index + 1}
              </span>
              <span style={{ color: info.color }}>{info.icon}</span>
            </span>
          )
        })}
      </div>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-text-tertiary)"
        strokeWidth="2"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  )
}
