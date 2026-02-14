'use client'

import { useState } from 'react'

interface WeeklyReviewSectionProps {
  title: string
  emoji: string
  items: string[]
  color: string
  bgColor: string
  onCreateTask?: (suggestion: string) => void
}

export default function WeeklyReviewSection({
  title,
  emoji,
  items,
  color,
  bgColor,
  onCreateTask,
}: WeeklyReviewSectionProps) {
  const [expanded, setExpanded] = useState(items.length <= 3)

  const displayItems = expanded ? items : items.slice(0, 3)
  const hasMore = items.length > 3

  return (
    <div style={{
      background: bgColor,
      borderRadius: 'var(--radius-lg)',
      padding: '20px',
      marginBottom: '16px',
      border: `1px solid ${color}20`,
    }}>
      <h3 style={{
        fontSize: 'var(--text-body)',
        fontWeight: 600,
        color: color,
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span>{emoji}</span>
        {title}
      </h3>

      <ul style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
      }}>
        {displayItems.map((item, index) => (
          <li
            key={index}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '8px 0',
              borderBottom: index < displayItems.length - 1 ? `1px solid ${color}15` : 'none',
            }}
          >
            <span style={{
              flexShrink: 0,
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: `${color}20`,
              color: color,
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: '2px',
            }}>
              {emoji}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{
                fontSize: 'var(--text-body)',
                color: 'var(--color-text-primary)',
                lineHeight: 1.5,
              }}>
                {item}
              </span>
              {onCreateTask && (
                <button
                  onClick={() => onCreateTask(item)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginLeft: '8px',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${color}40`,
                    background: 'var(--color-bg)',
                    color: color,
                    fontSize: 'var(--text-caption)',
                    fontWeight: 500,
                    cursor: 'pointer',
                    verticalAlign: 'middle',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Create task
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            marginTop: '12px',
            padding: '8px 16px',
            background: 'transparent',
            border: `1px solid ${color}30`,
            borderRadius: 'var(--radius-sm)',
            color: color,
            fontSize: 'var(--text-small)',
            fontWeight: 500,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          {expanded ? 'Show less' : `Show ${items.length - 3} more`}
        </button>
      )}
    </div>
  )
}
