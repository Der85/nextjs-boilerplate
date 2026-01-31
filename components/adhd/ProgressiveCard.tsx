'use client'

import { useState, useEffect, useRef, ReactNode } from 'react'

interface ProgressiveCardProps {
  id: string // Unique ID for localStorage persistence
  title: string
  icon?: string
  preview?: string | ReactNode // What to show when collapsed
  children: ReactNode
  defaultExpanded?: boolean
  autoCollapseDelay?: number // milliseconds, default 30000 (30s)
  onExpandChange?: (expanded: boolean) => void
}

export default function ProgressiveCard({
  id,
  title,
  icon,
  preview,
  children,
  defaultExpanded = false,
  autoCollapseDelay = 30000,
  onExpandChange
}: ProgressiveCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [isAnimating, setIsAnimating] = useState(false)
  const collapseTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Load expanded state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem(`progressive-card-${id}`)
    if (savedState !== null) {
      setIsExpanded(savedState === 'true')
    }
  }, [id])

  // Save expanded state to localStorage
  useEffect(() => {
    localStorage.setItem(`progressive-card-${id}`, String(isExpanded))
  }, [id, isExpanded])

  // Auto-collapse timer
  useEffect(() => {
    if (isExpanded && autoCollapseDelay > 0) {
      // Clear any existing timer
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current)
      }

      // Set new timer
      collapseTimerRef.current = setTimeout(() => {
        setIsExpanded(false)
        if (onExpandChange) {
          onExpandChange(false)
        }
      }, autoCollapseDelay)
    }

    // Cleanup on unmount or when collapsed
    return () => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current)
      }
    }
  }, [isExpanded, autoCollapseDelay, onExpandChange])

  const toggleExpanded = () => {
    setIsAnimating(true)
    const newState = !isExpanded

    setIsExpanded(newState)

    if (onExpandChange) {
      onExpandChange(newState)
    }

    // Remove animating class after animation completes
    setTimeout(() => setIsAnimating(false), 300)
  }

  return (
    <div className={`progressive-card ${isExpanded ? 'expanded' : 'collapsed'} ${isAnimating ? 'animating' : ''}`}>
      <button
        onClick={toggleExpanded}
        className="card-header"
        aria-expanded={isExpanded}
        aria-controls={`card-content-${id}`}
      >
        <div className="header-left">
          {icon && <span className="card-icon">{icon}</span>}
          <span className="card-title">{title}</span>
        </div>

        <div className="header-right">
          {!isExpanded && preview && (
            <span className="card-preview">{preview}</span>
          )}
          <span className="expand-icon">{isExpanded ? '−' : '+'}</span>
        </div>
      </button>

      <div
        id={`card-content-${id}`}
        className="card-content"
        style={{
          maxHeight: isExpanded ? '2000px' : '0',
          opacity: isExpanded ? 1 : 0
        }}
      >
        <div className="card-inner">
          {children}
        </div>
      </div>

      <style jsx>{`
        .progressive-card {
          background: white;
          border-radius: clamp(14px, 4vw, 18px);
          overflow: hidden;
          margin-bottom: clamp(12px, 3.5vw, 16px);
          border: 1px solid #e5e7eb;
          transition: box-shadow 0.2s ease;
        }

        .progressive-card.expanded {
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
        }

        .card-header {
          width: 100%;
          padding: clamp(14px, 4vw, 18px) clamp(16px, 4.5vw, 20px);
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: clamp(12px, 3vw, 16px);
          text-align: left;
          transition: background 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .card-header:hover {
          background: rgba(0, 0, 0, 0.02);
        }

        .card-header:active {
          background: rgba(0, 0, 0, 0.04);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: clamp(8px, 2.5vw, 12px);
          flex: 1;
          min-width: 0;
        }

        .card-icon {
          font-size: clamp(18px, 5vw, 22px);
          flex-shrink: 0;
          line-height: 1;
        }

        .card-title {
          font-size: clamp(14px, 3.8vw, 16px);
          font-weight: 600;
          color: #0f1419;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: clamp(10px, 2.5vw, 14px);
          flex-shrink: 0;
        }

        .card-preview {
          font-size: clamp(12px, 3.2vw, 14px);
          color: #536471;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
          max-width: 150px;
        }

        .expand-icon {
          width: clamp(24px, 6vw, 28px);
          height: clamp(24px, 6vw, 28px);
          border-radius: 50%;
          background: rgba(29, 155, 240, 0.1);
          color: #1D9BF0;
          font-size: clamp(16px, 4.5vw, 20px);
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: transform 0.2s ease, background 0.2s ease;
        }

        .progressive-card.expanded .expand-icon {
          background: rgba(29, 155, 240, 0.15);
        }

        .card-header:hover .expand-icon {
          transform: scale(1.1);
          background: rgba(29, 155, 240, 0.2);
        }

        .card-content {
          overflow: hidden;
          transition: max-height 0.3s ease, opacity 0.3s ease;
        }

        .card-inner {
          padding: 0 clamp(16px, 4.5vw, 20px) clamp(16px, 4.5vw, 20px);
        }

        @media (max-width: 480px) {
          .card-preview {
            max-width: 100px;
          }
        }

        @media (max-width: 350px) {
          .card-preview {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}
