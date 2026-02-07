'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import AppHeader from '@/components/AppHeader'
import FABToolbox from '@/components/FABToolbox'

interface TodayWin {
  id: string
  type: 'check_in' | 'focus_step' | 'goal_step'
  label: string
  time: string
}

type WindDownStep = 'loading' | 'wins' | 'tomorrow' | 'breathe' | 'done'

export default function WindDownPage() {
  const supabase = createClient()
  const router = useRouter()
  const [step, setStep] = useState<WindDownStep>('loading')
  const [todayWins, setTodayWins] = useState<TodayWin[]>([])
  const [tomorrowTask, setTomorrowTask] = useState('')
  const [breathePhase, setBreathePhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale')

  useEffect(() => {
    const loadTodayWins = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const wins: TodayWin[] = []

      // Get today's check-ins
      const { data: checkIns } = await supabase
        .from('mood_entries')
        .select('id, created_at')
        .eq('user_id', session.user.id)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: true })

      if (checkIns && checkIns.length > 0) {
        wins.push({
          id: 'checkin-' + checkIns[0].id,
          type: 'check_in',
          label: 'Checked in with yourself',
          time: new Date(checkIns[0].created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        })
      }

      // Get today's completed focus steps
      const { data: focusPlans } = await supabase
        .from('focus_plans')
        .select('id, task_name, steps, updated_at')
        .eq('user_id', session.user.id)
        .gte('updated_at', today.toISOString())

      if (focusPlans) {
        focusPlans.forEach(plan => {
          const steps = plan.steps as Array<{ completed: boolean; text: string }>
          const completedSteps = steps?.filter(s => s.completed) || []
          completedSteps.forEach((s, i) => {
            wins.push({
              id: `focus-${plan.id}-${i}`,
              type: 'focus_step',
              label: s.text || plan.task_name,
              time: new Date(plan.updated_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
            })
          })
        })
      }

      setTodayWins(wins.slice(0, 5)) // Limit to 5 wins
      setStep('wins')
    }

    loadTodayWins()
  }, [router])

  // Breathing animation
  useEffect(() => {
    if (step !== 'breathe') return

    const phases: Array<{ phase: 'inhale' | 'hold' | 'exhale'; duration: number }> = [
      { phase: 'inhale', duration: 4000 },
      { phase: 'hold', duration: 4000 },
      { phase: 'exhale', duration: 6000 },
    ]

    let phaseIndex = 0
    const runPhase = () => {
      setBreathePhase(phases[phaseIndex].phase)
      setTimeout(() => {
        phaseIndex = (phaseIndex + 1) % phases.length
        runPhase()
      }, phases[phaseIndex].duration)
    }

    runPhase()
  }, [step])

  const handleSaveTomorrow = async () => {
    if (!tomorrowTask.trim()) {
      setStep('breathe')
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      // Save as a focus plan for tomorrow
      await supabase.from('focus_plans').insert({
        user_id: session.user.id,
        task_name: tomorrowTask.trim(),
        steps: [],
        due_date: 'tomorrow',
      })
    }
    setStep('breathe')
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour >= 17 && hour < 21) return 'Good evening'
    if (hour >= 21) return 'Night owl mode'
    return 'Winding down'
  }

  if (step === 'loading') {
    return (
      <div className="wind-down">
        <div className="loading-container">
          <div className="loading-moon">🌙</div>
          <p>Preparing your wind-down...</p>
        </div>
        <style jsx>{styles}</style>
      </div>
    )
  }

  return (
    <div className="wind-down">
      <AppHeader />

      <main className="main">
        {/* Step 1: Today's Wins */}
        {step === 'wins' && (
          <div className="step-container">
            <div className="step-icon">🌅</div>
            <h1 className="step-title">{getGreeting()}</h1>
            <p className="step-subtitle">Let&apos;s close out the day.</p>

            {todayWins.length > 0 ? (
              <div className="wins-section">
                <h2 className="wins-header">Today&apos;s wins:</h2>
                <div className="wins-list">
                  {todayWins.map(win => (
                    <div key={win.id} className="win-item">
                      <span className="win-check">✓</span>
                      <span className="win-label">{win.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="no-wins">
                <p>No tracked wins today, and that&apos;s okay.</p>
                <p className="no-wins-subtext">Rest is productive too.</p>
              </div>
            )}

            <button className="continue-btn" onClick={() => setStep('tomorrow')}>
              Continue →
            </button>
          </div>
        )}

        {/* Step 2: Tomorrow's One Thing */}
        {step === 'tomorrow' && (
          <div className="step-container">
            <div className="step-icon">📝</div>
            <h1 className="step-title">One thing for tomorrow</h1>
            <p className="step-subtitle">
              What&apos;s one small thing you could start with?
            </p>

            <textarea
              value={tomorrowTask}
              onChange={(e) => setTomorrowTask(e.target.value)}
              placeholder="Something tiny, like 'open the document' or 'drink water first thing'..."
              className="tomorrow-input"
              rows={3}
              maxLength={200}
            />

            <div className="tomorrow-actions">
              <button className="continue-btn" onClick={handleSaveTomorrow}>
                {tomorrowTask.trim() ? 'Save & Continue' : 'Skip for now'} →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Breathing */}
        {step === 'breathe' && (
          <div className="step-container breathe-step">
            <div className={`breathe-circle ${breathePhase}`}>
              <span className="breathe-text">
                {breathePhase === 'inhale' ? 'Breathe in...' :
                 breathePhase === 'hold' ? 'Hold...' :
                 'Breathe out...'}
              </span>
            </div>

            <p className="breathe-subtitle">One calming breath before bed</p>

            <button className="skip-breathe" onClick={() => setStep('done')}>
              I&apos;m ready to rest
            </button>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 'done' && (
          <div className="step-container done-step">
            <div className="step-icon">🌙</div>
            <h1 className="step-title">You&apos;re done.</h1>
            <p className="step-subtitle">
              Tomorrow is a fresh start. Sleep well.
            </p>

            <button className="done-btn" onClick={() => router.push('/dashboard')}>
              Close
            </button>
          </div>
        )}
      </main>

      <FABToolbox mode="maintenance" />

      <style jsx>{styles}</style>
    </div>
  )
}

const styles = `
  .wind-down {
    min-height: 100vh;
    min-height: 100dvh;
    background: linear-gradient(180deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%);
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    color: white;
  }

  .loading-moon {
    font-size: 64px;
    margin-bottom: 16px;
    animation: float 2s ease-in-out infinite;
  }

  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }

  .main {
    max-width: 480px;
    margin: 0 auto;
    padding: clamp(20px, 5vw, 32px);
    padding-top: clamp(40px, 10vw, 60px);
  }

  .step-container {
    text-align: center;
    animation: fadeIn 0.5s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .step-icon {
    font-size: clamp(48px, 12vw, 64px);
    margin-bottom: clamp(16px, 4vw, 24px);
  }

  .step-title {
    font-size: clamp(24px, 6.5vw, 32px);
    font-weight: 700;
    color: white;
    margin: 0 0 clamp(8px, 2vw, 12px) 0;
  }

  .step-subtitle {
    font-size: clamp(15px, 4vw, 18px);
    color: rgba(255, 255, 255, 0.7);
    margin: 0 0 clamp(28px, 7vw, 40px) 0;
    line-height: 1.5;
  }

  /* Wins Section */
  .wins-section {
    margin-bottom: clamp(28px, 7vw, 40px);
  }

  .wins-header {
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.6);
    margin: 0 0 clamp(12px, 3vw, 16px) 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .wins-list {
    display: flex;
    flex-direction: column;
    gap: clamp(10px, 2.5vw, 14px);
  }

  .win-item {
    display: flex;
    align-items: center;
    gap: clamp(10px, 2.5vw, 14px);
    padding: clamp(14px, 3.5vw, 18px);
    background: rgba(255, 255, 255, 0.1);
    border-radius: clamp(12px, 3vw, 16px);
    backdrop-filter: blur(10px);
  }

  .win-check {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #00ba7c;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .win-label {
    font-size: clamp(14px, 3.8vw, 16px);
    color: white;
    text-align: left;
  }

  .no-wins {
    padding: clamp(24px, 6vw, 32px);
    background: rgba(255, 255, 255, 0.05);
    border-radius: clamp(16px, 4vw, 24px);
    margin-bottom: clamp(28px, 7vw, 40px);
  }

  .no-wins p {
    font-size: clamp(15px, 4vw, 17px);
    color: rgba(255, 255, 255, 0.8);
    margin: 0;
  }

  .no-wins-subtext {
    font-size: clamp(13px, 3.5vw, 15px);
    color: rgba(255, 255, 255, 0.5);
    margin-top: 8px !important;
  }

  /* Tomorrow Input */
  .tomorrow-input {
    width: 100%;
    padding: clamp(16px, 4vw, 20px);
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: clamp(12px, 3vw, 16px);
    font-size: clamp(15px, 4vw, 17px);
    color: white;
    resize: none;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    margin-bottom: clamp(20px, 5vw, 28px);
  }

  .tomorrow-input:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.5);
  }

  .tomorrow-input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  .tomorrow-actions {
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 3vw, 16px);
  }

  /* Buttons */
  .continue-btn {
    width: 100%;
    padding: clamp(16px, 4.5vw, 20px);
    background: white;
    color: #312e81;
    border: none;
    border-radius: clamp(12px, 3vw, 16px);
    font-size: clamp(16px, 4.5vw, 18px);
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .continue-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  }

  /* Breathe Step */
  .breathe-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
  }

  .breathe-circle {
    width: clamp(180px, 45vw, 240px);
    height: clamp(180px, 45vw, 240px);
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: clamp(24px, 6vw, 32px);
    transition: transform 4s ease-in-out, background 0.5s ease;
  }

  .breathe-circle.inhale {
    transform: scale(1.2);
    background: rgba(100, 200, 255, 0.2);
  }

  .breathe-circle.hold {
    transform: scale(1.2);
    background: rgba(150, 200, 255, 0.25);
  }

  .breathe-circle.exhale {
    transform: scale(1);
    background: rgba(255, 255, 255, 0.1);
  }

  .breathe-text {
    font-size: clamp(18px, 5vw, 24px);
    font-weight: 600;
    color: white;
  }

  .breathe-subtitle {
    font-size: clamp(14px, 3.8vw, 16px);
    color: rgba(255, 255, 255, 0.6);
    margin-bottom: clamp(32px, 8vw, 48px);
  }

  .skip-breathe {
    background: transparent;
    border: 2px solid rgba(255, 255, 255, 0.3);
    color: rgba(255, 255, 255, 0.8);
    padding: clamp(14px, 3.5vw, 18px) clamp(24px, 6vw, 32px);
    border-radius: clamp(12px, 3vw, 16px);
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.2s ease, color 0.2s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .skip-breathe:hover {
    border-color: rgba(255, 255, 255, 0.6);
    color: white;
  }

  /* Done Step */
  .done-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
  }

  .done-btn {
    margin-top: clamp(24px, 6vw, 32px);
    padding: clamp(14px, 3.5vw, 18px) clamp(48px, 12vw, 64px);
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.3);
    color: white;
    border-radius: clamp(12px, 3vw, 16px);
    font-size: clamp(15px, 4vw, 17px);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .done-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.5);
  }
`
