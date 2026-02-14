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
    <div
      className="review-section"
      style={{
        '--section-color': color,
        '--section-bg': bgColor,
      } as React.CSSProperties}
    >
      <h3 className="review-section-title">
        <span>{emoji}</span>
        {title}
      </h3>

      <ul className="review-section-list">
        {displayItems.map((item, index) => (
          <li
            key={index}
            className={`review-section-item ${index < displayItems.length - 1 ? 'with-border' : ''}`}
          >
            <span className="review-section-bullet">{emoji}</span>
            <div className="review-section-content">
              <span className="review-section-text">{item}</span>
              {onCreateTask && (
                <button
                  onClick={() => onCreateTask(item)}
                  className="review-section-action"
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
          className="review-section-toggle"
        >
          {expanded ? 'Show less' : `Show ${items.length - 3} more`}
        </button>
      )}

      <style>{`
        .review-section {
          background: var(--section-bg);
          border-radius: var(--radius-lg);
          padding: 20px;
          margin-bottom: 16px;
          border: 1px solid color-mix(in srgb, var(--section-color) 12%, transparent);
        }

        .review-section-title {
          font-size: var(--text-body);
          font-weight: 600;
          color: var(--section-color);
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .review-section-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .review-section-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 8px 0;
        }

        .review-section-item.with-border {
          border-bottom: 1px solid color-mix(in srgb, var(--section-color) 8%, transparent);
        }

        .review-section-bullet {
          flex-shrink: 0;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: color-mix(in srgb, var(--section-color) 12%, transparent);
          color: var(--section-color);
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 2px;
        }

        .review-section-content {
          flex: 1;
          min-width: 0;
        }

        .review-section-text {
          font-size: var(--text-body);
          color: var(--color-text-primary);
          line-height: 1.5;
        }

        .review-section-action {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-left: 8px;
          padding: 4px 10px;
          border-radius: var(--radius-sm);
          border: 1px solid color-mix(in srgb, var(--section-color) 25%, transparent);
          background: var(--color-bg);
          color: var(--section-color);
          font-size: var(--text-caption);
          font-weight: 500;
          cursor: pointer;
          vertical-align: middle;
        }

        .review-section-action:hover {
          background: color-mix(in srgb, var(--section-color) 8%, var(--color-bg));
        }

        .review-section-toggle {
          margin-top: 12px;
          padding: 8px 16px;
          background: transparent;
          border: 1px solid color-mix(in srgb, var(--section-color) 18%, transparent);
          border-radius: var(--radius-sm);
          color: var(--section-color);
          font-size: var(--text-small);
          font-weight: 500;
          cursor: pointer;
          width: 100%;
          transition: background 0.15s ease;
        }

        .review-section-toggle:hover {
          background: color-mix(in srgb, var(--section-color) 8%, transparent);
        }
      `}</style>
    </div>
  )
}
