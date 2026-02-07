'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface EnhancedSuggestion {
  goalId: string | null
  goalTitle: string | null
  suggestion: string
  reason: string
  timeEstimate: string
  effortLevel: 'low' | 'medium' | 'high'
  url: string
}

interface Just1ThingHeroProps {
  greeting: string
  contextMessage?: string
  suggestions: EnhancedSuggestion[]
  onShuffle?: () => void
  shuffleCount: number
  maxShuffles?: number
}

const getEffortEmoji = (level: 'low' | 'medium' | 'high'): string => {
  switch (level) {
    case 'low': return '🌱'
    case 'medium': return '⚡'
    case 'high': return '🔥'
  }
}

const getEffortLabel = (level: 'low' | 'medium' | 'high'): string => {
  switch (level) {
    case 'low': return 'Light effort'
    case 'medium': return 'Medium effort'
    case 'high': return 'High effort'
  }
}

export default function Just1ThingHero({
  greeting,
  contextMessage,
  suggestions,
  onShuffle,
  shuffleCount,
  maxShuffles = 3,
}: Just1ThingHeroProps) {
  const router = useRouter()
  const [isShuffling, setIsShuffling] = useState(false)

  // Current suggestion is the first one (after shuffles, API returns new ordering)
  const current = suggestions[0]

  if (!current) {
    // Fallback when no suggestions
    return (
      <div className="just1-hero-card">
        <div className="hero-greeting">
          <h1>{greeting} 👋</h1>
          {contextMessage && <p className="hero-context">{contextMessage}</p>}
        </div>
        <button
          onClick={() => router.push('/focus')}
          className="hero-action-btn"
        >
          <span className="btn-text">Pick something small</span>
          <span className="btn-arrow">→</span>
        </button>
        <style jsx>{styles}</style>
      </div>
    )
  }

  const canShuffle = shuffleCount < maxShuffles
  const shufflesRemaining = maxShuffles - shuffleCount

  const handleShuffle = async () => {
    if (!canShuffle || !onShuffle) return
    setIsShuffling(true)
    onShuffle()
    // Brief animation delay
    setTimeout(() => setIsShuffling(false), 300)
  }

  const handleGo = () => {
    router.push(current.url)
  }

  return (
    <div className="just1-hero-card">
      {/* Greeting */}
      <div className="hero-greeting">
        <h1>{greeting} 👋</h1>
        {contextMessage && <p className="hero-context">{contextMessage}</p>}
      </div>

      {/* Main suggestion card */}
      <div className={`suggestion-card ${isShuffling ? 'shuffling' : ''}`}>
        <div className="suggestion-header">
          <span className="suggestion-label">Your one thing right now</span>
        </div>

        <h2 className="suggestion-title">{current.suggestion}</h2>

        {/* Context row: Goal connection */}
        {current.goalTitle && (
          <div className="context-row goal-row">
            <span className="context-icon">🎯</span>
            <span className="context-text">Part of: {current.goalTitle}</span>
          </div>
        )}

        {/* Context row: Time + Effort */}
        <div className="context-row meta-row">
          <span className="meta-item">
            <span className="context-icon">⏱️</span>
            <span className="context-text">{current.timeEstimate}</span>
          </span>
          <span className="meta-divider">·</span>
          <span className="meta-item">
            <span className="context-icon">{getEffortEmoji(current.effortLevel)}</span>
            <span className="context-text">{getEffortLabel(current.effortLevel)}</span>
          </span>
        </div>

        {/* AI reasoning */}
        <div className="reason-row">
          <span className="reason-icon">💡</span>
          <span className="reason-text">"{current.reason}"</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="action-row">
        <button onClick={handleGo} className="hero-action-btn primary">
          <span className="btn-text">Let's go</span>
          <span className="btn-arrow">→</span>
        </button>

        {onShuffle && (
          <button
            onClick={handleShuffle}
            className={`shuffle-btn ${!canShuffle ? 'disabled' : ''}`}
            disabled={!canShuffle}
            title={canShuffle ? `${shufflesRemaining} shuffle${shufflesRemaining !== 1 ? 's' : ''} left` : 'No more shuffles'}
          >
            <span className="shuffle-icon">🔀</span>
            {canShuffle && (
              <span className="shuffle-count">{shufflesRemaining}</span>
            )}
          </button>
        )}
      </div>

      <style jsx>{styles}</style>
    </div>
  )
}

const styles = `
  .just1-hero-card {
    background: white;
    border-radius: 20px;
    padding: clamp(20px, 5vw, 28px);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
    border: 1px solid #e5e7eb;
    margin-bottom: 16px;
  }

  .hero-greeting {
    margin-bottom: 20px;
  }

  .hero-greeting h1 {
    font-size: clamp(22px, 5.5vw, 28px);
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 4px;
    letter-spacing: -0.5px;
  }

  .hero-context {
    font-size: clamp(14px, 3.5vw, 16px);
    color: #6b7280;
    margin: 0;
  }

  /* Suggestion Card */
  .suggestion-card {
    background: linear-gradient(135deg, rgba(29, 155, 240, 0.06) 0%, rgba(29, 155, 240, 0.02) 100%);
    border: 1px solid rgba(29, 155, 240, 0.15);
    border-radius: 16px;
    padding: clamp(16px, 4vw, 20px);
    margin-bottom: 20px;
    transition: opacity 0.15s ease, transform 0.15s ease;
  }

  .suggestion-card.shuffling {
    opacity: 0.6;
    transform: scale(0.98);
  }

  .suggestion-header {
    margin-bottom: 8px;
  }

  .suggestion-label {
    font-size: 12px;
    font-weight: 600;
    color: #1D9BF0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .suggestion-title {
    font-size: clamp(18px, 4.5vw, 22px);
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 16px;
    line-height: 1.3;
  }

  /* Context rows */
  .context-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }

  .context-icon {
    font-size: 14px;
    flex-shrink: 0;
  }

  .context-text {
    font-size: clamp(13px, 3.5vw, 14px);
    color: #4b5563;
  }

  .goal-row {
    padding: 8px 12px;
    background: rgba(29, 155, 240, 0.08);
    border-radius: 8px;
    margin-bottom: 12px;
  }

  .goal-row .context-text {
    color: #1D9BF0;
    font-weight: 500;
  }

  .meta-row {
    gap: 6px;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .meta-divider {
    color: #9ca3af;
    margin: 0 4px;
  }

  .reason-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 12px;
    background: rgba(0, 0, 0, 0.02);
    border-radius: 8px;
    margin-top: 12px;
  }

  .reason-icon {
    font-size: 14px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .reason-text {
    font-size: clamp(13px, 3.5vw, 14px);
    color: #6b7280;
    font-style: italic;
    line-height: 1.4;
  }

  /* Action buttons */
  .action-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  /* Unified Hero Action Button - matches global .btn-hero-action */
  .hero-action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px 24px;
    background: #1D9BF0;
    color: white;
    border: none;
    border-radius: 14px;
    font-size: 1.1rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(29, 155, 240, 0.3);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    min-height: 56px;
  }

  .hero-action-btn:hover {
    background: #1a8cd8;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(29, 155, 240, 0.4);
  }

  .hero-action-btn:active {
    transform: translateY(0);
    box-shadow: 0 4px 12px rgba(29, 155, 240, 0.3);
  }

  .btn-arrow {
    font-size: 18px;
    transition: transform 0.2s ease;
  }

  .hero-action-btn:hover .btn-arrow {
    transform: translateX(3px);
  }

  .shuffle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    width: 52px;
    height: 52px;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
  }

  .shuffle-btn:hover:not(.disabled) {
    background: #e5e7eb;
    border-color: #d1d5db;
  }

  .shuffle-btn.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .shuffle-icon {
    font-size: 18px;
  }

  .shuffle-count {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #1D9BF0;
    color: white;
    font-size: 11px;
    font-weight: 700;
    width: 18px;
    height: 18px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid white;
  }
`
