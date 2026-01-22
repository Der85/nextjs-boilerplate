'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  emotions, 
  physicalSensations, 
  externalTriggers,
  stepBackActions,
  proceedResponses,
  getCopingSkillsForEmotion,
  getCopingSkills,
  getRandomAffirmation,
  CopingSkill
} from '@/lib/adhderData'

type Step = 'start' | 'stop' | 'step_back' | 'observe' | 'affirmation' | 'coping' | 'proceed' | 'complete'

export default function BrakePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // Flow state
  const [step, setStep] = useState<Step>('start')
  const [intensityBefore, setIntensityBefore] = useState<number | null>(null)
  
  // STOP state
  const [stopProgress, setStopProgress] = useState(0)
  const [isHolding, setIsHolding] = useState(false)
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [stopDuration, setStopDuration] = useState(0)
  
  // Step back
  const [selectedStepBack, setSelectedStepBack] = useState<string | null>(null)
  
  // Observe
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([])
  const [selectedSensations, setSelectedSensations] = useState<string[]>([])
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>([])
  const [thoughtStory, setThoughtStory] = useState('')
  
  // Coping Skills
  const [suggestedCopingSkills, setSuggestedCopingSkills] = useState<CopingSkill[]>([])
  const [selectedCopingSkill, setSelectedCopingSkill] = useState<CopingSkill | null>(null)
  const [copingFilter, setCopingFilter] = useState<'all' | 'distraction' | 'expression' | 'grounding' | 'physical'>('all')
  const [usedCopingSkill, setUsedCopingSkill] = useState(false)
  
  // Proceed
  const [chosenResponse, setChosenResponse] = useState<string | null>(null)
  
  // Completion
  const [intensityAfter, setIntensityAfter] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  
  // Affirmation (shown if shame detected)
  const [affirmation, setAffirmation] = useState<string>('')

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUser(session.user)
      setLoading(false)
    }
    checkUser()
  }, [router])

  // Handle the STOP hold interaction
  const startHold = () => {
    setIsHolding(true)
    const startTime = Date.now()
    
    holdTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000
      const progress = Math.min((elapsed / 10) * 100, 100)
      setStopProgress(progress)
      setStopDuration(Math.floor(elapsed))
      
      if (elapsed >= 10) {
        if (holdTimerRef.current) clearInterval(holdTimerRef.current)
        setStep('step_back')
      }
    }, 100)
  }

  const endHold = () => {
    setIsHolding(false)
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current)
    }
    if (stopProgress < 100) {
      setStopProgress(0)
    }
  }

  const toggleTag = (tag: string, list: string[], setList: (l: string[]) => void) => {
    if (list.includes(tag)) {
      setList(list.filter(t => t !== tag))
    } else {
      setList([...list, tag])
    }
  }

  const handleObserveComplete = () => {
    // Check for shame - show affirmation first
    if (selectedEmotions.includes('shame') || selectedEmotions.includes('rejection')) {
      setAffirmation(getRandomAffirmation())
      setStep('affirmation')
    } else {
      // Generate coping skills based on emotions
      const skills = getCopingSkillsForEmotion(selectedEmotions)
      setSuggestedCopingSkills(skills)
      setStep('coping')
    }
  }

  const handleAffirmationContinue = () => {
    const skills = getCopingSkillsForEmotion(selectedEmotions)
    setSuggestedCopingSkills(skills)
    setStep('coping')
  }

  const handleFilterChange = (filter: typeof copingFilter) => {
    setCopingFilter(filter)
    if (filter === 'all') {
      setSuggestedCopingSkills(getCopingSkillsForEmotion(selectedEmotions))
    } else {
      setSuggestedCopingSkills(getCopingSkills(filter).slice(0, 4))
    }
  }

  const handleCopingSkillSelect = (skill: CopingSkill) => {
    setSelectedCopingSkill(skill)
  }

  const handleUsedCopingSkill = () => {
    setUsedCopingSkill(true)
    setStep('proceed')
  }

  const handleSkipCoping = () => {
    setStep('proceed')
  }

  const handleComplete = async () => {
    if (!chosenResponse) return
    
    setSaving(true)
    
    const { error } = await supabase
      .from('impulse_events')
      .insert({
        user_id: user.id,
        stop_duration_seconds: stopDuration,
        step_back_action: selectedStepBack,
        emotions: selectedEmotions,
        physical_sensations: selectedSensations,
        external_triggers: selectedTriggers,
        thought_story: thoughtStory || null,
        chosen_response: chosenResponse,
        intensity_before: intensityBefore,
        intensity_after: intensityAfter,
        completed_flow: true
      })

    if (!error) {
      setStep('complete')
    }
    setSaving(false)
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'distraction': return '🎯'
      case 'expression': return '💨'
      case 'grounding': return '🌱'
      case 'physical': return '💪'
      default: return '✨'
    }
  }

  const getDurationLabel = (duration: string) => {
    switch (duration) {
      case 'quick': return '< 2 min'
      case 'medium': return '2-10 min'
      case 'long': return '10+ min'
      default: return ''
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <button 
            onClick={() => router.push('/dashboard')}
            className="text-amber-600 hover:text-amber-800 font-medium flex items-center gap-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Exit
          </button>
          <h1 className="text-lg font-bold text-amber-700">S.T.O.P.</h1>
          <div className="w-16"></div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        
        {/* START: Intensity Rating */}
        {step === 'start' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-6 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-5xl">🛑</span>
              <h2 className="text-xl font-bold text-slate-800">You're about to react</h2>
              <p className="text-slate-600 text-sm">Let's create a gap between impulse and action.</p>
            </div>

            <div className="space-y-3">
              <p className="text-center text-slate-700">How intense is this feeling?</p>
              <div className="flex justify-center gap-3">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    onClick={() => {
                      setIntensityBefore(level)
                      setStep('stop')
                    }}
                    className="w-12 h-12 rounded-full text-lg font-bold transition-all bg-amber-100 text-amber-700 hover:bg-amber-200 hover:scale-110"
                  >
                    {level}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-xs text-slate-400 px-4">
                <span>Mild urge</span>
                <span>About to explode</span>
              </div>
            </div>
          </div>
        )}

        {/* S - STOP: Hold to pause */}
        {step === 'stop' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-6 animate-fadeIn">
            <div className="text-center space-y-2">
              <div className="text-6xl">✋</div>
              <h2 className="text-2xl font-bold text-slate-800">STOP</h2>
              <p className="text-slate-600">Freeze. Don't move a muscle.</p>
            </div>

            <div className="relative">
              <button
                onMouseDown={startHold}
                onMouseUp={endHold}
                onMouseLeave={endHold}
                onTouchStart={startHold}
                onTouchEnd={endHold}
                className={`w-full h-32 rounded-2xl font-bold text-xl transition-all ${
                  isHolding 
                    ? 'bg-amber-500 text-white scale-[0.98]' 
                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                }`}
              >
                {isHolding ? `Hold... ${10 - stopDuration}s` : 'Press & Hold'}
              </button>
              
              <div 
                className="absolute bottom-0 left-0 h-2 bg-amber-500 rounded-b-2xl transition-all"
                style={{ width: `${stopProgress}%` }}
              />
            </div>

            <p className="text-center text-sm text-slate-500">
              Hold for 10 seconds to interrupt the impulse
            </p>
          </div>
        )}

        {/* T - Take a Step Back */}
        {step === 'step_back' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-4xl">🚶</span>
              <h2 className="text-xl font-bold text-slate-800">Take a Step Back</h2>
              <p className="text-slate-600 text-sm">You paused. Now get some distance.</p>
            </div>

            <div className="grid gap-2">
              {stepBackActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => {
                    setSelectedStepBack(action.id)
                    setStep('observe')
                  }}
                  className="flex items-center gap-3 p-4 bg-amber-50 hover:bg-amber-100 rounded-xl transition-all text-left"
                >
                  <span className="text-2xl">{action.icon}</span>
                  <span className="font-medium text-slate-700">{action.text}</span>
                </button>
              ))}
            </div>

            <p className="text-center text-xs text-slate-500">
              Do one of these before continuing
            </p>
          </div>
        )}

        {/* O - Observe */}
        {step === 'observe' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-4xl">🔍</span>
              <h2 className="text-xl font-bold text-slate-800">Observe</h2>
              <p className="text-slate-600 text-sm">Be a detective. What's actually happening?</p>
            </div>

            {/* Emotions */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">What emotions? (select all)</p>
              <div className="flex flex-wrap gap-2">
                {emotions.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => toggleTag(e.id, selectedEmotions, setSelectedEmotions)}
                    className={`px-3 py-2 rounded-lg text-sm transition-all ${
                      selectedEmotions.includes(e.id)
                        ? 'bg-amber-500 text-white'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    {e.icon} {e.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Physical */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Body sensations?</p>
              <div className="flex flex-wrap gap-2">
                {physicalSensations.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => toggleTag(s.id, selectedSensations, setSelectedSensations)}
                    className={`px-3 py-2 rounded-lg text-sm transition-all ${
                      selectedSensations.includes(s.id)
                        ? 'bg-amber-500 text-white'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    {s.icon} {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Triggers */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">External triggers?</p>
              <div className="flex flex-wrap gap-2">
                {externalTriggers.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => toggleTag(t.id, selectedTriggers, setSelectedTriggers)}
                    className={`px-3 py-2 rounded-lg text-sm transition-all ${
                      selectedTriggers.includes(t.id)
                        ? 'bg-amber-500 text-white'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* The Story */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">What's your brain telling you?</p>
              <input
                type="text"
                value={thoughtStory}
                onChange={(e) => setThoughtStory(e.target.value)}
                placeholder="e.g., 'They hate me', 'I need this now'"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-sm"
              />
            </div>

            <button
              onClick={handleObserveComplete}
              disabled={selectedEmotions.length === 0}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3.5 rounded-xl transition disabled:opacity-50"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Affirmation (if shame detected) */}
        {step === 'affirmation' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-4xl">💚</span>
              <h2 className="text-xl font-bold text-slate-800">A moment of kindness</h2>
              <p className="text-slate-600 text-sm">Before we continue, read this:</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-teal-50 p-6 rounded-xl border-2 border-green-200">
              <p className="text-lg text-slate-800 text-center italic leading-relaxed">
                "{affirmation}"
              </p>
            </div>

            <p className="text-center text-sm text-slate-500">
              Your feelings are valid. Shame is not a helpful guide.
            </p>

            <button
              onClick={handleAffirmationContinue}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3.5 rounded-xl transition"
            >
              I've read this →
            </button>
          </div>
        )}

        {/* COPING SKILLS (New step) */}
        {step === 'coping' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-4xl">🛠️</span>
              <h2 className="text-xl font-bold text-slate-800">Coping Toolkit</h2>
              <p className="text-slate-600 text-sm">Try one of these before deciding what to do next.</p>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                { id: 'all', label: 'All', icon: '✨' },
                { id: 'distraction', label: 'Distract', icon: '🎯' },
                { id: 'expression', label: 'Express', icon: '💨' },
                { id: 'grounding', label: 'Ground', icon: '🌱' },
                { id: 'physical', label: 'Move', icon: '💪' }
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleFilterChange(cat.id as typeof copingFilter)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    copingFilter === cat.id
                      ? 'bg-amber-500 text-white'
                      : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  }`}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>

            {/* Coping Skills List */}
            <div className="grid gap-2">
              {suggestedCopingSkills.map((skill) => (
                <button
                  key={skill.id}
                  onClick={() => handleCopingSkillSelect(skill)}
                  className={`p-4 rounded-xl transition-all text-left border-2 ${
                    selectedCopingSkill?.id === skill.id
                      ? 'bg-amber-100 border-amber-500'
                      : 'bg-slate-50 border-transparent hover:bg-amber-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{getCategoryIcon(skill.category)}</span>
                    <div className="flex-1">
                      <div className="font-medium text-slate-800 text-sm">{skill.text}</div>
                      <div className="text-xs text-slate-500 mt-1">{skill.why}</div>
                      <div className="flex gap-2 mt-2">
                        <span className="text-xs px-2 py-0.5 bg-slate-200 rounded-full text-slate-600">
                          {getDurationLabel(skill.duration)}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-slate-200 rounded-full text-slate-600 capitalize">
                          {skill.intensity} energy
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              {selectedCopingSkill && (
                <button
                  onClick={handleUsedCopingSkill}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3.5 rounded-xl transition"
                >
                  ✓ I did this → Continue
                </button>
              )}
              <button
                onClick={handleSkipCoping}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium py-3 rounded-xl transition text-sm"
              >
                Skip for now →
              </button>
            </div>
          </div>
        )}

        {/* P - Proceed Mindfully */}
        {step === 'proceed' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-4xl">🎯</span>
              <h2 className="text-xl font-bold text-slate-800">Proceed Mindfully</h2>
              <p className="text-slate-600 text-sm">You have a choice. What aligns with your goals?</p>
            </div>

            {/* Show if they used a coping skill */}
            {usedCopingSkill && selectedCopingSkill && (
              <div className="bg-green-50 p-3 rounded-xl border border-green-200">
                <p className="text-green-700 text-sm">
                  ✓ You used: <strong>{selectedCopingSkill.text}</strong>
                </p>
              </div>
            )}

            <div className="grid gap-2">
              {proceedResponses.map((response) => (
                <button
                  key={response.id}
                  onClick={() => setChosenResponse(response.id)}
                  className={`flex items-center gap-3 p-4 rounded-xl transition-all text-left border-2 ${
                    chosenResponse === response.id
                      ? 'bg-amber-100 border-amber-500'
                      : 'bg-slate-50 border-transparent hover:bg-amber-50'
                  }`}
                >
                  <span className="text-2xl">{response.icon}</span>
                  <span className="font-medium text-slate-700">{response.text}</span>
                </button>
              ))}
            </div>

            {/* Post intensity */}
            <div className="pt-4 border-t">
              <p className="text-center text-slate-700 text-sm mb-3">How intense now?</p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    onClick={() => setIntensityAfter(level)}
                    className={`w-10 h-10 rounded-full text-sm font-bold transition-all ${
                      intensityAfter === level
                        ? 'bg-amber-500 text-white scale-110'
                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleComplete}
              disabled={!chosenResponse || saving}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3.5 rounded-xl transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : "I choose this →"}
            </button>
          </div>
        )}

        {/* Complete */}
        {step === 'complete' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 text-center animate-fadeIn">
            <span className="text-5xl">🌟</span>
            <h2 className="text-xl font-bold text-slate-800">You hit the brake</h2>
            
            <p className="text-slate-600 text-sm">
              You created a gap between impulse and action. That's powerful.
            </p>

            {intensityBefore && intensityAfter && (
              <div className="bg-amber-50 p-4 rounded-xl">
                <p className="text-amber-700 text-sm">
                  Intensity: <strong>{intensityBefore}</strong> → <strong>{intensityAfter}</strong>
                  {intensityAfter < intensityBefore && ' 🎉'}
                </p>
                {intensityAfter < intensityBefore && (
                  <p className="text-amber-600 text-xs mt-1">
                    You reduced the intensity by {intensityBefore - intensityAfter} points!
                  </p>
                )}
              </div>
            )}

            {usedCopingSkill && selectedCopingSkill && (
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                <p className="text-blue-800 font-medium text-sm">Coping skill used:</p>
                <p className="text-blue-700 mt-1 text-sm">{selectedCopingSkill.text}</p>
              </div>
            )}

            <div className="bg-green-50 p-4 rounded-xl border border-green-200">
              <p className="text-green-800 font-medium text-sm">Your mindful choice:</p>
              <p className="text-green-700 mt-1 text-sm">
                {proceedResponses.find(r => r.id === chosenResponse)?.text}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-xl transition text-sm"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
