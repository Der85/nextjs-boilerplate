'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Goal {
  id: string
  title: string
  description: string | null
  progress_percent: number
  status: 'active' | 'completed' | 'paused'
}

const getPlantEmoji = (p: number): string => {
  if (p >= 100) return '🌸'
  if (p >= 75) return '🌷'
  if (p >= 50) return '🪴'
  if (p >= 25) return '🌿'
  return '🌱'
}

export default function GoalsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [view, setView] = useState<'list' | 'create'>('list')
  const [goals, setGoals] = useState<Goal[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      await fetchGoals()
      setLoading(false)
    }
    init()
  }, [router])

  const fetchGoals = async () => {
    const { data } = await supabase
      .from('goals')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setGoals(data)
  }

  const handleCreate = async () => {
    if (!user || !title.trim()) return
    setSaving(true)
    
    await supabase.from('goals').insert({
      user_id: user.id,
      title,
      description: description || null,
      progress_percent: 0,
      status: 'active',
      plant_type: 'seedling'
    })

    setTitle('')
    setDescription('')
    setView('list')
    await fetchGoals()
    setSaving(false)
  }

  const updateProgress = async (goalId: string, newProgress: number) => {
    const progress = Math.min(100, Math.max(0, newProgress))
    await supabase.from('goals').update({
      progress_percent: progress,
      status: progress >= 100 ? 'completed' : 'active'
    }).eq('id', goalId)
    await fetchGoals()
  }

  if (loading) {
    return (
      <div className="app-container flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--success)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const activeGoals = goals.filter(g => g.status === 'active')
  const completedGoals = goals.filter(g => g.status === 'completed')

  return (
    <div className="app-container">
      <div className="top-bar">
        <div className="top-bar-inner">
          <button onClick={() => router.push('/dashboard')} className="btn btn-ghost btn-icon">←</button>
          <h1 style={{ fontSize: '19px', fontWeight: 800 }}>Goals</h1>
          <div style={{ width: '36px' }} />
        </div>
      </div>

      <div className="main-content">
        <div className="tabs">
          <button className={`tab ${view === 'list' ? 'tab-active' : ''}`} onClick={() => setView('list')}>My goals</button>
          <button className={`tab ${view === 'create' ? 'tab-active' : ''}`} onClick={() => setView('create')}>New goal</button>
        </div>

        {view === 'create' && (
          <div className="compose-box">
            <p className="font-bold mb-2">What's your goal?</p>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Exercise 3x per week" className="input mb-4" />

            <p className="font-bold mb-2">Why is this important? (optional)</p>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="What will achieving this mean to you?" className="input" rows={3} style={{ minHeight: 'auto' }} />

            <button onClick={handleCreate} disabled={!title.trim() || saving}
              className="btn btn-primary w-full mt-4" style={{ background: 'var(--success)' }}>
              {saving ? 'Planting...' : '🌱 Plant this goal'}
            </button>
          </div>
        )}

        {view === 'list' && (
          <>
            {goals.length === 0 ? (
              <div className="card text-center" style={{ padding: '40px 15px' }}>
                <span className="emoji-large">🌱</span>
                <p className="font-bold mt-3">No goals planted yet</p>
                <p className="text-sm text-muted mt-1">Plant your first goal and watch it grow</p>
                <button onClick={() => setView('create')} className="btn btn-primary mt-4" style={{ background: 'var(--success)' }}>
                  Plant first goal
                </button>
              </div>
            ) : (
              <>
                {activeGoals.length > 0 && (
                  <>
                    <div className="page-header"><h2 className="page-title">Growing ({activeGoals.length})</h2></div>
                    {activeGoals.map((goal) => (
                      <div key={goal.id} className="card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                          <span style={{ fontSize: '32px' }}>{getPlantEmoji(goal.progress_percent)}</span>
                          <div style={{ flex: 1 }}>
                            <p className="font-bold">{goal.title}</p>
                            {goal.description && <p className="text-sm text-muted">{goal.description}</p>}
                          </div>
                          <span className="font-bold" style={{ color: 'var(--success)' }}>{goal.progress_percent}%</span>
                        </div>
                        
                        <div className="progress-bar mb-3">
                          <div className="progress-fill" style={{ width: `${goal.progress_percent}%`, background: 'var(--success)' }} />
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => updateProgress(goal.id, goal.progress_percent - 10)}
                            className="btn btn-ghost" style={{ flex: 1 }} disabled={goal.progress_percent <= 0}>-10%</button>
                          <button onClick={() => updateProgress(goal.id, goal.progress_percent + 10)}
                            className="btn btn-outline" style={{ flex: 1, borderColor: 'var(--success)', color: 'var(--success)' }}>+10%</button>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {completedGoals.length > 0 && (
                  <>
                    <div className="section-divider" />
                    <div className="page-header"><h2 className="page-title">Bloomed 🌸 ({completedGoals.length})</h2></div>
                    {completedGoals.map((goal) => (
                      <div key={goal.id} className="card" style={{ opacity: 0.8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '32px' }}>🌸</span>
                          <p className="font-bold" style={{ flex: 1 }}>{goal.title}</p>
                          <span style={{ color: 'var(--success)' }}>✓</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}

        <div style={{ height: '50px' }} />
      </div>
    </div>
  )
}