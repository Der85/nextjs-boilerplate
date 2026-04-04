'use client'

export default function FeedError({ reset }: { reset: () => void }) {
  return (
    <div style={{ padding: '48px 16px', textAlign: 'center' }}>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
        Couldn&apos;t load the feed. Check your connection.
      </p>
      <button
        onClick={reset}
        style={{
          padding: '10px 24px',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-accent)',
          color: '#fff',
          fontSize: '0.875rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  )
}
