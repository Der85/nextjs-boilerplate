'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Step {
  id: string
  text: string
  completed: boolean
}

interface Plan {
  id: string
  task_name: string
  steps: Step[]
  created_at: string
}

export default function FocusPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [view, setView] = useState<'list' | 'create'>('list')
  const [plans, setPlans] = useState<Plan[]>([])
  const [taskName, setTaskName] = useState('')
  const [steps, setSteps] = useState<string[]>(['', '', ''])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      await fetchPlans(session.user.id)
      setLoading(false)
    }
    init()
  }, [router])

  const fetchPlans = async (userId: string) => {
    const { data } = await supabase
      .from('focus_plans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)
    if (data) setPlans(data.map(p => ({ ...p, steps: p.steps || [] })))
  }

  const addStep = () => setSteps([...steps, ''])
  
  const updateStep = (i: number, val: string) => {
    const newSteps = [...steps]
    newSteps[i] = val
    setSteps(newSteps)
  }

  const removeStep = (i: number) => {
    if (steps.length > 1) setSteps(steps.filter((_, idx) => idx !== i))
  }

  const handleCreate = async () => {
    if (!user || !taskName.trim()) return
    const validSteps = steps.filter(s => s.trim())
    if (validSteps.length === 0) return
    
    setSaving(true)
    const stepsData = validSteps.map((text, i) => ({ id: `step-${i}`, text, completed: false }))
    
    await supabase.from('focus_plans').insert({
      user_id: user.id,
      task_name: taskName,
      steps: stepsData,
      steps_completed: 0,
      total_steps: stepsData.length,
      is_completed: false
    })

    setTaskName('')
    setSteps(['', '', ''])
    setView('list')
    if (user) await fetchPlans(user.id)
    setSaving(false)
  }

  const toggleStep = async (planId: string, stepId: string) => {
    const plan = plans.find(p => p.id === planId)
    if (!plan) return

    const updatedSteps = plan.steps.map(s => s.id === stepId ? { ...s, completed: !s.completed } : s)
    const completedCount = updatedSteps.filter(s => s.completed).length

    if (!user) return
    await supabase.from('focus_plans').update({
      steps: updatedSteps,
      steps_completed: completedCount,
      is_completed: completedCount === updatedSteps.length
    }).eq('id', planId).eq('user_id', user.id)

    await fetchPlans(user.id)
  }

  if (loading) {
    return (
      <div className="app-container flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="app-container">
      <div className="top-bar">
        <div className="top-bar-inner">
          <button onClick={() => router.push('/dashboard')} className="btn btn-ghost btn-icon">←</button>
          <h1 style={{ fontSize: '19px', fontWeight: 800 }}>Break it down</h1>
          <div style={{ width: '36px' }} />
        </div>
      </div>

      <div className="main-content">
        <div className="tabs">
          <button className={`tab ${view === 'list' ? 'tab-active' : ''}`} onClick={() => setView('list')}>My tasks</button>
          <button className={`tab ${view === 'create' ? 'tab-active' : ''}`} onClick={() => setView('create')}>New task</button>
        </div>

        {view === 'create' && (
          <div className="compose-box">
            <p className="font-bold mb-2">What's the task?</p>
            <input type="text" value={taskName} onChange={(e) => setTaskName(e.target.value)}
              placeholder="e.g., Clean my room" className="input mb-4" />

            <p className="font-bold mb-2">Break it into steps:</p>
            {steps.map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <span className="text-muted" style={{ padding: '12px 0', minWidth: '24px' }}>{i + 1}.</span>
                <input type="text" value={step} onChange={(e) => updateStep(i, e.target.value)}
                  placeholder={`Step ${i + 1}`} className="input" style={{ flex: 1 }} />
                {steps.length > 1 && (
                  <button onClick={() => removeStep(i)} className="btn btn-ghost btn-icon" style={{ color: 'var(--danger)' }}>×</button>
                )}
              </div>
            ))}

            <button onClick={addStep} className="btn btn-ghost text-sm mb-4">+ Add another step</button>

            <button onClick={handleCreate} disabled={!taskName.trim() || steps.filter(s => s.trim()).length === 0 || saving}
              className="btn btn-primary w-full">
              {saving ? 'Saving...' : 'Create task'}
            </button>
          </div>
        )}

        {view === 'list' && (
          <>
            {plans.length === 0 ? (
              <div className="card text-center" style={{ padding: '40px 15px' }}>
                <span className="emoji-large">🔨</span>
                <p className="font-bold mt-3">No tasks yet</p>
                <p className="text-sm text-muted mt-1">Break down a task to get started</p>
                <button onClick={() => setView('create')} className="btn btn-primary mt-4">Create first task</button>
              </div>
            ) : (
              plans.map((plan) => {
                const done = plan.steps.filter(s => s.completed).length
                const total = plan.steps.length
                const pct = total > 0 ? Math.round((done / total) * 100) : 0

                return (
                  <div key={plan.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <p className="font-bold">{plan.task_name}</p>
                      <span className="text-sm text-muted">{done}/{total}</span>
                    </div>
                    
                    <div className="progress-bar mb-3">
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>

                    {plan.steps.map((step) => (
                      <div key={step.id} onClick={() => toggleStep(plan.id, step.id)} className="card-clickable"
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0',
                          borderBottom: '1px solid var(--extra-light-gray)' }}>
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%',
                          border: step.completed ? 'none' : '2px solid var(--light-gray)',
                          background: step.completed ? 'var(--success)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontSize: '14px' }}>
                          {step.completed && '✓'}
                        </div>
                        <span style={{ textDecoration: step.completed ? 'line-through' : 'none',
                          color: step.completed ? 'var(--light-gray)' : 'var(--black)' }}>{step.text}</span>
                      </div>
                    ))}
                  </div>
                )
              })
            )}
          </>
        )}

        <div style={{ height: '50px' }} />
      </div>
    </div>
  )
}
