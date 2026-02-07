'use client'

import { useState, useRef } from 'react'

interface TriageItemProps {
  id: string
  title: string
  createdAt: string
  isSelected: boolean
  onSelect: (id: string, selected: boolean) => void
  onSwipeReschedule?: (id: string) => void
  onSwipeArchive?: (id: string) => void
  isExiting?: boolean
}

// Get relative time string (e.g., "3 days ago")
const getRelativeTime = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 14) return '1 week ago'
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 60) return '1 month ago'
  return `${Math.floor(diffDays / 30)} months ago`
}

export default function TriageItem({
  id,
  title,
  createdAt,
  isSelected,
  onSelect,
  onSwipeReschedule,
  onSwipeArchive,
  isExiting = false,
}: TriageItemProps) {
  const [swipeX, setSwipeX] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const startXRef = useRef(0)
  const itemRef = useRef<HTMLDivElement>(null)

  const SWIPE_THRESHOLD = 80

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX
    setIsSwiping(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return
    const currentX = e.touches[0].clientX
    const diff = currentX - startXRef.current
    // Limit swipe distance
    const clampedDiff = Math.max(-120, Math.min(120, diff))
    setSwipeX(clampedDiff)
  }

  const handleTouchEnd = () => {
    if (swipeX > SWIPE_THRESHOLD && onSwipeReschedule) {
      onSwipeReschedule(id)
    } else if (swipeX < -SWIPE_THRESHOLD && onSwipeArchive) {
      onSwipeArchive(id)
    }
    setSwipeX(0)
    setIsSwiping(false)
  }

  const getSwipeIndicator = () => {
    if (swipeX > SWIPE_THRESHOLD) {
      return { text: 'Reschedule', color: '#1D9BF0', side: 'left' }
    }
    if (swipeX < -SWIPE_THRESHOLD) {
      return { text: 'Archive', color: '#94a3b8', side: 'right' }
    }
    return null
  }

  const indicator = getSwipeIndicator()

  return (
    <div className={`triage-item-wrapper ${isExiting ? 'exiting' : ''}`}>
      {/* Swipe indicators behind the item */}
      <div className="swipe-indicators">
        <div className={`indicator left ${swipeX > 30 ? 'visible' : ''}`}>
          Reschedule
        </div>
        <div className={`indicator right ${swipeX < -30 ? 'visible' : ''}`}>
          Archive
        </div>
      </div>

      <div
        ref={itemRef}
        className={`triage-item ${isSelected ? 'selected' : ''}`}
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <label className="item-checkbox-label">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(id, e.target.checked)}
            className="item-checkbox"
          />
          <span className="checkbox-custom" />
        </label>

        <div className="item-content">
          <span className="item-title">{title}</span>
          <span className="item-time">{getRelativeTime(createdAt)}</span>
        </div>
      </div>

      <style jsx>{`
        .triage-item-wrapper {
          position: relative;
          overflow: hidden;
          transition: opacity 0.2s ease, transform 0.2s ease, max-height 0.2s ease;
          max-height: 80px;
        }

        .triage-item-wrapper.exiting {
          opacity: 0;
          transform: translateX(100px);
          max-height: 0;
          margin-bottom: 0;
          padding: 0;
        }

        .swipe-indicators {
          position: absolute;
          inset: 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 16px;
          pointer-events: none;
        }

        .indicator {
          font-size: 13px;
          font-weight: 600;
          opacity: 0;
          transition: opacity 0.15s ease;
        }

        .indicator.visible {
          opacity: 1;
        }

        .indicator.left {
          color: #1D9BF0;
        }

        .indicator.right {
          color: #64748b;
        }

        .triage-item {
          display: flex;
          align-items: center;
          gap: clamp(12px, 3vw, 16px);
          padding: clamp(14px, 3.5vw, 18px);
          background: white;
          border-radius: clamp(10px, 2.5vw, 12px);
          border: 1px solid #e5e7eb;
          transition: transform 0.1s ease, border-color 0.2s ease, background 0.2s ease;
          cursor: pointer;
          touch-action: pan-y;
        }

        .triage-item.selected {
          border-color: #1D9BF0;
          background: rgba(29, 155, 240, 0.04);
        }

        .item-checkbox-label {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .item-checkbox {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
        }

        .checkbox-custom {
          width: clamp(20px, 5vw, 24px);
          height: clamp(20px, 5vw, 24px);
          border: 2px solid #d1d5db;
          border-radius: 6px;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .item-checkbox:checked + .checkbox-custom {
          background: #1D9BF0;
          border-color: #1D9BF0;
        }

        .item-checkbox:checked + .checkbox-custom::after {
          content: '✓';
          color: white;
          font-size: 14px;
          font-weight: 700;
        }

        .item-content {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .item-title {
          font-size: clamp(14px, 3.5vw, 16px);
          font-weight: 500;
          color: #1f2937;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .item-time {
          font-size: clamp(12px, 3vw, 13px);
          color: #9ca3af;
        }
      `}</style>
    </div>
  )
}
