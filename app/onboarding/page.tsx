This is a great foundation. The logic is solid, but the narrative currently feels a bit like a standard "form filling" exercise. For an ADHD audience, we need to minimize the "chore" factor and maximize the dopamine/engagement factor.

Here is the updated code. I have kept the logic identical but overhauled the copy to be:

1. **More conversational** (breaking down the "wall" between app and user).
2. **Validation-focused** (making the user feel seen immediately).
3. **UK English compliant** (as requested in your preferences).
4. **Momentum-driven** (explaining *why* we need data like emails/passwords to reduce friction).

Here is the updated `OnboardingPage` component:

```javascript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Form data
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mood, setMood] = useState(5)
  const [moodNote, setMoodNote] = useState('')
  const [coachAdvice, setCoachAdvice] = useState('')

  const totalSteps = 11

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1)
    }
  }

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1)
    }
  }

  const handleRegister = async () => {
    if (!email || !password || !name) {
      setError('Please fill in all fields')
      return
    }
    
    setIsLoading(true)
    setError('')
    
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
          }
        }
      })
      
      if (signUpError) throw signUpError
      
      handleNext()
    } catch (err: any) {
      setError(err.message || 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMoodSubmit = async () => {
    setIsLoading(true)
    
    try {
      // Get coach advice
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moodScore: mood, note: moodNote }),
      })
      
      const data = await response.json()
      setCoachAdvice(data.advice)
      
      // Save mood entry
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        await supabase.from('mood_entries').insert({
          user_id: user.id,
          mood_score: mood,
          note: moodNote,
          coach_advice: data.advice,
        })
      }
      
      handleNext()
    } catch (err) {
      console.error('Error:', err)
      handleNext()
    } finally {
      setIsLoading(false)
    }
  }

  const handleFinish = () => {
    router.push('/dashboard')
  }

  const renderStep = () => {
    switch (step) {
      // Step 0: Welcome - First time user?
      case 0:
        return (
          <div className="step-content centered">
            <div className="icon-circle primary">
              <span>🧠</span>
            </div>
            <h1 className="title">Welcome to ADHDer.io</h1>
            <p className="subtitle">Ready to find a system that actually works with your brain, not against it?</p>
            <div className="button-stack">
              <button onClick={handleNext} className="btn-primary">
                Yes, let's get started
              </button>
              <button onClick={() => router.push('/login')} className="btn-secondary">
                I already have an account
              </button>
            </div>
          </div>
        )

      // Step 1: Meet Der, get name
      case 1:
        return (
          <div className="step-content">
            <h1 className="title">Hi! I'm Der, your pocket coach.</h1>
            <p className="subtitle">
              It's short for <span className="text-primary font-bold">ADHD-er</span>. (I know, terrible pun, but stick with me! 😄)
            </p>
            <p className="subtitle">What should I call you?</p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name or nickname"
              className="text-input"
              autoFocus
            />
            <button onClick={handleNext} disabled={!name.trim()} className="btn-primary">
              Nice to meet you
            </button>
          </div>
        )

      // Step 2: Get email
      case 2:
        return (
          <div className="step-content">
            <h1 className="title">Hi {name}, let's keep this safe.</h1>
            <p className="subtitle">We're going to build a personal journal of your patterns. Where should I send your daily summary?</p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="text-input"
              autoFocus
            />
            <button onClick={handleNext} disabled={!email.trim()} className="btn-primary">
              Continue
            </button>
          </div>
        )

      // Step 3: Create password & register
      case 3:
        return (
          <div className="step-content">
            <h1 className="title">Last boring bit, I promise.</h1>
            <p className="subtitle">Set a password so you can access your insights on other devices.</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a secure password"
              className="text-input"
              autoFocus
            />
            {error && <p className="error-text">{error}</p>}
            <button 
              onClick={handleRegister} 
              disabled={!password.trim() || isLoading} 
              className="btn-primary"
            >
              {isLoading ? 'Creating your space...' : 'Secure my account'}
            </button>
          </div>
        )

      // Step 4: Der's story
      case 4:
        return (
          <div className="step-content centered">
            <div className="avatar-photo">
              <img src="/der.png" alt="Der" />
            </div>
            <h1 className="title">Why am I here?</h1>
            <div className="prose">
              <p>
                I was diagnosed in my 30s. Suddenly my whole life made sense, but I still felt lost. I tried the planners, the apps, the "just try harder" method.
              </p>
              <p className="text-dark">
                <strong>None of it stuck.</strong>
              </p>
              <p>
                That's why I built this. We aren't going to try to "fix" you with expensive systems or new gym memberships.
              </p>
              <p>
                We're going to build systems that work for <strong>your</strong> brain, right where you are today.
              </p>
            </div>
            <button onClick={handleNext} className="btn-primary">
              That sounds like what I need
            </button>
          </div>
        )

      // Step 5: First check-in (mood + note)
      case 5:
        return (
          <div className="step-content">
            <h1 className="title">Let's try a check-in</h1>
            <p className="subtitle">
              We track mood to find patterns. How is your brain feeling right this second?
            </p>
            
            <div className="mood-slider-container">
              <div className="mood-slider-labels">
                <span>Overwhelmed</span>
                <span className="mood-value">{mood}</span>
                <span>Thriving</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={mood}
                onChange={(e) => setMood(parseInt(e.target.value))}
                className="mood-slider"
              />
            </div>

            <p className="subtitle">Quick brain dump: What's on your mind? (Don't overthink it).</p>
            <textarea
              value={moodNote}
              onChange={(e) => setMoodNote(e.target.value)}
              placeholder="I'm feeling..."
              rows={3}
              className="text-input textarea"
            />
            
            <button onClick={handleMoodSubmit} disabled={isLoading} className="btn-primary">
              {isLoading ? 'Analysing...' : 'Complete Check-in'}
            </button>
          </div>
        )

      // Step 6: Show coach advice
      case 6:
        return (
          <div className="step-content">
            <h1 className="title">My thoughts...</h1>
            <div className="advice-card">
              <p>
                {coachAdvice || "Thanks for sharing. Acknowledging where you are is the first step to navigating it."}
              </p>
            </div>
            <div className="prose">
              <p>
                This is how we'll work together. You check in, and I'll help you spot the patterns you might miss while you're in the thick of it.
              </p>
              <p className="text-dark">
                 Remember: <strong>You are in the driving seat.</strong>
              </p>
              <p>
                I'm just the navigator holding the map so you can keep your eyes on the road.
              </p>
            </div>
            <button onClick={handleNext} className="btn-primary">
              Makes sense
            </button>
          </div>
        )

      // Step 7: Other tools intro
      case 7:
        return (
          <div className="step-content">
            <h1 className="title">Your Toolkit</h1>
            <p className="subtitle">
              Pattern recognition is great, but sometimes you need immediate help. 
            </p>
            <div className="info-card">
              <p>
                💡 The menu button will always hold your full toolkit, but there is one tool I need to show you immediately.
              </p>
            </div>
            <p className="text-dark lead">
              It's called <span className="text-danger font-bold">BREAK</span>.
            </p>
            <button onClick={handleNext} className="btn-primary">
              Show me BREAK
            </button>
          </div>
        )

      // Step 8: BREAK explanation
      case 8:
        return (
          <div className="step-content">
            <div className="icon-circle danger">
              <span>🛑</span>
            </div>
            <h1 className="title">For when the noise gets too loud</h1>
            <div className="prose">
              <p>
                You know that feeling? The supermarket is too bright, someone asks you a simple question and you snap, then you feel guilty, which makes you snappier?
              </p>
              <p className="text-dark"><strong>That is the red zone.</strong></p>
            </div>
            <div className="warning-card">
              <p>
                When you feel this, hit the <strong>BREAK</strong> button. It helps you pause for just 10 seconds to reset your regulation.
              </p>
            </div>
            <p className="subtitle">
              Because ADHD isn't just about "focus"—it's usually about <strong className="text-dark">emotional dysregulation</strong>.
            </p>
            <button onClick={handleNext} className="btn-primary">
              Dysregulation?
            </button>
          </div>
        )

      // Step 9: Dysregulation explanation
      case 9:
        return (
          <div className="step-content">
            <div className="icon-circle primary">
              <span>💙</span>
            </div>
            <h1 className="title">It's not a character flaw</h1>
            <div className="prose">
              <p>
                Dysregulation affects your attention, sleep, food, and energy. It's like having a Ferrari engine with bicycle brakes.
              </p>
              <p>
                <strong>I need you to hear this: It is not your fault.</strong>
              </p>
              <p>
                You likely didn't grow up with people who knew how to teach you to drive a Ferrari. But we can learn now.
              </p>
            </div>
            <div className="info-card primary">
              <p>
                🧬 Your brain is wired differently. We work <em>with</em> that wiring, not against it.
              </p>
            </div>
            <button onClick={handleNext} className="btn-primary">
              I'm listening
            </button>
          </div>
        )

      // Step 10: Energy levels & burnout
      case 10:
        return (
          <div className="step-content">
            <div className="icon-circle warning">
              <span>🔋</span>
            </div>
            <h1 className="title">Protecting your battery</h1>
            <div className="prose">
              <p>
                ADHDers often run on an "all or nothing" energy setting. Hyperfocus or exhaustion.
              </p>
              <p>
                We often rely on <strong className="text-dark">stress and anxiety</strong> to force us into action. It works, until it doesn't. That's the fast track to burnout.
              </p>
            </div>
            <div className="warning-card orange">
              <p>
                ⚡ I'm going to help you track your energy alongside your mood. The goal is to keep you out of the burnout zone.
              </p>
            </div>
            <p className="text-dark lead"><strong>Nothing is more important than taking care of yourself. Shall we begin?</strong></p>
            <button onClick={handleFinish} className="btn-primary">
              Let's go! →
            </button>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="onboarding-page">
      {/* Progress bar */}
      {step > 0 && (
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${(step / (totalSteps - 1)) * 100}%` }} />
        </div>
      )}

      {/* Header with back button */}
      {step > 0 && step < 4 && (
        <header className="header">
          <button onClick={handleBack} className="back-btn">
            ←
          </button>
          <span className="header-title">Sign up</span>
          <div className="header-spacer" />
        </header>
      )}

      {/* Main content */}
      <main className="main">
        <div className="card">
          {renderStep()}
        </div>
      </main>

      {/* Step indicator */}
      {step > 0 && (
        <div className="step-indicator">
          <span>{step} of {totalSteps - 1}</span>
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
  .onboarding-page {
    --primary: #1D9BF0;
    --success: #00ba7c;
    --warning: #f59e0b;
    --danger: #f4212e;
    --bg-gray: #f7f9fa;
    --dark-gray: #536471;
    --light-gray: #8899a6;
    --extra-light-gray: #eff3f4;
    --text-dark: #0f1419;
    
    background: var(--bg-gray);
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  /* ===== PROGRESS BAR ===== */
  .progress-bar-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: clamp(3px, 0.8vw, 5px);
    background: var(--extra-light-gray);
    z-index: 50;
  }

  .progress-bar-fill {
    height: 100%;
    background: var(--primary);
    transition: width 0.3s ease;
  }

  /* ===== HEADER ===== */
  .header {
    position: sticky;
    top: 0;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--extra-light-gray);
    padding: clamp(10px, 2.5vw, 14px) clamp(12px, 4vw, 20px);
    display: flex;
    align-items: center;
    z-index: 40;
  }

  .back-btn {
    width: clamp(36px, 9vw, 44px);
    height: clamp(36px, 9vw, 44px);
    border-radius: 50%;
    border: none;
    background: none;
    cursor: pointer;
    font-size: clamp(18px, 5vw, 24px);
    color: var(--text-dark);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .back-btn:hover {
    background: var(--extra-light-gray);
  }

  .header-title {
    margin-left: clamp(12px, 3vw, 20px);
    font-size: clamp(15px, 4vw, 18px);
    font-weight: 700;
    color: var(--text-dark);
  }

  .header-spacer {
    width: clamp(36px, 9vw, 44px);
  }

  /* ===== MAIN ===== */
  .main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(16px, 4vw, 24px);
    padding-bottom: clamp(60px, 15vw, 80px);
  }

  .card {
    width: 100%;
    max-width: clamp(320px, 90vw, 480px);
    background: white;
    border-radius: clamp(16px, 4vw, 24px);
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    border: 1px solid var(--extra-light-gray);
    padding: clamp(20px, 5vw, 32px);
  }

  /* ===== STEP CONTENT ===== */
  .step-content {
    /* container */
  }

  .step-content.centered {
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
    margin: 0 0 clamp(16px, 4vw, 24px) 0;
    line-height: 1.5;
  }

  .prose {
    margin-bottom: clamp(16px, 4vw, 24px);
  }

  .prose p {
    font-size: clamp(14px, 3.8vw, 16px);
    color: var(--dark-gray);
    margin: 0 0 clamp(12px, 3vw, 16px) 0;
    line-height: 1.6;
  }

  .prose p:last-child {
    margin-bottom: 0;
  }

  .lead {
    font-size: clamp(14px, 3.8vw, 16px);
    margin-bottom: clamp(16px, 4vw, 24px);
  }

  .text-primary { color: var(--primary); }
  .text-dark { color: var(--text-dark); }
  .text-danger { color: var(--danger); }
  .text-warning { color: var(--warning); }
  .font-bold { font-weight: 700; }

  /* ===== ICON CIRCLES ===== */
  .icon-circle {
    width: clamp(48px, 14vw, 68px);
    height: clamp(48px, 14vw, 68px);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: clamp(16px, 4vw, 24px);
  }

  .step-content.centered .icon-circle {
    margin-left: auto;
    margin-right: auto;
  }

  .icon-circle span {
    font-size: clamp(24px, 7vw, 36px);
  }

  .icon-circle.primary { background: var(--primary); }
  .icon-circle.danger { background: var(--danger); }
  .icon-circle.warning { background: var(--warning); }

  /* ===== AVATAR PHOTO ===== */
  .avatar-photo {
    width: clamp(80px, 22vw, 110px);
    height: clamp(80px, 22vw, 110px);
    border-radius: 50%;
    overflow: hidden;
    margin: 0 auto clamp(16px, 4vw, 24px);
    border: 3px solid var(--primary);
    box-shadow: 0 4px 12px rgba(29, 155, 240, 0.2);
  }

  .avatar-photo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* ===== INPUTS ===== */
  .text-input {
    width: 100%;
    padding: clamp(12px, 3vw, 16px);
    border: 1px solid var(--extra-light-gray);
    border-radius: clamp(10px, 2.5vw, 14px);
    font-size: clamp(14px, 3.8vw, 16px);
    font-family: inherit;
    color: var(--text-dark);
    margin-bottom: clamp(16px, 4vw, 24px);
    box-sizing: border-box;
    transition: border-color 0.2s ease;
  }

  .text-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(29, 155, 240, 0.1);
  }

  .text-input::placeholder {
    color: var(--dark-gray);
  }

  .text-input.textarea {
    resize: none;
    min-height: clamp(80px, 20vw, 100px);
  }

  .error-text {
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--danger);
    margin: clamp(-12px, -3vw, -16px) 0 clamp(16px, 4vw, 24px) 0;
  }

  /* ===== MOOD SLIDER ===== */
  .mood-slider-container {
    margin-bottom: clamp(20px, 5vw, 28px);
  }

  .mood-slider-labels {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: clamp(8px, 2vw, 12px);
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--dark-gray);
  }

  .mood-value {
    font-size: clamp(20px, 5.5vw, 26px);
    font-weight: 700;
    color: var(--primary);
  }

  .mood-slider {
    width: 100%;
    height: clamp(6px, 1.5vw, 8px);
    border-radius: 100px;
    appearance: none;
    -webkit-appearance: none;
    background: var(--extra-light-gray);
    cursor: pointer;
  }

  .mood-slider::-webkit-slider-thumb {
    appearance: none;
    -webkit-appearance: none;
    width: clamp(22px, 6vw, 28px);
    height: clamp(22px, 6vw, 28px);
    border-radius: 50%;
    background: var(--primary);
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  }

  .mood-slider::-moz-range-thumb {
    width: clamp(22px, 6vw, 28px);
    height: clamp(22px, 6vw, 28px);
    border-radius: 50%;
    background: var(--primary);
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  }

  /* ===== BUTTONS ===== */
  .btn-primary {
    width: 100%;
    padding: clamp(12px, 3.5vw, 16px);
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 100px;
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .btn-primary:hover {
    background: #1a8cd8;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    width: 100%;
    padding: clamp(12px, 3.5vw, 16px);
    background: white;
    color: var(--text-dark);
    border: 1px solid var(--extra-light-gray);
    border-radius: 100px;
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .btn-secondary:hover {
    background: var(--bg-gray);
  }

  .button-stack {
    display: flex;
    flex-direction: column;
    gap: clamp(10px, 3vw, 14px);
  }

  /* ===== CARDS ===== */
  .advice-card {
    background: var(--bg-gray);
    border: 1px solid var(--extra-light-gray);
    border-radius: clamp(14px, 4vw, 20px);
    padding: clamp(14px, 4vw, 20px);
    margin-bottom: clamp(16px, 4vw, 24px);
  }

  .advice-card p {
    font-size: clamp(14px, 3.8vw, 16px);
    color: var(--text-dark);
    margin: 0;
    line-height: 1.5;
  }

  .info-card {
    background: var(--bg-gray);
    border: 1px solid var(--extra-light-gray);
    border-radius: clamp(14px, 4vw, 20px);
    padding: clamp(12px, 3.5vw, 18px);
    margin-bottom: clamp(16px, 4vw, 24px);
  }

  .info-card.primary {
    background: rgba(29, 155, 240, 0.08);
    border-color: rgba(29, 155, 240, 0.2);
  }

  .info-card.primary p {
    color: var(--primary);
    font-weight: 500;
  }

  .info-card p {
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--dark-gray);
    margin: 0;
    line-height: 1.5;
  }

  .warning-card {
    background: rgba(244, 33, 46, 0.08);
    border: 1px solid rgba(244, 33, 46, 0.2);
    border-radius: clamp(14px, 4vw, 20px);
    padding: clamp(12px, 3.5vw, 18px);
    margin-bottom: clamp(16px, 4vw, 24px);
  }

  .warning-card p {
    font-size: clamp(12px, 3.2vw, 14px);
    color: #991b1b;
    margin: 0;
    line-height: 1.5;
  }

  .warning-card.orange {
    background: rgba(249, 115, 22, 0.08);
    border-color: rgba(249, 115, 22, 0.3);
  }

  .warning-card.orange p {
    color: #c2410c;
  }

  /* ===== STEP INDICATOR ===== */
  .step-indicator {
    position: fixed;
    bottom: clamp(16px, 4vw, 24px);
    left: 50%;
    transform: translateX(-50%);
  }

  .step-indicator span {
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--dark-gray);
    background: white;
    padding: clamp(6px, 1.5vw, 8px) clamp(12px, 3vw, 16px);
    border-radius: 100px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    border: 1px solid var(--extra-light-gray);
  }

  /* ===== TABLET/DESKTOP ===== */
  @media (min-width: 768px) {
    .main {
      padding: 32px;
    }

    .card {
      max-width: 480px;
      padding: 36px;
    }

    .btn-primary:hover,
    .btn-secondary:hover {
      transform: translateY(-1px);
    }
  }

  @media (min-width: 1024px) {
    .card {
      max-width: 520px;
      padding: 40px;
    }
  }
`