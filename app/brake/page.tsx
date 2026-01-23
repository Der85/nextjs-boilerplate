'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCopingSkillsForEmotion, CopingSkill } from '@/lib/adhderData'

type Step = 'impulse' | 'intensity' | 'observe' | 'cope' | 'proceed' | 'done'

const steps: { id: Step; label: string }[] = [
  { id: 'impulse', label: 'The urge' },
  { id: 'intensity', label: 'How strong?' },
  { id: 'observe', label: 'What\'s underneath?' },
  { id: 'cope', label: 'Cope first' },
  { id: 'proceed', label: 'Decide' },
]

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

const copingCategories = [
  { id: 'all', label: 'All' },
  { id: 'distraction', label: '🎯 Distract' },
  { id: 'expression', label: '💨 Express' },
  { id: 'grounding', label: '🌱 Ground' },
  { id: 'physical', label: '💪 Move' },
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
  const [selectedCategory, setSelectedCategory] = useState('all')
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

  const currentStepIndex = steps.findIndex(s => s.id === currentStep)

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

  const filteredSkills = selectedCategory === 'all' 
    ? suggestedSkills 
    : suggestedSkills.filter(s => s.category === selectedCategory)

  if (loading) {
    return (
      <div className="app-shell flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="app-shell bg-gradient-to-br from-amber-50 via-white to-orange-50">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-white/20">
        <div className="app-max py-4 flex items-center justify-between">
          <button 
            onClick={() => router.push('/dashboard')}
            className="btn btn-ghost flex items-center gap-2 text-amber-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Home
          </button>
          <h1 className="text-lg font-bold text-amber-800">Impulse Brake</h1>
          <div className="w-16" />
        </div>
      </header>

      {/* Progress */}
      {currentStep !== 'done' && (
        <div className="app-max pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-amber-700">
              {steps[currentStepIndex]?.label}
            </span>
            <span className="text-sm text-amber-500">
              {currentStepIndex + 1} of {steps.length}
            </span>
          </div>
          <div className="flex gap-1.5">
            {steps.map((step, i) => (
              <div
                key={step.id}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  i <= currentStepIndex 
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500' 
                    : 'bg-amber-200'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      <main className="app-max py-6 space-y-4">
        
        {/* Step 1: Impulse */}
        {currentStep === 'impulse' && (
          <section className="surface p-6 space-y-5">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30 mb-4">
                <span className="text-3xl">🛑</span>
              </div>
              <h2 className="text-xl font-bold text-slate-800">STOP</h2>
              <p className="text-slate-600 mt-1">What do you feel like doing right now?</p>
            </div>

            <textarea
              value={impulseText}
              onChange={(e) => setImpulseText(e.target.value)}
              placeholder="I want to..."
              className="input min-h-[100px]"
              autoFocus
            />

            <button
              onClick={() => setCurrentStep('intensity')}
              disabled={!impulseText.trim()}
              className="btn btn-primary w-full bg-gradient-to-r from-amber-500 to-orange-500"
            >
              Next →
            </button>
          </section>
        )}

        {/* Step 2: Intensity */}
        {currentStep === 'intensity' && (
          <section className="surface p-6 space-y-5">
            <div className="text-center">
              <span className="text-4xl">🌡️</span>
              <h2 className="text-xl font-bold text-slate-800 mt-2">How strong is this urge?</h2>
              <p className="text-slate-600 mt-1">1 = mild, 10 = overwhelming</p>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => setIntensityBefore(n)}
                  className={`h-12 rounded-xl font-bold transition-all ${
                    intensityBefore === n
                      ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg'
                      : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentStep('observe')}
              disabled={!intensityBefore}
              className="btn btn-primary w-full bg-gradient-to-r from-amber-500 to-orange-500"
            >
              Next →
            </button>
          </section>
        )}

        {/* Step 3: Observe */}
        {currentStep === 'observe' && (
          <section className="surface p-6 space-y-5">
            <div className="text-center">
              <span className="text-4xl">👁️</span>
              <h2 className="text-xl font-bold text-slate-800 mt-2">What's underneath?</h2>
              <p className="text-slate-600 mt-1">Select all emotions you're feeling</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {emotions.map((emotion) => (
                <button
                  key={emotion.id}
                  onClick={() => toggleEmotion(emotion.id)}
                  className={`surface card-hover p-3 flex items-center gap-3 text-left ${
                    selectedEmotions.includes(emotion.id)
                      ? 'bg-amber-100 border-amber-400'
                      : 'bg-slate-50'
                  }`}
                >
                  <span className="text-xl">{emotion.icon}</span>
                  <span className="font-medium text-slate-700">{emotion.label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={handleObserveDone}
              disabled={selectedEmotions.length === 0}
              className="btn btn-primary w-full bg-gradient-to-r from-amber-500 to-orange-500"
            >
              Next →
            </button>
          </section>
        )}

        {/* Step 4: Cope */}
        {currentStep === 'cope' && (
          <section className="surface p-6 space-y-5">
            <div className="text-center">
              <span className="text-4xl">🧘</span>
              <h2 className="text-xl font-bold text-slate-800 mt-2">Try a coping skill first</h2>
              <p className="text-slate-600 mt-1">Pick one and do it before deciding</p>
            </div>

            {/* Category filter */}
            <div className="flex flex-wrap gap-2">
              {copingCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-amber-500 text-white'
                      : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredSkills.slice(0, 6).map((skill) => (
                <button
                  key={skill.text}
                  onClick={() => handleSkillUsed(skill)}
                  className="surface card-hover w-full p-4 text-left bg-slate-50"
                >
                  <p className="font-medium text-slate-800">{skill.text}</p>
                  <p className="text-sm text-slate-500 mt-1">{skill.why}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                      {skill.duration}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                      {skill.intensity}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentStep('proceed')}
              className="btn btn-ghost w-full"
            >
              Skip for now →
            </button>
          </section>
        )}

        {/* Step 5: Proceed */}
        {currentStep === 'proceed' && (
          <section className="surface p-6 space-y-5">
            <div className="text-center">
              <span className="text-4xl">🤔</span>
              <h2 className="text-xl font-bold text-slate-800 mt-2">Now decide</h2>
              <p className="text-slate-600 mt-1">After pausing, what do you want to do?</p>
            </div>

            {usedSkill && (
              <div className="surface p-4 bg-green-50 border-green-200/50">
                <p className="text-sm text-green-600 font-medium">You tried:</p>
                <p className="text-green-800">{usedSkill.text}</p>
              </div>
            )}

            {/* Intensity check */}
            <div>
              <p className="text-center text-slate-700 mb-3 font-medium">How strong is the urge now?</p>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <button
                    key={n}
                    onClick={() => setIntensityAfter(n)}
                    className={`h-10 rounded-lg font-bold text-sm transition-all ${
                      intensityAfter === n
                        ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white'
                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4">
              <button
                onClick={() => handleComplete(false)}
                disabled={saving}
                className="btn btn-primary bg-gradient-to-r from-green-500 to-emerald-500 py-4"
              >
                <span className="text-2xl mb-1">✓</span>
                <span className="block text-sm">I'll wait</span>
              </button>
              <button
                onClick={() => handleComplete(true)}
                disabled={saving}
                className="btn btn-ghost py-4 border-2 border-amber-300 bg-amber-50"
              >
                <span className="text-2xl mb-1">→</span>
                <span className="block text-sm text-amber-700">I'll do it</span>
              </button>
            </div>
          </section>
        )}

        {/* Done */}
        {currentStep === 'done' && (
          <section className="surface p-6 text-center space-y-5">
            <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center shadow-lg ${
              actedOnImpulse === false 
                ? 'bg-gradient-to-br from-green-400 to-emerald-500 shadow-green-500/30'
                : 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-500/30'
            }`}>
              <span className="text-4xl">{actedOnImpulse === false ? '🌟' : '👍'}</span>
            </div>
            
            <h2 className="text-xl font-bold text-slate-800">
              {actedOnImpulse === false ? 'You hit the brakes!' : 'You made a choice'}
            </h2>
            
            <p className="text-slate-600">
              {actedOnImpulse === false 
                ? 'You paused, observed, and chose not to act impulsively. That takes real strength.'
                : 'You paused and made a conscious decision. That awareness matters.'
              }
            </p>

            {intensityBefore && intensityAfter && intensityAfter < intensityBefore && (
              <div className="inline-flex items-center gap-3 surface px-5 py-3 bg-amber-50">
                <span className="text-amber-600 font-medium">Urge:</span>
                <span className="text-2xl font-bold text-amber-400">{intensityBefore}</span>
                <span className="text-amber-300">→</span>
                <span className="text-2xl font-bold text-amber-600">{intensityAfter}</span>
                <span className="text-xl">📉</span>
              </div>
            )}

            {usedSkill && (
              <div className="surface p-4 bg-green-50 border-green-200/50">
                <p className="text-sm text-green-600 font-medium">Coping skill used:</p>
                <p className="text-green-800">{usedSkill.text}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={reset} className="btn btn-ghost flex-1">
                Another urge
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="btn btn-primary flex-1 bg-gradient-to-r from-amber-500 to-orange-500"
              >
                Done
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
