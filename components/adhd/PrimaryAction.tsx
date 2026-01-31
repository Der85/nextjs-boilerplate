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

const colorConfig = {
  red: {
    gradient: 'linear-gradient(135deg, #f4212e 0%, #dc2626 100%)',
    shadow: '0 4px 14px rgba(244, 33, 46, 0.3)',
    hoverShadow: '0 6px 20px rgba(244, 33, 46, 0.4)',
  },
  green: {
    gradient: 'linear-gradient(135deg, #00ba7c 0%, #059669 100%)',
    shadow: '0 4px 14px rgba(0, 186, 124, 0.3)',
    hoverShadow: '0 6px 20px rgba(0, 186, 124, 0.4)',
  },
  blue: {
    gradient: 'linear-gradient(135deg, #1D9BF0 0%, #0c7abf 100%)',
    shadow: '0 4px 14px rgba(29, 155, 240, 0.3)',
    hoverShadow: '0 6px 20px rgba(29, 155, 240, 0.4)',
  },
  orange: {
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    shadow: '0 4px 14px rgba(245, 158, 11, 0.3)',
    hoverShadow: '0 6px 20px rgba(245, 158, 11, 0.4)',
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
          background: ${config.gradient};
          box-shadow: ${config.shadow};
          transition: all 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .primary-action-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: ${config.hoverShadow};
        }

        .primary-action-btn:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: ${config.shadow};
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
