'use client'

import { useState } from 'react'

type UserMode = 'recovery' | 'maintenance' | 'growth'

interface ModeIndicatorProps {
  mode: UserMode
  showLabel?: boolean
  position?: 'inline' | 'absolute'
}

const modeConfig = {
  recovery: {
    color: '#f4212e',
    bgColor: 'rgba(244, 33, 46, 0.1)',
    label: 'Recovery',
    tooltip: 'Low energy detected. Focus on regulation, not productivity.'
  },
  growth: {
    color: '#00ba7c',
    bgColor: 'rgba(0, 186, 124, 0.1)',
    label: 'Growth',
    tooltip: 'High momentum! Great time to channel energy into meaningful work.'
  },
  maintenance: {
    color: '#1D9BF0',
    bgColor: 'rgba(29, 155, 240, 0.1)',
    label: 'Steady',
    tooltip: 'Balanced state. Building consistent habits.'
  }
}

export default function ModeIndicator({
  mode,
  showLabel = false,
  position = 'inline'
}: ModeIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const config = modeConfig[mode]

  return (
    <div
      className={`mode-indicator ${position}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="mode-badge">
        <span
          className="mode-dot"
          style={{ backgroundColor: config.color }}
        />
        {showLabel && (
          <span
            className="mode-label"
            style={{ color: config.color }}
          >
            {config.label}
          </span>
        )}
      </div>

      {showTooltip && (
        <div className="mode-tooltip">
          {config.tooltip}
        </div>
      )}

      <style jsx>{`
        .mode-indicator {
          display: inline-flex;
          align-items: center;
          position: relative;
        }

        .mode-indicator.absolute {
          position: absolute;
          top: clamp(12px, 3vw, 16px);
          right: clamp(12px, 3vw, 16px);
          z-index: 10;
        }

        .mode-badge {
          display: flex;
          align-items: center;
          gap: clamp(5px, 1.5vw, 8px);
          padding: clamp(4px, 1.2vw, 6px) clamp(8px, 2.5vw, 10px);
          background: ${config.bgColor};
          border-radius: 100px;
          border: 1px solid ${config.color}33;
        }

        .mode-dot {
          width: clamp(7px, 2vw, 9px);
          height: clamp(7px, 2vw, 9px);
          border-radius: 50%;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            box-shadow: 0 0 0 0 ${config.color}66;
          }
          50% {
            opacity: 0.7;
            box-shadow: 0 0 0 3px ${config.color}00;
          }
        }

        .mode-label {
          font-size: clamp(10px, 2.8vw, 12px);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .mode-tooltip {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          background: #0f1419;
          color: white;
          padding: clamp(8px, 2.5vw, 12px) clamp(12px, 3.5vw, 16px);
          border-radius: clamp(8px, 2vw, 12px);
          font-size: clamp(12px, 3.2vw, 14px);
          line-height: 1.4;
          white-space: nowrap;
          max-width: 250px;
          white-space: normal;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          z-index: 100;
          animation: fadeIn 0.2s ease;
        }

        .mode-tooltip::before {
          content: '';
          position: absolute;
          top: -4px;
          right: 16px;
          width: 8px;
          height: 8px;
          background: #0f1419;
          transform: rotate(45deg);
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 768px) {
          .mode-tooltip {
            right: -20px;
            max-width: 200px;
          }
        }
      `}</style>
    </div>
  )
}
