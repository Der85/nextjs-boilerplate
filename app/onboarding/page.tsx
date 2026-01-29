'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Type for onboarding path based on mood score
type OnboardingPath = 'recovery' | 'maintenance' | 'growth'

// Type for user regulation state
type RegulationState = 'regulated' | 'dysregulated'

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
  
  // Phase 1: Onboarding path state for adaptive journey
  const [onboardingPath, setOnboardingPath] = useState<OnboardingPath>('maintenance')
  
  // Phase 2: Somatic Proof (BREAK button) state
  const [breakProgress, setBreakProgress] = useState(0)
  const [breakCompleted, setBreakCompleted] = useState(false)
  const [isHolding, setIsHolding] = useState(false)
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Phase 3: Energy Battery state
  const [energyLevel, setEnergyLevel] = useState(5)
  
  const HOLD_DURATION = 5000 // 5 seconds for onboarding (reduced from 10s)
  const PROGRESS_UPDATE_INTERVAL = 50 // Update progress every 50ms for smooth animation

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
    
    // Phase 1: Determine onboarding path based on mood score
    if (mood <= 3) {
      setOnboardingPath('recovery')
    } else if (mood >= 8) {
      setOnboardingPath('growth')
    } else {
      setOnboardingPath('maintenance')
    }
    
    try {
      // Get coach advice (existing Supabase call - kept intact)
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moodScore: mood, note: moodNote }),
      })

      const data = await response.json()
      setCoachAdvice(data.advice)

      // Save mood entry (existing Supabase call - kept intact)
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

  // Phase 3: Calculate regulation state based on mood + energy
  const calculateRegulationState = (): RegulationState => {
    const combinedScore = (mood + energyLevel) / 2
    // If average is below 4, user is dysregulated
    // Also dysregulated if there's a large gap between mood and energy (>4 points)
    const gap = Math.abs(mood - energyLevel)
    if (combinedScore < 4 || gap > 4) {
      return 'dysregulated'
    }
    return 'regulated'
  }

  // Phase 3: Get user-friendly mode label
  const getModeLabel = (): string => {
    switch (onboardingPath) {
      case 'recovery':
        return 'Recovery'
      case 'growth':
        return 'Growth'
      case 'maintenance':
      default:
        return 'Steady'
    }
  }

  // Phase 3: Enhanced handleFinish with database writes
  const handleFinish = async () => {
    setIsLoading(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const regulationState = calculateRegulationState()
        const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
        
        // Write to user_daily_states table (onboarding baseline)
        await supabase.from('user_daily_states').insert({
          user_id: user.id,
          date: today,
          mood_score: mood,
          energy_level: energyLevel,
          regulation_state: regulationState,
          onboarding_path: onboardingPath,
        })
      }
      
      router.push('/dashboard')
    } catch (err) {
      console.error('Error saving user state:', err)
      // Still navigate even if save fails - don't block the user
      router.push('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  // Phase 2: BREAK button handlers (dead man's switch mechanic)
  const startHolding = useCallback(() => {
    if (breakCompleted) return
    
    setIsHolding(true)
    const startTime = Date.now()
    
    // Progress updater - runs frequently for smooth animation
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime
      const progress = Math.min((elapsed / HOLD_DURATION) * 100, 100)
      setBreakProgress(progress)
    }, PROGRESS_UPDATE_INTERVAL)
    
    // Completion timer
    holdTimerRef.current = setTimeout(() => {
      setBreakProgress(100)
      setBreakCompleted(true)
      setIsHolding(false)
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }, HOLD_DURATION)
  }, [breakCompleted])

  const stopHolding = useCallback(() => {
    if (breakCompleted) return
    
    setIsHolding(false)
    
    // Clear timers
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
    
    // Reset progress immediately (dead man's switch)
    setBreakProgress(0)
  }, [breakCompleted])

  // Cleanup timers on unmount or step change
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    }
  }, [])

  // Reset BREAK state when leaving step 8
  useEffect(() => {
    if (step !== 8) {
      setBreakProgress(0)
      setBreakCompleted(false)
      setIsHolding(false)
    }
  }, [step])

  // Phase 1: Helper function to render path-specific content for Step 6
  const renderPathContent = () => {
    switch (onboardingPath) {
      case 'recovery':
        return {
          icon: '🫂',
          iconClass: 'danger',
          title: "It sounds like a heavy day.",
          message: "Let's skip the goal setting and focus on regulation.",
          explanation: "When you're in the red zone, adding more tasks only makes things worse. Today, we're going to focus on getting you back to baseline. No pressure, no productivity hacks—just gentle support.",
          buttonText: "Focus on regulation"
        }
      case 'growth':
        return {
          icon: '🚀',
          iconClass: 'success',
          title: "You're in a great spot!",
          message: "Let's harness this momentum.",
          explanation: "This is the perfect time to tackle something meaningful. Your brain is primed for action. Let's capture this energy and point it somewhere that matters to you.",
          buttonText: "Let's build something"
        }
      case 'maintenance':
      default:
        return {
          icon: '⚖️',
          iconClass: 'primary',
          title: "Steady is good.",
          message: "Let's build a system to keep you here.",
          explanation: "Maintenance mode is underrated. This is where sustainable habits are built. Let's create some routines that protect this equilibrium.",
          buttonText: "Build my system"
        }
    }
  }

  // Phase 2: Helper function to render path-specific BREAK intro text
  const getBreakIntroText = () => {
    switch (onboardingPath) {
      case 'recovery':
        return {
          title: "Let's just breathe for 5 seconds.",
          subtitle: "You're already in a tough spot. This isn't about fixing anything—just pausing the spiral.",
          instruction: "Press and hold the button below. Don't let go until it's done."
        }
      case 'growth':
        return {
          title: "Quick calibration check.",
          subtitle: "Even when you're flying high, it helps to know you can slow down on command.",
          instruction: "Press and hold to prove to your nervous system that you're in control."
        }
      case 'maintenance':
      default:
        return {
          title: "Let's practice the pause.",
          subtitle: "This is your emergency brake. Best to test it when you don't need it.",
          instruction: "Press and hold the button for 5 seconds to complete the calibration."
        }
    }
  }

  // Phase 3: Get battery color based on energy level
  const getBatteryColor = (level: number): string => {
    if (level <= 3) return '#f4212e' // Red - low energy
    if (level <= 6) return '#f59e0b' // Yellow/Orange - medium energy
    return '#00ba7c' // Green - high energy
  }

  // Phase 3: Get battery fill percentage
  const getBatteryFill = (level: number): number => {
    return (level / 10) * 100
  }

  // Phase 3: Get energy label
  const getEnergyLabel = (level: number): string => {
    if (level <= 2) return 'Running on empty'
    if (level <= 4) return 'Low reserves'
    if (level <= 6) return 'Holding steady'
    if (level <= 8) return 'Good charge'
    return 'Fully powered'
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
            <button
              onClick={handleNext}
              disabled={!name.trim()}
              className="btn-primary"
            >
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
            <button
              onClick={handleNext}
              disabled={!email.trim()}
              className="btn-primary"
            >
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
            <button
              onClick={handleMoodSubmit}
              disabled={isLoading}
              className="btn-primary"
            >
              {isLoading ? 'Analysing...' : 'Complete Check-in'}
            </button>
          </div>
        )

      // Step 6: Show coach advice - WITH ADAPTIVE BRANCHING (Phase 1)
      case 6:
        const pathContent = renderPathContent()
        return (
          <div className="step-content centered">
            <div className={`icon-circle ${pathContent.iconClass}`}>
              <span>{pathContent.icon}</span>
            </div>
            <h1 className="title">{pathContent.title}</h1>
            <div className="path-message-card">
              <p className="path-message">{pathContent.message}</p>
            </div>
            
            {/* Still show coach advice if available */}
            {coachAdvice && (
              <div className="advice-card">
                <p>{coachAdvice}</p>
              </div>
            )}
            
            <div className="prose">
              <p>{pathContent.explanation}</p>
              <p className="text-dark">
                Remember: <strong>You are in the driving seat.</strong>
              </p>
              <p>
                I'm just the navigator holding the map so you can keep your eyes on the road.
              </p>
            </div>
            <button onClick={handleNext} className="btn-primary">
              {pathContent.buttonText}
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

      // Step 8: BREAK - Interactive Somatic Proof (Phase 2)
      case 8:
        const breakIntro = getBreakIntroText()
        return (
          <div className="step-content centered">
            {breakCompleted ? (
              // Success state
              <>
                <div className="icon-circle success pulse-success">
                  <span>✓</span>
                </div>
                <h1 className="title">Nervous system calibrated.</h1>
                <div className="success-message-card">
                  <p>You just proved you can pause on command. That's the whole skill.</p>
                </div>
                <div className="prose">
                  <p>
                    When the noise gets too loud—the supermarket lights, the snappy comment, the guilt spiral—you now have a tool.
                  </p>
                  <p className="text-dark">
                    <strong>BREAK</strong> will always be in your menu. Use it whenever you need to reset.
                  </p>
                </div>
                <button onClick={handleNext} className="btn-primary">
                  Got it, let's continue
                </button>
              </>
            ) : (
              // Interactive hold state
              <>
                <h1 className="title">{breakIntro.title}</h1>
                <p className="subtitle">{breakIntro.subtitle}</p>
                
                {/* The interactive BREAK button with progress ring */}
                <div className="break-button-container">
                  <svg className="progress-ring" viewBox="0 0 200 200">
                    {/* Background ring */}
                    <circle
                      className="progress-ring-bg"
                      cx="100"
                      cy="100"
                      r="90"
                      fill="none"
                      strokeWidth="8"
                    />
                    {/* Progress ring */}
                    <circle
                      className="progress-ring-fill"
                      cx="100"
                      cy="100"
                      r="90"
                      fill="none"
                      strokeWidth="8"
                      strokeDasharray={`${2 * Math.PI * 90}`}
                      strokeDashoffset={`${2 * Math.PI * 90 * (1 - breakProgress / 100)}`}
                      transform="rotate(-90 100 100)"
                    />
                  </svg>
                  <button
                    className={`break-button ${isHolding ? 'holding' : ''}`}
                    onMouseDown={startHolding}
                    onMouseUp={stopHolding}
                    onMouseLeave={stopHolding}
                    onTouchStart={(e) => { e.preventDefault(); startHolding(); }}
                    onTouchEnd={stopHolding}
                    onTouchCancel={stopHolding}
                  >
                    <span className="break-text">BREAK</span>
                    <span className="break-instruction">
                      {isHolding ? `${Math.ceil((100 - breakProgress) / 20)}s` : 'Hold'}
                    </span>
                  </button>
                </div>
                
                <p className="instruction-text">{breakIntro.instruction}</p>
                
                {/* Progress hint */}
                {breakProgress > 0 && breakProgress < 100 && (
                  <p className="progress-hint">Keep holding... {Math.round(breakProgress)}%</p>
                )}
                
                {/* Disabled next button until completed */}
                <button 
                  onClick={handleNext} 
                  className="btn-primary"
                  disabled={!breakCompleted}
                >
                  Complete the hold first
                </button>
              </>
            )}
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

      // Step 10: Energy Battery & Final Calibration (Phase 3)
      case 10:
        const batteryColor = getBatteryColor(energyLevel)
        const batteryFill = getBatteryFill(energyLevel)
        const energyLabel = getEnergyLabel(energyLevel)
        const regulationState = calculateRegulationState()
        const modeLabel = getModeLabel()
        
        return (
          <div className="step-content centered">
            <h1 className="title">One more reading: Your battery</h1>
            <p className="subtitle">
              ADHDers often run on "all or nothing" energy. Let's see where you're at right now.
            </p>
            
            {/* Interactive Battery Visual */}
            <div className="battery-container">
              <svg className="battery-svg" viewBox="0 0 120 200">
                {/* Battery cap */}
                <rect
                  x="35"
                  y="0"
                  width="50"
                  height="12"
                  rx="4"
                  fill={batteryColor}
                  opacity="0.6"
                />
                {/* Battery body outline */}
                <rect
                  x="10"
                  y="15"
                  width="100"
                  height="180"
                  rx="12"
                  fill="none"
                  stroke={batteryColor}
                  strokeWidth="4"
                />
                {/* Battery fill */}
                <rect
                  x="18"
                  y={23 + (164 * (1 - batteryFill / 100))}
                  width="84"
                  height={164 * (batteryFill / 100)}
                  rx="8"
                  fill={batteryColor}
                  className="battery-fill"
                />
                {/* Energy level text */}
                <text
                  x="60"
                  y="115"
                  textAnchor="middle"
                  fill={energyLevel > 5 ? 'white' : batteryColor}
                  fontSize="36"
                  fontWeight="bold"
                  className="battery-text"
                >
                  {energyLevel}
                </text>
              </svg>
              <p className="energy-label" style={{ color: batteryColor }}>
                {energyLabel}
              </p>
            </div>
            
            {/* Energy Slider */}
            <div className="energy-slider-container">
              <div className="energy-slider-labels">
                <span>Empty</span>
                <span>Full</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={energyLevel}
                onChange={(e) => setEnergyLevel(parseInt(e.target.value))}
                className="energy-slider"
                style={{
                  background: `linear-gradient(to right, ${batteryColor} 0%, ${batteryColor} ${(energyLevel - 1) / 9 * 100}%, #eff3f4 ${(energyLevel - 1) / 9 * 100}%, #eff3f4 100%)`
                }}
              />
            </div>
            
            {/* Calibration Summary */}
            <div className="calibration-card">
              <h3 className="calibration-title">Profile Calibrated</h3>
              <div className="calibration-stats">
                <div className="stat">
                  <span className="stat-label">Mood</span>
                  <span className="stat-value">{mood}/10</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Energy</span>
                  <span className="stat-value">{energyLevel}/10</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Mode</span>
                  <span className={`stat-value mode-${onboardingPath}`}>{modeLabel}</span>
                </div>
              </div>
              <p className="calibration-status">
                Status: <strong className={regulationState === 'regulated' ? 'text-success' : 'text-warning'}>
                  {regulationState === 'regulated' ? 'Regulated ✓' : 'Needs Support'}
                </strong>
              </p>
            </div>
            
            <p className="text-dark lead">
              <strong>Nothing is more important than taking care of yourself. Ready?</strong>
            </p>
            
            <button 
              onClick={handleFinish} 
              disabled={isLoading}
              className="btn-primary"
            >
              {isLoading ? 'Saving your profile...' : `Let's go! →`}
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
          <div
            className="progress-bar-fill"
            style={{ width: `${(step / (totalSteps - 1)) * 100}%` }}
          />
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
  .text-success { color: var(--success); }
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
  .icon-circle.success { background: var(--success); }

  /* Success pulse animation */
  .pulse-success {
    animation: pulse-success 0.6s ease-out;
  }

  @keyframes pulse-success {
    0% {
      transform: scale(0.8);
      opacity: 0;
    }
    50% {
      transform: scale(1.1);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

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

  /* Path message card for adaptive branching */
  .path-message-card {
    background: linear-gradient(135deg, rgba(29, 155, 240, 0.1) 0%, rgba(0, 186, 124, 0.1) 100%);
    border: 1px solid rgba(29, 155, 240, 0.2);
    border-radius: clamp(14px, 4vw, 20px);
    padding: clamp(16px, 4.5vw, 24px);
    margin-bottom: clamp(16px, 4vw, 24px);
  }

  .path-message {
    font-size: clamp(16px, 4.2vw, 20px);
    font-weight: 600;
    color: var(--text-dark);
    margin: 0;
    line-height: 1.4;
  }

  /* Success message card for BREAK completion */
  .success-message-card {
    background: rgba(0, 186, 124, 0.1);
    border: 1px solid rgba(0, 186, 124, 0.3);
    border-radius: clamp(14px, 4vw, 20px);
    padding: clamp(16px, 4.5vw, 24px);
    margin-bottom: clamp(16px, 4vw, 24px);
  }

  .success-message-card p {
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 500;
    color: #065f46;
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

  /* ===== PHASE 2: BREAK BUTTON STYLES ===== */
  .break-button-container {
    position: relative;
    width: clamp(160px, 45vw, 200px);
    height: clamp(160px, 45vw, 200px);
    margin: clamp(20px, 5vw, 32px) auto;
  }

  .progress-ring {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }

  .progress-ring-bg {
    stroke: var(--extra-light-gray);
  }

  .progress-ring-fill {
    stroke: var(--danger);
    stroke-linecap: round;
    transition: stroke-dashoffset 0.05s linear;
  }

  .break-button {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: clamp(120px, 34vw, 150px);
    height: clamp(120px, 34vw, 150px);
    border-radius: 50%;
    border: none;
    background: linear-gradient(145deg, #f4212e, #dc1b25);
    box-shadow: 
      0 6px 20px rgba(244, 33, 46, 0.4),
      0 2px 4px rgba(0, 0, 0, 0.1),
      inset 0 -2px 4px rgba(0, 0, 0, 0.1),
      inset 0 2px 4px rgba(255, 255, 255, 0.2);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(4px, 1vw, 8px);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
  }

  .break-button:active,
  .break-button.holding {
    transform: translate(-50%, -50%) scale(0.95);
    box-shadow: 
      0 3px 10px rgba(244, 33, 46, 0.5),
      0 1px 2px rgba(0, 0, 0, 0.1),
      inset 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .break-button.holding {
    animation: pulse-holding 1s ease-in-out infinite;
  }

  @keyframes pulse-holding {
    0%, 100% {
      box-shadow: 
        0 3px 10px rgba(244, 33, 46, 0.5),
        0 1px 2px rgba(0, 0, 0, 0.1),
        inset 0 2px 8px rgba(0, 0, 0, 0.2);
    }
    50% {
      box-shadow: 
        0 3px 20px rgba(244, 33, 46, 0.7),
        0 1px 2px rgba(0, 0, 0, 0.1),
        inset 0 2px 8px rgba(0, 0, 0, 0.2);
    }
  }

  .break-text {
    font-size: clamp(18px, 5vw, 24px);
    font-weight: 800;
    color: white;
    letter-spacing: 1px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .break-instruction {
    font-size: clamp(12px, 3.2vw, 14px);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .instruction-text {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    margin: 0 0 clamp(12px, 3vw, 16px) 0;
    line-height: 1.5;
  }

  .progress-hint {
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--danger);
    font-weight: 600;
    margin: 0 0 clamp(16px, 4vw, 24px) 0;
    animation: fade-pulse 0.5s ease-in-out infinite alternate;
  }

  @keyframes fade-pulse {
    from { opacity: 0.7; }
    to { opacity: 1; }
  }

  /* ===== PHASE 3: ENERGY BATTERY STYLES ===== */
  .battery-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: clamp(16px, 4vw, 24px) 0;
  }

  .battery-svg {
    width: clamp(80px, 22vw, 100px);
    height: clamp(130px, 36vw, 165px);
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
  }

  .battery-fill {
    transition: all 0.3s ease;
  }

  .battery-text {
    transition: fill 0.3s ease;
  }

  .energy-label {
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 600;
    margin-top: clamp(8px, 2vw, 12px);
    transition: color 0.3s ease;
  }

  .energy-slider-container {
    margin-bottom: clamp(20px, 5vw, 28px);
  }

  .energy-slider-labels {
    display: flex;
    justify-content: space-between;
    margin-bottom: clamp(8px, 2vw, 12px);
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--dark-gray);
  }

  .energy-slider {
    width: 100%;
    height: clamp(8px, 2vw, 10px);
    border-radius: 100px;
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .energy-slider::-webkit-slider-thumb {
    appearance: none;
    -webkit-appearance: none;
    width: clamp(24px, 6.5vw, 30px);
    height: clamp(24px, 6.5vw, 30px);
    border-radius: 50%;
    background: white;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    border: 3px solid currentColor;
  }

  .energy-slider::-moz-range-thumb {
    width: clamp(24px, 6.5vw, 30px);
    height: clamp(24px, 6.5vw, 30px);
    border-radius: 50%;
    background: white;
    cursor: pointer;
    border: 3px solid currentColor;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  }

  /* Calibration Card */
  .calibration-card {
    background: linear-gradient(135deg, rgba(29, 155, 240, 0.08) 0%, rgba(0, 186, 124, 0.08) 100%);
    border: 1px solid rgba(29, 155, 240, 0.2);
    border-radius: clamp(14px, 4vw, 20px);
    padding: clamp(16px, 4.5vw, 24px);
    margin-bottom: clamp(16px, 4vw, 24px);
  }

  .calibration-title {
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 700;
    color: var(--text-dark);
    margin: 0 0 clamp(12px, 3vw, 16px) 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .calibration-stats {
    display: flex;
    justify-content: space-around;
    margin-bottom: clamp(12px, 3vw, 16px);
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(4px, 1vw, 6px);
  }

  .stat-label {
    font-size: clamp(11px, 3vw, 13px);
    color: var(--dark-gray);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .stat-value {
    font-size: clamp(18px, 5vw, 22px);
    font-weight: 700;
    color: var(--text-dark);
  }

  .stat-value.mode-recovery {
    color: var(--danger);
  }

  .stat-value.mode-growth {
    color: var(--success);
  }

  .stat-value.mode-maintenance {
    color: var(--primary);
  }

  .calibration-status {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    margin: 0;
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

    .break-button:hover:not(.holding) {
      transform: translate(-50%, -50%) scale(1.02);
    }
  }

  @media (min-width: 1024px) {
    .card {
      max-width: 520px;
      padding: 40px;
    }
  }
`
