'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { usePresenceWithFallback } from '@/hooks/usePresence'
import { saveFocusFlowDraft, loadFocusFlowDraft, clearFocusFlowDraft } from '@/lib/focusFlowState'
import FocusSkeleton from '@/components/FocusSkeleton'

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
    <Suspense fallback={<FocusSkeleton />}>
      <FocusPageContent />
    </Suspense>
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
  const [parseInfo, setParseInfo] = useState<{
    aiUsed: boolean
    fallbackReason?: 'no_api_key' | 'api_error' | 'parse_error' | 'rate_limited'
  } | null>(null)
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
  const [gentleMode, setGentleMode] = useState(false)
  const [userMode, setUserMode] = useState<'recovery' | 'growth' | 'maintenance'>('maintenance')
  const [energyLevel, setEnergyLevel] = useState<'high' | 'low' | null>(null)

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
      const fetchedGoals = await fetchGoals(session.user.id)

      // Check for resumable draft FIRST (prevents data loss on refresh)
      const draft = loadFocusFlowDraft()
      if (draft && draft.step !== 'brain-dump' && draft.step !== 'dashboard') {
        // Restore state from draft
        if (draft.parsedTasks) setParsedTasks(draft.parsedTasks)
        if (draft.tasksWithContext) setTasksWithContext(draft.tasksWithContext as TaskWithContext[])
        if (draft.breakdowns) setBreakdowns(draft.breakdowns)
        if (draft.handoffGoalId !== undefined) setHandoffGoalId(draft.handoffGoalId)
        if (draft.handoffStepId !== undefined) setHandoffStepId(draft.handoffStepId)
        if (draft.userMode) setUserMode(draft.userMode)
        if (draft.energyLevel !== undefined) setEnergyLevel(draft.energyLevel)
        setStep(draft.step)
        setLoading(false)
        return // Skip normal routing - we're resuming from draft
      }

      // Handle URL params from Goals handoff
      const createParam = searchParams.get('create')
      const taskNameParam = searchParams.get('taskName')
      const goalIdParam = searchParams.get('goalId')
      const stepIdParam = searchParams.get('stepId')

      // Handle URL params from Check-in handoff (mode & energy)
      const modeParam = searchParams.get('mode') as 'sprint' | 'gentle' | null
      const energyParam = searchParams.get('energy') as 'high' | 'low' | null

      // Derive userMode and energyLevel from URL params
      if (modeParam === 'gentle') setUserMode('recovery')
      else if (modeParam === 'sprint') setUserMode('growth')
      if (energyParam) setEnergyLevel(energyParam)

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
      } else if ((modeParam === 'gentle' && energyParam === 'low') || (!modeParam && energyParam === 'low')) {
        // Gentle mode: skip brain-dump, go straight to breakdown with a low-demand task
        setGentleMode(true)
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
      } else if (fetchedGoals.length > 0) {
        // Goal-aware skip: user has active goals, skip brain-dump/triage
        // and land on ContextScreen with the top goal pre-selected
        const topGoal = fetchedGoals[0]
        const goalTask: ParsedTask = {
          id: `goal_${topGoal.id}`,
          text: topGoal.title,
        }
        setParsedTasks([goalTask])
        setHandoffGoalId(topGoal.id)
        setStep('context')
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

  const fetchGoals = async (userId: string): Promise<Goal[]> => {
    const { data } = await supabase
      .from('goals')
      .select('id, title, micro_steps')
      .eq('user_id', userId)
      .eq('is_completed', false)
      .order('created_at', { ascending: false })
      .limit(20)

    const fetched = (data || []).map(g => ({
      ...g,
      micro_steps: g.micro_steps || [],
    }))
    setGoals(fetched)
    return fetched
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
    setParseInfo(null) // Reset parse info

    let tasks: ParsedTask[] = []
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
      tasks = data.tasks || []
      setParsedTasks(tasks)

      // Capture AI usage info for UI feedback
      setParseInfo({
        aiUsed: data.aiUsed ?? true,
        fallbackReason: data.fallbackReason,
      })
    } catch (error) {
      console.error('Error parsing brain dump:', error)
      // Fallback: treat the whole text as one task
      tasks = [{ id: 'task_1', text: text.trim() }]
      setParsedTasks(tasks)
      setParseInfo({ aiUsed: false, fallbackReason: 'api_error' })
    }

    // Save draft after brain dump is parsed
    saveFocusFlowDraft({
      step: 'triage',
      brainDumpText: text,
      parsedTasks: tasks,
      handoffGoalId,
      handoffStepId,
      userMode,
      energyLevel,
    })

    setTriageLoading(false)
  }

  const handleBrainDumpSkip = () => {
    clearFocusFlowDraft() // Clear any draft when skipping to dashboard
    setStep('dashboard')
  }

  // ===== EXPRESS LANE: Quick Start =====
  // Bypasses triage, context, and breakdown — goes straight to dashboard with a dummy task
  const handleQuickStart = async () => {
    if (!user) return

    // Create a "Quick Focus Session" plan directly in the database
    const quickPlan = {
      user_id: user.id,
      task_name: 'Quick Focus Session',
      steps: [
        { id: 'quick_1', text: 'Set your intention', completed: false, dueBy: 'Now', timeEstimate: '1 min' },
        { id: 'quick_2', text: 'Start the timer', completed: false, dueBy: 'Next', timeEstimate: '1 min' },
        { id: 'quick_3', text: 'Focus until done', completed: false, dueBy: 'After that', timeEstimate: '25 min' },
      ],
      steps_completed: 0,
      total_steps: 3,
      is_completed: false,
      due_date: 'Today',
      energy_required: energyLevel || 'medium',
    }

    await supabase.from('focus_plans').insert(quickPlan)

    // Clear any draft since we're completing the flow
    clearFocusFlowDraft()

    // Refresh plans and go directly to dashboard
    await fetchPlans(user.id)
    setStep('dashboard')
  }

  const handleTriageConfirm = (tasks: ParsedTask[]) => {
    setParsedTasks(tasks)
    setStep('context')

    // Save draft after triage confirmation
    saveFocusFlowDraft({
      step: 'context',
      parsedTasks: tasks,
      handoffGoalId,
      handoffStepId,
      userMode,
      energyLevel,
    })
  }

  const handleTriageBack = () => {
    setParsedTasks([])
    clearFocusFlowDraft() // Clear draft when going back to start
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

      // Save draft after breakdowns are generated
      saveFocusFlowDraft({
        step: 'breakdown',
        parsedTasks,
        tasksWithContext: tasks,
        breakdowns: results,
        handoffGoalId,
        handoffStepId,
        userMode,
        energyLevel,
      })
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

      // Save draft with fallback breakdowns
      saveFocusFlowDraft({
        step: 'breakdown',
        parsedTasks,
        tasksWithContext: tasks,
        breakdowns: fallbacks,
        handoffGoalId,
        handoffStepId,
        userMode,
        energyLevel,
      })
    }

    setBreakdownLoading(false)
  }

  const handleContextBack = () => {
    // Save draft when going back to triage
    saveFocusFlowDraft({
      step: 'triage',
      parsedTasks,
      handoffGoalId,
      handoffStepId,
      userMode,
      energyLevel,
    })
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

    // Flow completed successfully - clear the draft
    clearFocusFlowDraft()

    // Refresh plans and show dashboard
    await fetchPlans(user.id)
    setHandoffGoalId(null)
    setHandoffStepId(null)
    setStep('dashboard')
  }

  const handleBreakdownBack = () => {
    // Save draft when going back to context
    saveFocusFlowDraft({
      step: 'context',
      parsedTasks,
      tasksWithContext,
      handoffGoalId,
      handoffStepId,
      userMode,
      energyLevel,
    })
    setStep('context')
  }

  const handleNewBrainDump = () => {
    // Clear draft when starting fresh
    clearFocusFlowDraft()
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
    return <FocusSkeleton />
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
            onQuickStart={handleQuickStart}
          />
        </>
      )}
      {step === 'triage' && (
        <TriageScreen
          tasks={parsedTasks}
          loading={triageLoading}
          energyLevel={energyLevel}
          parseInfo={parseInfo}
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
        <>
          {gentleMode && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 100,
              background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
              color: 'white',
              padding: '10px 16px',
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: 700,
              letterSpacing: '0.3px',
              boxShadow: '0 2px 12px rgba(99, 102, 241, 0.3)',
            }}>
              🌙 Gentle Mode: Energy is low, so we kept it simple.
            </div>
          )}
          <BreakdownScreen
            breakdowns={breakdowns}
            loading={breakdownLoading}
            onStartFocusing={handleStartFocusing}
            onBack={handleBreakdownBack}
          />
        </>
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
