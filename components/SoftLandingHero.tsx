'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import JustSitTimer from './JustSitTimer'
import QuickJournal from './QuickJournal'

interface SoftLandingHeroProps {
  onInteraction?: () => void // Called when user engages with any option
}

export default function SoftLandingHero({ onInteraction }: SoftLandingHeroProps) {
  const router = useRouter()
  const [showTimer, setShowTimer] = useState(false)
  const [showJournal, setShowJournal] = useState(false)

  const handleBreathe = () => {
    onInteraction?.()
    router.push('/brake')
  }

  const handleJustSit = () => {
    setShowTimer(true)
  }

  const handleTimerComplete = () => {
    setShowTimer(false)
    onInteraction?.()
  }

  const handleReachOut = () => {
    onInteraction?.()
    router.push('/village')
  }

  const handleWriteDown = () => {
    setShowJournal(true)
  }

  const handleJournalSave = () => {
    setShowJournal(false)
    onInteraction?.()
  }

  const handleJournalClose = () => {
    setShowJournal(false)
  }

  // Show timer view
  if (showTimer) {
    return (
      <div className="soft-landing-card timer-view">
        <JustSitTimer onComplete={handleTimerComplete} onClose={() => setShowTimer(false)} />
        <style jsx>{styles}</style>
      </div>
    )
  }

  // Show journal view
  if (showJournal) {
    return (
      <div className="soft-landing-card journal-view">
        <QuickJournal onSave={handleJournalSave} onClose={handleJournalClose} />
        <style jsx>{styles}</style>
      </div>
    )
  }

  // Main soft landing view
  return (
    <div className="soft-landing-card">
      <h2 className="soft-landing-title">It's okay to just be here.</h2>
      <p className="soft-landing-subtitle">Pick one, or none. No wrong answer.</p>

      <div className="options-grid">
        <button className="option-btn" onClick={handleBreathe}>
          <span className="option-icon">🤲</span>
          <span className="option-label">Breathe with me</span>
        </button>

        <button className="option-btn" onClick={handleJustSit}>
          <span className="option-icon">🌊</span>
          <span className="option-label">Just sit</span>
          <span className="option-detail">(2 min)</span>
        </button>

        <button className="option-btn" onClick={handleReachOut}>
          <span className="option-icon">👥</span>
          <span className="option-label">Reach out</span>
        </button>

        <button className="option-btn" onClick={handleWriteDown}>
          <span className="option-icon">✏️</span>
          <span className="option-label">Write it down</span>
        </button>
      </div>

      <div className="permission-text">
        <span className="divider" />
        <p>Or just close the app. We'll be here when you're ready.</p>
      </div>

      <style jsx>{styles}</style>
    </div>
  )
}

const styles = `
  .soft-landing-card {
    background: white;
    border-radius: clamp(16px, 4vw, 24px);
    padding: clamp(24px, 6vw, 32px);
    text-align: center;
    animation: fadeSlideIn 0.6s ease-out;
  }

  @keyframes fadeSlideIn {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .soft-landing-card.timer-view,
  .soft-landing-card.journal-view {
    min-height: clamp(280px, 70vw, 360px);
    display: flex;
    flex-direction: column;
  }

  .soft-landing-title {
    font-size: clamp(22px, 5.5vw, 28px);
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 clamp(8px, 2vw, 12px) 0;
    line-height: 1.3;
  }

  .soft-landing-subtitle {
    font-size: clamp(14px, 3.5vw, 16px);
    color: #6b7280;
    margin: 0 0 clamp(24px, 6vw, 32px) 0;
    line-height: 1.5;
  }

  .options-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: clamp(12px, 3vw, 16px);
    margin-bottom: clamp(24px, 6vw, 32px);
  }

  .option-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(8px, 2vw, 10px);
    padding: clamp(20px, 5vw, 28px) clamp(12px, 3vw, 16px);
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.06) 0%, rgba(99, 102, 241, 0.04) 100%);
    border: 1.5px solid rgba(139, 92, 246, 0.15);
    border-radius: clamp(14px, 3.5vw, 18px);
    cursor: pointer;
    transition: all 0.25s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .option-btn:hover {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(99, 102, 241, 0.08) 100%);
    border-color: rgba(139, 92, 246, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(139, 92, 246, 0.15);
  }

  .option-btn:active {
    transform: translateY(0);
  }

  .option-icon {
    font-size: clamp(28px, 7vw, 36px);
    line-height: 1;
  }

  .option-label {
    font-size: clamp(14px, 3.5vw, 16px);
    font-weight: 600;
    color: #374151;
  }

  .option-detail {
    font-size: clamp(12px, 3vw, 13px);
    color: #9ca3af;
    margin-top: -4px;
  }

  .permission-text {
    padding-top: clamp(16px, 4vw, 20px);
  }

  .divider {
    display: block;
    width: 60px;
    height: 1px;
    background: #e5e7eb;
    margin: 0 auto clamp(12px, 3vw, 16px);
  }

  .permission-text p {
    font-size: clamp(13px, 3.2vw, 14px);
    color: #9ca3af;
    margin: 0;
    line-height: 1.5;
    font-style: italic;
  }

  /* Responsive: Stack vertically on very small screens */
  @media (max-width: 340px) {
    .options-grid {
      grid-template-columns: 1fr;
    }

    .option-btn {
      flex-direction: row;
      justify-content: flex-start;
      gap: clamp(12px, 3vw, 16px);
      padding: clamp(16px, 4vw, 20px);
    }

    .option-detail {
      margin-top: 0;
      margin-left: 4px;
    }
  }
`
