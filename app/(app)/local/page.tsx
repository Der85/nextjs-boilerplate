export default function LocalPage() {
  return (
    <div style={{
      maxWidth: 'var(--content-max-width)',
      margin: '0 auto',
      padding: '48px 16px',
      textAlign: 'center',
    }}>
      <p style={{ fontSize: '2rem', marginBottom: '16px' }}>📍</p>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.1rem', marginBottom: '8px' }}>
        Local Feed — coming soon
      </p>
      <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>
        Posts from your neighbourhood will appear here.
      </p>
    </div>
  )
}
