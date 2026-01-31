'use client'

interface ProgressRingProps {
  progress: number // 0-100
  size?: number
  strokeWidth?: number
  color?: string
  backgroundColor?: string
  label?: string
  value?: string
}

export default function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 8,
  color = '#1D9BF0',
  backgroundColor = '#e5e7eb',
  label,
  value
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (progress / 100) * circumference

  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
        />

        {/* Progress circle */}
        <circle
          className="progress-circle"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>

      {/* Center content */}
      {(label || value) && (
        <div className="ring-content">
          {value && <div className="ring-value">{value}</div>}
          {label && <div className="ring-label">{label}</div>}
        </div>
      )}

      <style jsx>{`
        .progress-ring {
          position: relative;
          display: inline-block;
        }

        .progress-circle {
          transition: stroke-dashoffset 0.5s ease;
        }

        .ring-content {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          pointer-events: none;
        }

        .ring-value {
          font-size: clamp(18px, 4vw, 24px);
          font-weight: 700;
          color: #0f1419;
          line-height: 1;
        }

        .ring-label {
          font-size: clamp(10px, 2.5vw, 12px);
          color: #8899a6;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 4px;
        }
      `}</style>
    </div>
  )
}
