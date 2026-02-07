'use client'

/**
 * FocusSkeleton - Skeleton loading state for Focus page
 * Shows gray placeholder shapes that mimic the focus flow layout
 */

export default function FocusSkeleton() {
  return (
    <div className="skeleton-container">
      <div className="skeleton-content">
        {/* Icon placeholder */}
        <div className="skeleton-icon-large" />

        {/* Title placeholder */}
        <div className="skeleton-title" />

        {/* Subtitle placeholder */}
        <div className="skeleton-subtitle" />

        {/* Textarea placeholder */}
        <div className="skeleton-textarea" />

        {/* Button placeholder */}
        <div className="skeleton-button" />
      </div>

      <style jsx>{`
        .skeleton-container {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(20px, 5vw, 32px);
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

        .skeleton-content {
          max-width: 600px;
          width: 100%;
          text-align: center;
        }

        /* Shimmer effect */
        .skeleton-icon-large,
        .skeleton-title,
        .skeleton-subtitle,
        .skeleton-textarea,
        .skeleton-button {
          background: linear-gradient(
            90deg,
            #e5e7eb 0%,
            #f3f4f6 50%,
            #e5e7eb 100%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s ease-in-out infinite;
          border-radius: 12px;
          margin: 0 auto;
        }

        .skeleton-icon-large {
          width: clamp(48px, 14vw, 64px);
          height: clamp(48px, 14vw, 64px);
          border-radius: 50%;
          margin-bottom: clamp(12px, 3vw, 18px);
        }

        .skeleton-title {
          width: clamp(150px, 40vw, 200px);
          height: clamp(26px, 6.5vw, 32px);
          margin-bottom: clamp(8px, 2vw, 12px);
        }

        .skeleton-subtitle {
          width: clamp(200px, 60vw, 320px);
          height: clamp(16px, 4vw, 20px);
          margin-bottom: clamp(24px, 6vw, 32px);
        }

        .skeleton-textarea {
          width: 100%;
          height: clamp(160px, 40vw, 200px);
          border-radius: clamp(12px, 3vw, 16px);
          margin-bottom: clamp(24px, 6vw, 32px);
        }

        .skeleton-button {
          width: 100%;
          height: clamp(48px, 12vw, 56px);
          border-radius: clamp(10px, 2.5vw, 14px);
        }

        /* Accessibility: reduce motion */
        @media (prefers-reduced-motion: reduce) {
          .skeleton-icon-large,
          .skeleton-title,
          .skeleton-subtitle,
          .skeleton-textarea,
          .skeleton-button {
            animation: none;
            background: #e5e7eb;
          }
        }
      `}</style>
    </div>
  )
}
