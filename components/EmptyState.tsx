interface EmptyStateProps {
  icon?: string
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
}

export default function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 24px',
      textAlign: 'center',
    }}>
      {icon && (
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>
          {icon}
        </div>
      )}
      <h2 style={{
        fontSize: 'var(--text-body)',
        fontWeight: 'var(--font-heading)',
        color: 'var(--color-text-primary)',
        marginBottom: '8px',
      }}>
        {title}
      </h2>
      <p style={{
        fontSize: 'var(--text-caption)',
        color: 'var(--color-text-secondary)',
        maxWidth: '280px',
        lineHeight: 1.5,
      }}>
        {message}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          style={{
            marginTop: '20px',
            height: '40px',
            padding: '0 24px',
            borderRadius: 'var(--radius-full)',
            border: 'none',
            background: 'var(--color-accent)',
            color: '#fff',
            fontSize: 'var(--text-caption)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
