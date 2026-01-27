'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Step = 'intro' | 'hold' | 'emotion' | 'breathing' | 'complete'

const emotions = [
  { id: 'frustrated', label: 'Frustrated', icon: '😤', color: '#f97316' },
  { id: 'angry', label: 'Angry', icon: '😠', color: '#ef4444' },
  { id: 'rejected', label: 'Rejected', icon: '💔', color: '#ec4899' },
  { id: 'overwhelmed', label: 'Overwhelmed', icon: '🤯', color: '#8b5cf6' },
  { id: 'anxious', label: 'Anxious', icon: '😰', color: '#6366f1' },
  { id: 'sad', label: 'Sad', icon: '😢', color: '#3b82f6' },
]

export default function BreakOnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('intro')
  const [holdProgress, setHoldProgress] = useState(0)
  const [isHolding, setIsHolding] = useState(false)
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null)
  const [breathPhase, setBreathPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale')
  const [breathCount, setBreathCount] = useState(0)
  
  const holdInterval = useRef<NodeJS.Timeout | null>(null)
  const holdStartTime = useRef<number>(0)
  const HOLD_DURATION = 10000 // 10 seconds

  // Handle hold button
  const startHold = () => {
    setIsHolding(true)
    holdStartTime.current = Date.now()
    
    holdInterval.current = setInterval(() => {
      const elapsed = Date.now() - holdStartTime.current
      const progress = Math.min((elapsed / HOLD_DURATION) * 100, 100)
      setHoldProgress(progress)
      
      if (progress >= 100) {
        completeHold()
      }
    }, 50)
  }

  const stopHold = () => {
    setIsHolding(false)
    if (holdInterval.current) {
      clearInterval(holdInterval.current)
      holdInterval.current = null
    }
    // Reset progress if not complete
    if (holdProgress < 100) {
      setHoldProgress(0)
    }
  }

  const completeHold = () => {
    stopHold()
    setHoldProgress(100)
    // Small delay before moving to next step
    setTimeout(() => {
      setStep('emotion')
    }, 500)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (holdInterval.current) {
        clearInterval(holdInterval.current)
      }
    }
  }, [])

  // Breathing exercise
  useEffect(() => {
    if (step !== 'breathing') return

    const breathingSequence = () => {
      // Inhale for 4 seconds
      setBreathPhase('inhale')
      setTimeout(() => {
        // Hold for 4 seconds
        setBreathPhase('hold')
        setTimeout(() => {
          // Exhale for 4 seconds
          setBreathPhase('exhale')
          setTimeout(() => {
            setBreathCount(prev => {
              const newCount = prev + 1
              if (newCount >= 3) {
                setStep('complete')
              }
              return newCount
            })
          }, 4000)
        }, 4000)
      }, 4000)
    }

    breathingSequence()
    const interval = setInterval(breathingSequence, 12000)

    return () => clearInterval(interval)
  }, [step])

  const handleEmotionSelect = (emotionId: string) => {
    setSelectedEmotion(emotionId)
    setTimeout(() => {
      setStep('breathing')
    }, 300)
  }

  const handleContinue = () => {
    router.push('/onboarding')
  }

  const handleSkipToApp = () => {
    router.push('/dashboard')
  }

  return (
    <div className="break-page">
      {/* Step: Intro */}
      {step === 'intro' && (
        <div className="content centered">
          <div className="icon-circle danger">
            <span>🛑</span>
          </div>
          <h1 className="title">Let's practice BREAK</h1>
          <p className="subtitle">
            When you're feeling overwhelmed, frustrated, or about to react impulsively — 
            this is your emergency brake.
          </p>
          <div className="info-card">
            <p>
              You'll press and hold the button for <strong>10 seconds</strong>. 
              This pause activates your prefrontal cortex and gives you time to respond instead of react.
            </p>
          </div>
          <button onClick={() => setStep('hold')} className="btn-danger">
            I'm ready to try it
          </button>
          <button onClick={handleContinue} className="btn-ghost">
            Skip for now
          </button>
        </div>
      )}

      {/* Step: Hold Button */}
      {step === 'hold' && (
        <div className="content centered">
          <p className="hold-instruction">
            {isHolding 
              ? holdProgress < 100 
                ? 'Keep holding...' 
                : 'Release!'
              : 'Press and hold the button'
            }
          </p>
          
          <div className="hold-container">
            <svg className="hold-ring" viewBox="0 0 200 200">
              {/* Background circle */}
              <circle
                cx="100"
                cy="100"
                r="90"
                fill="none"
                stroke="#fee2e2"
                strokeWidth="8"
              />
              {/* Progress circle */}
              <circle
                cx="100"
                cy="100"
                r="90"
                fill="none"
                stroke="#ef4444"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={565.48}
                strokeDashoffset={565.48 - (565.48 * holdProgress) / 100}
                transform="rotate(-90 100 100)"
                style={{ transition: 'stroke-dashoffset 0.05s linear' }}
              />
            </svg>
            
            <button
              className={`hold-button ${isHolding ? 'holding' : ''} ${holdProgress >= 100 ? 'complete' : ''}`}
              onMouseDown={startHold}
              onMouseUp={stopHold}
              onMouseLeave={stopHold}
              onTouchStart={startHold}
              onTouchEnd={stopHold}
            >
              <span className="hold-emoji">🛑</span>
              <span className="hold-text">
                {holdProgress >= 100 ? '✓' : isHolding ? `${Math.ceil((100 - holdProgress) / 10)}` : 'HOLD'}
              </span>
            </button>
          </div>

          <p className="hold-timer">
            {isHolding 
              ? `${((HOLD_DURATION - (holdProgress / 100) * HOLD_DURATION) / 1000).toFixed(1)}s remaining`
              : holdProgress >= 100 
                ? 'Great job!' 
                : '10 seconds'
            }
          </p>

          {!isHolding && holdProgress < 100 && (
            <p className="hold-hint">
              Tip: Focus on the sensation of pressing. Notice your breathing.
            </p>
          )}
        </div>
      )}

      {/* Step: Emotion Selection */}
      {step === 'emotion' && (
        <div className="content">
          <div className="emotion-header">
            <span className="check-icon">✓</span>
            <h1 className="title">You paused. That's powerful.</h1>
          </div>
          <p className="subtitle">What are you feeling right now?</p>
          
          <div className="emotions-grid">
            {emotions.map((emotion) => (
              <button
                key={emotion.id}
                onClick={() => handleEmotionSelect(emotion.id)}
                className={`emotion-btn ${selectedEmotion === emotion.id ? 'selected' : ''}`}
                style={{ 
                  '--emotion-color': emotion.color,
                  '--emotion-bg': `${emotion.color}15`
                } as React.CSSProperties}
              >
                <span className="emotion-icon">{emotion.icon}</span>
                <span className="emotion-label">{emotion.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step: Breathing Exercise */}
      {step === 'breathing' && (
        <div className="content centered">
          <p className="breath-label">
            {selectedEmotion && emotions.find(e => e.id === selectedEmotion)?.icon} 
            {' '}Feeling {selectedEmotion}
          </p>
          
          <h1 className="title">Let's breathe together</h1>
          
          <div className="breath-container">
            <div className={`breath-circle ${breathPhase}`}>
              <span className="breath-text">
                {breathPhase === 'inhale' && 'Breathe in'}
                {breathPhase === 'hold' && 'Hold'}
                {breathPhase === 'exhale' && 'Breathe out'}
              </span>
            </div>
          </div>

          <div className="breath-progress">
            {[0, 1, 2].map((i) => (
              <div 
                key={i} 
                className={`breath-dot ${i < breathCount ? 'complete' : i === breathCount ? 'active' : ''}`}
              />
            ))}
          </div>

          <p className="breath-count">{breathCount} of 3 breaths</p>
        </div>
      )}

      {/* Step: Complete */}
      {step === 'complete' && (
        <div className="content centered">
          <div className="icon-circle success">
            <span>🌟</span>
          </div>
          <h1 className="title">You did it!</h1>
          <p className="subtitle">
            You just practiced the BREAK technique. Whenever you feel overwhelmed, 
            frustrated, or about to react impulsively — come here.
          </p>
          
          <div className="summary-card">
            <div className="summary-row">
              <span className="summary-icon">⏱️</span>
              <span>Paused for 10 seconds</span>
            </div>
            <div className="summary-row">
              <span className="summary-icon">
                {emotions.find(e => e.id === selectedEmotion)?.icon}
              </span>
              <span>Identified feeling {selectedEmotion}</span>
            </div>
            <div className="summary-row">
              <span className="summary-icon">🌬️</span>
              <span>Completed 3 calming breaths</span>
            </div>
          </div>

          <div className="info-card">
            <p>
              💡 The BREAK button is always available in the top right corner of the app 
              when you need it.
            </p>
          </div>

          <button onClick={handleContinue} className="btn-primary">
            Continue onboarding
          </button>
          <button onClick={handleSkipToApp} className="btn-ghost">
            Skip to app
          </button>
        </div>
      )}

      <style jsx>{styles}</style>
    </div>
  )
}

// ============================================
// RESPONSIVE STYLES
// ============================================
const styles = `
  .break-page {
    --primary: #1D9BF0;
    --success: #00ba7c;
    --warning: #f59e0b;
    --danger: #ef4444;
    --bg-gray: #f7f9fa;
    --dark-gray: #536471;
    --light-gray: #8899a6;
    --extra-light-gray: #eff3f4;
    --text-dark: #0f1419;
    
    background: linear-gradient(180deg, #fef2f2 0%, #fff 50%);
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(16px, 4vw, 24px);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  /* ===== CONTENT ===== */
  .content {
    width: 100%;
    max-width: clamp(320px, 90vw, 440px);
    background: white;
    border-radius: clamp(20px, 5vw, 28px);
    box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    padding: clamp(24px, 6vw, 36px);
  }

  .content.centered {
    text-align: center;
  }

  /* ===== TYPOGRAPHY ===== */
  .title {
    font-size: clamp(20px, 5.5vw, 26px);
    font-weight: 700;
    color: var(--text-dark);
    margin: 0 0 clamp(8px, 2vw, 12px) 0;
    line-height: 1.3;
  }

  .subtitle {
    font-size: clamp(14px, 3.8vw, 16px);
    color: var(--dark-gray);
    margin: 0 0 clamp(20px, 5vw, 28px) 0;
    line-height: 1.6;
  }

  /* ===== ICON CIRCLES ===== */
  .icon-circle {
    width: clamp(56px, 16vw, 76px);
    height: clamp(56px, 16vw, 76px);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto clamp(18px, 5vw, 26px);
  }

  .icon-circle span {
    font-size: clamp(28px, 8vw, 40px);
  }

  .icon-circle.danger { background: #fef2f2; }
  .icon-circle.success { background: #ecfdf5; }

  /* ===== INFO CARD ===== */
  .info-card {
    background: var(--bg-gray);
    border-radius: clamp(12px, 3vw, 16px);
    padding: clamp(14px, 4vw, 20px);
    margin-bottom: clamp(20px, 5vw, 28px);
  }

  .info-card p {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    margin: 0;
    line-height: 1.6;
  }

  .info-card strong {
    color: var(--text-dark);
  }

  /* ===== BUTTONS ===== */
  .btn-primary {
    width: 100%;
    padding: clamp(14px, 4vw, 18px);
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 100px;
    font-size: clamp(15px, 4vw, 17px);
    font-weight: 700;
    cursor: pointer;
    margin-bottom: clamp(10px, 2.5vw, 14px);
  }

  .btn-danger {
    width: 100%;
    padding: clamp(14px, 4vw, 18px);
    background: var(--danger);
    color: white;
    border: none;
    border-radius: 100px;
    font-size: clamp(15px, 4vw, 17px);
    font-weight: 700;
    cursor: pointer;
    margin-bottom: clamp(10px, 2.5vw, 14px);
  }

  .btn-ghost {
    width: 100%;
    padding: clamp(12px, 3.5vw, 16px);
    background: transparent;
    color: var(--dark-gray);
    border: none;
    border-radius: 100px;
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 500;
    cursor: pointer;
  }

  /* ===== HOLD BUTTON ===== */
  .hold-instruction {
    font-size: clamp(16px, 4.5vw, 20px);
    font-weight: 600;
    color: var(--text-dark);
    margin: 0 0 clamp(24px, 6vw, 36px) 0;
  }

  .hold-container {
    position: relative;
    width: clamp(180px, 50vw, 220px);
    height: clamp(180px, 50vw, 220px);
    margin: 0 auto clamp(20px, 5vw, 28px);
  }

  .hold-ring {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  .hold-button {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: clamp(140px, 38vw, 170px);
    height: clamp(140px, 38vw, 170px);
    border-radius: 50%;
    border: none;
    background: linear-gradient(145deg, #ef4444, #dc2626);
    box-shadow: 0 8px 24px rgba(239, 68, 68, 0.4);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(4px, 1vw, 8px);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }

  .hold-button:active,
  .hold-button.holding {
    transform: translate(-50%, -50%) scale(0.95);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.5);
  }

  .hold-button.complete {
    background: linear-gradient(145deg, #22c55e, #16a34a);
    box-shadow: 0 8px 24px rgba(34, 197, 94, 0.4);
  }

  .hold-emoji {
    font-size: clamp(32px, 9vw, 44px);
  }

  .hold-text {
    font-size: clamp(16px, 4.5vw, 20px);
    font-weight: 800;
    color: white;
    letter-spacing: 1px;
  }

  .hold-timer {
    font-size: clamp(14px, 3.8vw, 16px);
    color: var(--dark-gray);
    margin: 0 0 clamp(12px, 3vw, 18px) 0;
  }

  .hold-hint {
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--light-gray);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== EMOTION SELECTION ===== */
  .emotion-header {
    display: flex;
    align-items: center;
    gap: clamp(10px, 3vw, 14px);
    margin-bottom: clamp(6px, 1.5vw, 10px);
  }

  .check-icon {
    width: clamp(28px, 8vw, 36px);
    height: clamp(28px, 8vw, 36px);
    background: var(--success);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: clamp(14px, 4vw, 18px);
    font-weight: 700;
  }

  .emotions-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: clamp(10px, 3vw, 14px);
  }

  .emotion-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(6px, 1.5vw, 10px);
    padding: clamp(16px, 4.5vw, 22px) clamp(12px, 3vw, 16px);
    background: var(--emotion-bg);
    border: 2px solid transparent;
    border-radius: clamp(14px, 4vw, 20px);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .emotion-btn:hover,
  .emotion-btn:active {
    border-color: var(--emotion-color);
    transform: scale(1.02);
  }

  .emotion-btn.selected {
    border-color: var(--emotion-color);
    background: var(--emotion-color);
  }

  .emotion-btn.selected .emotion-label {
    color: white;
  }

  .emotion-icon {
    font-size: clamp(28px, 8vw, 38px);
  }

  .emotion-label {
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 600;
    color: var(--text-dark);
  }

  /* ===== BREATHING EXERCISE ===== */
  .breath-label {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    margin: 0 0 clamp(8px, 2vw, 12px) 0;
  }

  .breath-container {
    margin: clamp(24px, 6vw, 36px) 0;
  }

  .breath-circle {
    width: clamp(160px, 45vw, 200px);
    height: clamp(160px, 45vw, 200px);
    border-radius: 50%;
    background: linear-gradient(145deg, #e0f2fe, #bae6fd);
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 4s ease-in-out, background 0.5s ease;
  }

  .breath-circle.inhale {
    transform: scale(1.2);
    background: linear-gradient(145deg, #dbeafe, #93c5fd);
  }

  .breath-circle.hold {
    transform: scale(1.2);
    background: linear-gradient(145deg, #c7d2fe, #a5b4fc);
  }

  .breath-circle.exhale {
    transform: scale(1);
    background: linear-gradient(145deg, #e0f2fe, #bae6fd);
  }

  .breath-text {
    font-size: clamp(16px, 4.5vw, 20px);
    font-weight: 600;
    color: #1e40af;
  }

  .breath-progress {
    display: flex;
    justify-content: center;
    gap: clamp(10px, 3vw, 14px);
    margin-bottom: clamp(12px, 3vw, 18px);
  }

  .breath-dot {
    width: clamp(10px, 3vw, 14px);
    height: clamp(10px, 3vw, 14px);
    border-radius: 50%;
    background: var(--extra-light-gray);
    transition: all 0.3s ease;
  }

  .breath-dot.active {
    background: var(--primary);
    transform: scale(1.2);
  }

  .breath-dot.complete {
    background: var(--success);
  }

  .breath-count {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    margin: 0;
  }

  /* ===== SUMMARY CARD ===== */
  .summary-card {
    background: #ecfdf5;
    border-radius: clamp(14px, 4vw, 20px);
    padding: clamp(16px, 4.5vw, 22px);
    margin-bottom: clamp(16px, 4vw, 22px);
  }

  .summary-row {
    display: flex;
    align-items: center;
    gap: clamp(10px, 3vw, 14px);
    padding: clamp(8px, 2vw, 12px) 0;
    font-size: clamp(14px, 3.8vw, 16px);
    color: var(--text-dark);
  }

  .summary-row:not(:last-child) {
    border-bottom: 1px solid rgba(0, 186, 124, 0.2);
  }

  .summary-icon {
    font-size: clamp(18px, 5vw, 24px);
  }

  /* ===== TABLET/DESKTOP ===== */
  @media (min-width: 768px) {
    .content {
      padding: 40px;
    }

    .emotions-grid {
      grid-template-columns: repeat(3, 1fr);
    }

    .emotion-btn:hover {
      transform: scale(1.05);
    }
  }

  @media (min-width: 1024px) {
    .content {
      max-width: 480px;
    }
  }
`
