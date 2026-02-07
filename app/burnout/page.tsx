'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AppHeader from '@/components/AppHeader'
import FABToolbox from '@/components/FABToolbox'

interface BurnoutLog {
  id: string
  user_id: string
  sleep_quality: number | null
  energy_level: number | null
  physical_tension: number | null
  irritability: number | null
  overwhelm: number | null
  motivation: number | null
  focus_difficulty: number | null
  forgetfulness: number | null
  decision_fatigue: number | null
  total_score: number | null
  severity_level: 'green' | 'yellow' | 'red' | null
  notes: string | null
  source: string | null
  battery_level: number | null
  created_at: string
}

type BatteryStep = 'idle' | 'battery' | 'drains' | 'done'

interface DrainChip {
  key: string
  label: string
  icon: string
}

const DRAIN_CHIPS: DrainChip[] = [
  { key: 'sleep_quality', label: 'Sleep', icon: '😴' },
  { key: 'physical_tension', label: 'Pain', icon: '💪' },
  { key: 'focus_difficulty', label: 'Focus', icon: '🎯' },
  { key: 'irritability', label: 'People', icon: '😤' },
  { key: 'decision_fatigue', label: 'Decisions', icon: '🤔' },
  { key: 'forgetfulness', label: 'Memory', icon: '🧠' },
  { key: 'overwhelm', label: 'Overwhelm', icon: '🌊' },
  { key: 'energy_level', label: 'Energy', icon: '⚡' },
  { key: 'motivation', label: 'Motivation', icon: '🔥' },
]

export default function BurnoutPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [recentLogs, setRecentLogs] = useState<BurnoutLog[]>([])

  // Smart Battery state
  const [batteryStep, setBatteryStep] = useState<BatteryStep>('idle')
  const [batteryLevel, setBatteryLevel] = useState(50)
  const [selectedDrains, setSelectedDrains] = useState<string[]>([])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      await fetchLogs(session.user.id)
      setLoading(false)
    }
    init()
  }, [router])

  const fetchLogs = async (userId: string) => {
    const { data } = await supabase
      .from('burnout_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (data) setRecentLogs(data)
  }

  const getBatteryColor = (level: number) => {
    if (level >= 70) return '#00ba7c'
    if (level >= 40) return '#ffad1f'
    return '#f4212e'
  }

  const getBatterySeverity = (level: number): 'green' | 'yellow' | 'red' => {
    if (level >= 70) return 'green'
    if (level >= 40) return 'yellow'
    return 'red'
  }

  const getSeverityInfo = (severity: 'green' | 'yellow' | 'red' | null) => {
    switch (severity) {
      case 'green':
        return {
          label: 'Looking Good',
          emoji: '✅',
          color: '#00ba7c',
          bgColor: 'rgba(0, 186, 124, 0.1)',
          message: "Your energy levels are healthy! Keep doing what you're doing."
        }
      case 'yellow':
        return {
          label: 'Watch Out',
          emoji: '⚠️',
          color: '#ffad1f',
          bgColor: 'rgba(255, 173, 31, 0.1)',
          message: "You're showing some signs of strain. Consider taking breaks and prioritizing rest."
        }
      case 'red':
        return {
          label: 'Burnout Risk',
          emoji: '🚨',
          color: '#f4212e',
          bgColor: 'rgba(244, 33, 46, 0.1)',
          message: 'Your scores suggest high burnout risk. Please prioritize self-care and consider talking to someone.'
        }
      default:
        return {
          label: 'Unknown',
          emoji: '❓',
          color: '#8899a6',
          bgColor: 'rgba(136, 153, 166, 0.1)',
          message: 'No data available.'
        }
    }
  }

  const handleBatteryConfirm = () => {
    const severity = getBatterySeverity(batteryLevel)
    if (severity === 'green') {
      // Green = feel great, skip the drain questions
      handleSaveGreen()
    } else {
      // Yellow/Red = ask what's draining them
      setBatteryStep('drains')
    }
  }

  const toggleDrain = (key: string) => {
    setSelectedDrains(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const handleSaveGreen = async () => {
    if (!user) return
    setSaving(true)

    // Green: fill all values high (8)
    await supabase.from('burnout_logs').insert({
      user_id: user.id,
      battery_level: batteryLevel,
      sleep_quality: 8,
      energy_level: 8,
      physical_tension: 8,
      irritability: 8,
      overwhelm: 8,
      motivation: 8,
      focus_difficulty: 8,
      forgetfulness: 8,
      decision_fatigue: 8,
      total_score: 72,
      severity_level: 'green',
      source: 'smart_battery',
    })

    await fetchLogs(user.id)
    setSaving(false)
    setBatteryStep('done')
  }

  const handleSaveDrains = async () => {
    if (!user) return
    setSaving(true)

    const severity = getBatterySeverity(batteryLevel)

    // Build partial record: selected drains get low values, rest null
    const record: Record<string, any> = {
      user_id: user.id,
      battery_level: batteryLevel,
      severity_level: severity,
      source: 'smart_battery',
    }

    // Set low values (2-3) for identified problem areas
    const drainValue = severity === 'red' ? 2 : 3
    for (const chip of DRAIN_CHIPS) {
      if (selectedDrains.includes(chip.key)) {
        record[chip.key] = drainValue
      }
    }

    // Calculate partial total if any drains selected
    if (selectedDrains.length > 0) {
      const filledValues = DRAIN_CHIPS
        .filter(c => selectedDrains.includes(c.key))
        .map(() => drainValue)
      record.total_score = filledValues.reduce((sum, v) => sum + v, 0)
    }

    await supabase.from('burnout_logs').insert(record)

    await fetchLogs(user.id)
    setSaving(false)
    setBatteryStep('done')
  }

  const resetFlow = () => {
    setBatteryStep('idle')
    setBatteryLevel(50)
    setSelectedDrains([])
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="burnout-page">
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading...</p>
        </div>
        <style jsx>{styles}</style>
      </div>
    )
  }

  const batteryColor = getBatteryColor(batteryLevel)
  const latestSeverity = recentLogs.length > 0 ? recentLogs[0].severity_level : null

  return (
    <div className="burnout-page">
      <AppHeader
        notificationBar={latestSeverity ? {
          text: getSeverityInfo(latestSeverity).label,
          color: getSeverityInfo(latestSeverity).color,
          icon: '🔋',
        } : {
          text: 'Track your energy levels',
          color: '#1D9BF0',
          icon: '🔋',
        }}
      />

      <main className="main">
        <div className="page-header-title">
          <h1>🔋 Energy Tracker</h1>
        </div>

        {/* Current Status Card */}
        {recentLogs.length > 0 && batteryStep === 'idle' && (() => {
          const info = getSeverityInfo(recentLogs[0].severity_level)
          return (
            <div
              className="card status-card"
              style={{
                background: info.bgColor,
                borderLeft: `4px solid ${info.color}`
              }}
            >
              <div className="status-header">
                <span className="status-emoji">{info.emoji}</span>
                <div className="status-info">
                  <div className="status-label" style={{ color: info.color }}>
                    {info.label}
                  </div>
                  <div className="status-time">Last check: {formatDate(recentLogs[0].created_at)}</div>
                </div>
              </div>
              <p className="status-message">{info.message}</p>
            </div>
          )
        })()}

        {/* === IDLE STATE: Start Button === */}
        {batteryStep === 'idle' && (
          <div className="card">
            <h2 className="card-title">How&apos;s your energy?</h2>
            <p className="card-desc">A quick battery check to spot burnout early.</p>
            <button onClick={() => setBatteryStep('battery')} className="btn-primary full">
              Start Battery Check
            </button>
          </div>
        )}

        {/* === STEP 1: Battery Slider === */}
        {batteryStep === 'battery' && (
          <div className="card battery-card">
            <button onClick={resetFlow} className="close-btn">×</button>

            <div className="battery-visual">
              <div className="battery-shell">
                <div className="battery-terminal" />
                <div
                  className="battery-fill"
                  style={{
                    height: `${batteryLevel}%`,
                    background: batteryColor,
                    transition: 'height 0.2s ease, background 0.2s ease',
                  }}
                />
                <div className="battery-label">
                  <span className="battery-pct" style={{ color: batteryColor }}>{batteryLevel}%</span>
                </div>
              </div>
            </div>

            <h2 className="battery-question">What&apos;s in the tank?</h2>
            <p className="battery-hint">Drag to set your battery level</p>

            <input
              type="range"
              min="0"
              max="100"
              value={batteryLevel}
              onChange={(e) => setBatteryLevel(parseInt(e.target.value))}
              className="battery-slider"
              style={{
                background: `linear-gradient(to right, ${batteryColor} 0%, ${batteryColor} ${batteryLevel}%, #eff3f4 ${batteryLevel}%, #eff3f4 100%)`
              }}
            />

            <div className="battery-labels">
              <span>Empty</span>
              <span>Full</span>
            </div>

            <button
              onClick={handleBatteryConfirm}
              className="btn-primary full"
              disabled={saving}
              style={{ background: batteryColor }}
            >
              {saving ? 'Saving...' : batteryLevel >= 70 ? 'Awesome! Save →' : 'Next →'}
            </button>
          </div>
        )}

        {/* === STEP 2: Drain Chips (Yellow/Red only) === */}
        {batteryStep === 'drains' && (
          <div className="card drains-card">
            <button onClick={resetFlow} className="close-btn">×</button>

            <div className="drains-header">
              <span className="drains-emoji">🔍</span>
              <h2 className="drains-title">What&apos;s draining the battery?</h2>
              <p className="drains-subtitle">Tap everything that feels like a problem right now</p>
            </div>

            <div className="chips-grid">
              {DRAIN_CHIPS.map((chip) => {
                const isSelected = selectedDrains.includes(chip.key)
                return (
                  <button
                    key={chip.key}
                    onClick={() => toggleDrain(chip.key)}
                    className={`drain-chip ${isSelected ? 'selected' : ''}`}
                    style={isSelected ? {
                      borderColor: batteryColor,
                      background: `${batteryColor}12`,
                    } : {}}
                  >
                    <span className="chip-icon">{chip.icon}</span>
                    <span className="chip-label">{chip.label}</span>
                    {isSelected && <span className="chip-check">✓</span>}
                  </button>
                )
              })}
            </div>

            <button
              onClick={handleSaveDrains}
              className="btn-primary full"
              disabled={saving}
              style={{ background: batteryColor }}
            >
              {saving ? 'Saving...' : selectedDrains.length === 0 ? 'Skip & Save' : `Save (${selectedDrains.length} identified)`}
            </button>
          </div>
        )}

        {/* === DONE STATE === */}
        {batteryStep === 'done' && (
          <div className="card done-card">
            <div className="done-icon">
              <span>{batteryLevel >= 70 ? '🚀' : batteryLevel >= 40 ? '💛' : '🫂'}</span>
            </div>
            <h2 className="done-title">
              {batteryLevel >= 70 ? 'Go crush it!' : batteryLevel >= 40 ? 'Watch those drains' : 'Be gentle with yourself'}
            </h2>
            <p className="done-message">
              {batteryLevel >= 70
                ? "Your energy looks great. Keep doing what you're doing!"
                : selectedDrains.length > 0
                  ? `You identified ${selectedDrains.length} area${selectedDrains.length > 1 ? 's' : ''} draining your battery. Awareness is the first step.`
                  : "Even recognizing low energy is progress. Consider using the BREAK tool if you need a reset."
              }
            </p>
            <div className="done-buttons">
              <button onClick={resetFlow} className="btn-secondary">Check Again</button>
              <button onClick={() => router.push('/dashboard')} className="btn-primary">Done</button>
            </div>
          </div>
        )}

        {/* History */}
        {recentLogs.length > 0 && batteryStep === 'idle' && (
          <>
            <div className="section-header">
              <h2>Recent Check-ins</h2>
            </div>
            {recentLogs.map((log) => {
              const info = getSeverityInfo(log.severity_level)
              return (
                <div key={log.id} className="card log-card">
                  <div className="log-header">
                    <span className="log-emoji">{info.emoji}</span>
                    <div className="log-info">
                      <div className="log-score-row">
                        {log.battery_level != null ? (
                          <span className="log-score" style={{ color: info.color }}>
                            {log.battery_level}% battery
                          </span>
                        ) : log.total_score != null ? (
                          <span className="log-score" style={{ color: info.color }}>
                            {(log.total_score / 9).toFixed(1)}/10
                          </span>
                        ) : null}
                        <span className="log-badge" style={{ background: info.bgColor, color: info.color }}>
                          {info.label}
                        </span>
                        {log.source && log.source !== 'full_assessment' && (
                          <span className="log-source">{log.source.replace('_', ' ')}</span>
                        )}
                      </div>
                      <div className="log-time">{formatDate(log.created_at)}</div>
                    </div>
                  </div>
                  {log.notes && <p className="log-notes">{log.notes}</p>}
                </div>
              )
            })}
          </>
        )}

        {/* ADHD Tip */}
        {batteryStep === 'idle' && (
          <div className="card tip-card">
            <div className="tip-label">💡 ADHD & Burnout</div>
            <p className="tip-text">
              ADHDers often rely on stress to stay productive, which leads to burnout faster.
              Regular energy check-ins help you catch the warning signs early.
            </p>
          </div>
        )}
      </main>

      <FABToolbox mode="recovery" />

      <style jsx>{styles}</style>
    </div>
  )
}

const styles = `
  .burnout-page {
    --primary: #1D9BF0;
    --success: #00ba7c;
    --warning: #ffad1f;
    --danger: #f4212e;
    --bg-gray: #f7f9fa;
    --dark-gray: #536471;
    --light-gray: #8899a6;
    --extra-light-gray: #eff3f4;

    background: var(--bg-gray);
    min-height: 100vh;
    min-height: 100dvh;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    min-height: 100dvh;
    color: var(--light-gray);
  }

  .spinner {
    width: clamp(24px, 5vw, 32px);
    height: clamp(24px, 5vw, 32px);
    border: 3px solid var(--primary);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 12px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .main {
    padding: clamp(12px, 4vw, 20px);
    padding-bottom: clamp(16px, 4vw, 24px);
    max-width: 600px;
    margin: 0 auto;
  }

  .page-header-title {
    margin-bottom: clamp(14px, 4vw, 20px);
  }

  .page-header-title h1 {
    font-size: clamp(22px, 6vw, 28px);
    font-weight: 700;
    margin: 0;
  }

  /* Cards */
  .card {
    background: white;
    border-radius: clamp(14px, 4vw, 20px);
    padding: clamp(16px, 4.5vw, 24px);
    margin-bottom: clamp(12px, 3.5vw, 18px);
    position: relative;
  }

  .card-title {
    font-size: clamp(16px, 4.5vw, 20px);
    font-weight: 600;
    margin: 0 0 clamp(6px, 1.5vw, 10px) 0;
  }

  .card-desc {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    margin: 0 0 clamp(14px, 4vw, 20px) 0;
    line-height: 1.5;
  }

  .close-btn {
    position: absolute;
    top: clamp(12px, 3vw, 16px);
    right: clamp(12px, 3vw, 16px);
    background: none;
    border: none;
    cursor: pointer;
    color: var(--light-gray);
    font-size: clamp(20px, 5vw, 26px);
    line-height: 1;
    padding: 4px;
    z-index: 1;
  }

  /* Status Card */
  .status-card { border-radius: clamp(14px, 4vw, 20px); }
  .status-header { display: flex; align-items: center; gap: clamp(10px, 3vw, 14px); margin-bottom: clamp(8px, 2vw, 12px); }
  .status-emoji { font-size: clamp(28px, 8vw, 38px); }
  .status-label { font-size: clamp(16px, 4.5vw, 20px); font-weight: 700; }
  .status-time { font-size: clamp(12px, 3.2vw, 14px); color: var(--dark-gray); }
  .status-message { font-size: clamp(13px, 3.5vw, 15px); color: var(--dark-gray); line-height: 1.5; margin: 0; }

  /* Buttons */
  .btn-primary {
    padding: clamp(12px, 3.5vw, 16px);
    background: var(--primary);
    color: white;
    border: none;
    border-radius: clamp(10px, 2.5vw, 14px);
    font-size: clamp(14px, 4vw, 17px);
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  .btn-primary.full { width: 100%; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-secondary {
    flex: 1;
    padding: clamp(12px, 3.5vw, 16px);
    background: white;
    color: var(--dark-gray);
    border: 1px solid var(--extra-light-gray);
    border-radius: clamp(10px, 2.5vw, 14px);
    font-size: clamp(14px, 4vw, 17px);
    font-weight: 600;
    cursor: pointer;
  }

  /* === Battery Card === */
  .battery-card {
    text-align: center;
    padding: clamp(24px, 6vw, 36px) clamp(16px, 4.5vw, 24px);
  }

  .battery-visual {
    display: flex;
    justify-content: center;
    margin-bottom: clamp(20px, 5vw, 28px);
  }

  .battery-shell {
    position: relative;
    width: clamp(80px, 22vw, 110px);
    height: clamp(140px, 38vw, 200px);
    border: 4px solid #0f1419;
    border-radius: clamp(8px, 2vw, 14px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }

  .battery-terminal {
    position: absolute;
    top: clamp(-8px, -2vw, -12px);
    left: 50%;
    transform: translateX(-50%);
    width: 40%;
    height: clamp(8px, 2vw, 12px);
    background: #0f1419;
    border-radius: clamp(4px, 1vw, 6px) clamp(4px, 1vw, 6px) 0 0;
  }

  .battery-fill {
    width: 100%;
  }

  .battery-label {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .battery-pct {
    font-size: clamp(24px, 7vw, 34px);
    font-weight: 800;
    text-shadow: 0 1px 3px rgba(255,255,255,0.8);
  }

  .battery-question {
    font-size: clamp(18px, 5vw, 24px);
    font-weight: 700;
    margin: 0 0 clamp(4px, 1vw, 8px) 0;
  }

  .battery-hint {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--light-gray);
    margin: 0 0 clamp(16px, 4vw, 24px) 0;
  }

  .battery-slider {
    width: 100%;
    height: clamp(10px, 2.5vw, 14px);
    border-radius: 100px;
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
    margin-bottom: clamp(8px, 2vw, 12px);
  }

  .battery-slider::-webkit-slider-thumb {
    appearance: none;
    -webkit-appearance: none;
    width: clamp(28px, 7vw, 36px);
    height: clamp(28px, 7vw, 36px);
    border-radius: 50%;
    background: white;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    border: 3px solid #0f1419;
  }

  .battery-slider::-moz-range-thumb {
    width: clamp(28px, 7vw, 36px);
    height: clamp(28px, 7vw, 36px);
    border-radius: 50%;
    background: white;
    cursor: pointer;
    border: 3px solid #0f1419;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  }

  .battery-labels {
    display: flex;
    justify-content: space-between;
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--light-gray);
    margin-bottom: clamp(20px, 5vw, 28px);
  }

  /* === Drains Card === */
  .drains-card {
    padding: clamp(24px, 6vw, 36px) clamp(16px, 4.5vw, 24px);
  }

  .drains-header {
    text-align: center;
    margin-bottom: clamp(20px, 5vw, 28px);
  }

  .drains-emoji {
    font-size: clamp(36px, 10vw, 48px);
    display: block;
    margin-bottom: clamp(10px, 3vw, 14px);
  }

  .drains-title {
    font-size: clamp(18px, 5vw, 22px);
    font-weight: 700;
    margin: 0 0 clamp(4px, 1vw, 8px) 0;
  }

  .drains-subtitle {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--light-gray);
    margin: 0;
  }

  .chips-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: clamp(8px, 2vw, 12px);
    margin-bottom: clamp(20px, 5vw, 28px);
  }

  .drain-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(4px, 1vw, 6px);
    padding: clamp(14px, 4vw, 20px) clamp(8px, 2vw, 12px);
    background: var(--bg-gray);
    border: 2px solid transparent;
    border-radius: clamp(12px, 3vw, 16px);
    cursor: pointer;
    transition: all 0.15s ease;
    position: relative;
  }

  .drain-chip:hover {
    background: var(--extra-light-gray);
  }

  .drain-chip.selected {
    border-width: 2px;
  }

  .chip-icon {
    font-size: clamp(24px, 7vw, 32px);
  }

  .chip-label {
    font-size: clamp(11px, 3vw, 13px);
    font-weight: 600;
    color: var(--dark-gray);
  }

  .chip-check {
    position: absolute;
    top: clamp(4px, 1vw, 6px);
    right: clamp(4px, 1vw, 6px);
    font-size: clamp(10px, 2.5vw, 12px);
    font-weight: 700;
    color: white;
    background: var(--success);
    width: clamp(16px, 4vw, 20px);
    height: clamp(16px, 4vw, 20px);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* === Done Card === */
  .done-card {
    text-align: center;
    padding: clamp(30px, 8vw, 50px) clamp(16px, 4.5vw, 24px);
  }

  .done-icon {
    font-size: clamp(48px, 14vw, 72px);
    margin-bottom: clamp(14px, 4vw, 20px);
  }

  .done-title {
    font-size: clamp(20px, 5.5vw, 26px);
    font-weight: 800;
    margin: 0 0 clamp(8px, 2vw, 12px) 0;
  }

  .done-message {
    font-size: clamp(14px, 3.8vw, 16px);
    color: var(--dark-gray);
    line-height: 1.6;
    margin: 0 0 clamp(20px, 5vw, 28px) 0;
  }

  .done-buttons {
    display: flex;
    gap: clamp(10px, 3vw, 14px);
  }

  .done-buttons .btn-primary,
  .done-buttons .btn-secondary {
    flex: 1;
  }

  /* Section */
  .section-header { margin-bottom: clamp(10px, 3vw, 14px); }
  .section-header h2 { font-size: clamp(14px, 3.8vw, 17px); font-weight: 700; color: var(--dark-gray); margin: 0; }

  /* Log Cards */
  .log-header { display: flex; align-items: center; gap: clamp(10px, 3vw, 14px); }
  .log-emoji { font-size: clamp(24px, 7vw, 32px); }
  .log-info { flex: 1; }
  .log-score-row { display: flex; align-items: center; gap: clamp(6px, 2vw, 10px); flex-wrap: wrap; }
  .log-score { font-size: clamp(15px, 4vw, 18px); font-weight: 700; }
  .log-badge { font-size: clamp(11px, 3vw, 13px); padding: clamp(2px, 0.5vw, 4px) clamp(6px, 2vw, 10px); border-radius: 100px; font-weight: 500; }
  .log-source { font-size: clamp(10px, 2.8vw, 12px); color: var(--light-gray); font-style: italic; }
  .log-time { font-size: clamp(12px, 3.2vw, 14px); color: var(--dark-gray); }
  .log-notes { margin: clamp(8px, 2vw, 12px) 0 0 0; font-size: clamp(13px, 3.5vw, 15px); color: var(--dark-gray); }

  /* Tip Card */
  .tip-card { background: rgba(29, 155, 240, 0.05); border-left: 3px solid var(--primary); }
  .tip-label { font-size: clamp(12px, 3.2vw, 14px); font-weight: 600; color: var(--primary); margin-bottom: clamp(4px, 1vw, 6px); }
  .tip-text { font-size: clamp(13px, 3.5vw, 15px); color: var(--dark-gray); line-height: 1.5; margin: 0; }

  /* Responsive */
  @media (min-width: 768px) {
    .main { padding: 24px; padding-bottom: 24px; }
    .chips-grid { gap: 12px; }
  }

  @media (min-width: 1024px) {
    .main { max-width: 680px; }
  }
`
