'use client'

import { useRouter } from 'next/navigation'
import { getEnergyEmoji, getEnergyLabel } from '@/lib/gamification'

interface SummaryScreenProps {
  energyLevel: number | null
  moodScore: number | null
  currentStreak: number
  userMode: 'recovery' | 'maintenance' | 'growth'
}

const getMoodEmoji = (score: number): string => {
  if (score <= 2) return '😢'
  if (score <= 4) return '😔'
  if (score <= 6) return '😐'
  if (score <= 8) return '🙂'
  return '😄'
}

export default function SummaryScreen({
  energyLevel,
  moodScore,
  currentStreak,
  userMode
}: SummaryScreenProps) {
  const router = useRouter()

  const getModeAction = () => {
    switch (userMode) {
      case 'recovery':
        return {
          label: '🛑 Take a BREAK',
          path: '/brake'
        }
      case 'growth':
        return {
          label: '⏱️ Start Focus Session',
          path: '/focus'
        }
      default:
        return {
          label: '✓ Done for today',
          path: '/dashboard'
        }
    }
  }

  const action = getModeAction()

  return (
    <div className="summary-screen">
      <div className="summary-content">
        <div className="celebration">
          <div className="checkmark">✓</div>
          <h2 className="summary-title">Check-in Complete!</h2>
        </div>

        <div className="summary-cards">
          {/* Energy card */}
          {energyLevel !== null && (
            <div className="summary-card">
              <div className="card-label">Energy</div>
              <div className="card-value">
                <span className="card-emoji">{getEnergyEmoji(energyLevel)}</span>
                <span className="card-text">{getEnergyLabel(energyLevel)}</span>
              </div>
            </div>
          )}

          {/* Mood card */}
          {moodScore !== null && (
            <div className="summary-card">
              <div className="card-label">Mood</div>
              <div className="card-value">
                <span className="card-emoji">{getMoodEmoji(moodScore)}</span>
                <span className="card-text">{moodScore}/10</span>
              </div>
            </div>
          )}

          {/* Streak card */}
          {currentStreak > 0 && (
            <div className="summary-card">
              <div className="card-label">Streak</div>
              <div className="card-value">
                <span className="card-emoji">🔥</span>
                <span className="card-text">{currentStreak} days</span>
              </div>
            </div>
          )}
        </div>

        <div className="action-buttons">
          <button
            onClick={() => router.push(action.path)}
            className="action-btn primary"
          >
            {action.label}
          </button>

          {action.path !== '/dashboard' && (
            <button
              onClick={() => router.push('/dashboard')}
              className="action-btn secondary"
            >
              Back to Dashboard
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .summary-screen {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(20px, 5vw, 32px);
          background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
        }

        .summary-content {
          max-width: 600px;
          width: 100%;
        }

        .celebration {
          text-align: center;
          margin-bottom: clamp(32px, 8vw, 48px);
        }

        .checkmark {
          width: clamp(80px, 20vw, 120px);
          height: clamp(80px, 20vw, 120px);
          border-radius: 50%;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: clamp(40px, 10vw, 60px);
          margin: 0 auto clamp(16px, 4vw, 24px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
          animation: checkmarkPop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @keyframes checkmarkPop {
          0% {
            transform: scale(0);
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
          }
        }

        .summary-title {
          font-size: clamp(24px, 6.5vw, 32px);
          font-weight: 700;
          color: #0f1419;
          margin: 0;
        }

        .summary-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: clamp(12px, 3vw, 16px);
          margin-bottom: clamp(32px, 8vw, 48px);
        }

        .summary-card {
          background: white;
          border-radius: clamp(12px, 3vw, 16px);
          padding: clamp(16px, 4vw, 24px);
          text-align: center;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
          animation: cardSlideUp 0.5s ease-out backwards;
        }

        .summary-card:nth-child(1) {
          animation-delay: 0.1s;
        }

        .summary-card:nth-child(2) {
          animation-delay: 0.2s;
        }

        .summary-card:nth-child(3) {
          animation-delay: 0.3s;
        }

        @keyframes cardSlideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .card-label {
          font-size: clamp(11px, 3vw, 13px);
          color: #8899a6;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: clamp(8px, 2vw, 12px);
        }

        .card-value {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: clamp(6px, 1.5vw, 8px);
        }

        .card-emoji {
          font-size: clamp(28px, 7vw, 36px);
        }

        .card-text {
          font-size: clamp(14px, 3.8vw, 16px);
          font-weight: 700;
          color: #0f1419;
        }

        .action-buttons {
          display: flex;
          flex-direction: column;
          gap: clamp(12px, 3vw, 16px);
        }

        .action-btn {
          border: none;
          border-radius: clamp(10px, 2.5vw, 14px);
          padding: clamp(14px, 4vw, 18px);
          font-size: clamp(15px, 4vw, 17px);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .action-btn.primary {
          background: #0f1419;
          color: white;
        }

        .action-btn.primary:hover {
          background: #2d3748;
        }

        .action-btn.secondary {
          background: white;
          color: #536471;
          border: 2px solid #e5e7eb;
        }

        .action-btn.secondary:hover {
          background: #f7f9fa;
        }

        .action-btn:active {
          transform: scale(0.98);
        }
      `}</style>
    </div>
  )
}
