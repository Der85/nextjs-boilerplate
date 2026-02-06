'use client'

/**
 * Transparent Overwhelm Logging Notification
 *
 * Shows users a notification when they visit support pages,
 * asking for consent before logging overwhelm data.
 * This replaces the implicit (silent) logging approach.
 */

interface OverwhelmNotificationProps {
  showNotification: boolean
  onConfirm: () => void
  onDismiss: () => void
}

export default function OverwhelmNotification({
  showNotification,
  onConfirm,
  onDismiss,
}: OverwhelmNotificationProps) {
  if (!showNotification) return null

  return (
    <div className="overwhelm-notification">
      <div className="overwhelm-notification-content">
        <span className="overwhelm-notification-icon">💜</span>
        <div className="overwhelm-notification-text">
          <p className="overwhelm-notification-title">We noticed you need support</p>
          <p className="overwhelm-notification-desc">
            Track this moment to see patterns over time?
          </p>
        </div>
      </div>
      <div className="overwhelm-notification-actions">
        <button onClick={onConfirm} className="overwhelm-btn-yes">Yes, log it</button>
        <button onClick={onDismiss} className="overwhelm-btn-no">No thanks</button>
      </div>

      <style jsx>{`
        .overwhelm-notification {
          position: fixed;
          bottom: clamp(16px, 4vw, 24px);
          left: 50%;
          transform: translateX(-50%);
          background: white;
          border-radius: clamp(14px, 4vw, 20px);
          padding: clamp(14px, 4vw, 20px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          max-width: 340px;
          width: calc(100% - 32px);
          animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        .overwhelm-notification-content {
          display: flex;
          align-items: flex-start;
          gap: clamp(10px, 3vw, 14px);
          margin-bottom: clamp(12px, 3vw, 16px);
        }

        .overwhelm-notification-icon {
          font-size: clamp(24px, 6vw, 32px);
          flex-shrink: 0;
        }

        .overwhelm-notification-text {
          flex: 1;
          min-width: 0;
        }

        .overwhelm-notification-title {
          font-size: clamp(14px, 3.8vw, 16px);
          font-weight: 700;
          color: #0f1419;
          margin: 0 0 clamp(2px, 0.5vw, 4px) 0;
        }

        .overwhelm-notification-desc {
          font-size: clamp(12px, 3.2vw, 14px);
          color: #536471;
          margin: 0;
          line-height: 1.4;
        }

        .overwhelm-notification-actions {
          display: flex;
          gap: clamp(8px, 2vw, 12px);
        }

        .overwhelm-btn-yes,
        .overwhelm-btn-no {
          flex: 1;
          padding: clamp(10px, 2.5vw, 12px);
          border-radius: clamp(8px, 2vw, 12px);
          font-size: clamp(13px, 3.5vw, 15px);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .overwhelm-btn-yes {
          background: #805ad5;
          color: white;
          border: none;
        }

        .overwhelm-btn-yes:hover {
          background: #6b46c1;
        }

        .overwhelm-btn-no {
          background: #f7f9fa;
          color: #536471;
          border: 1px solid #e5e7eb;
        }

        .overwhelm-btn-no:hover {
          background: #eff3f4;
        }
      `}</style>
    </div>
  )
}
