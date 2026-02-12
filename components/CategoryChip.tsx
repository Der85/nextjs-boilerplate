'use client'

import { getColorWithOpacity } from '@/lib/utils/colors'

interface CategoryChipProps {
  name: string
  color: string
  icon?: string
  onClick?: () => void
  selected?: boolean
  size?: 'small' | 'default'
}

export default function CategoryChip({ name, color, icon, onClick, selected, size = 'default' }: CategoryChipProps) {
  const isSmall = size === 'small'

  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: isSmall ? '2px 8px' : '6px 12px',
        borderRadius: 'var(--radius-full)',
        border: 'none',
        background: selected ? color : getColorWithOpacity(color, 0.1),
        color: selected ? '#fff' : color,
        fontSize: isSmall ? 'var(--text-small)' : 'var(--text-caption)',
        fontWeight: 500,
        cursor: onClick ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
        transition: 'all 0.15s',
        lineHeight: 1.4,
        minHeight: onClick ? '44px' : undefined,
      }}
    >
      {icon && <span>{icon}</span>}
      {name}
    </button>
  )
}
