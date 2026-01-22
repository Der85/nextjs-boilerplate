'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Step = 'intro' | 'physical' | 'mental' | 'emotional' | 'results' | 'recovery' | 'complete'

interface Symptom {
  id: string
  text: string
  icon: string
}

interface RecoveryAction {
  id: string
  text: string
  icon: string
  forLevels: ('green' | 'yellow' | 'red')[]
}

// Symptoms based on ADHD Burnout Worksheet
const physicalSymptoms: Symptom[] = [
  { id: 'exhausted_after_sleep', text: 'Still exhausted after sleeping', icon: '😴' },
  { id: 'body_aches', text: 'Unexplained body aches or tension', icon: '🤕' },
  { id: 'frequent_illness', text: 'Getting sick more often', icon: '🤒' },
  { id: 'appetite_changes', text: 'Eating way more or way less', icon: '🍽️' },
  { id: 'sleep_problems', text: 'Can\'t fall asleep or stay asleep', icon: '🌙' },
  { id: 'low_energy', text: 'No energy even for easy tasks', icon: '🔋' },
  { id: 'headaches', text: 'Frequent headaches', icon: '🤯' },
  { id: 'neglecting_hygiene', text: 'Struggling with basic hygiene', icon: '🚿' }
]

const mentalSymptoms: Symptom[] = [
  { id: 'brain_fog', text: 'Constant brain fog', icon: '🌫️' },
  { id: 'cant_focus', text: 'Can\'t focus on anything', icon: '🎯' },
  { id: 'decision_paralysis', text: 'Even tiny decisions feel impossible', icon: '🤔' },
  { id: 'forgetting_everything', text: 'Forgetting everything', icon: '🧠' },
  { id: 'no_motivation', text: 'Zero motivation', icon: '📉' },
  { id: 'dreading_tasks', text: 'Dreading future tasks', icon: '😰' },
  { id: 'time_blindness_worse', text: 'Time blindness is way worse', icon: '⏰' },
  { id: 'cant_start_anything', text: 'Can\'t start anything new', icon: '🚫' }
]

const emotionalSymptoms: Symptom[] = [
  { id: 'irritable', text: 'Snapping at people easily', icon: '😤' },
  { id: 'numb', text: 'Feeling numb or empty', icon: '😶' },
  { id: 'hopeless', text: 'Hopeless about the future', icon: '😔' },
  { id: 'overwhelmed_by_small', text: 'Overwhelmed by small things', icon: '🌊' },
  { id: 'crying_easily', text: 'Crying more than usual', icon: '😢' },
  { id: 'no_joy', text: 'Nothing brings joy anymore', icon: '💔' },
  { id: 'isolated', text: 'Withdrawing from everyone', icon: '🏠' },
  { id: 'shame_spiral', text: 'Constant shame spirals', icon: '🌀' }
]

const recoveryActions: RecoveryAction[] = [
  // Green level - preventative
  { id: 'say_no', text: 'Say no to one commitment this week', icon: '🚫', forLevels: ['green', 'yellow'] },
  { id: 'rest_day', text: 'Schedule a full rest day', icon: '🛋️', forLevels: ['green', 'yellow'] },
  { id: 'nature_time', text: 'Spend 20 minutes outside today', icon: '🌳', forLevels: ['green', 'yellow'] },
  { id: 'sleep_priority', text: 'Protect your sleep this week', icon: '😴', forLevels: ['green', 'yellow', 'red'] },
  
  // Yellow level - moderate intervention
  { id: 'cancel_plans', text: 'Cancel non-essential plans', icon: '📅', forLevels: ['yellow', 'red'] },
  { id: 'ask_help', text: 'Ask someone for help with one task', icon: '🤝', forLevels: ['yellow', 'red'] },
  { id: 'reduce_inputs', text: 'Reduce social media and news', icon: '📵', forLevels: ['yellow', 'red'] },
  { id: 'lower_standards', text: 'Lower your standards temporarily', icon: '📊', forLevels: ['yellow', 'red'] },
  
  // Red level - emergency recovery
  { id: 'sick_day', text: 'Take a mental health sick day', icon: '🏥', forLevels: ['red'] },
  { id: 'bare_minimum', text: 'Only do the absolute bare minimum', icon: '⬇️', forLevels: ['red'] },
  { id: 'tell_someone', text: 'Tell someone you trust how you\'re feeling', icon: '💬', forLevels: ['red'] },
  { id: 'professional_help', text: 'Reach out to a therapist or doctor', icon: '👨‍⚕️', forLevels: ['red'] }
]

export default function BurnoutPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // Flow state
  const [step, setStep] = useState<Step>('intro')
  
  // Selections
  const [selectedPhysical, setSelectedPhysical] = useState<string[]>([])
  const [selectedMental, setSelectedMental] = useState<string[]>([])
  const [selectedEmotional, setSelectedEmotional] = useState<string[]>([])
  
  // Results
  const [totalScore, setTotalScore] = useState(0)
  const [severityLevel, setSeverityLevel] = useState<'green' | 'yellow' | 'red'>('green')
  
  // Recovery
  const [selectedRecovery, setSelectedRecovery] = useState<string | null>(null)
  const [customRecovery, setCustomRecovery] = useState('')
  const [reflectionNote, setReflectionNote] = useState('')
  
  // Previous data
  const [lastLog, setLastLog] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUser(session.user)
      await fetchLastLog(session.user.id)
      setLoading(false)
    }
    checkUser()
  }, [router])

  const fetchLastLog = async (userId: string) => {
    const { data } = await supabase
      .from('burnout_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (data) {
      setLastLog(data)
    }
  }

  const toggleSymptom = (id: string, list: string[], setList: (l: string[]) => void) => {
    if (list.includes(id)) {
      setList(list.filter(s => s !== id))
    } else {
      setList([...list, id])
    }
  }

  const calculateResults = () => {
    const score = selectedPhysical.length + selectedMental.length + selectedEmotional.length
    setTotalScore(score)
    
    // Scoring logic based on worksheet
    // 0-7: Green (Manageable)
    // 8-14: Yellow (Moderate Burnout)
    // 15+: Red (Significant Burnout)
    if (score <= 7) {
      setSeverityLevel('green')
    } else if (score <= 14) {
      setSeverityLevel('yellow')
    } else {
      setSeverityLevel('red')
    }
    
    setStep('results')
  }

  const getAvailableRecoveryActions = () => {
    return recoveryActions.filter(action => action.forLevels.includes(severityLevel))
  }

  const saveBurnoutLog = async () => {
    setSaving(true)
    
    const { error } = await supabase
      .from('burnout_logs')
      .insert({
        user_id: user.id,
        total_score: totalScore,
        severity_level: severityLevel,
        symptoms_physical: selectedPhysical,
        symptoms_mental: selectedMental,
        symptoms_emotional: selectedEmotional,
        recovery_action: selectedRecovery,
        custom_recovery_action: customRecovery || null,
        reflection_note: reflectionNote || null,
        week_of: new Date().toISOString().split('T')[0]
      })

    if (!error) {
      setStep('complete')
    }
    setSaving(false)
  }

  const getSeverityColor = (level: string) => {
    switch (level) {
      case 'green': return 'bg-green-500'
      case 'yellow': return 'bg-yellow-500'
      case 'red': return 'bg-red-500'
      default: return 'bg-slate-500'
    }
  }

  const getSeverityBgColor = (level: string) => {
    switch (level) {
      case 'green': return 'bg-green-50 border-green-200'
      case 'yellow': return 'bg-yellow-50 border-yellow-200'
      case 'red': return 'bg-red-50 border-red-200'
      default: return 'bg-slate-50 border-slate-200'
    }
  }

  const getSeverityTextColor = (level: string) => {
    switch (level) {
      case 'green': return 'text-green-700'
      case 'yellow': return 'text-yellow-700'
      case 'red': return 'text-red-700'
      default: return 'text-slate-700'
    }
  }

  const getSeverityLabel = (level: string) => {
    switch (level) {
      case 'green': return 'Manageable Stress'
      case 'yellow': return 'Moderate Burnout'
      case 'red': return 'Significant Burnout'
      default: return ''
    }
  }

  const getSeverityMessage = (level: string) => {
    switch (level) {
      case 'green':
        return "You're doing okay, but stay aware. Small preventative actions now can keep you from sliding into burnout."
      case 'yellow':
        return "You're in the warning zone. Your brain and body are sending signals. It's time to scale back and prioritize recovery."
      case 'red':
        return "You're in burnout. This isn't weakness—it's your system telling you it needs repair. Radical rest and boundary-setting are essential now."
      default:
        return ''
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <button 
            onClick={() => router.push('/dashboard')}
            className="text-slate-600 hover:text-slate-800 font-medium flex items-center gap-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-lg font-bold text-slate-700">Burnout Barometer</h1>
          <div className="w-16"></div>
        </div>
      </header>

      {/* Progress - only show during quiz */}
      {!['intro', 'complete'].includes(step) && (
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <div className="flex gap-1.5">
            {['physical', 'mental', 'emotional', 'results', 'recovery'].map((s, i) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  ['physical', 'mental', 'emotional', 'results', 'recovery'].indexOf(step) >= i 
                    ? 'bg-slate-500' 
                    : 'bg-slate-300'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-6">
        
        {/* Intro */}
        {step === 'intro' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-5xl">🔋</span>
              <h2 className="text-xl font-bold text-slate-800">Weekly Battery Check</h2>
              <p className="text-slate-600 text-sm">
                ADHD burnout sneaks up slowly. This check-in helps you catch it early.
              </p>
            </div>

            {/* Last check-in info */}
            {lastLog && (
              <div className={`p-4 rounded-xl border-2 ${getSeverityBgColor(lastLog.severity_level)}`}>
                <p className="text-sm text-slate-600">
                  Last check-in: <strong>{new Date(lastLog.created_at).toLocaleDateString()}</strong>
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-3 h-3 rounded-full ${getSeverityColor(lastLog.severity_level)}`}></div>
                  <span className={`font-medium ${getSeverityTextColor(lastLog.severity_level)}`}>
                    {getSeverityLabel(lastLog.severity_level)} ({lastLog.total_score}/24)
                  </span>
                </div>
              </div>
            )}

            <div className="bg-slate-50 p-4 rounded-xl">
              <p className="text-slate-700 text-sm">
                <strong>How it works:</strong> You'll check symptoms across 3 areas (physical, mental, emotional). 
                Your total determines your burnout level, and you'll get matched recovery actions.
              </p>
            </div>

            <button
              onClick={() => setStep('physical')}
              className="w-full bg-slate-700 hover:bg-slate-800 text-white font-semibold py-4 rounded-xl transition"
            >
              Start Check-in →
            </button>
          </div>
        )}

        {/* Physical Symptoms */}
        {step === 'physical' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-4xl">🏃</span>
              <h2 className="text-xl font-bold text-slate-800">Physical Signs</h2>
              <p className="text-slate-600 text-sm">Select all that apply this week</p>
            </div>

            <div className="grid gap-2">
              {physicalSymptoms.map((symptom) => (
                <button
                  key={symptom.id}
                  onClick={() => toggleSymptom(symptom.id, selectedPhysical, setSelectedPhysical)}
                  className={`flex items-center gap-3 p-4 rounded-xl transition-all text-left ${
                    selectedPhysical.includes(symptom.id)
                      ? 'bg-red-100 border-2 border-red-400'
                      : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'
                  }`}
                >
                  <span className="text-xl">{symptom.icon}</span>
                  <span className="text-slate-700">{symptom.text}</span>
                  {selectedPhysical.includes(symptom.id) && (
                    <span className="ml-auto text-red-500">✓</span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-sm text-slate-500">
                {selectedPhysical.length} selected
              </span>
              <button
                onClick={() => setStep('mental')}
                className="bg-slate-700 hover:bg-slate-800 text-white font-semibold px-6 py-3 rounded-xl transition"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Mental Symptoms */}
        {step === 'mental' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-4xl">🧠</span>
              <h2 className="text-xl font-bold text-slate-800">Mental Signs</h2>
              <p className="text-slate-600 text-sm">Select all that apply this week</p>
            </div>

            <div className="grid gap-2">
              {mentalSymptoms.map((symptom) => (
                <button
                  key={symptom.id}
                  onClick={() => toggleSymptom(symptom.id, selectedMental, setSelectedMental)}
                  className={`flex items-center gap-3 p-4 rounded-xl transition-all text-left ${
                    selectedMental.includes(symptom.id)
                      ? 'bg-yellow-100 border-2 border-yellow-400'
                      : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'
                  }`}
                >
                  <span className="text-xl">{symptom.icon}</span>
                  <span className="text-slate-700">{symptom.text}</span>
                  {selectedMental.includes(symptom.id) && (
                    <span className="ml-auto text-yellow-600">✓</span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-sm text-slate-500">
                {selectedMental.length} selected
              </span>
              <button
                onClick={() => setStep('emotional')}
                className="bg-slate-700 hover:bg-slate-800 text-white font-semibold px-6 py-3 rounded-xl transition"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Emotional Symptoms */}
        {step === 'emotional' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-4xl">💙</span>
              <h2 className="text-xl font-bold text-slate-800">Emotional Signs</h2>
              <p className="text-slate-600 text-sm">Select all that apply this week</p>
            </div>

            <div className="grid gap-2">
              {emotionalSymptoms.map((symptom) => (
                <button
                  key={symptom.id}
                  onClick={() => toggleSymptom(symptom.id, selectedEmotional, setSelectedEmotional)}
                  className={`flex items-center gap-3 p-4 rounded-xl transition-all text-left ${
                    selectedEmotional.includes(symptom.id)
                      ? 'bg-blue-100 border-2 border-blue-400'
                      : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'
                  }`}
                >
                  <span className="text-xl">{symptom.icon}</span>
                  <span className="text-slate-700">{symptom.text}</span>
                  {selectedEmotional.includes(symptom.id) && (
                    <span className="ml-auto text-blue-500">✓</span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-sm text-slate-500">
                {selectedEmotional.length} selected
              </span>
              <button
                onClick={calculateResults}
                className="bg-slate-700 hover:bg-slate-800 text-white font-semibold px-6 py-3 rounded-xl transition"
              >
                See Results →
              </button>
            </div>
          </div>
        )}

        {/* Results */}
        {step === 'results' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-5xl">🔋</span>
              <h2 className="text-xl font-bold text-slate-800">Your Burnout Level</h2>
            </div>

            {/* Battery visualization */}
            <div className="flex justify-center">
              <div className="w-32 h-48 border-4 border-slate-300 rounded-2xl relative overflow-hidden">
                {/* Battery cap */}
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-12 h-4 bg-slate-300 rounded-t-lg"></div>
                
                {/* Battery level */}
                <div 
                  className={`absolute bottom-0 left-0 right-0 transition-all duration-1000 ${
                    severityLevel === 'green' ? 'bg-green-400' :
                    severityLevel === 'yellow' ? 'bg-yellow-400' : 'bg-red-400'
                  }`}
                  style={{ 
                    height: `${Math.max(10, 100 - (totalScore / 24 * 100))}%` 
                  }}
                ></div>
                
                {/* Score overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold text-white drop-shadow-lg">
                    {totalScore}
                  </span>
                </div>
              </div>
            </div>

            {/* Severity label */}
            <div className={`p-4 rounded-xl border-2 text-center ${getSeverityBgColor(severityLevel)}`}>
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className={`w-4 h-4 rounded-full ${getSeverityColor(severityLevel)}`}></div>
                <span className={`text-lg font-bold ${getSeverityTextColor(severityLevel)}`}>
                  {getSeverityLabel(severityLevel)}
                </span>
              </div>
              <p className={`text-sm ${getSeverityTextColor(severityLevel)}`}>
                {getSeverityMessage(severityLevel)}
              </p>
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-red-50 p-3 rounded-xl">
                <div className="text-xl font-bold text-red-600">{selectedPhysical.length}</div>
                <div className="text-xs text-red-500">Physical</div>
              </div>
              <div className="bg-yellow-50 p-3 rounded-xl">
                <div className="text-xl font-bold text-yellow-600">{selectedMental.length}</div>
                <div className="text-xs text-yellow-500">Mental</div>
              </div>
              <div className="bg-blue-50 p-3 rounded-xl">
                <div className="text-xl font-bold text-blue-600">{selectedEmotional.length}</div>
                <div className="text-xs text-blue-500">Emotional</div>
              </div>
            </div>

            {/* Comparison with last week */}
            {lastLog && (
              <div className="bg-slate-50 p-3 rounded-xl text-center">
                <p className="text-sm text-slate-600">
                  Last week: <strong>{lastLog.total_score}/24</strong>
                  {totalScore > lastLog.total_score && (
                    <span className="text-red-500 ml-2">↑ {totalScore - lastLog.total_score}</span>
                  )}
                  {totalScore < lastLog.total_score && (
                    <span className="text-green-500 ml-2">↓ {lastLog.total_score - totalScore}</span>
                  )}
                  {totalScore === lastLog.total_score && (
                    <span className="text-slate-400 ml-2">→ Same</span>
                  )}
                </p>
              </div>
            )}

            <button
              onClick={() => setStep('recovery')}
              className="w-full bg-slate-700 hover:bg-slate-800 text-white font-semibold py-4 rounded-xl transition"
            >
              Get Recovery Actions →
            </button>
          </div>
        )}

        {/* Recovery Actions */}
        {step === 'recovery' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-4xl">💚</span>
              <h2 className="text-xl font-bold text-slate-800">Recovery Actions</h2>
              <p className="text-slate-600 text-sm">
                Choose one thing to commit to this week
              </p>
            </div>

            <div className="grid gap-2">
              {getAvailableRecoveryActions().map((action) => (
                <button
                  key={action.id}
                  onClick={() => {
                    setSelectedRecovery(action.id)
                    setCustomRecovery('')
                  }}
                  className={`flex items-center gap-3 p-4 rounded-xl transition-all text-left border-2 ${
                    selectedRecovery === action.id
                      ? 'bg-green-100 border-green-400'
                      : 'bg-slate-50 border-transparent hover:bg-slate-100'
                  }`}
                >
                  <span className="text-2xl">{action.icon}</span>
                  <span className="text-slate-700">{action.text}</span>
                  {selectedRecovery === action.id && (
                    <span className="ml-auto text-green-500">✓</span>
                  )}
                </button>
              ))}
            </div>

            {/* Custom action */}
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-sm text-slate-600 mb-2">Or write your own:</p>
              <input
                type="text"
                value={customRecovery}
                onChange={(e) => {
                  setCustomRecovery(e.target.value)
                  setSelectedRecovery(null)
                }}
                placeholder="I will..."
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-slate-400 outline-none text-sm"
              />
            </div>

            {/* Optional reflection */}
            <div>
              <p className="text-sm text-slate-600 mb-2">Any thoughts to capture? (optional)</p>
              <textarea
                value={reflectionNote}
                onChange={(e) => setReflectionNote(e.target.value)}
                placeholder="What's contributing to how you're feeling..."
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-slate-400 outline-none resize-none text-sm"
              />
            </div>

            <button
              onClick={saveBurnoutLog}
              disabled={(!selectedRecovery && !customRecovery) || saving}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-4 rounded-xl transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Complete Check-in →'}
            </button>
          </div>
        )}

        {/* Complete */}
        {step === 'complete' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 text-center animate-fadeIn">
            <span className="text-5xl">✅</span>
            <h2 className="text-xl font-bold text-slate-800">Check-in Complete</h2>
            
            <p className="text-slate-600">
              You've taken the first step by being honest about where you're at.
            </p>

            <div className={`p-4 rounded-xl border-2 ${getSeverityBgColor(severityLevel)}`}>
              <p className={`font-medium ${getSeverityTextColor(severityLevel)}`}>
                Your commitment this week:
              </p>
              <p className={`text-lg mt-1 ${getSeverityTextColor(severityLevel)}`}>
                {selectedRecovery 
                  ? recoveryActions.find(a => a.id === selectedRecovery)?.text 
                  : customRecovery
                }
              </p>
            </div>

            {severityLevel === 'red' && (
              <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                <p className="text-red-700 text-sm">
                  <strong>Remember:</strong> Burnout isn't a personal failure. 
                  Your brain has been working overtime. Recovery isn't optional—it's necessary.
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex-1 bg-slate-700 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl transition"
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
