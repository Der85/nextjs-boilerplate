'use client'

import type { OutcomeHorizon } from '@/lib/types/outcomes'

interface OutcomeChipProps {
  title: string
  horizon?: OutcomeHorizon
  onClick?: () => void
  size?: 'small' | 'medium'
}

const HORIZON_COLORS: Record<OutcomeHorizon, string> = {
  weekly: '#10b981',
  monthly: '#1D9BF0',
  quarterly: '#8b5cf6',
}

export default function OutcomeChip({
  title,
  horizon,
  onClick,
  size = 'small',
}: OutcomeChipProps) {
  const displayTitle = title.length > 25 ? title.slice(0, 25) + '...' : title
  const color = horizon ? HORIZON_COLORS[horizon] : '#6b7280'
  const isClickable = !!onClick

  const Component = isClickable ? 'button' : 'span'

  return (
    <>
      <Component
        className={`outcome-chip ${size} ${isClickable ? 'clickable' : ''}`}
        onClick={onClick}
        type={isClickable ? 'button' : undefined}
        style={{
          borderColor: color,
          color: color,
        }}
      >
        <span className="icon">🎯</span>
        <span className="title">{displayTitle}</span>
      </Component>

      <style jsx>{`
        .outcome-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border: 1px solid;
          border-radius: 100px;
          background: white;
          font-weight: 500;
          white-space: nowrap;
        }

        .outcome-chip.small {
          padding: 2px 8px;
          font-size: 11px;
        }

        .outcome-chip.medium {
          padding: 4px 12px;
          font-size: 13px;
        }

        .outcome-chip.clickable {
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .outcome-chip.clickable:hover {
          transform: scale(1.02);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .icon {
          font-size: 0.9em;
        }

        .title {
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </>
  )
}
