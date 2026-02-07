'use client'

/**
 * DashboardSkeleton - Reduces perceived loading time with skeleton UI
 * Shows gray placeholder shapes that mimic the dashboard layout
 */

export default function DashboardSkeleton() {
  return (
    <div className="skeleton-container">
      {/* Header skeleton */}
      <div className="skeleton-header">
        <div className="skeleton-logo" />
        <div className="skeleton-nav">
          <div className="skeleton-nav-item" />
          <div className="skeleton-nav-item" />
          <div className="skeleton-nav-item" />
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="skeleton-main">
        {/* Hero card skeleton */}
        <div className="skeleton-hero-card">
          <div className="skeleton-greeting" />
          <div className="skeleton-suggestion">
            <div className="skeleton-suggestion-label" />
            <div className="skeleton-suggestion-title" />
            <div className="skeleton-meta-row">
              <div className="skeleton-meta-item" />
              <div className="skeleton-meta-item" />
            </div>
          </div>
          <div className="skeleton-button" />
        </div>

        {/* Secondary cards skeleton */}
        <div className="skeleton-card">
          <div className="skeleton-card-header">
            <div className="skeleton-icon" />
            <div className="skeleton-card-title" />
          </div>
        </div>

        <div className="skeleton-card">
          <div className="skeleton-card-header">
            <div className="skeleton-icon" />
            <div className="skeleton-card-title" />
          </div>
        </div>
      </div>

      <style jsx>{`
        .skeleton-container {
          min-height: 100vh;
          min-height: 100dvh;
          background: #f7f9fa;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        /* Shimmer effect for all skeleton elements */
        .skeleton-logo,
        .skeleton-nav-item,
        .skeleton-greeting,
        .skeleton-suggestion-label,
        .skeleton-suggestion-title,
        .skeleton-meta-item,
        .skeleton-button,
        .skeleton-icon,
        .skeleton-card-title {
          background: linear-gradient(
            90deg,
            #e5e7eb 0%,
            #f3f4f6 50%,
            #e5e7eb 100%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s ease-in-out infinite;
          border-radius: 8px;
        }

        /* Header */
        .skeleton-header {
          background: white;
          padding: clamp(12px, 3vw, 16px) clamp(16px, 4vw, 24px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #e5e7eb;
        }

        .skeleton-logo {
          width: clamp(100px, 25vw, 140px);
          height: clamp(24px, 6vw, 32px);
        }

        .skeleton-nav {
          display: flex;
          gap: clamp(12px, 3vw, 20px);
        }

        .skeleton-nav-item {
          width: clamp(60px, 15vw, 80px);
          height: clamp(16px, 4vw, 20px);
        }

        /* Main content */
        .skeleton-main {
          padding: clamp(16px, 4vw, 24px);
          max-width: 600px;
          margin: 0 auto;
        }

        /* Hero card */
        .skeleton-hero-card {
          background: white;
          border-radius: clamp(16px, 4vw, 20px);
          padding: clamp(20px, 5vw, 28px);
          margin-bottom: clamp(16px, 4vw, 20px);
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
          border: 1px solid #e5e7eb;
        }

        .skeleton-greeting {
          width: clamp(180px, 45vw, 240px);
          height: clamp(28px, 7vw, 36px);
          margin-bottom: clamp(16px, 4vw, 24px);
        }

        .skeleton-suggestion {
          background: rgba(29, 155, 240, 0.04);
          border-radius: clamp(12px, 3vw, 16px);
          padding: clamp(16px, 4vw, 20px);
          margin-bottom: clamp(16px, 4vw, 20px);
        }

        .skeleton-suggestion-label {
          width: clamp(100px, 25vw, 140px);
          height: clamp(12px, 3vw, 14px);
          margin-bottom: clamp(8px, 2vw, 12px);
        }

        .skeleton-suggestion-title {
          width: 100%;
          height: clamp(22px, 5.5vw, 28px);
          margin-bottom: clamp(12px, 3vw, 16px);
        }

        .skeleton-meta-row {
          display: flex;
          gap: clamp(12px, 3vw, 16px);
        }

        .skeleton-meta-item {
          width: clamp(60px, 15vw, 80px);
          height: clamp(14px, 3.5vw, 18px);
        }

        .skeleton-button {
          width: 100%;
          height: clamp(48px, 12vw, 56px);
          border-radius: clamp(12px, 3vw, 14px);
        }

        /* Secondary cards */
        .skeleton-card {
          background: white;
          border-radius: clamp(14px, 3.5vw, 18px);
          padding: clamp(14px, 3.5vw, 18px) clamp(16px, 4vw, 20px);
          margin-bottom: clamp(12px, 3vw, 16px);
          border: 1px solid #e5e7eb;
        }

        .skeleton-card-header {
          display: flex;
          align-items: center;
          gap: clamp(10px, 2.5vw, 14px);
        }

        .skeleton-icon {
          width: clamp(22px, 5.5vw, 26px);
          height: clamp(22px, 5.5vw, 26px);
          border-radius: 50%;
        }

        .skeleton-card-title {
          width: clamp(120px, 30vw, 160px);
          height: clamp(16px, 4vw, 20px);
        }

        /* Accessibility: reduce motion */
        @media (prefers-reduced-motion: reduce) {
          .skeleton-logo,
          .skeleton-nav-item,
          .skeleton-greeting,
          .skeleton-suggestion-label,
          .skeleton-suggestion-title,
          .skeleton-meta-item,
          .skeleton-button,
          .skeleton-icon,
          .skeleton-card-title {
            animation: none;
            background: #e5e7eb;
          }
        }
      `}</style>
    </div>
  )
}
