'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Step = 'impulse' | 'intensity' | 'observe' | 'cope' | 'proceed' | 'done'

const emotions = [
  { id: 'anger', label: 'Angry', icon: '😤' },
  { id: 'anxiety', label: 'Anxious', icon: '😰' },
  { id: 'sadness', label: 'Sad', icon: '😢' },
  { id: 'frustration', label: 'Frustrated', icon: '😣' },
  { id: 'overwhelm', label: 'Overwhelmed', icon: '🤯' },
  { id: 'boredom', label: 'Bored', icon: '😑' },
  { id: 'excitement', label: 'Excited', icon: '🤩' },
  { id: 'shame', label: 'Ashamed', icon: '😔' },
]

const skills = [
  { text: 'Take 5 deep breaths', why: 'Activates your calm nervous system', time: '30 sec' },
  { text: 'Splash cold water on face', why: 'Triggers dive reflex, slows heart rate', time: '1 min' },
  { text: 'Name 5 things you can see', why: 'Grounds you in the present moment', time: '1 min' },
  { text: 'Do 10 jumping jacks', why: 'Burns off adrenaline', time: '30 sec' },
  { text: 'Hold ice cubes', why: 'Strong sensation redirects focus', time: '1 min' },
  { text: 'Count backwards from 100 by 7s', why: 'Engages logical brain', time: '2 min' },
]

export default function BrakePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [currentStep, setCurrentStep] = useState<Step>('impulse')
  const [impulseText, setImpulseText] = useState('')
  const [intensityBefore, setIntensityBefore] = useState<number | null>(null)
  const [intensityAfter, setIntensityAfter] = useState<number | null>(null)
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([])
  const [usedSkill, setUsedSkill] = useState<string | null>(null)
  const [actedOnImpulse, setActedOnImpulse] = useState<boolean | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      setLoading(false)
    }
    init()
  }, [router])

  const toggleEmotion = (id: string) => {
    setSelectedEmotions(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id])
  }

  const handleComplete = async (acted: boolean) => {
    if (!user) return
    setSaving(true)
    setActedOnImpulse(acted)
    await supabase.from('impulse_events').insert({
      user_id: user.id,
      impulse_description: impulseText,
      intensity_before: intensityBefore,
      intensity_after: intensityAfter,
      emotions_felt: selectedEmotions,
      coping_skill_used: usedSkill,
      acted_on_impulse: acted,
    })
    setCurrentStep('done')
    setSaving(false)
  }

  const reset = () => {
    setCurrentStep('impulse')
    setImpulseText('')
    setIntensityBefore(null)
    setIntensityAfter(null)
    setSelectedEmotions([])
    setUsedSkill(null)
    setActedOnImpulse(null)
  }

  if (loading) {
    return (
      <div className="app-container flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--warning)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const stepLabels = ['The urge', 'How strong?', 'Underneath', 'Cope first', 'Decide']
  const stepIndex = ['impulse', 'intensity', 'observe', 'cope', 'proceed'].indexOf(currentStep)

  return (
    <div className="app-container">
      <div className="top-bar">
        <div className="top-bar-inner">
          <button onClick={() => router.push('/dashboard')} className="btn btn-ghost btn-icon">←</button>
          <h1 style={{ fontSize: '19px', fontWeight: 800, color: 'var(--warning)' }}>STOP</h1>
          <div style={{ width: '36px' }} />
        </div>
      </div>

      <div className="main-content">
        {currentStep !== 'done' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="text-sm font-bold">{stepLabels[stepIndex]}</span>
              <span className="text-sm text-muted">{stepIndex + 1} of 5</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${((stepIndex + 1) / 5) * 100}%`, background: 'var(--warning)' }} />
            </div>
          </div>
        )}

        {currentStep === 'impulse' && (
          <div className="compose-box">
            <div className="text-center mb-4">
              <span className="emoji-large">🛑</span>
              <h2 className="text-xl font-extrabold mt-2">STOP</h2>
              <p className="text-muted">What do you feel like doing?</p>
            </div>
            <textarea value={impulseText} onChange={(e) => setImpulseText(e.target.value)}
              placeholder="I want to..." className="input-borderless w-full" rows={3} autoFocus />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => setCurrentStep('intensity')} disabled={!impulseText.trim()}
                className="btn btn-primary" style={{ background: 'var(--warning)' }}>Next →</button>
            </div>
          </div>
        )}

        {currentStep === 'intensity' && (
          <div className="card text-center" style={{ padding: '30px 15px' }}>
            <span className="emoji-large">🌡️</span>
            <h2 className="text-xl font-extrabold mt-3 mb-2">How strong is this urge?</h2>
            <p className="text-muted mb-4">1 = mild, 10 = overwhelming</p>
            <div className="rating-grid" style={{ justifyContent: 'center' }}>
              {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                <button key={n} onClick={() => setIntensityBefore(n)}
                  className={`rating-btn ${intensityBefore === n ? 'rating-btn-active' : ''}`}
                  style={intensityBefore === n ? { background: 'var(--warning)', borderColor: 'var(--warning)' } : {}}>{n}</button>
              ))}
            </div>
            <button onClick={() => setCurrentStep('observe')} disabled={!intensityBefore}
              className="btn btn-primary w-full mt-4" style={{ background: 'var(--warning)' }}>Next →</button>
          </div>
        )}

        {currentStep === 'observe' && (
          <>
            <div className="page-header">
              <h2 className="page-title">What's underneath?</h2>
              <p className="page-subtitle">Select all emotions you're feeling</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              {emotions.map((e) => (
                <div key={e.id} className="card card-clickable" onClick={() => toggleEmotion(e.id)}
                  style={{ borderLeft: selectedEmotions.includes(e.id) ? '3px solid var(--primary)' : '3px solid transparent',
                    background: selectedEmotions.includes(e.id) ? 'rgba(29,161,242,0.05)' : undefined }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '24px' }}>{e.icon}</span>
                    <span className="font-bold">{e.label}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="card">
              <button onClick={() => setCurrentStep('cope')} disabled={selectedEmotions.length === 0}
                className="btn btn-primary w-full" style={{ background: 'var(--warning)' }}>Next →</button>
            </div>
          </>
        )}

        {currentStep === 'cope' && (
          <>
            <div className="page-header">
              <h2 className="page-title">Try a coping skill first</h2>
              <p className="page-subtitle">Pick one and do it before deciding</p>
            </div>
            {skills.map((s) => (
              <div key={s.text} className="card card-clickable" onClick={() => { setUsedSkill(s.text); setCurrentStep('proceed') }}>
                <p className="font-bold">{s.text}</p>
                <p className="text-sm text-muted mt-1">{s.why}</p>
                <span style={{ fontSize: '12px', padding: '2px 8px', background: 'var(--bg-gray)', borderRadius: '4px',
                  color: 'var(--dark-gray)', marginTop: '8px', display: 'inline-block' }}>{s.time}</span>
              </div>
            ))}
            <div className="card">
              <button onClick={() => setCurrentStep('proceed')} className="btn btn-ghost w-full">Skip for now →</button>
            </div>
          </>
        )}

        {currentStep === 'proceed' && (
          <>
            <div className="page-header">
              <h2 className="page-title">Now decide</h2>
              <p className="page-subtitle">After pausing, what do you want to do?</p>
            </div>
            {usedSkill && (
              <div className="card" style={{ background: 'rgba(23,191,99,0.05)', borderLeft: '3px solid var(--success)' }}>
                <p className="text-sm font-bold" style={{ color: 'var(--success)' }}>You tried:</p>
                <p>{usedSkill}</p>
              </div>
            )}
            <div className="card">
              <p className="font-bold mb-3 text-center">How strong is the urge now?</p>
              <div className="rating-grid" style={{ justifyContent: 'center' }}>
                {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                  <button key={n} onClick={() => setIntensityAfter(n)}
                    className={`rating-btn ${intensityAfter === n ? 'rating-btn-active' : ''}`}
                    style={{ width: '40px', height: '40px',
                      ...(intensityAfter === n ? { background: 'var(--warning)', borderColor: 'var(--warning)' } : {}) }}>{n}</button>
                ))}
              </div>
            </div>
            <div className="card">
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => handleComplete(false)} disabled={saving}
                  className="btn btn-large" style={{ flex: 1, background: 'var(--success)', color: 'white' }}>✓ I'll wait</button>
                <button onClick={() => handleComplete(true)} disabled={saving}
                  className="btn btn-outline btn-large" style={{ flex: 1, borderColor: 'var(--warning)', color: 'var(--warning)' }}>→ I'll do it</button>
              </div>
            </div>
          </>
        )}

        {currentStep === 'done' && (
          <div className="card text-center" style={{ padding: '40px 20px' }}>
            <div style={{ width: '80px', height: '80px', background: actedOnImpulse ? 'var(--warning)' : 'var(--success)',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <span style={{ fontSize: '40px' }}>{actedOnImpulse ? '👍' : '🌟'}</span>
            </div>
            <h2 className="text-xl font-extrabold mb-2">{actedOnImpulse ? 'You made a choice' : 'You hit the brakes!'}</h2>
            <p className="text-muted mb-4">{actedOnImpulse ? 'You paused and made a conscious decision.' : 'You paused and chose not to act impulsively.'}</p>
            {intensityBefore && intensityAfter && intensityAfter < intensityBefore && (
              <div className="stats-row" style={{ justifyContent: 'center', marginBottom: '20px' }}>
                <span className="text-muted">Urge:</span>
                <span className="stat-value" style={{ color: 'var(--light-gray)' }}>{intensityBefore}</span>
                <span className="text-muted">→</span>
                <span className="stat-value" style={{ color: 'var(--warning)' }}>{intensityAfter}</span>
                <span>📉</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={reset} className="btn btn-outline" style={{ flex: 1 }}>Another urge</button>
              <button onClick={() => router.push('/dashboard')} className="btn btn-primary" style={{ flex: 1, background: 'var(--warning)' }}>Done</button>
            </div>
          </div>
        )}

        <div style={{ height: '50px' }} />
      </div>
    </div>
  )
}