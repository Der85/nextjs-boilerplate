'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { usePresenceWithFallback } from '@/hooks/usePresence'

// Step components
import BrainDumpScreen from './components/BrainDumpScreen'
import TriageScreen from './components/TriageScreen'
import ContextScreen from './components/ContextScreen'
import type { TaskWithContext } from './components/ContextScreen'
import BreakdownScreen from './components/BreakdownScreen'
import FocusDashboard from './components/FocusDashboard'

type Step = 'brain-dump' | 'triage' | 'context' | 'breakdown' | 'dashboard'

interface ParsedTask {
  id: string
  text: string
}

interface MicroStep {
  id: string
  text: string
  dueBy: string
  timeEstimate: string
  completed: boolean
}

interface TaskBreakdown {
  taskName: string
  dueDate: string
  energyLevel: string
  steps: MicroStep[]
}

interface Plan {
  id: string
  task_name: string
  steps: Array<{ id: string; text: string; completed: boolean; dueBy?: string; timeEstimate?: string }>
  created_at: string
  due_date?: string | null
  energy_required?: string | null
  related_goal_id?: string | null
  related_step_id?: string | null
}

interface Goal {
  id: string
  title: string
  micro_steps: Array<{ id: string; text: string; completed: boolean }>
}

export default function FocusPage() {
  return (
    <Suspense fallback={<FocusPageLoading />}>
      <FocusPageContent />
    </Suspense>
  )
}

function FocusPageLoading() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f7f9fa',
      color: '#8899a6',
    }}>
      <div style={{
        width: 32,
        height: 32,
        border: '3px solid #1D9BF0',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: 16,
      }} />
      <p>Loading...</p>
      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

function FocusPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<Step>('brain-dump')

  // Data flowing through the journey
  const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([])
  const [triageLoading, setTriageLoading] = useState(false)
  const [tasksWithContext, setTasksWithContext] = useState<TaskWithContext[]>([])
  const [breakdowns, setBreakdowns] = useState<TaskBreakdown[]>([])
  const [breakdownLoading, setBreakdownLoading] = useState(false)

  // Dashboard data
  const [plans, setPlans] = useState<Plan[]>([])
  const [goals, setGoals] = useState<Goal[]>([])

  // Goal handoff state
  const [handoffGoalId, setHandoffGoalId] = useState<string | null>(null)
  const [handoffStepId, setHandoffStepId] = useState<string | null>(null)

  // Sprint/Gentle mode state (from check-in handoff)
  const [sprintMode, setSprintMode] = useState(false)
  const [userMode, setUserMode] = useState<'recovery' | 'growth' | 'maintenance'>('maintenance')

  // Presence
  const { onlineCount } = usePresenceWithFallback({ isFocusing: true })

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUser(session.user)

      const fetchedPlans = await fetchPlans(session.user.id)
      await fetchGoals(session.user.id)

      // Handle URL params from Goals handoff
      const createParam = searchParams.get('create')
      const taskNameParam = searchParams.get('taskName')
      const goalIdParam = searchParams.get('goalId')
      const stepIdParam = searchParams.get('stepId')

      // Handle URL params from Check-in handoff (mode & energy)
      const modeParam = searchParams.get('mode') as 'sprint' | 'gentle' | null
      const energyParam = searchParams.get('energy') as 'high' | 'low' | null

      // Derive userMode from URL params for post-task completion flow
      if (modeParam === 'gentle') setUserMode('recovery')
      else if (modeParam === 'sprint') setUserMode('growth')

      if (createParam === 'true' && taskNameParam) {
        // Goal handoff: skip to context with pre-filled task
        const handoffTask: ParsedTask = {
          id: 'handoff_1',
          text: decodeURIComponent(taskNameParam),
        }
        setParsedTasks([handoffTask])
        setHandoffGoalId(goalIdParam || null)
        setHandoffStepId(stepIdParam || null)
        setStep('context')
      } else if (modeParam === 'gentle' && energyParam === 'low') {
        // Gentle mode: skip brain-dump, go straight to breakdown with a low-demand task
        const gentleTask: ParsedTask = {
          id: 'gentle_1',
          text: 'Just 5 minutes of low-demand work',
        }
        setParsedTasks([gentleTask])
        setBreakdowns([{
          taskName: gentleTask.text,
          dueDate: 'Today',
          energyLevel: 'low',
          steps: [
            { id: 'gentle_step_1', text: 'Pick the smallest thing on your list', dueBy: 'Now', timeEstimate: '1 min', completed: false },
            { id: 'gentle_step_2', text: 'Set a 5-minute timer', dueBy: 'Next', timeEstimate: '1 min', completed: false },
            { id: 'gentle_step_3', text: 'Work until the timer ends — then stop', dueBy: 'After that', timeEstimate: '5 min', completed: false },
          ],
        }])
        setStep('breakdown')
      } else if (modeParam === 'sprint' && energyParam === 'high') {
        // Sprint mode: stay on brain-dump but flag it
        setSprintMode(true)
      } else if (fetchedPlans.length > 0) {
        // Has existing plans: go to dashboard
        setStep('dashboard')
      }
      // Otherwise: starts at brain-dump (default)

      setLoading(false)
    }
    init()
  }, [router, searchParams])

  const fetchPlans = async (userId: string): Promise<Plan[]> => {
    const { data } = await supabase
      .from('focus_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('is_completed', false)
      .order('created_at', { ascending: false })
      .limit(10)

    const fetched = (data || []).map(p => ({
      ...p,
      steps: p.steps || [],
      related_goal_id: p.related_goal_id || null,
      related_step_id: p.related_step_id || null,
    }))
    setPlans(fetched)
    return fetched
  }

  const fetchGoals = async (userId: string) => {
    const { data } = await supabase
      .from('goals')
      .select('id, title, micro_steps')
      .eq('user_id', userId)
      .eq('is_completed', false)
      .order('created_at', { ascending: false })
      .limit(20)

    if (data) setGoals(data.map(g => ({
      ...g,
      micro_steps: g.micro_steps || [],
    })))
  }

  const getAuthToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  // ============================================
  // Step Handlers
  // ============================================

  const handleBrainDumpSubmit = async (text: string) => {
    setStep('triage')
    setTriageLoading(true)

    try {
      const token = await getAuthToken()
      const response = await fetch('/api/focus-coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'parse', text }),
      })

      const data = await response.json()
      setParsedTasks(data.tasks || [])
    } catch (error) {
      console.error('Error parsing brain dump:', error)
      // Fallback: treat the whole text as one task
      setParsedTasks([{ id: 'task_1', text: text.trim() }])
    }

    setTriageLoading(false)
  }

  const handleBrainDumpSkip = () => {
    setStep('dashboard')
  }

  const handleTriageConfirm = (tasks: ParsedTask[]) => {
    setParsedTasks(tasks)
    setStep('context')
  }

  const handleTriageBack = () => {
    setParsedTasks([])
    setStep('brain-dump')
  }

  const handleContextComplete = async (tasks: TaskWithContext[]) => {
    setTasksWithContext(tasks)
    setStep('breakdown')
    setBreakdownLoading(true)

    try {
      const token = await getAuthToken()
      const results: TaskBreakdown[] = []

      for (const task of tasks) {
        const response = await fetch('/api/focus-coach', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: 'breakdown',
            taskName: task.text,
            dueDate: task.dueDate,
            energyLevel: task.energyLevel,
          }),
        })

        const data = await response.json()
        const steps = (data.steps || []).map((s: any) => ({
          ...s,
          completed: false,
        }))

        results.push({
          taskName: task.text,
          dueDate: task.dueDate,
          energyLevel: task.energyLevel,
          steps,
        })
      }

      setBreakdowns(results)
    } catch (error) {
      console.error('Error generating breakdowns:', error)
      // Fallback: create basic breakdowns
      const fallbacks = tasks.map(t => ({
        taskName: t.text,
        dueDate: t.dueDate,
        energyLevel: t.energyLevel,
        steps: [
          { id: 'step_1', text: 'Write down the first tiny action', dueBy: 'Now', timeEstimate: '2 min', completed: false },
          { id: 'step_2', text: 'Gather what you need', dueBy: 'Next', timeEstimate: '5 min', completed: false },
          { id: 'step_3', text: 'Set a timer and start', dueBy: 'After that', timeEstimate: '10 min', completed: false },
        ],
      }))
      setBreakdowns(fallbacks)
    }

    setBreakdownLoading(false)
  }

  const handleContextBack = () => {
    setStep('triage')
  }

  const handleStartFocusing = async (finalBreakdowns: TaskBreakdown[]) => {
    if (!user) return

    // Save each breakdown as a focus_plan
    for (let i = 0; i < finalBreakdowns.length; i++) {
      const bd = finalBreakdowns[i]

      const stepsData = bd.steps.map((s, j) => ({
        id: s.id || `step_${j}`,
        text: s.text,
        completed: false,
        dueBy: s.dueBy || null,
        timeEstimate: s.timeEstimate || null,
      }))

      const insertData: any = {
        user_id: user.id,
        task_name: bd.taskName,
        steps: stepsData,
        steps_completed: 0,
        total_steps: stepsData.length,
        is_completed: false,
        due_date: bd.dueDate || null,
        energy_required: bd.energyLevel || null,
      }

      // If this was a goal handoff (single task), link it
      if (handoffGoalId && finalBreakdowns.length === 1) {
        insertData.related_goal_id = handoffGoalId
        insertData.related_step_id = handoffStepId
      }

      await supabase.from('focus_plans').insert(insertData)
    }

    // Refresh plans and show dashboard
    await fetchPlans(user.id)
    setHandoffGoalId(null)
    setHandoffStepId(null)
    setStep('dashboard')
  }

  const handleBreakdownBack = () => {
    setStep('context')
  }

  const handleNewBrainDump = () => {
    // Reset journey state
    setParsedTasks([])
    setTasksWithContext([])
    setBreakdowns([])
    setHandoffGoalId(null)
    setHandoffStepId(null)
    setStep('brain-dump')
  }

  const handlePlansUpdate = async () => {
    if (user) {
      await fetchPlans(user.id)
      await fetchGoals(user.id)
    }
  }

  if (loading) {
    return <FocusPageLoading />
  }

  return (
    <>
      {step === 'brain-dump' && (
        <>
          {sprintMode && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 100,
              background: 'linear-gradient(135deg, #00ba7c 0%, #059669 100%)',
              color: 'white',
              padding: '10px 16px',
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: 700,
              letterSpacing: '0.3px',
              boxShadow: '0 2px 12px rgba(0, 186, 124, 0.3)',
            }}>
              ⚡ Sprint Mode Active: Let&apos;s go!
            </div>
          )}
          <BrainDumpScreen
            onSubmit={handleBrainDumpSubmit}
            onSkip={handleBrainDumpSkip}
          />
        </>
      )}
      {step === 'triage' && (
        <TriageScreen
          tasks={parsedTasks}
          loading={triageLoading}
          onConfirm={handleTriageConfirm}
          onBack={handleTriageBack}
        />
      )}
      {step === 'context' && (
        <ContextScreen
          tasks={parsedTasks}
          onComplete={handleContextComplete}
          onBack={handleContextBack}
        />
      )}
      {step === 'breakdown' && (
        <BreakdownScreen
          breakdowns={breakdowns}
          loading={breakdownLoading}
          onStartFocusing={handleStartFocusing}
          onBack={handleBreakdownBack}
        />
      )}
      {step === 'dashboard' && (
        <FocusDashboard
          plans={plans}
          goals={goals}
          user={user}
          onlineCount={onlineCount}
          userMode={userMode}
          onNewBrainDump={handleNewBrainDump}
          onPlansUpdate={handlePlansUpdate}
        />
      )}
    </>
  )
}
