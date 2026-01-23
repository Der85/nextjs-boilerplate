'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCopingSkillsForEmotion, CopingSkill } from '@/lib/adhderData'

type Step = 'impulse' | 'intensity' | 'observe' | 'cope' | 'proceed' | 'done'

const emotions = [
  { id: 'anger', label: 'Angry', icon: '😤' },
  { id: 'anxiety', label: 'Anxious', icon: '😰' },
  { id: 'sadness', label: 'Sad', icon: '😢' },
  { id: 'frustration', label: 'Frustrated', icon: '😤' },
  { id: 'overwhelm', label: 'Overwhelmed', icon: '🤯' },
  { id: 'boredom', label: 'Bored', icon: '😑' },
  { id: 'excitement', label: 'Excited', icon: '🤩' },
  { id: 'shame', label: 'Ashamed', icon: '😔' },
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
  const [suggestedSkills, setSuggestedSkills] = useState<CopingSkill[]>([])
  const [usedSkill, setUsedSkill] = useState<CopingSkill | null>(null)
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
    setSelectedEmotions(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    )
  }

  const handleObserveDone = () => {
    const skills = getCopingSkillsForEmotion(selectedEmotions)
    setSuggestedSkills(skills)
    setCurrentStep('cope')
  }

  const handleSkillUsed = (skill: CopingSkill) => {
    setUsedSkill(skill)
    setCurrentStep('proceed')
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
      coping_skill_used: usedSkill?.text || null,
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
        <div className="w-8 h-8 border-2 border-[#1da1f2] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const stepLabels = ['The urge', 'How strong?', 'What\'s underneath?', 'Cope first', 'Decide']
  const stepIndex = ['impulse', 'intensity', 'observe', 'cope', 'proceed'].indexOf(currentStep)

  return (
    <div className="app-container">
      {/* Top Bar */}
      <div className="top-bar">
        <div className="top-bar-inner">
          <button onClick={() => router.push('/dashboard')} className="btn btn-ghost btn-icon">
            ←
          </button>
          <h1 style={{ fontSize: '19px', fontWeight: 800 }}>STOP</h1>
          <div style={{ width: '36px' }} />
        </div>
      </div>

      <div className="main-content">
        {/* Progress */}
        {currentStep !== 'done' && (
          <div className="card">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-bold">{stepLabels[stepIndex]}</span>
              <span className="text-sm text-muted">{stepIndex + 1} of 5</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${((stepIndex + 1) / 5) * 100}%`, background: 'var(--warning)' }} />
            </div>
          </div>
        )}

        {/* Step 1: Impulse */}
        {currentStep === 'impulse' && (
          <div className="compose-box">
            <div className="text-center mb-4">
              <span className="emoji-large">🛑</span>
              <h2 className="text-xl font-extrabold mt-2">STOP</h2>
              <p className="text-muted">What do you feel like doing right now?</p>
            </div>

            <textarea
              value={impulseText}
              onChange={(e) => setImpulseText(e.target.value)}
              placeholder="I want to..."
              className="input-borderless w-full"
              rows={3}
              autoFocus
            />

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setCurrentStep('intensity')}
                disabled={!impulseText.trim()}
                className="btn btn-primary"
                style={{ background: 'var(--warning)' }}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Intensity */}
        {currentStep === 'intensity' && (
          <div className="card" style={{ textAlign: 'center', padding: '30px 15px' }}>
            <span className="emoji-large">🌡️</span>
            <h2 className="text-xl font-extrabold mt-3 mb-2">How strong is this urge?</h2>
            <p className="text-muted mb-4">1 = mild, 10 = overwhelming</p>
            
            <div className="rating-grid" style={{ justifyContent: 'center' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => setIntensityBefore(n)}
                  className={`rating-btn ${intensityBefore === n ? 'rating-btn-active' : ''}`}
                  style={intensityBefore === n ? { background: 'var(--warning)', borderColor: 'var(--warning)' } : {}}
                >
                  {n}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentStep('observe')}
              disabled={!intensityBefore}
              className="btn btn-primary btn-full mt-5"
              style={{ background: 'var(--warning)' }}
            >
              Next →
            </button>
          </div>
        )}

        {/* Step 3: Observe */}
        {currentStep === 'observe' && (
          <>
            <div className="page-header">
              <h2 className="page-title">What's underneath?</h2>
              <p className="page-subtitle">Select all emotions you're feeling</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              {emotions.map((emotion) => (
                <div
                  key={emotion.id}
                  className="card card-clickable"
                  onClick={() => toggleEmotion(emotion.id)}
                  style={{ 
                    borderLeft: selectedEmotions.includes(emotion.id) ? '3px solid var(--primary)' : '3px solid transparent',
                    background: selectedEmotions.includes(emotion.id) ? 'rgba(29, 161, 242, 0.05)' : undefined
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: '24px' }}>{emotion.icon}</span>
                    <span className="font-bold">{emotion.label}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="card">
              <button
                onClick={handleObserveDone}
                disabled={selectedEmotions.length === 0}
                className="btn btn-primary btn-full"
                style={{ background: 'var(--warning)' }}
              >
                Next →
              </button>
            </div>
          </>
        )}

        {/* Step 4: Cope */}
        {currentStep === 'cope' && (
          <>
            <div className="page-header">
              <h2 className="page-title">Try a coping skill first</h2>
              <p className="page-subtitle">Pick one and do it before deciding</p>
            </div>

            {suggestedSkills.slice(0, 5).map((skill) => (
              <div
                key={skill.text}
                className="card card-clickable"
                onClick={() => handleSkillUsed(skill)}
              >
                <p className="font-bold">{skill.text}</p>
                <p className="text-sm text-muted mt-1">{skill.why}</p>
                <div className="flex gap-2 mt-2">
                  <span style={{ 
                    fontSize: '12px', 
                    padding: '2px 8px', 
                    background: 'var(--bg-gray)', 
                    borderRadius: '4px',
                    color: 'var(--dark-gray)'
                  }}>
                    {skill.duration}
                  </span>
                  <span style={{ 
                    fontSize: '12px', 
                    padding: '2px 8px', 
                    background: 'var(--bg-gray)', 
                    borderRadius: '4px',
                    color: 'var(--dark-gray)'
                  }}>
                    {skill.intensity}
                  </span>
                </div>
              </div>
            ))}

            <div className="card">
              <button
                onClick={() => setCurrentStep('proceed')}
                className="btn btn-ghost btn-full"
              >
                Skip for now →
              </button>
            </div>
          </>
        )}

        {/* Step 5: Proceed */}
        {currentStep === 'proceed' && (
          <>
            <div className="page-header">
              <h2 className="page-title">Now decide</h2>
              <p className="page-subtitle">After pausing, what do you want to do?</p>
            </div>

            {usedSkill && (
              <div className="card" style={{ background: 'rgba(23, 191, 99, 0.05)', borderLeft: '3px solid var(--success)' }}>
                <p className="text-sm text-success font-bold">You tried:</p>
                <p>{usedSkill.text}</p>
              </div>
            )}

            <div className="card">
              <p className="font-bold mb-3 text-center">How strong is the urge now?</p>
              <div className="rating-grid" style={{ justifyContent: 'center' }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <button
                    key={n}
                    onClick={() => setIntensityAfter(n)}
                    className={`rating-btn ${intensityAfter === n ? 'rating-btn-active' : ''}`}
                    style={{ 
                      width: '40px', 
                      height: '40px',
                      ...(intensityAfter === n ? { background: 'var(--warning)', borderColor: 'var(--warning)' } : {})
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="flex gap-3">
                <button
                  onClick={() => handleComplete(false)}
                  disabled={saving}
                  className="btn btn-success btn-large"
                  style={{ flex: 1 }}
                >
                  ✓ I'll wait
                </button>
                <button
                  onClick={() => handleComplete(true)}
                  disabled={saving}
                  className="btn btn-outline btn-large"
                  style={{ flex: 1, borderColor: 'var(--warning)', color: 'var(--warning)' }}
                >
                  → I'll do it
                </button>
              </div>
            </div>
          </>
        )}

        {/* Done */}
        {currentStep === 'done' && (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ 
              width: '80px', 
              height: '80px', 
              background: actedOnImpulse === false ? 'var(--success)' : 'var(--warning)', 
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <span style={{ fontSize: '40px' }}>{actedOnImpulse === false ? '🌟' : '👍'}</span>
            </div>
            
            <h2 className="text-xl font-extrabold mb-2">
              {actedOnImpulse === false ? 'You hit the brakes!' : 'You made a choice'}
            </h2>
            
            <p className="text-muted mb-4">
              {actedOnImpulse === false 
                ? 'You paused, observed, and chose not to act impulsively.'
                : 'You paused and made a conscious decision. That awareness matters.'
              }
            </p>

            {intensityBefore && intensityAfter && intensityAfter < intensityBefore && (
              <div className="stats-row" style={{ justifyContent: 'center', marginBottom: '20px' }}>
                <span className="text-muted">Urge:</span>
                <span className="stat-value" style={{ color: 'var(--light-gray)' }}>{intensityBefore}</span>
                <span className="text-muted">→</span>
                <span className="stat-value" style={{ color: 'var(--warning)' }}>{intensityAfter}</span>
                <span>📉</span>
              </div>
            )}

            {usedSkill && (
              <div style={{ 
                background: 'rgba(23, 191, 99, 0.1)', 
                padding: '16px', 
                borderRadius: '12px',
                marginBottom: '20px'
              }}>
                <p className="text-sm text-success font-bold mb-1">Coping skill used:</p>
                <p>{usedSkill.text}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={reset} className="btn btn-outline" style={{ flex: 1 }}>
                Another urge
              </button>
              <button 
                onClick={() => router.push('/dashboard')} 
                className="btn btn-primary" 
                style={{ flex: 1, background: 'var(--warning)' }}
              >
                Done
              </button>
            </div>
          </div>
        )}

        <div style={{ height: '50px' }} />
      </div>
    </div>
  )
}
