'use client'

import { useRouter } from 'next/navigation'

type ModeColor = 'red' | 'green' | 'blue' | 'orange'

interface PrimaryActionProps {
  icon: string
  label: string
  message?: string
  path?: string
  onClick?: () => void
  color?: ModeColor
  disabled?: boolean
  loading?: boolean
}

// Visual Quieting: Flat colors instead of gradients, shadows only on hover
const colorConfig = {
  red: {
    background: '#ef4444',
    hoverShadow: '0 4px 14px rgba(239, 68, 68, 0.25)',
  },
  green: {
    background: '#10b981',
    hoverShadow: '0 4px 14px rgba(16, 185, 129, 0.25)',
  },
  blue: {
    background: '#1D9BF0',
    hoverShadow: '0 4px 14px rgba(29, 155, 240, 0.25)',
  },
  orange: {
    background: '#f59e0b',
    hoverShadow: '0 4px 14px rgba(245, 158, 11, 0.25)',
  }
}

export default function PrimaryAction({
  icon,
  label,
  message,
  path,
  onClick,
  color = 'blue',
  disabled = false,
  loading = false
}: PrimaryActionProps) {
  const router = useRouter()
  const config = colorConfig[color]

  const handleClick = () => {
    if (disabled || loading) return

    if (onClick) {
      onClick()
    } else if (path) {
      if (path.startsWith('#')) {
        // Scroll to element on same page
        const element = document.querySelector(path)
        element?.scrollIntoView({ behavior: 'smooth' })
      } else {
        // Navigate to different page
        router.push(path)
      }
    }
  }

  return (
    <div className="primary-action-container">
      {message && (
        <p className="action-message">
          {message}
        </p>
      )}

      <button
        onClick={handleClick}
        disabled={disabled || loading}
        className="primary-action-btn"
      >
        <span className="action-icon">{icon}</span>
        <span className="action-label">{loading ? 'Loading...' : label}</span>
      </button>

      <style jsx>{`
        .primary-action-container {
          margin-bottom: clamp(16px, 4vw, 24px);
        }

        .action-message {
          font-size: clamp(13px, 3.5vw, 15px);
          color: var(--dark-gray, #536471);
          line-height: 1.5;
          margin: 0 0 clamp(12px, 3vw, 16px) 0;
          text-align: center;
        }

        .primary-action-btn {
          width: 100%;
          padding: clamp(16px, 4.5vw, 20px);
          border: none;
          border-radius: clamp(14px, 3.5vw, 18px);
          font-size: clamp(16px, 4.5vw, 20px);
          font-weight: 700;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: clamp(10px, 2.5vw, 14px);
          background: ${config.background};
          box-shadow: none;
          transition: all 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .primary-action-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: ${config.hoverShadow};
        }

        .primary-action-btn:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: none;
        }

        .primary-action-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .action-icon {
          font-size: clamp(20px, 5.5vw, 26px);
          line-height: 1;
        }

        .action-label {
          line-height: 1.2;
        }

        @media (min-width: 768px) {
          .primary-action-btn {
            padding: 20px 32px;
          }
        }

        @media (max-width: 350px) {
          .primary-action-btn {
            flex-direction: column;
            gap: 6px;
            padding: 14px;
          }

          .action-label {
            font-size: 14px;
          }
        }
      `}</style>
    </div>
  )
}
