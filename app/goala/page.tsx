'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type View = 'garden' | 'create' | 'detail'
type CreateStep = 'title' | 'specific' | 'measurable' | 'achievable' | 'relevant' | 'timebound' | 'milestones' | 'review'

interface Goal {
  id: string
  title: string
  category: string
  specific_what: string
  specific_detail: string | null
  measurable_metric: string
  achievable_bad_day: boolean
  achievable_adjustment: string | null
  relevant_why: string
  time_bound_deadline: string | null
  time_bound_frequency: string | null
  progress_percent: number
  milestones: Milestone[]
  plant_type: string
  status: string
  created_at: string
}

interface Milestone {
  id: string
  text: string
  completed: boolean
  completedAt: string | null
}

const categories = [
  { id: 'health', label: 'Health & Wellness', icon: '💪', color: 'bg-green-100 text-green-700 border-green-300' },
  { id: 'work', label: 'Work & Career', icon: '💼', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { id: 'creative', label: 'Creative Projects', icon: '🎨', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  { id: 'learning', label: 'Learning & Growth', icon: '📚', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { id: 'relationships', label: 'Relationships', icon: '❤️', color: 'bg-pink-100 text-pink-700 border-pink-300' },
  { id: 'finance', label: 'Finance', icon: '💰', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { id: 'home', label: 'Home & Environment', icon: '🏠', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { id: 'personal', label: 'Personal', icon: '✨', color: 'bg-indigo-100 text-indigo-700 border-indigo-300' }
]

const plantEmojis: Record<string, string> = {
  seedling: '🌱',
  sprout: '🌿',
  growing: '🪴',
  budding: '🌷',
  blooming: '🌸'
}

const plantLabels: Record<string, string> = {
  seedling: 'Just planted',
  sprout: 'Sprouting',
  growing: 'Growing strong',
  budding: 'Almost there',
  blooming: 'In full bloom!'
}

export default function GoalsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // View state
  const [view, setView] = useState<View>('garden')
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)
  
  // Goals data
  const [goals, setGoals] = useState<Goal[]>([])
  
  // Create wizard state
  const [createStep, setCreateStep] = useState<CreateStep>('title')
  const [newGoal, setNewGoal] = useState({
    title: '',
    category: '',
    specific_what: '',
    specific_detail: '',
    measurable_metric: '',
    achievable_bad_day: true,
    achievable_adjustment: '',
    relevant_why: '',
    time_bound_deadline: '',
    time_bound_frequency: 'once' as string,
    milestones: [] as Milestone[]
  })
  const [newMilestone, setNewMilestone] = useState('')

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUser(session.user)
      await fetchGoals()
      setLoading(false)
    }
    checkUser()
  }, [router])

  const fetchGoals = async () => {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (!error && data) {
      setGoals(data)
    }
  }

  const addMilestone = () => {
    if (!newMilestone.trim()) return
    const milestone: Milestone = {
      id: Date.now().toString(),
      text: newMilestone.trim(),
      completed: false,
      completedAt: null
    }
    setNewGoal({ ...newGoal, milestones: [...newGoal.milestones, milestone] })
    setNewMilestone('')
  }

  const removeMilestone = (id: string) => {
    setNewGoal({ 
      ...newGoal, 
      milestones: newGoal.milestones.filter(m => m.id !== id) 
    })
  }

  const saveGoal = async () => {
    setSaving(true)
    
    const { error } = await supabase
      .from('goals')
      .insert({
        user_id: user.id,
        title: newGoal.title,
        category: newGoal.category,
        specific_what: newGoal.specific_what,
        specific_detail: newGoal.specific_detail || null,
        measurable_metric: newGoal.measurable_metric,
        achievable_bad_day: newGoal.achievable_bad_day,
        achievable_adjustment: newGoal.achievable_adjustment || null,
        relevant_why: newGoal.relevant_why,
        time_bound_deadline: newGoal.time_bound_deadline || null,
        time_bound_frequency: newGoal.time_bound_frequency,
        milestones: newGoal.milestones,
        progress_percent: 0
      })

    if (!error) {
      await fetchGoals()
      resetCreateForm()
      setView('garden')
    }
    setSaving(false)
  }

  const resetCreateForm = () => {
    setNewGoal({
      title: '',
      category: '',
      specific_what: '',
      specific_detail: '',
      measurable_metric: '',
      achievable_bad_day: true,
      achievable_adjustment: '',
      relevant_why: '',
      time_bound_deadline: '',
      time_bound_frequency: 'once',
      milestones: []
    })
    setCreateStep('title')
  }

  const toggleMilestone = async (goal: Goal, milestoneId: string) => {
    const updatedMilestones = goal.milestones.map(m => {
      if (m.id === milestoneId) {
        return {
          ...m,
          completed: !m.completed,
          completedAt: !m.completed ? new Date().toISOString() : null
        }
      }
      return m
    })
    
    const completedCount = updatedMilestones.filter(m => m.completed).length
    const progress = Math.round((completedCount / updatedMilestones.length) * 100)
    
    const { error } = await supabase
      .from('goals')
      .update({
        milestones: updatedMilestones,
        progress_percent: progress
      })
      .eq('id', goal.id)

    if (!error) {
      await fetchGoals()
      if (selectedGoal?.id === goal.id) {
        setSelectedGoal({ ...goal, milestones: updatedMilestones, progress_percent: progress })
      }
    }
  }

  const updateProgress = async (goal: Goal, progress: number) => {
    const { error } = await supabase
      .from('goals')
      .update({ progress_percent: progress })
      .eq('id', goal.id)

    if (!error) {
      await fetchGoals()
      if (selectedGoal?.id === goal.id) {
        setSelectedGoal({ ...goal, progress_percent: progress })
      }
    }
  }

  const getCategoryInfo = (categoryId: string) => {
    return categories.find(c => c.id === categoryId) || categories[7]
  }

  const activeGoals = goals.filter(g => g.status === 'active')
  const completedGoals = goals.filter(g => g.status === 'completed')

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <button 
            onClick={() => {
              if (view === 'create' || view === 'detail') {
                setView('garden')
                setSelectedGoal(null)
                resetCreateForm()
              } else {
                router.push('/dashboard')
              }
            }}
            className="text-green-600 hover:text-green-800 font-medium flex items-center gap-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {view === 'garden' ? 'Back' : 'Garden'}
          </button>
          <h1 className="text-lg font-bold text-green-700">Goal Garden</h1>
          <div className="w-16"></div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        
        {/* GARDEN VIEW */}
        {view === 'garden' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header + Add Button */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Your Garden</h2>
                <p className="text-sm text-slate-500">{activeGoals.length} growing, {completedGoals.length} bloomed</p>
              </div>
              <button
                onClick={() => setView('create')}
                className="bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded-xl transition flex items-center gap-2"
              >
                <span>🌱</span> Plant New
              </button>
            </div>

            {/* Empty State */}
            {goals.length === 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                <span className="text-6xl">🌱</span>
                <h3 className="text-lg font-bold text-slate-800 mt-4">Your garden is empty</h3>
                <p className="text-slate-500 mt-2 text-sm">
                  Plant your first goal and watch it grow!
                </p>
                <button
                  onClick={() => setView('create')}
                  className="mt-4 bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-3 rounded-xl transition"
                >
                  Plant Your First Goal
                </button>
              </div>
            )}

            {/* Active Goals */}
            {activeGoals.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Growing</h3>
                {activeGoals.map((goal) => {
                  const cat = getCategoryInfo(goal.category)
                  return (
                    <button
                      key={goal.id}
                      onClick={() => {
                        setSelectedGoal(goal)
                        setView('detail')
                      }}
                      className="w-full bg-white rounded-2xl shadow-lg p-4 text-left hover:shadow-xl transition-all"
                    >
                      <div className="flex items-start gap-4">
                        {/* Plant */}
                        <div className="text-4xl">
                          {plantEmojis[goal.plant_type]}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${cat.color}`}>
                              {cat.icon} {cat.label}
                            </span>
                          </div>
                          <h4 className="font-semibold text-slate-800 truncate">{goal.title}</h4>
                          <p className="text-sm text-slate-500 truncate">{goal.specific_what}</p>
                          
                          {/* Progress bar */}
                          <div className="mt-2">
                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                              <span>{plantLabels[goal.plant_type]}</span>
                              <span>{goal.progress_percent}%</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-green-500 transition-all"
                                style={{ width: `${goal.progress_percent}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Completed Goals */}
            {completedGoals.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Bloomed 🌸</h3>
                {completedGoals.map((goal) => {
                  const cat = getCategoryInfo(goal.category)
                  return (
                    <button
                      key={goal.id}
                      onClick={() => {
                        setSelectedGoal(goal)
                        setView('detail')
                      }}
                      className="w-full bg-green-50 rounded-2xl shadow p-4 text-left border-2 border-green-200"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-3xl">🌸</span>
                        <div className="flex-1">
                          <h4 className="font-semibold text-green-800">{goal.title}</h4>
                          <p className="text-sm text-green-600">Completed!</p>
                        </div>
                        <span className="text-green-500">✓</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* CREATE VIEW - SMART Wizard */}
        {view === 'create' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Progress */}
            <div className="flex gap-1.5">
              {['title', 'specific', 'measurable', 'achievable', 'relevant', 'timebound', 'milestones', 'review'].map((s, i) => (
                <div
                  key={s}
                  className={`h-1.5 flex-1 rounded-full transition-all ${
                    ['title', 'specific', 'measurable', 'achievable', 'relevant', 'timebound', 'milestones', 'review'].indexOf(createStep) >= i 
                      ? 'bg-green-500' 
                      : 'bg-green-200'
                  }`}
                />
              ))}
            </div>

            {/* Step: Title & Category */}
            {createStep === 'title' && (
              <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5">
                <div className="text-center space-y-2">
                  <span className="text-4xl">🌱</span>
                  <h2 className="text-xl font-bold text-slate-800">Plant a New Goal</h2>
                  <p className="text-slate-600 text-sm">What do you want to grow?</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Goal Title</label>
                  <input
                    type="text"
                    value={newGoal.title}
                    onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                    placeholder="e.g., Write a book, Learn Spanish, Exercise regularly"
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-green-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
                  <div className="grid grid-cols-2 gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setNewGoal({ ...newGoal, category: cat.id })}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          newGoal.category === cat.id
                            ? 'border-green-500 bg-green-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <span className="text-xl">{cat.icon}</span>
                        <span className="text-sm ml-2">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setCreateStep('specific')}
                  disabled={!newGoal.title || !newGoal.category}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3.5 rounded-xl transition disabled:opacity-50"
                >
                  Continue →
                </button>
              </div>
            )}

            {/* Step: Specific */}
            {createStep === 'specific' && (
              <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5">
                <div className="text-center space-y-2">
                  <span className="text-3xl font-bold text-green-600">S</span>
                  <h2 className="text-xl font-bold text-slate-800">Specific</h2>
                  <p className="text-slate-600 text-sm">What exactly will you do?</p>
                </div>

                <div className="bg-green-50 p-4 rounded-xl">
                  <p className="text-green-800 text-sm">
                    <strong>Goal:</strong> "{newGoal.title}"
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Break it down - what specifically?
                  </label>
                  <input
                    type="text"
                    value={newGoal.specific_what}
                    onChange={(e) => setNewGoal({ ...newGoal, specific_what: e.target.value })}
                    placeholder="e.g., Write 500 words every morning"
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-green-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Any other details? (optional)
                  </label>
                  <textarea
                    value={newGoal.specific_detail}
                    onChange={(e) => setNewGoal({ ...newGoal, specific_detail: e.target.value })}
                    placeholder="Where, when, with what tools..."
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-green-500 outline-none resize-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setCreateStep('title')}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => setCreateStep('measurable')}
                    disabled={!newGoal.specific_what}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
                  >
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* Step: Measurable */}
            {createStep === 'measurable' && (
              <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5">
                <div className="text-center space-y-2">
                  <span className="text-3xl font-bold text-green-600">M</span>
                  <h2 className="text-xl font-bold text-slate-800">Measurable</h2>
                  <p className="text-slate-600 text-sm">How will you know you've done it?</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    What's the measurable outcome?
                  </label>
                  <input
                    type="text"
                    value={newGoal.measurable_metric}
                    onChange={(e) => setNewGoal({ ...newGoal, measurable_metric: e.target.value })}
                    placeholder="e.g., 50,000 words written, 30 workouts completed"
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-green-500 outline-none"
                  />
                </div>

                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                  <p className="text-yellow-800 text-sm">
                    💡 <strong>Tip:</strong> Numbers help! "Exercise more" becomes "Exercise 3x per week"
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setCreateStep('specific')}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => setCreateStep('achievable')}
                    disabled={!newGoal.measurable_metric}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
                  >
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* Step: Achievable */}
            {createStep === 'achievable' && (
              <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5">
                <div className="text-center space-y-2">
                  <span className="text-3xl font-bold text-green-600">A</span>
                  <h2 className="text-xl font-bold text-slate-800">Achievable</h2>
                  <p className="text-slate-600 text-sm">Is this realistic for your ADHD brain?</p>
                </div>

                <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
                  <p className="text-purple-800 text-sm">
                    🧠 <strong>ADHD Reality Check:</strong> Can you do this on a "bad brain" day when executive function is low?
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    On your worst ADHD day, could you still make some progress?
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setNewGoal({ ...newGoal, achievable_bad_day: true })}
                      className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                        newGoal.achievable_bad_day
                          ? 'border-green-500 bg-green-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-2xl">✅</span>
                      <p className="text-sm font-medium mt-1">Yes, it's flexible</p>
                    </button>
                    <button
                      onClick={() => setNewGoal({ ...newGoal, achievable_bad_day: false })}
                      className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                        !newGoal.achievable_bad_day
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-2xl">⚠️</span>
                      <p className="text-sm font-medium mt-1">Might be hard</p>
                    </button>
                  </div>
                </div>

                {!newGoal.achievable_bad_day && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      How could you adjust it for bad days?
                    </label>
                    <input
                      type="text"
                      value={newGoal.achievable_adjustment}
                      onChange={(e) => setNewGoal({ ...newGoal, achievable_adjustment: e.target.value })}
                      placeholder="e.g., On bad days, just write 100 words instead of 500"
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-green-500 outline-none"
                    />
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setCreateStep('measurable')}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => setCreateStep('relevant')}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl transition"
                  >
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* Step: Relevant */}
            {createStep === 'relevant' && (
              <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5">
                <div className="text-center space-y-2">
                  <span className="text-3xl font-bold text-green-600">R</span>
                  <h2 className="text-xl font-bold text-slate-800">Relevant</h2>
                  <p className="text-slate-600 text-sm">Why does this actually matter to YOU?</p>
                </div>

                <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                  <p className="text-red-800 text-sm">
                    🎖️ <strong>Drill Sergeant Check:</strong> Is this something you actually want, or something you feel you "should" do?
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Why does this goal matter to YOU? (Not someone else's expectation)
                  </label>
                  <textarea
                    value={newGoal.relevant_why}
                    onChange={(e) => setNewGoal({ ...newGoal, relevant_why: e.target.value })}
                    placeholder="e.g., I want to write a book because storytelling brings me joy and I have something meaningful to share..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-green-500 outline-none resize-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setCreateStep('achievable')}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => setCreateStep('timebound')}
                    disabled={!newGoal.relevant_why}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
                  >
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* Step: Time-bound */}
            {createStep === 'timebound' && (
              <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5">
                <div className="text-center space-y-2">
                  <span className="text-3xl font-bold text-green-600">T</span>
                  <h2 className="text-xl font-bold text-slate-800">Time-Bound</h2>
                  <p className="text-slate-600 text-sm">When will you work on this?</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    How often will you work on this?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'once', label: 'One-time goal' },
                      { id: 'daily', label: 'Daily habit' },
                      { id: 'weekly', label: 'Weekly practice' },
                      { id: 'monthly', label: 'Monthly check-in' }
                    ].map((freq) => (
                      <button
                        key={freq.id}
                        onClick={() => setNewGoal({ ...newGoal, time_bound_frequency: freq.id })}
                        className={`p-3 rounded-xl border-2 text-sm transition-all ${
                          newGoal.time_bound_frequency === freq.id
                            ? 'border-green-500 bg-green-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {freq.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Target completion date (optional)
                  </label>
                  <input
                    type="date"
                    value={newGoal.time_bound_deadline}
                    onChange={(e) => setNewGoal({ ...newGoal, time_bound_deadline: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-green-500 outline-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setCreateStep('relevant')}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => setCreateStep('milestones')}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl transition"
                  >
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* Step: Milestones */}
            {createStep === 'milestones' && (
              <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5">
                <div className="text-center space-y-2">
                  <span className="text-4xl">🪜</span>
                  <h2 className="text-xl font-bold text-slate-800">Milestones</h2>
                  <p className="text-slate-600 text-sm">Break it into checkpoints (optional but helpful!)</p>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMilestone}
                    onChange={(e) => setNewMilestone(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addMilestone()}
                    placeholder="e.g., Complete chapter 1"
                    className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-green-500 outline-none"
                  />
                  <button
                    onClick={addMilestone}
                    disabled={!newMilestone.trim()}
                    className="px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-xl transition disabled:opacity-50"
                  >
                    + Add
                  </button>
                </div>

                {newGoal.milestones.length > 0 && (
                  <div className="space-y-2">
                    {newGoal.milestones.map((m, i) => (
                      <div key={m.id} className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
                        <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                          {i + 1}
                        </span>
                        <span className="flex-1 text-slate-700">{m.text}</span>
                        <button
                          onClick={() => removeMilestone(m.id)}
                          className="text-slate-400 hover:text-red-500"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setCreateStep('timebound')}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => setCreateStep('review')}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl transition"
                  >
                    Review Goal →
                  </button>
                </div>
              </div>
            )}

            {/* Step: Review */}
            {createStep === 'review' && (
              <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5">
                <div className="text-center space-y-2">
                  <span className="text-4xl">🌱</span>
                  <h2 className="text-xl font-bold text-slate-800">Ready to Plant?</h2>
                </div>

                <div className="space-y-3">
                  <div className="bg-green-50 p-4 rounded-xl">
                    <p className="text-xs text-green-600 font-medium uppercase">Goal</p>
                    <p className="text-green-800 font-semibold">{newGoal.title}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-3 rounded-xl">
                      <p className="text-xs text-slate-500 uppercase">Specific</p>
                      <p className="text-sm text-slate-700">{newGoal.specific_what}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl">
                      <p className="text-xs text-slate-500 uppercase">Measurable</p>
                      <p className="text-sm text-slate-700">{newGoal.measurable_metric}</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl">
                    <p className="text-xs text-slate-500 uppercase">Why it matters</p>
                    <p className="text-sm text-slate-700">{newGoal.relevant_why}</p>
                  </div>

                  {newGoal.milestones.length > 0 && (
                    <div className="bg-slate-50 p-3 rounded-xl">
                      <p className="text-xs text-slate-500 uppercase mb-2">Milestones</p>
                      <div className="space-y-1">
                        {newGoal.milestones.map((m, i) => (
                          <p key={m.id} className="text-sm text-slate-700">
                            {i + 1}. {m.text}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setCreateStep('milestones')}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={saveGoal}
                    disabled={saving}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
                  >
                    {saving ? 'Planting...' : '🌱 Plant Goal'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* DETAIL VIEW */}
        {view === 'detail' && selectedGoal && (
          <div className="space-y-4 animate-fadeIn">
            {/* Header Card */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="text-center mb-4">
                <span className="text-6xl">{plantEmojis[selectedGoal.plant_type]}</span>
                <p className="text-sm text-green-600 mt-2">{plantLabels[selectedGoal.plant_type]}</p>
              </div>

              <h2 className="text-xl font-bold text-slate-800 text-center">{selectedGoal.title}</h2>
              <p className="text-slate-500 text-center text-sm mt-1">{selectedGoal.specific_what}</p>

              {/* Progress */}
              <div className="mt-4">
                <div className="flex justify-between text-sm text-slate-500 mb-2">
                  <span>Progress</span>
                  <span>{selectedGoal.progress_percent}%</span>
                </div>
                <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all"
                    style={{ width: `${selectedGoal.progress_percent}%` }}
                  />
                </div>
              </div>

              {/* Quick progress buttons */}
              {selectedGoal.status === 'active' && selectedGoal.milestones.length === 0 && (
                <div className="flex gap-2 mt-4">
                  {[25, 50, 75, 100].map((p) => (
                    <button
                      key={p}
                      onClick={() => updateProgress(selectedGoal, p)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                        selectedGoal.progress_percent >= p
                          ? 'bg-green-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Milestones */}
            {selectedGoal.milestones.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="font-semibold text-slate-800 mb-4">Milestones</h3>
                <div className="space-y-2">
                  {selectedGoal.milestones.map((m, i) => (
                    <button
                      key={m.id}
                      onClick={() => toggleMilestone(selectedGoal, m.id)}
                      disabled={selectedGoal.status !== 'active'}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition text-left ${
                        m.completed
                          ? 'bg-green-50 border-2 border-green-200'
                          : 'bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        m.completed
                          ? 'bg-green-500 text-white'
                          : 'bg-slate-300 text-slate-600'
                      }`}>
                        {m.completed ? '✓' : i + 1}
                      </span>
                      <span className={`flex-1 ${m.completed ? 'text-green-700 line-through' : 'text-slate-700'}`}>
                        {m.text}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Why it matters */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="font-semibold text-slate-800 mb-2">Why This Matters</h3>
              <p className="text-slate-600 text-sm">{selectedGoal.relevant_why}</p>
            </div>

            {/* Completion celebration */}
            {selectedGoal.status === 'completed' && (
              <div className="bg-green-50 rounded-2xl shadow-lg p-6 text-center border-2 border-green-200">
                <span className="text-5xl">🎉</span>
                <h3 className="text-lg font-bold text-green-800 mt-2">Goal Complete!</h3>
                <p className="text-green-600 text-sm">You grew this goal to full bloom!</p>
              </div>
            )}
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
