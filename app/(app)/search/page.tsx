'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from '@/lib/contexts/LocationContext'
import { PostCard } from '@/components/PostCard'
import type { PostWithAuthor } from '@/lib/types'

export default function SearchPage() {
  const { currentZoneId, zoneLabel } = useLocation()
  const [query, setQuery] = useState('')
  const [zoneOnly, setZoneOnly] = useState(true)
  const [results, setResults] = useState<PostWithAuthor[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (q: string, zoneId: string | null) => {
    if (!q || q.trim().length < 2) {
      setResults([])
      setSearched(false)
      return
    }
    setIsLoading(true)
    setSearched(true)
    try {
      const params = new URLSearchParams({ q: q.trim() })
      if (zoneOnly && zoneId) params.set('zoneId', zoneId)
      const res = await fetch(`/api/search?${params}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.posts ?? [])
      } else {
        setResults([])
      }
    } catch {
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [zoneOnly])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      doSearch(query, currentZoneId)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, zoneOnly, currentZoneId, doSearch])

  return (
    <div style={{ maxWidth: 'var(--content-max-width)', margin: '0 auto' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--color-border)' }}>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 12px 0' }}>
          Search
        </h1>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search posts…"
          autoFocus
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            fontSize: '1rem',
            color: 'var(--color-text-primary)',
            background: 'var(--color-surface)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.875rem' }}>
          {currentZoneId && zoneLabel && (
            <>
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {zoneOnly ? `Searching in ${zoneLabel}` : 'Searching everywhere'}
              </span>
              <button
                onClick={() => setZoneOnly((v) => !v)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-accent)',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: '0.875rem',
                  textDecoration: 'underline',
                }}
              >
                {zoneOnly ? 'Search everywhere' : `Limit to ${zoneLabel}`}
              </button>
            </>
          )}
        </div>
      </div>

      {isLoading && (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
          Searching…
        </div>
      )}

      {!isLoading && searched && results.length === 0 && (
        <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔍</div>
          <p>No results found for &ldquo;{query}&rdquo;.</p>
        </div>
      )}

      {!isLoading && results.length > 0 && (
        <div>
          {results.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {!searched && !isLoading && (
        <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
          Type at least 2 characters to search.
        </div>
      )}
    </div>
  )
}
