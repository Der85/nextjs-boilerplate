interface ZoneBadgeProps {
  label: string
  size?: 'sm' | 'md'
}

export default function ZoneBadge({ label, size = 'sm' }: ZoneBadgeProps) {
  // Truncate long H3 indices to show just the first 8 chars
  const displayLabel = label.length > 20 ? `${label.slice(0, 8)}...` : label

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      fontSize: size === 'sm' ? 'var(--text-small)' : 'var(--text-caption)',
      color: 'var(--color-accent)',
      background: 'var(--color-accent-light)',
      padding: size === 'sm' ? '2px 8px' : '4px 10px',
      borderRadius: 'var(--radius-full)',
      fontWeight: 500,
      maxWidth: '200px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }}>
      {displayLabel}
    </span>
  )
}
