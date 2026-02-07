'use client'

import { useRouter } from 'next/navigation'

interface GentleTidyUpProps {
  overdueCount: number
  onDismiss: () => void
  onReview: () => void
}

// Helper to get friendly count text (avoids shame-inducing large numbers)
const getCountText = (count: number): string => {
  if (count === 1) return '1 older item'
  if (count <= 5) return `${count} older items`
  return 'a few older items'
}

export default function GentleTidyUp({
  overdueCount,
  onDismiss,
  onReview,
}: GentleTidyUpProps) {
  const router = useRouter()

  if (overdueCount === 0) return null

  return (
    <div className="gentle-tidy-up">
      <div className="tidy-header">
        <span className="tidy-icon">🧹</span>
        <span className="tidy-title">Some things from before</span>
      </div>

      <p className="tidy-message">
        We tucked away {getCountText(overdueCount)}. Review them whenever you're ready, or leave them be.
      </p>

      <div className="tidy-actions">
        <button className="tidy-btn review" onClick={onReview}>
          Review items
        </button>
        <button className="tidy-btn dismiss" onClick={onDismiss}>
          All good
        </button>
      </div>

      <style jsx>{`
        .gentle-tidy-up {
          /* Zen Mode: Subtle gray background, no shadow, sits behind white Hero */
          background: #f8f9fa;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: clamp(12px, 3vw, 16px);
          padding: clamp(16px, 4vw, 20px);
          margin-top: clamp(12px, 3vw, 16px);
          animation: fadeIn 0.4s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .tidy-header {
          display: flex;
          align-items: center;
          gap: clamp(8px, 2vw, 10px);
          margin-bottom: clamp(8px, 2vw, 12px);
        }

        .tidy-icon {
          font-size: clamp(18px, 4.5vw, 22px);
          opacity: 0.8;
        }

        .tidy-title {
          font-size: clamp(14px, 3.5vw, 16px);
          font-weight: 600;
          color: #64748b;
        }

        .tidy-message {
          font-size: clamp(13px, 3.2vw, 14px);
          color: #94a3b8;
          line-height: 1.5;
          margin: 0 0 clamp(14px, 3.5vw, 18px) 0;
        }

        .tidy-actions {
          display: flex;
          gap: clamp(10px, 2.5vw, 14px);
        }

        .tidy-btn {
          flex: 1;
          padding: clamp(10px, 2.5vw, 12px) clamp(14px, 3.5vw, 18px);
          border-radius: clamp(8px, 2vw, 10px);
          font-size: clamp(13px, 3.2vw, 14px);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .tidy-btn.review {
          background: rgba(100, 116, 139, 0.1);
          border: 1px solid rgba(100, 116, 139, 0.2);
          color: #64748b;
        }

        .tidy-btn.review:hover {
          background: rgba(100, 116, 139, 0.15);
          border-color: rgba(100, 116, 139, 0.3);
        }

        .tidy-btn.dismiss {
          background: transparent;
          border: 1px solid rgba(148, 163, 184, 0.2);
          color: #94a3b8;
        }

        .tidy-btn.dismiss:hover {
          background: rgba(148, 163, 184, 0.08);
          color: #64748b;
        }

        /* Responsive: Stack on very small screens */
        @media (max-width: 360px) {
          .tidy-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  )
}
