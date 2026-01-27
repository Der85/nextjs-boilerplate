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
            <p className="subtitle">Is this your first time here?</p>
            <div className="button-stack">
              <button onClick={handleNext} className="btn-primary">
                Yes, I'm new here
              </button>
              <button onClick={() => router.push('/login')} className="btn-secondary">
                No, take me to login
              </button>
            </div>
          </div>
        )

      // Step 1: Meet Der, get name
      case 1:
        return (
          <div className="step-content">
            <h1 className="title">Hello! I'm Der, your ADHD coach.</h1>
            <p className="subtitle">
              It's <span className="text-primary font-bold">ADH<span className="underline">Der</span></span>, get it? 😄
            </p>
            <p className="subtitle">What's your name?</p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="text-input"
              autoFocus
            />
            <button onClick={handleNext} disabled={!name.trim()} className="btn-primary">
              Continue
            </button>
          </div>
        )

      // Step 2: Get email
      case 2:
        return (
          <div className="step-content">
            <h1 className="title">Hi {name}, great to meet you!</h1>
            <p className="subtitle">What's your email?</p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
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
            <h1 className="title">Great! Now create a password</h1>
            <p className="subtitle">So you can log back in later.</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              className="text-input"
              autoFocus
            />
            {error && <p className="error-text">{error}</p>}
            <button 
              onClick={handleRegister} 
              disabled={!password.trim() || isLoading} 
              className="btn-primary"
            >
              {isLoading ? 'Creating account...' : 'Create Account'}
            </button>
          </div>
        )

      // Step 4: Der's story
      case 4:
        return (
          <div className="step-content">
            <h1 className="title">A bit about me...</h1>
            <div className="prose">
              <p>
                I was only diagnosed with ADHD in my 30s. Suddenly so much made sense, and at the same time there still feels like there's so much to figure out.
              </p>
              <p>
                That's why I'm here — to build <strong>systems with you that work</strong>.
              </p>
              <p>
                Not brand new "expensive" systems that require you to buy a bunch of new things — I'm guessing you've tried that already.
              </p>
              <p className="text-dark">
                <strong>Systems that are yours, built where you are — not where you imagine you'll be with the new gym membership or supplement from the health food store.</strong>
              </p>
            </div>
            <button onClick={handleNext} className="btn-primary">
              I like the sound of that
            </button>
          </div>
        )

      // Step 5: First check-in (mood + note)
      case 5:
        return (
          <div className="step-content">
            <h1 className="title">Let's start with a simple check-in</h1>
            <p className="subtitle">
              Rate how you're feeling right now, with 10 being the best you've ever felt and 0 being the worst.
            </p>
            
            <div className="mood-slider-container">
              <div className="mood-slider-labels">
                <span>Worst</span>
                <span className="mood-value">{mood}</span>
                <span>Best</span>
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

            <p className="subtitle">Why did you pick that number? What's happening?</p>
            <textarea
              value={moodNote}
              onChange={(e) => setMoodNote(e.target.value)}
              placeholder="Share what's on your mind..."
              rows={3}
              className="text-input textarea"
            />
            
            <button onClick={handleMoodSubmit} disabled={isLoading} className="btn-primary">
              {isLoading ? 'Getting advice...' : 'Submit Check-in'}
            </button>
          </div>
        )

      // Step 6: Show coach advice
      case 6:
        return (
          <div className="step-content">
            <h1 className="title">Here's what I think...</h1>
            <div className="advice-card">
              <p>
                {coachAdvice || "Thanks for sharing. Remember, checking in with yourself is the first step to understanding your patterns."}
              </p>
            </div>
            <div className="prose">
              <p>
                This was your first coaching session! I'm going to ask you to tell me how you're feeling once per day and offer suggestions like this.
              </p>
              <p>
                The goal is to help recognize patterns. There aren't always patterns, but sometimes there are — and helping you recognize them can help build new ones, or choose to continue with the old ones.
              </p>
              <p className="text-dark"><strong>You're in the driving seat here!</strong></p>
            </div>
            <button onClick={handleNext} className="btn-primary">
              Continue
            </button>
          </div>
        )

      // Step 7: Other tools intro
      case 7:
        return (
          <div className="step-content">
            <h1 className="title">There's more I can help with</h1>
            <p className="subtitle">
              Helping you recognize your patterns is one thing, but there's a bunch of other stuff on this journey too.
            </p>
            <div className="info-card">
              <p>
                💡 Pressing the menu button after this journey will show you everything I can help with — but don't worry about that for now.
              </p>
            </div>
            <p className="text-dark lead">
              The first tool I need to show you is <span className="text-danger font-bold">BREAK</span> →
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
            <h1 className="title">BREAK is for when everything is overwhelming</h1>
            <div className="prose">
              <p>
                For me, sometimes it's the noise in a busy supermarket. Or being a bit tired and someone asks me a question and I'm snappy, they get annoyed, I get more annoyed…
              </p>
              <p className="text-dark"><strong>You know the story.</strong></p>
            </div>
            <div className="warning-card">
              <p>
                Press the <strong>BREAK</strong> button for 10 seconds. Select if you're frustrated, angry, feel rejected, or upset.
              </p>
            </div>
            <p className="subtitle">
              ADHD isn't just about focus and dopamine levels — it's so much more. Mainly, it's about <strong className="text-dark">dysregulation</strong>.
            </p>
            <button onClick={handleNext} className="btn-primary">
              Tell me more about dysregulation
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
            <h1 className="title">Dysregulation means it's not your fault</h1>
            <div className="prose">
              <p>
                Dysregulation of attention, sure. But also of sleep, food, energy levels, relationships.
              </p>
              <p>
                I know you won't fully believe me when I say it's not your fault.
              </p>
              <p>
                You didn't get to grow up with people who could teach you how to cope with the world. But it's not your parents' fault either — ADHD is highly hereditary.
              </p>
            </div>
            <div className="info-card primary">
              <p>
                🧬 Your brain is wired differently. That's not a flaw — it's just different.
              </p>
            </div>
            <button onClick={handleNext} className="btn-primary">
              Continue
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
            <h1 className="title">Let's talk about energy</h1>
            <div className="prose">
              <p>
                Energy for us ADHDers is, well, <strong className="text-dark">dysregulated</strong>.
              </p>
              <p>
                If it's something we're interested in, everything else disappears. But if it's something we "have" to do, it's nearly impossible to get off the couch.
              </p>
              <p>
                When we're not interested in something but it still needs to be done (think: work), we often rely on <strong className="text-dark">stress and anxiety</strong> to keep us moving.
              </p>
              <p>
                No problem once in a while — but when it becomes our default… <strong className="text-warning">burnout becomes the destination</strong>.
              </p>
            </div>
            <div className="warning-card orange">
              <p>
                ⚡ When your mood is lower or when you share that you've been frustrated, I'm going to ask about your energy levels. The key is to avoid burnout.
              </p>
            </div>
            <p className="text-dark lead"><strong>Nothing is more important than taking care of yourself.</strong></p>
            <button onClick={handleFinish} className="btn-primary">
              Let's get started! →
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
