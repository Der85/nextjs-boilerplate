'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface BreakdownStep {
  id: string
  text: string
  timeEstimate: string
  completed: boolean
}

type WizardStep = 'task' | 'reality' | 'breakdown' | 'supplies' | 'obstacles' | 'reward' | 'ready' | 'doing' | 'complete'

const commonDistractions = [
  { id: 'phone', label: 'Phone notifications', icon: '📱' },
  { id: 'social', label: 'Social media', icon: '📲' },
  { id: 'people', label: 'People interrupting', icon: '👥' },
  { id: 'hunger', label: 'Getting hungry', icon: '🍕' },
  { id: 'tired', label: 'Feeling tired', icon: '😴' },
  { id: 'noise', label: 'Noise/environment', icon: '🔊' },
  { id: 'thoughts', label: 'Racing thoughts', icon: '💭' },
  { id: 'perfectionism', label: 'Perfectionism paralysis', icon: '✨' }
]

const timeEstimates = ['5 min', '10 min', '15 min', '20 min', '30 min', '45 min', '1 hour', '1+ hours']

const rewardIdeas = [
  '☕ Coffee/tea break',
  '🎵 Listen to a favorite song',
  '📱 5 min phone time',
  '🍫 Small snack',
  '🚶 Quick walk',
  '🎮 10 min gaming',
  '📺 Watch one short video',
  '💬 Text a friend'
]

export default function FocusFoundryPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // Wizard state
  const [wizardStep, setWizardStep] = useState<WizardStep>('task')
  
  // Task data
  const [taskName, setTaskName] = useState('')
  const [drillSergeantTime, setDrillSergeantTime] = useState('')
  const [realisticTime, setRealisticTime] = useState('')
  
  // Breakdown
  const [breakdownSteps, setBreakdownSteps] = useState<BreakdownStep[]>([])
  const [newStepText, setNewStepText] = useState('')
  const [newStepTime, setNewStepTime] = useState('10 min')
  
  // Supplies
  const [supplies, setSupplies] = useState<string[]>([])
  const [newSupply, setNewSupply] = useState('')
  
  // Obstacles
  const [selectedDistractions, setSelectedDistractions] = useState<string[]>([])
  const [distractionPlan, setDistractionPlan] = useState('')
  
  // Rewards
  const [rewardStep1, setRewardStep1] = useState('')
  const [rewardComplete, setRewardComplete] = useState('')
  
  // Execution state
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [planId, setPlanId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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

  const addStep = () => {
    if (!newStepText.trim()) return
    
    const newStep: BreakdownStep = {
      id: Date.now().toString(),
      text: newStepText.trim(),
      timeEstimate: newStepTime,
      completed: false
    }
    
    setBreakdownSteps([...breakdownSteps, newStep])
    setNewStepText('')
  }

  const removeStep = (id: string) => {
    setBreakdownSteps(breakdownSteps.filter(s => s.id !== id))
  }

  const addSupply = () => {
    if (!newSupply.trim()) return
    setSupplies([...supplies, newSupply.trim()])
    setNewSupply('')
  }

  const removeSupply = (index: number) => {
    setSupplies(supplies.filter((_, i) => i !== index))
  }

  const toggleDistraction = (id: string) => {
    if (selectedDistractions.includes(id)) {
      setSelectedDistractions(selectedDistractions.filter(d => d !== id))
    } else {
      setSelectedDistractions([...selectedDistractions, id])
    }
  }

  const savePlan = async () => {
    setSaving(true)
    
    const { data, error } = await supabase
      .from('focus_plans')
      .insert({
        user_id: user.id,
        task_name: taskName,
        drill_sergeant_time: drillSergeantTime,
        realistic_time: realisticTime,
        breakdown_steps: breakdownSteps,
        supplies_needed: supplies,
        potential_distractions: selectedDistractions,
        distraction_plan: distractionPlan,
        reward_after_step1: rewardStep1,
        reward_after_complete: rewardComplete,
        total_steps: breakdownSteps.length,
        steps_completed: 0,
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (!error && data) {
      setPlanId(data.id)
      setWizardStep('doing')
    }
    setSaving(false)
  }

  const completeStep = async (stepIndex: number) => {
    const updatedSteps = [...breakdownSteps]
    updatedSteps[stepIndex].completed = true
    setBreakdownSteps(updatedSteps)
    
    const completedCount = updatedSteps.filter(s => s.completed).length
    
    // Update in database
    if (planId) {
      await supabase
        .from('focus_plans')
        .update({
          breakdown_steps: updatedSteps,
          steps_completed: completedCount,
          is_completed: completedCount === updatedSteps.length,
          completed_at: completedCount === updatedSteps.length ? new Date().toISOString() : null
        })
        .eq('id', planId)
    }
    
    // Check if all done
    if (completedCount === updatedSteps.length) {
      setWizardStep('complete')
    } else {
      setCurrentStepIndex(stepIndex + 1)
    }
  }

  const getTotalTime = () => {
    let totalMinutes = 0
    breakdownSteps.forEach(step => {
      const time = step.timeEstimate
      if (time.includes('hour')) {
        totalMinutes += parseInt(time) * 60 || 60
      } else {
        totalMinutes += parseInt(time) || 10
      }
    })
    
    if (totalMinutes >= 60) {
      const hours = Math.floor(totalMinutes / 60)
      const mins = totalMinutes % 60
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    }
    return `${totalMinutes} min`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-100 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <button 
            onClick={() => router.push('/dashboard')}
            className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-lg font-bold text-blue-700">Focus Foundry</h1>
          <div className="w-16"></div>
        </div>
      </header>

      {/* Progress - only show during wizard */}
      {!['doing', 'complete'].includes(wizardStep) && (
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <div className="flex gap-1.5">
            {['task', 'reality', 'breakdown', 'supplies', 'obstacles', 'reward', 'ready'].map((s, i) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  ['task', 'reality', 'breakdown', 'supplies', 'obstacles', 'reward', 'ready'].indexOf(wizardStep) >= i 
                    ? 'bg-blue-500' 
                    : 'bg-blue-200'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-6">
        
        {/* Step 1: Task Input */}
        {wizardStep === 'task' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-4xl">🔨</span>
              <h2 className="text-xl font-bold text-slate-800">What's the scary task?</h2>
              <p className="text-slate-600 text-sm">The one you've been avoiding. Let's break it down.</p>
            </div>

            <div>
              <input
                type="text"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="e.g., Clean the house, Write the report, Do taxes..."
                className="w-full px-4 py-4 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-lg"
                autoFocus
              />
            </div>

            <button
              onClick={() => setWizardStep('reality')}
              disabled={!taskName.trim()}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3.5 rounded-xl transition disabled:opacity-50"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 2: Drill Sergeant Reality Check */}
        {wizardStep === 'reality' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-4xl">🎖️</span>
              <h2 className="text-xl font-bold text-slate-800">The Drill Sergeant Check</h2>
              <p className="text-slate-600 text-sm">Let's expose those unrealistic expectations.</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl">
              <p className="text-slate-800 font-medium">Your task: "{taskName}"</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-red-600 mb-2">
                  🎖️ The Drill Sergeant says this should take:
                </label>
                <select
                  value={drillSergeantTime}
                  onChange={(e) => setDrillSergeantTime(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-red-200 focus:border-red-400 outline-none bg-red-50"
                >
                  <option value="">Select time...</option>
                  <option value="10 minutes">10 minutes</option>
                  <option value="30 minutes">30 minutes</option>
                  <option value="1 hour">1 hour</option>
                  <option value="2 hours">2 hours</option>
                  <option value="Half a day">Half a day</option>
                  <option value="One day">One day</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-green-600 mb-2">
                  💚 Realistically, with an ADHD brain, it might take:
                </label>
                <select
                  value={realisticTime}
                  onChange={(e) => setRealisticTime(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-green-200 focus:border-green-400 outline-none bg-green-50"
                >
                  <option value="">Select time...</option>
                  <option value="30 minutes">30 minutes</option>
                  <option value="1 hour">1 hour</option>
                  <option value="2 hours">2 hours</option>
                  <option value="Half a day">Half a day</option>
                  <option value="A full day">A full day</option>
                  <option value="Multiple sessions">Multiple sessions over days</option>
                  <option value="A week">A week (and that's okay!)</option>
                </select>
              </div>
            </div>

            {drillSergeantTime && realisticTime && (
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                <p className="text-blue-800 text-sm">
                  <strong>Reality check:</strong> The gap between "{drillSergeantTime}" and "{realisticTime}" 
                  isn't laziness—it's the difference between a neurotypical estimate and an ADHD-realistic one.
                </p>
              </div>
            )}

            <button
              onClick={() => setWizardStep('breakdown')}
              disabled={!drillSergeantTime || !realisticTime}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3.5 rounded-xl transition disabled:opacity-50"
            >
              Now let's break it down →
            </button>
          </div>
        )}

        {/* Step 3: Breakdown */}
        {wizardStep === 'breakdown' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-4xl">🧩</span>
              <h2 className="text-xl font-bold text-slate-800">Break it into tiny pieces</h2>
              <p className="text-slate-600 text-sm">What are the actual steps? Make them small!</p>
            </div>

            {/* Add step form */}
            <div className="space-y-3">
              <input
                type="text"
                value={newStepText}
                onChange={(e) => setNewStepText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addStep()}
                placeholder="e.g., Get the cleaning supplies out"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              />
              
              <div className="flex gap-2">
                <select
                  value={newStepTime}
                  onChange={(e) => setNewStepTime(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:border-blue-500 outline-none text-sm"
                >
                  {timeEstimates.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <button
                  onClick={addStep}
                  disabled={!newStepText.trim()}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition disabled:opacity-50"
                >
                  + Add
                </button>
              </div>
            </div>

            {/* Steps list */}
            {breakdownSteps.length > 0 && (
              <div className="space-y-2">
                {breakdownSteps.map((step, index) => (
                  <div
                    key={step.id}
                    className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl"
                  >
                    <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-slate-800 text-sm">{step.text}</p>
                      <p className="text-slate-500 text-xs">{step.timeEstimate}</p>
                    </div>
                    <button
                      onClick={() => removeStep(step.id)}
                      className="text-slate-400 hover:text-red-500 transition"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                
                <div className="text-right text-sm text-slate-500">
                  Total estimated time: <strong>{getTotalTime()}</strong>
                </div>
              </div>
            )}

            {breakdownSteps.length === 0 && (
              <div className="text-center py-6 text-slate-400">
                <p>Add at least 2-3 small steps</p>
                <p className="text-xs mt-1">The smaller, the better!</p>
              </div>
            )}

            <button
              onClick={() => setWizardStep('supplies')}
              disabled={breakdownSteps.length < 2}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3.5 rounded-xl transition disabled:opacity-50"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 4: Supplies */}
        {wizardStep === 'supplies' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-4xl">🎒</span>
              <h2 className="text-xl font-bold text-slate-800">What do you need?</h2>
              <p className="text-slate-600 text-sm">Gather supplies before starting to avoid excuses.</p>
            </div>

            {/* Add supply form */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newSupply}
                onChange={(e) => setNewSupply(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSupply()}
                placeholder="e.g., Laptop charger, snacks, water..."
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              />
              <button
                onClick={addSupply}
                disabled={!newSupply.trim()}
                className="px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition disabled:opacity-50"
              >
                +
              </button>
            </div>

            {/* Supplies list */}
            {supplies.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {supplies.map((supply, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm"
                  >
                    {supply}
                    <button
                      onClick={() => removeSupply(index)}
                      className="hover:text-red-500"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <button
              onClick={() => setWizardStep('obstacles')}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3.5 rounded-xl transition"
            >
              {supplies.length > 0 ? 'Continue →' : 'Skip this →'}
            </button>
          </div>
        )}

        {/* Step 5: Obstacles */}
        {wizardStep === 'obstacles' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-4xl">🚧</span>
              <h2 className="text-xl font-bold text-slate-800">Obstacle-proof it</h2>
              <p className="text-slate-600 text-sm">What might derail you? Let's plan for it.</p>
            </div>

            {/* Distractions */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-3">What might distract you?</p>
              <div className="grid grid-cols-2 gap-2">
                {commonDistractions.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => toggleDistraction(d.id)}
                    className={`flex items-center gap-2 p-3 rounded-xl text-left text-sm transition-all ${
                      selectedDistractions.includes(d.id)
                        ? 'bg-amber-100 border-2 border-amber-400'
                        : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'
                    }`}
                  >
                    <span>{d.icon}</span>
                    <span>{d.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Plan for distractions */}
            {selectedDistractions.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">What's your plan to handle these?</p>
                <textarea
                  value={distractionPlan}
                  onChange={(e) => setDistractionPlan(e.target.value)}
                  placeholder="e.g., Phone goes in another room, I'll eat first, I'll use noise-cancelling headphones..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none resize-none text-sm"
                />
              </div>
            )}

            <button
              onClick={() => setWizardStep('reward')}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3.5 rounded-xl transition"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 6: Rewards */}
        {wizardStep === 'reward' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-4xl">🎁</span>
              <h2 className="text-xl font-bold text-slate-800">Set your rewards</h2>
              <p className="text-slate-600 text-sm">ADHD brains need dopamine hits. Plan them!</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  After completing Step 1, I'll reward myself with:
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {rewardIdeas.slice(0, 4).map((reward) => (
                    <button
                      key={reward}
                      onClick={() => setRewardStep1(reward)}
                      className={`px-3 py-1.5 rounded-full text-xs transition ${
                        rewardStep1 === reward
                          ? 'bg-green-500 text-white'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {reward}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={rewardStep1}
                  onChange={(e) => setRewardStep1(e.target.value)}
                  placeholder="Or type your own..."
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  When the whole task is done, I'll celebrate with:
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {rewardIdeas.slice(4).map((reward) => (
                    <button
                      key={reward}
                      onClick={() => setRewardComplete(reward)}
                      className={`px-3 py-1.5 rounded-full text-xs transition ${
                        rewardComplete === reward
                          ? 'bg-green-500 text-white'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {reward}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={rewardComplete}
                  onChange={(e) => setRewardComplete(e.target.value)}
                  placeholder="Or type your own..."
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-sm"
                />
              </div>
            </div>

            <button
              onClick={() => setWizardStep('ready')}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3.5 rounded-xl transition"
            >
              I'm ready to see my plan →
            </button>
          </div>
        )}

        {/* Step 7: Ready - Show full plan */}
        {wizardStep === 'ready' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-4xl">📋</span>
              <h2 className="text-xl font-bold text-slate-800">Your Focus Plan</h2>
              <p className="text-slate-600 text-sm">"{taskName}"</p>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 p-3 rounded-xl">
                <p className="text-xs text-blue-600 font-medium">Steps</p>
                <p className="text-xl font-bold text-blue-700">{breakdownSteps.length}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-xl">
                <p className="text-xs text-blue-600 font-medium">Est. Time</p>
                <p className="text-xl font-bold text-blue-700">{getTotalTime()}</p>
              </div>
            </div>

            {/* Steps preview */}
            <div className="space-y-2">
              {breakdownSteps.map((step, index) => (
                <div key={step.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                  <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </span>
                  <span className="flex-1 text-sm text-slate-700">{step.text}</span>
                  <span className="text-xs text-slate-400">{step.timeEstimate}</span>
                </div>
              ))}
            </div>

            {/* Supplies */}
            {supplies.length > 0 && (
              <div className="bg-amber-50 p-3 rounded-xl">
                <p className="text-xs text-amber-600 font-medium mb-1">📦 Gather first:</p>
                <p className="text-sm text-amber-800">{supplies.join(', ')}</p>
              </div>
            )}

            {/* Distraction plan */}
            {distractionPlan && (
              <div className="bg-red-50 p-3 rounded-xl">
                <p className="text-xs text-red-600 font-medium mb-1">🚧 Distraction plan:</p>
                <p className="text-sm text-red-800">{distractionPlan}</p>
              </div>
            )}

            {/* Reward */}
            {rewardStep1 && (
              <div className="bg-green-50 p-3 rounded-xl">
                <p className="text-xs text-green-600 font-medium mb-1">🎁 After Step 1:</p>
                <p className="text-sm text-green-800">{rewardStep1}</p>
              </div>
            )}

            <button
              onClick={savePlan}
              disabled={saving}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 rounded-xl transition text-lg disabled:opacity-50"
            >
              {saving ? 'Saving...' : "🚀 Let's do this!"}
            </button>
          </div>
        )}

        {/* Doing - Execution mode */}
        {wizardStep === 'doing' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Current step card */}
            <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">
                  Step {currentStepIndex + 1} of {breakdownSteps.length}
                </span>
                <span className="text-sm text-slate-500">
                  {breakdownSteps[currentStepIndex]?.timeEstimate}
                </span>
              </div>

              <h2 className="text-xl font-bold text-slate-800">
                {breakdownSteps[currentStepIndex]?.text}
              </h2>

              {/* Progress bar */}
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${(breakdownSteps.filter(s => s.completed).length / breakdownSteps.length) * 100}%` }}
                />
              </div>

              <button
                onClick={() => completeStep(currentStepIndex)}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-4 rounded-xl transition text-lg"
              >
                ✓ Done with this step!
              </button>

              {/* Show reward reminder after step 1 */}
              {currentStepIndex === 1 && rewardStep1 && (
                <div className="bg-green-50 p-3 rounded-xl border border-green-200">
                  <p className="text-green-700 text-sm text-center">
                    🎁 You completed Step 1! Time for: <strong>{rewardStep1}</strong>
                  </p>
                </div>
              )}
            </div>

            {/* All steps overview */}
            <div className="bg-white rounded-2xl shadow-lg p-4">
              <p className="text-sm font-medium text-slate-700 mb-3">All steps:</p>
              <div className="space-y-2">
                {breakdownSteps.map((step, index) => (
                  <div
                    key={step.id}
                    className={`flex items-center gap-3 p-2 rounded-lg ${
                      step.completed ? 'bg-green-50' : 
                      index === currentStepIndex ? 'bg-blue-50' : 'bg-slate-50'
                    }`}
                  >
                    {step.completed ? (
                      <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs">✓</span>
                    ) : (
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === currentStepIndex ? 'bg-blue-500 text-white' : 'bg-slate-300 text-slate-600'
                      }`}>
                        {index + 1}
                      </span>
                    )}
                    <span className={`flex-1 text-sm ${step.completed ? 'text-green-700 line-through' : 'text-slate-700'}`}>
                      {step.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Complete */}
        {wizardStep === 'complete' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 text-center animate-fadeIn">
            <span className="text-6xl">🎉</span>
            <h2 className="text-2xl font-bold text-slate-800">You did it!</h2>
            
            <p className="text-slate-600">
              You completed "{taskName}" by breaking it into {breakdownSteps.length} manageable steps.
            </p>

            <div className="bg-green-50 p-4 rounded-xl border border-green-200">
              <p className="text-green-800 font-medium">Time for your reward:</p>
              <p className="text-green-700 text-lg mt-1">{rewardComplete || '🎁 Celebrate however you want!'}</p>
            </div>

            <div className="bg-blue-50 p-4 rounded-xl">
              <p className="text-blue-700 text-sm">
                <strong>Remember:</strong> The task wasn't actually that scary—it was the Drill Sergeant 
                making it feel impossible. You just proved it wrong.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition"
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
