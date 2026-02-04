'use client'

import { useRouter } from 'next/navigation'
interface SummaryScreenProps {
  energyLevel: number | null
  moodScore: number | null
  currentStreak: number
  userMode: 'recovery' | 'maintenance' | 'growth'
}

export default function SummaryScreen({
  userMode,
  moodScore,
}: SummaryScreenProps) {
  const router = useRouter()

  const getModeAction = (): { label: string; path: string; subtitle: string; bgClass: string } => {
    switch (userMode) {
      case 'recovery':
        return {
          label: '🌱 Try One Tiny Thing',
          subtitle: 'Low-energy mode — we kept it gentle.',
          path: '/focus?mode=gentle&energy=low',
          bgClass: 'recovery',
        }
      case 'growth':
        return {
          label: '⚡ Start Focus Session',
          subtitle: 'Channel this momentum before it fades.',
          path: '/focus?mode=sprint&energy=high',
          bgClass: 'growth',
        }
      default:
        return {
          label: '✓ Back to Dashboard',
          subtitle: 'Nice check-in. Your dashboard is ready.',
          path: '/dashboard',
          bgClass: 'maintenance',
        }
    }
  }

  const action = getModeAction()

  // Show breathing suggestion for low mood or recovery mode
  const suggestBreathing = userMode === 'recovery' || (moodScore !== null && moodScore <= 4)

  return (
    <div className={`summary-screen ${action.bgClass}`}>
      <div className="summary-content">
        <div className="celebration">
          <div className="checkmark">✓</div>
          <h2 className="summary-title">Check-in Complete!</h2>
          <p className="summary-subtitle">{action.subtitle}</p>
        </div>

        <button
          onClick={() => router.push(action.path)}
          className={`hero-action-btn ${action.bgClass}`}
        >
          {action.label}
        </button>

        {/* Breathing as suggested next step (not a blocker) */}
        {suggestBreathing && (
          <button
            onClick={() => router.push('/brake')}
            className="breathe-suggestion"
          >
            <span className="breathe-icon">🫁</span>
            <span className="breathe-text">Take a 10s breath first?</span>
          </button>
        )}

        {action.path !== '/dashboard' && (
          <button
            onClick={() => router.push('/dashboard')}
            className="skip-link"
          >
            Skip to Dashboard
          </button>
        )}
      </div>

      <style jsx>{`
        .summary-screen {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(20px, 5vw, 32px);
        }

        .summary-screen.maintenance {
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
        }

        .summary-screen.growth {
          background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
        }

        .summary-screen.recovery {
          background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%);
        }

        .summary-content {
          max-width: 480px;
          width: 100%;
          text-align: center;
        }

        .celebration {
          margin-bottom: clamp(40px, 10vw, 64px);
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
          0% { transform: scale(0); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }

        .summary-title {
          font-size: clamp(24px, 6.5vw, 32px);
          font-weight: 700;
          color: #0f1419;
          margin: 0 0 clamp(6px, 1.5vw, 10px) 0;
        }

        .summary-subtitle {
          font-size: clamp(14px, 3.8vw, 17px);
          color: #536471;
          margin: 0;
          line-height: 1.5;
        }

        .hero-action-btn {
          display: block;
          width: 100%;
          border: none;
          border-radius: clamp(14px, 4vw, 22px);
          padding: clamp(20px, 5.5vw, 28px);
          font-size: clamp(18px, 5vw, 22px);
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          animation: heroSlideUp 0.5s ease-out 0.3s backwards;
        }

        .hero-action-btn.growth {
          background: linear-gradient(135deg, #00ba7c 0%, #059669 100%);
          color: white;
          box-shadow: 0 6px 24px rgba(0, 186, 124, 0.35);
        }

        .hero-action-btn.recovery {
          background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
          color: white;
          box-shadow: 0 6px 24px rgba(139, 92, 246, 0.35);
        }

        .hero-action-btn.maintenance {
          background: #0f1419;
          color: white;
          box-shadow: 0 6px 24px rgba(0, 0, 0, 0.2);
        }

        .hero-action-btn:hover {
          transform: translateY(-2px);
        }

        .hero-action-btn:active {
          transform: translateY(0);
        }

        @keyframes heroSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .skip-link {
          display: block;
          margin-top: clamp(16px, 4vw, 24px);
          background: none;
          border: none;
          color: #8899a6;
          font-size: clamp(14px, 3.8vw, 16px);
          font-weight: 500;
          cursor: pointer;
          padding: clamp(8px, 2vw, 12px);
          transition: color 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          width: 100%;
          text-align: center;
        }

        .skip-link:hover {
          color: #536471;
        }

        .breathe-suggestion {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: clamp(8px, 2vw, 12px);
          width: 100%;
          margin-top: clamp(14px, 3.5vw, 18px);
          padding: clamp(14px, 3.5vw, 18px);
          background: white;
          border: 2px dashed rgba(0, 0, 0, 0.15);
          border-radius: clamp(12px, 3vw, 16px);
          cursor: pointer;
          transition: border-color 0.2s ease, background 0.2s ease, transform 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          animation: heroSlideUp 0.5s ease-out 0.5s backwards;
        }

        .breathe-suggestion:hover {
          border-color: #1D9BF0;
          background: rgba(29, 155, 240, 0.04);
          transform: translateY(-1px);
        }

        .breathe-icon {
          font-size: clamp(20px, 5vw, 24px);
        }

        .breathe-text {
          font-size: clamp(14px, 3.8vw, 16px);
          font-weight: 600;
          color: #536471;
        }

        .breathe-suggestion:hover .breathe-text {
          color: #1D9BF0;
        }
      `}</style>
    </div>
  )
}
