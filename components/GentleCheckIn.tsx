'use client'

interface GentleCheckInProps {
  variant?: 'timed' | 'post-interaction'
  onStillLow?: () => void
  onALittleBetter?: () => void
  onOkayNow?: () => void
  onDismiss?: () => void
}

export default function GentleCheckIn({
  variant = 'timed',
  onStillLow,
  onALittleBetter,
  onOkayNow,
  onDismiss
}: GentleCheckInProps) {
  const message = variant === 'post-interaction'
    ? 'Nice. How are you feeling now?'
    : "Been a little while. How are you feeling now?"

  return (
    <div className="gentle-checkin">
      <p className="checkin-message">{message}</p>

      <div className="checkin-options">
        <button
          className="checkin-btn still-low"
          onClick={onStillLow}
        >
          Still low
        </button>
        <button
          className="checkin-btn a-little-better"
          onClick={onALittleBetter}
        >
          A little better
        </button>
        <button
          className="checkin-btn okay-now"
          onClick={onOkayNow}
        >
          I'm okay now
        </button>
      </div>

      {onDismiss && (
        <button className="dismiss-btn" onClick={onDismiss}>
          Not now
        </button>
      )}

      <style jsx>{`
        .gentle-checkin {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.06) 0%, rgba(99, 102, 241, 0.04) 100%);
          border: 1px solid rgba(139, 92, 246, 0.12);
          border-radius: clamp(14px, 3.5vw, 18px);
          padding: clamp(16px, 4vw, 20px);
          margin-top: clamp(16px, 4vw, 20px);
          text-align: center;
          animation: fadeSlideUp 0.4s ease-out;
        }

        @keyframes fadeSlideUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .checkin-message {
          font-size: clamp(14px, 3.5vw, 16px);
          color: #4b5563;
          margin: 0 0 clamp(14px, 3.5vw, 18px) 0;
          line-height: 1.4;
        }

        .checkin-options {
          display: flex;
          flex-wrap: wrap;
          gap: clamp(8px, 2vw, 10px);
          justify-content: center;
        }

        .checkin-btn {
          padding: clamp(10px, 2.5vw, 12px) clamp(16px, 4vw, 20px);
          border-radius: 100px;
          font-size: clamp(13px, 3.2vw, 14px);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          border: none;
        }

        .checkin-btn.still-low {
          background: rgba(139, 92, 246, 0.1);
          color: #7c3aed;
        }

        .checkin-btn.still-low:hover {
          background: rgba(139, 92, 246, 0.15);
        }

        .checkin-btn.a-little-better {
          background: rgba(16, 185, 129, 0.1);
          color: #059669;
        }

        .checkin-btn.a-little-better:hover {
          background: rgba(16, 185, 129, 0.15);
        }

        .checkin-btn.okay-now {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
        }

        .checkin-btn.okay-now:hover {
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
          transform: translateY(-1px);
        }

        .dismiss-btn {
          display: block;
          margin: clamp(12px, 3vw, 16px) auto 0;
          padding: clamp(6px, 1.5vw, 8px) clamp(12px, 3vw, 16px);
          background: none;
          border: none;
          color: #9ca3af;
          font-size: clamp(12px, 3vw, 13px);
          cursor: pointer;
          transition: color 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .dismiss-btn:hover {
          color: #6b7280;
        }

        /* Responsive: Stack buttons on very small screens */
        @media (max-width: 360px) {
          .checkin-options {
            flex-direction: column;
          }

          .checkin-btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}
