'use client'

import { useState } from 'react'
import { useDailyCheckinSafe } from '@/context/DailyCheckinContext'
import type { AdaptiveRecommendation } from '@/lib/types/daily-checkin'

interface AdaptiveBannerProps {
  className?: string
  onRecommendationAccepted?: (recommendation: AdaptiveRecommendation) => void
}

export default function AdaptiveBanner({
  className = '',
  onRecommendationAccepted,
}: AdaptiveBannerProps) {
  const { adaptiveState } = useDailyCheckinSafe()
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  // Don't show if no triggers are active
  if (adaptiveState.triggers.length === 0) {
    return null
  }

  // Filter out dismissed recommendations
  const visibleRecommendations = adaptiveState.recommendations.filter(
    (r) => !dismissedIds.has(r.id)
  )

  if (visibleRecommendations.length === 0) {
    return null
  }

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]))
  }

  const handleAccept = (recommendation: AdaptiveRecommendation) => {
    onRecommendationAccepted?.(recommendation)
    handleDismiss(recommendation.id)
  }

  // Get banner style based on primary trigger
  const primaryTrigger = adaptiveState.triggers[0]
  const bannerStyles: Record<string, { bg: string; border: string; icon: string }> = {
    high_overwhelm: { bg: 'rgba(239, 68, 68, 0.1)', border: '#ef4444', icon: '🌊' },
    high_anxiety: { bg: 'rgba(245, 158, 11, 0.1)', border: '#f59e0b', icon: '💭' },
    low_energy: { bg: 'rgba(59, 130, 246, 0.1)', border: '#3b82f6', icon: '⚡' },
    low_clarity: { bg: 'rgba(139, 92, 246, 0.1)', border: '#8b5cf6', icon: '🎯' },
    combined_stress: { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', icon: '🫂' },
  }

  const style = bannerStyles[primaryTrigger] || bannerStyles.combined_stress

  return (
    <div className={`adaptive-banner ${className}`}>
      <div className="banner-header">
        <span className="banner-icon">{style.icon}</span>
        <span className="banner-title">
          {adaptiveState.simplifiedUIEnabled
            ? 'Simplified mode active'
            : 'Personalized for today'}
        </span>
      </div>

      <div className="recommendations">
        {visibleRecommendations.map((rec) => (
          <div key={rec.id} className="recommendation-card">
            <div className="rec-content">
              <h4 className="rec-title">{rec.title}</h4>
              <p className="rec-description">{rec.description}</p>
            </div>
            <div className="rec-actions">
              {rec.actionType && (
                <button
                  className="action-btn primary"
                  onClick={() => handleAccept(rec)}
                >
                  {rec.actionType === 'navigate' ? 'Go' : 'Enable'}
                </button>
              )}
              <button
                className="action-btn dismiss"
                onClick={() => handleDismiss(rec.id)}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .adaptive-banner {
          background: ${style.bg};
          border: 1px solid ${style.border};
          border-radius: 16px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .banner-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .banner-icon {
          font-size: 20px;
        }

        .banner-title {
          font-size: 14px;
          font-weight: 600;
          color: #e4e4f0;
        }

        .recommendations {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .recommendation-card {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 10px;
          padding: 12px;
        }

        .rec-content {
          flex: 1;
          min-width: 0;
        }

        .rec-title {
          font-size: 14px;
          font-weight: 500;
          color: #e4e4f0;
          margin: 0 0 4px;
        }

        .rec-description {
          font-size: 12px;
          color: #a0a0be;
          margin: 0;
          line-height: 1.4;
        }

        .rec-actions {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }

        .action-btn {
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          border: none;
        }

        .action-btn.primary {
          background: ${style.border};
          color: white;
        }

        .action-btn.primary:hover {
          filter: brightness(1.1);
        }

        .action-btn.dismiss {
          background: transparent;
          color: #6b6b8e;
          font-size: 18px;
          padding: 4px 8px;
          line-height: 1;
        }

        .action-btn.dismiss:hover {
          color: #a0a0be;
        }

        @media (max-width: 480px) {
          .recommendation-card {
            flex-direction: column;
            align-items: flex-start;
          }

          .rec-actions {
            width: 100%;
            justify-content: flex-end;
            margin-top: 8px;
          }
        }
      `}</style>
    </div>
  )
}
