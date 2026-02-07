'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AppHeader from '@/components/AppHeader'
import FABToolbox from '@/components/FABToolbox'
import PostFocusToast from '@/components/micro/PostFocusToast'
import QuickAllyModal from './QuickAllyModal'
import { useUserStats } from '@/context/UserStatsContext'
import { XP_VALUES } from '@/lib/gamification'
import { useGamificationPrefsSafe } from '@/context/GamificationPrefsContext'

const OVERWHELM_DELAY_MS = 5 * 60 * 1000 // 5 minutes of inactivity

interface Step {
  id: string
  text: string
  completed: boolean
  dueBy?: string
  timeEstimate?: string
}

interface Plan {
  id: string
  task_name: string
  steps: Step[]
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

interface FocusDashboardProps {
  plans: Plan[]
  goals: Goal[]
  user: any
  onlineCount: number
  userMode: 'recovery' | 'growth' | 'maintenance'
  onNewBrainDump: () => void
  onPlansUpdate: () => void
}

const getPlantEmoji = (p: number): string => {
  if (p >= 100) return '🌸'
  if (p >= 75) return '🌷'
  if (p >= 50) return '🪴'
  if (p >= 25) return '🌿'
  return '🌱'
}

const DUE_DATE_ORDER: Record<string, number> = {
  today: 0,
  tomorrow: 1,
  this_week: 2,
  no_rush: 3,
}

function sortByDueDate(a: Plan, b: Plan): number {
  const aOrder = DUE_DATE_ORDER[a.due_date || ''] ?? 4
  const bOrder = DUE_DATE_ORDER[b.due_date || ''] ?? 4
  return aOrder - bOrder
}

export default function FocusDashboard({
  plans,
  goals,
  user,
  onlineCount,
  userMode,
  onNewBrainDump,
  onPlansUpdate,
}: FocusDashboardProps) {
  const router = useRouter()
  const { awardXP } = useUserStats()
  const { prefs: gamPrefs } = useGamificationPrefsSafe()
  const [xpToast, setXpToast] = useState<{ amount: number; visible: boolean }>({ amount: 0, visible: false })
  const [pulseStepId, setPulseStepId] = useState<string | null>(null)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [completedPlan, setCompletedPlan] = useState<Plan | null>(null)
  const [syncingGoal, setSyncingGoal] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)

  // Post-Action Survey (Trojan Horse)
  const [showFocusSurvey, setShowFocusSurvey] = useState(false)

  // Mode-specific completion modal
  const [showModeModal, setShowModeModal] = useState(false)

  // Task action menu
  const [taskMenuId, setTaskMenuId] = useState<string | null>(null)

  // Quick Ally (Stuck) modal state
  const [showStuckModal, setShowStuckModal] = useState(false)
  const [stuckTaskName, setStuckTaskName] = useState('')

  // Quick Capture (Parking Lot)
  const [captureText, setCaptureText] = useState('')
  const [showCaptureToast, setShowCaptureToast] = useState(false)

  // Editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTaskName, setEditingTaskName] = useState('')
  const [editingStepKey, setEditingStepKey] = useState<string | null>(null)
  const [editingStepText, setEditingStepText] = useState('')

  // Undo deletion state
  const [pendingDelete, setPendingDelete] = useState<{
    type: 'plan' | 'step'
    planId: string
    stepId?: string
    label: string
    timer: ReturnType<typeof setTimeout>
  } | null>(null)

  // Micro-Start (5-Minute Dash) state
  const [microTimerPlanId, setMicroTimerPlanId] = useState<string | null>(null)
  const [microSecondsLeft, setMicroSecondsLeft] = useState(300)
  const microIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [showMomentumModal, setShowMomentumModal] = useState(false)
  const [momentumPlanId, setMomentumPlanId] = useState<string | null>(null)

  // Drift Detector state
  const DRIFT_THRESHOLD_MS = 3 * 60 * 1000 // 3 minutes
  const [showDriftModal, setShowDriftModal] = useState(false)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isIdleRef = useRef(false)
  const originalTitleRef = useRef('')
  const microTimerActiveRef = useRef(false)

  // Zen Mode
  const [isZenMode, setIsZenMode] = useState(false)
  const [zenPlanId, setZenPlanId] = useState<string | null>(null)

  // Lock-In Mode: auto-hides navigation to protect hyperfocus state
  const [lockedIn, setLockedIn] = useState(userMode === 'growth')

  // Village Presence (Body Doubling)
  const [showBoostBurst, setShowBoostBurst] = useState(false)

  // Implicit Overwhelm Detection
  const [showOverwhelmToast, setShowOverwhelmToast] = useState(false)
  const overwhelmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const overwhelmFiredRef = useRef(false)

  const logOverwhelmEvent = async () => {
    if (!user) return
    await supabase.from('burnout_logs').insert({
      user_id: user.id,
      overwhelm: 6,
      source: 'focus_stagnation',
    })
  }

  const resetOverwhelmTimer = () => {
    if (overwhelmTimerRef.current) {
      clearTimeout(overwhelmTimerRef.current)
      overwhelmTimerRef.current = null
    }
  }

  // Start/restart the stagnation timer whenever plans change (step toggled, etc.)
  useEffect(() => {
    // Only run if there are active plans and we haven't already fired
    if (plans.length === 0 || overwhelmFiredRef.current) return

    resetOverwhelmTimer()
    overwhelmTimerRef.current = setTimeout(() => {
      if (!overwhelmFiredRef.current) {
        overwhelmFiredRef.current = true
        setShowOverwhelmToast(true)
        logOverwhelmEvent()
      }
    }, OVERWHELM_DELAY_MS)

    return () => resetOverwhelmTimer()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans, user])

  const dismissOverwhelmToast = () => {
    setShowOverwhelmToast(false)
  }

  // Micro-Start: gentle chime via Web Audio API
  const playChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const notes = [523.25, 659.25] // C5, E5
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = freq
        osc.type = 'sine'
        const start = ctx.currentTime + i * 0.2
        gain.gain.setValueAtTime(0.3, start)
        gain.gain.exponentialRampToValueAtTime(0.001, start + 1)
        osc.start(start)
        osc.stop(start + 1)
      })
    } catch {
      // Audio not supported — silent fallback
    }
  }

  // Micro-Start timer countdown
  useEffect(() => {
    if (!microTimerPlanId) return

    microIntervalRef.current = setInterval(() => {
      setMicroSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(microIntervalRef.current!)
          microIntervalRef.current = null
          playChime()
          setMomentumPlanId(microTimerPlanId)
          setMicroTimerPlanId(null)
          setShowMomentumModal(true)
          return 300
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (microIntervalRef.current) {
        clearInterval(microIntervalRef.current)
        microIntervalRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [microTimerPlanId])

  // Drift Detector: soft ping (lighter than the chime — single A5 note)
  const playPing = () => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880 // A5
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.6)
    } catch {
      // Audio not supported — silent fallback
    }
  }

  // Keep microTimerActiveRef in sync
  useEffect(() => {
    microTimerActiveRef.current = microTimerPlanId !== null
  }, [microTimerPlanId])

  // Restore title if micro-timer expires while user is idle
  useEffect(() => {
    if (!microTimerPlanId && isIdleRef.current && originalTitleRef.current) {
      document.title = originalTitleRef.current
      originalTitleRef.current = ''
    }
  }, [microTimerPlanId])

  // Auto-lock when micro-timer starts
  useEffect(() => {
    if (microTimerPlanId) {
      setLockedIn(true)
    }
  }, [microTimerPlanId])

  // Drift Detector: idle detection via mouse/keyboard/touch events
  useEffect(() => {
    const onActivity = () => {
      // Returning from idle — handle welcome-back
      if (isIdleRef.current) {
        isIdleRef.current = false
        if (originalTitleRef.current) {
          document.title = originalTitleRef.current
          originalTitleRef.current = ''
        }
        // Only show drift modal if micro-timer is still running
        if (microTimerActiveRef.current) {
          setShowDriftModal(true)
        }
      }

      // Reset idle countdown
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(() => {
        isIdleRef.current = true
        if (microTimerActiveRef.current) {
          originalTitleRef.current = document.title
          document.title = 'Still focusing? \u{1F440}'
          playPing()
        }
      }, DRIFT_THRESHOLD_MS)
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }))

    // Start initial idle countdown
    idleTimerRef.current = setTimeout(() => {
      isIdleRef.current = true
      if (microTimerActiveRef.current) {
        originalTitleRef.current = document.title
        document.title = 'Still focusing? \u{1F440}'
        playPing()
      }
    }, DRIFT_THRESHOLD_MS)

    return () => {
      events.forEach(e => window.removeEventListener(e, onActivity))
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      if (originalTitleRef.current) {
        document.title = originalTitleRef.current
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const formatMicroTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const startMicroTimer = (planId: string) => {
    setMicroSecondsLeft(300)
    setMicroTimerPlanId(planId)
    // Auto-enter zen mode for this task
    setIsZenMode(true)
    setZenPlanId(planId)
  }

  const stopMicroTimer = () => {
    if (microIntervalRef.current) {
      clearInterval(microIntervalRef.current)
      microIntervalRef.current = null
    }
    setMicroTimerPlanId(null)
    setMicroSecondsLeft(300)
  }

  const handleMomentumKeepGoing = () => {
    setShowMomentumModal(false)
    setMomentumPlanId(null)
  }

  const handleMomentumBreak = () => {
    setShowMomentumModal(false)
    setMomentumPlanId(null)
  }

  const handleMomentumDone = async () => {
    if (!momentumPlanId || !user) {
      setShowMomentumModal(false)
      setMomentumPlanId(null)
      return
    }

    const plan = plans.find(p => p.id === momentumPlanId)
    if (!plan) {
      setShowMomentumModal(false)
      setMomentumPlanId(null)
      return
    }

    const allCompleted = plan.steps.map(s => ({ ...s, completed: true }))
    await supabase.from('focus_plans').update({
      steps: allCompleted,
      steps_completed: allCompleted.length,
      is_completed: true,
    }).eq('id', momentumPlanId).eq('user_id', user.id)

    const uncompletedCount = plan.steps.filter(s => !s.completed).length
    if (uncompletedCount > 0) {
      const xpGained = uncompletedCount * XP_VALUES.focus_step + XP_VALUES.focus_plan_complete
      for (let i = 0; i < uncompletedCount; i++) {
        await awardXP('focus_step')
      }
      await awardXP('focus_plan_complete')
      showXpToast(xpGained)
    }

    setShowMomentumModal(false)
    setMomentumPlanId(null)
    setShowFocusSurvey(true)
    if (plan.related_goal_id && plan.related_step_id) {
      setCompletedPlan({ ...plan, steps: allCompleted })
    }
    onPlansUpdate()
  }

  // Drift Detector: modal handlers
  const handleDriftKeepRolling = () => {
    setShowDriftModal(false)
  }

  const handleDriftSubtract = () => {
    // Reset micro-timer to a fresh 5:00 — the drift time "doesn't count"
    setMicroSecondsLeft(300)
    setShowDriftModal(false)
  }

  const sortedPlans = [...plans]
    .filter(p => !(pendingDelete?.type === 'plan' && pendingDelete.planId === p.id))
    .sort(sortByDueDate)

  const getGoalTitle = (goalId: string | null) => {
    if (!goalId) return null
    const goal = goals.find(g => g.id === goalId)
    return goal?.title || null
  }

  const getDueDateLabel = (dueDate: string | null | undefined): string | null => {
    if (!dueDate) return null
    switch (dueDate) {
      case 'today': return 'Due today'
      case 'tomorrow': return 'Tomorrow'
      case 'this_week': return 'This week'
      case 'no_rush': return 'No rush'
      default: return dueDate
    }
  }

  const showXpToast = (amount: number) => {
    setXpToast({ amount, visible: true })
    setTimeout(() => setXpToast({ amount: 0, visible: false }), 2000)
  }

  const toggleStep = async (planId: string, stepId: string) => {
    const plan = plans.find(p => p.id === planId)
    if (!plan || !user) return

    const wasCompleted = plan.steps.find(s => s.id === stepId)?.completed

    const updatedSteps = plan.steps.map(s =>
      s.id === stepId ? { ...s, completed: !s.completed } : s
    )

    const completedCount = updatedSteps.filter(s => s.completed).length
    const isNowComplete = completedCount === updatedSteps.length

    await supabase.from('focus_plans').update({
      steps: updatedSteps,
      steps_completed: completedCount,
      is_completed: isNowComplete,
    }).eq('id', planId).eq('user_id', user.id)

    onPlansUpdate()

    // Award XP when a step is checked (not unchecked)
    if (!wasCompleted) {
      // Dopamine pulse on the checkbox
      setPulseStepId(stepId)
      setTimeout(() => setPulseStepId(null), 600)

      let xpGained = XP_VALUES.focus_step
      await awardXP('focus_step')
      if (isNowComplete) {
        xpGained += XP_VALUES.focus_plan_complete
        await awardXP('focus_plan_complete')
      }
      showXpToast(xpGained)
    }

    if (isNowComplete) {
      // Show focus quality survey (Trojan Horse)
      setShowFocusSurvey(true)

      if (plan.related_goal_id && plan.related_step_id) {
        setCompletedPlan({ ...plan, steps: updatedSteps })
      }
    }
  }

  const handleFocusToastDismiss = () => {
    setShowFocusSurvey(false)
    if (userMode === 'recovery' || userMode === 'growth') {
      setShowModeModal(true)
    } else if (completedPlan) {
      setShowCompletionModal(true)
    }
  }

  const handleGoalSync = async (shouldSync: boolean) => {
    if (!shouldSync || !completedPlan || !user) {
      setShowCompletionModal(false)
      setCompletedPlan(null)
      return
    }

    setSyncingGoal(true)

    try {
      const { related_goal_id, related_step_id } = completedPlan

      const { data: goalData, error: fetchError } = await supabase
        .from('goals')
        .select('*')
        .eq('id', related_goal_id)
        .eq('user_id', user.id)
        .single()

      if (fetchError || !goalData) {
        setShowCompletionModal(false)
        setCompletedPlan(null)
        setSyncingGoal(false)
        return
      }

      const updatedMicroSteps = (goalData.micro_steps || []).map((step: any) =>
        step.id === related_step_id ? { ...step, completed: true } : step
      )

      const completedStepCount = updatedMicroSteps.filter((s: any) => s.completed).length
      const totalSteps = updatedMicroSteps.length
      const newProgress = totalSteps > 0 ? Math.round((completedStepCount / totalSteps) * 100) : 0
      const isGoalComplete = newProgress >= 100

      const goalUpdate: any = {
        micro_steps: updatedMicroSteps,
        progress_percent: newProgress,
      }

      if (isGoalComplete) {
        goalUpdate.status = 'completed'
        goalUpdate.celebration_message = `You completed "${goalData.title}" by finishing all your focus sessions!`
      }

      await supabase
        .from('goals')
        .update(goalUpdate)
        .eq('id', related_goal_id)
        .eq('user_id', user.id)

      if (isGoalComplete) {
        setShowCelebration(true)
        setTimeout(() => setShowCelebration(false), 4000)
      }
    } catch (e) {
      console.error('Failed to sync goal:', e)
    }

    setShowCompletionModal(false)
    setCompletedPlan(null)
    setSyncingGoal(false)
    onPlansUpdate()
  }

  const handleRecoveryBetter = async () => {
    setShowModeModal(false)
    if (user) {
      await supabase.from('mood_entries').insert({
        user_id: user.id,
        mood_score: 6,
        note: 'Recovery win',
        coach_advice: null,
      })
    }
    // After completing a task on low battery and feeling better → maintenance
    if (completedPlan) {
      setShowCompletionModal(true)
    } else {
      router.push('/dashboard?mode=maintenance')
    }
  }

  const getGoalProgress = (goalId: string | null): number => {
    if (!goalId) return 0
    const goal = goals.find(g => g.id === goalId)
    if (!goal || goal.micro_steps.length === 0) return 0
    const done = goal.micro_steps.filter(s => s.completed).length
    return Math.round((done / goal.micro_steps.length) * 100)
  }

  // ============================================
  // Task Actions
  // ============================================

  const deletePlan = (planId: string) => {
    const plan = plans.find(p => p.id === planId)
    if (!plan || !user) return
    setTaskMenuId(null)

    if (pendingDelete?.timer) clearTimeout(pendingDelete.timer)

    const timer = setTimeout(async () => {
      await supabase.from('focus_plans').delete().eq('id', planId).eq('user_id', user.id)
      setPendingDelete(null)
      onPlansUpdate()
    }, 5000)

    setPendingDelete({ type: 'plan', planId, label: plan.task_name, timer })
  }

  const startEditTask = (plan: Plan) => {
    setEditingTaskId(plan.id)
    setEditingTaskName(plan.task_name)
    setTaskMenuId(null)
  }

  const saveEditTask = async (planId: string) => {
    if (!user || !editingTaskName.trim()) return
    await supabase.from('focus_plans').update({
      task_name: editingTaskName.trim(),
    }).eq('id', planId).eq('user_id', user.id)
    setEditingTaskId(null)
    setEditingTaskName('')
    onPlansUpdate()
  }

  const cancelEditTask = () => {
    setEditingTaskId(null)
    setEditingTaskName('')
  }

  const deprioritizePlan = async (planId: string) => {
    if (!user) return
    await supabase.from('focus_plans').update({
      due_date: 'no_rush',
    }).eq('id', planId).eq('user_id', user.id)
    setTaskMenuId(null)
    onPlansUpdate()
  }

  // ============================================
  // Step Actions
  // ============================================

  const deleteStep = (planId: string, stepId: string) => {
    const plan = plans.find(p => p.id === planId)
    if (!plan || !user) return

    const step = plan.steps.find(s => s.id === stepId)
    if (pendingDelete?.timer) clearTimeout(pendingDelete.timer)

    const timer = setTimeout(async () => {
      const updatedSteps = plan.steps.filter(s => s.id !== stepId)
      const completedCount = updatedSteps.filter(s => s.completed).length

      await supabase.from('focus_plans').update({
        steps: updatedSteps,
        steps_completed: completedCount,
        total_steps: updatedSteps.length,
        is_completed: updatedSteps.length > 0 && completedCount === updatedSteps.length,
      }).eq('id', planId).eq('user_id', user.id)

      setPendingDelete(null)
      onPlansUpdate()
    }, 5000)

    setPendingDelete({ type: 'step', planId, stepId, label: step?.text || 'step', timer })
  }

  const undoDelete = () => {
    if (!pendingDelete) return
    clearTimeout(pendingDelete.timer)
    setPendingDelete(null)
  }

  const startEditStep = (planId: string, step: Step) => {
    setEditingStepKey(`${planId}:${step.id}`)
    setEditingStepText(step.text)
  }

  const saveEditStep = async (planId: string, stepId: string) => {
    const plan = plans.find(p => p.id === planId)
    if (!plan || !user || !editingStepText.trim()) return

    const updatedSteps = plan.steps.map(s =>
      s.id === stepId ? { ...s, text: editingStepText.trim() } : s
    )

    await supabase.from('focus_plans').update({
      steps: updatedSteps,
    }).eq('id', planId).eq('user_id', user.id)

    setEditingStepKey(null)
    setEditingStepText('')
    onPlansUpdate()
  }

  const cancelEditStep = () => {
    setEditingStepKey(null)
    setEditingStepText('')
  }

  const handleQuickCapture = async () => {
    const text = captureText.trim()
    if (!text || !user) return

    // Optimistic: clear input and show toast immediately
    setCaptureText('')
    setShowCaptureToast(true)
    setTimeout(() => setShowCaptureToast(false), 2000)

    // Background: save as a low-energy backlog plan
    await supabase.from('focus_plans').insert({
      user_id: user.id,
      task_name: text,
      steps: [],
      steps_completed: 0,
      total_steps: 0,
      is_completed: false,
      due_date: 'no_rush',
      energy_required: 'low',
    })

    onPlansUpdate()
  }

  const handleVillageBoost = () => {
    setShowBoostBurst(true)
    setTimeout(() => setShowBoostBurst(false), 2500)
  }

  return (
    <div className={`focus-page ${isZenMode ? 'zen-page' : ''} ${lockedIn && !isZenMode ? 'locked-in-page' : ''} ${userMode === 'recovery' ? 'recovery-dimmed' : ''}`}>
      {!isZenMode && !lockedIn && (
        <AppHeader
          onlineCount={onlineCount}
          notificationBar={{
            text: 'Break down tasks into manageable steps',
            color: '#1D9BF0',
            icon: '⏱️',
          }}
          brakeVariant={userMode === 'recovery' ? 'urgent' : 'neutral'}
          userMode={userMode}
        />
      )}

      {/* Lock-In bar: minimal header that replaces AppHeader during focus */}
      {lockedIn && !isZenMode && (
        <div className="lockin-bar">
          <span className="lockin-icon">🔒</span>
          <span className="lockin-label">Focus Lock</span>
          <button className="lockin-unlock" onClick={() => setLockedIn(false)}>
            Unlock
          </button>
        </div>
      )}

      {/* Zen Mode dimmed backdrop */}
      {isZenMode && <div className="zen-backdrop" />}

      <main className={`main ${isZenMode ? 'main-zen' : ''}`}>
        {isZenMode ? (
          <div className="zen-header">
            <button
              className="zen-toggle active"
              onClick={() => {
                setIsZenMode(false)
                setZenPlanId(null)
              }}
            >
              📋 Show All
            </button>
          </div>
        ) : (
          <div className="page-header-title">
            <h1>⏱️ Focus Mode</h1>
            <div className="page-header-actions">
              {!lockedIn && sortedPlans.length > 0 && (
                <button
                  className="zen-toggle"
                  onClick={() => {
                    setIsZenMode(true)
                    setZenPlanId(sortedPlans[0]?.id || null)
                  }}
                >
                  👁️ Zen Mode
                </button>
              )}
              {!lockedIn && (
                <button
                  className="zen-toggle"
                  onClick={() => setLockedIn(true)}
                >
                  🔒 Lock In
                </button>
              )}
            </div>
          </div>
        )}

        {!isZenMode && !lockedIn && (
          <button onClick={onNewBrainDump} className="new-dump-btn">
            🧠 New Brain Dump
          </button>
        )}

        {sortedPlans.length === 0 ? (
          <div className="card empty-state">
            <span className="empty-emoji">🔨</span>
            <p className="empty-title">No active tasks</p>
            <p className="empty-subtitle">Do a brain dump to break down what&apos;s on your mind</p>
            <button onClick={onNewBrainDump} className="btn-primary">
              Start Brain Dump
            </button>
          </div>
        ) : (
          (isZenMode
            ? sortedPlans.filter(p => zenPlanId ? p.id === zenPlanId : false).slice(0, 1)
            : sortedPlans
          ).map((plan) => {
            const done = plan.steps.filter(s => s.completed).length
            const total = plan.steps.length
            const pct = total > 0 ? Math.round((done / total) * 100) : 0
            const linkedGoalTitle = getGoalTitle(plan.related_goal_id || null)
            const dueDateLabel = getDueDateLabel(plan.due_date)
            const canDeprioritize = plan.due_date === 'today' || plan.due_date === 'tomorrow'
            const isMenuOpen = taskMenuId === plan.id

            return (
              <div key={plan.id} className={`card task-card ${isZenMode ? 'zen-active' : ''}`}>
                {!isZenMode && (
                  <>
                    <div className="task-top-row">
                      <div className="task-badges">
                        {linkedGoalTitle && (
                          <span className="linked-goal-badge">🎯 {linkedGoalTitle}</span>
                        )}
                        {dueDateLabel && (
                          <span className="due-badge">{dueDateLabel}</span>
                        )}
                      </div>
                      <div className="task-actions-wrapper">
                        <button
                          className="task-menu-btn"
                          onClick={() => setTaskMenuId(isMenuOpen ? null : plan.id)}
                          type="button"
                        >
                          ⋯
                        </button>
                        {isMenuOpen && (
                          <div className="task-action-menu">
                            <button className="action-item" onClick={() => startEditTask(plan)}>
                              ✏️ Edit name
                            </button>
                            {canDeprioritize && (
                              <button className="action-item" onClick={() => deprioritizePlan(plan.id)}>
                                🌊 Deprioritize
                              </button>
                            )}
                            <button className="action-item danger" onClick={() => deletePlan(plan.id)}>
                              🗑️ Delete task
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {isMenuOpen && (
                      <div className="action-menu-overlay" onClick={() => setTaskMenuId(null)} />
                    )}
                  </>
                )}

                <div className="task-header">
                  {editingTaskId === plan.id ? (
                    <div className="inline-edit">
                      <input
                        type="text"
                        value={editingTaskName}
                        onChange={(e) => setEditingTaskName(e.target.value)}
                        className="inline-edit-input"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEditTask(plan.id)
                          if (e.key === 'Escape') cancelEditTask()
                        }}
                      />
                      <button className="inline-save" onClick={() => saveEditTask(plan.id)}>✓</button>
                      <button className="inline-cancel" onClick={cancelEditTask}>✕</button>
                    </div>
                  ) : (
                    <>
                      <p className="task-name">{plan.task_name}</p>
                      <span className="task-progress-text">{done}/{total}</span>
                    </>
                  )}
                </div>

                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${pct}%` }} />
                </div>

                {/* Village Presence (Body Doubling) */}
                {onlineCount > 0 && (
                  <div className="village-presence">
                    <div className="village-dots">
                      {Array.from({ length: Math.min(onlineCount, 5) }).map((_, i) => (
                        <span key={i} className="village-dot" style={{ animationDelay: `${i * 0.3}s` }} />
                      ))}
                    </div>
                    <span className="village-text">
                      {onlineCount} other{onlineCount !== 1 ? 's' : ''} focusing with you
                    </span>
                    <button className="village-boost-btn" onClick={handleVillageBoost} type="button">
                      👋 Boost
                    </button>
                  </div>
                )}

                {/* Micro-Start: 5-Minute Dash */}
                {!microTimerPlanId && pct < 100 && (
                  <button
                    className="micro-start-btn"
                    onClick={() => startMicroTimer(plan.id)}
                  >
                    ⚡ Just 5 Minutes
                  </button>
                )}
                {microTimerPlanId === plan.id && (
                  <div className="micro-active-badge">
                    ⚡ {formatMicroTime(microSecondsLeft)} remaining
                  </div>
                )}

                <button
                  className="stuck-btn"
                  onClick={() => {
                    setStuckTaskName(plan.task_name)
                    setShowStuckModal(true)
                  }}
                >
                  💜 Hitting a Wall
                </button>

                {plan.steps
                  .filter(s => !(pendingDelete?.type === 'step' && pendingDelete.planId === plan.id && pendingDelete.stepId === s.id))
                  .map((step) => {
                  const stepKey = `${plan.id}:${step.id}`
                  const isEditingThisStep = editingStepKey === stepKey

                  return (
                    <div key={step.id} className="step-item">
                      <div
                        className={`checkbox ${step.completed ? 'checked' : ''} ${pulseStepId === step.id ? 'step-pulse' : ''}`}
                        onClick={() => toggleStep(plan.id, step.id)}
                      >
                        {step.completed && '✓'}
                      </div>
                      <div className="step-content" onClick={() => { if (!isEditingThisStep) toggleStep(plan.id, step.id) }}>
                        {isEditingThisStep ? (
                          <div className="inline-edit">
                            <input
                              type="text"
                              value={editingStepText}
                              onChange={(e) => setEditingStepText(e.target.value)}
                              className="inline-edit-input"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEditStep(plan.id, step.id)
                                if (e.key === 'Escape') cancelEditStep()
                              }}
                            />
                            <button className="inline-save" onClick={(e) => { e.stopPropagation(); saveEditStep(plan.id, step.id) }}>✓</button>
                            <button className="inline-cancel" onClick={(e) => { e.stopPropagation(); cancelEditStep() }}>✕</button>
                          </div>
                        ) : (
                          <>
                            <span className={`step-text ${step.completed ? 'completed' : ''}`}>
                              {step.text}
                            </span>
                            {step.dueBy && (
                              <span className="step-meta">{step.dueBy}{step.timeEstimate ? ` · ${step.timeEstimate}` : ''}</span>
                            )}
                          </>
                        )}
                      </div>
                      {!isEditingThisStep && (
                        <div className="step-actions">
                          <button
                            className="step-action-btn"
                            onClick={(e) => { e.stopPropagation(); startEditStep(plan.id, step) }}
                            title="Edit step"
                          >
                            ✏️
                          </button>
                          <button
                            className="step-action-btn delete"
                            onClick={(e) => { e.stopPropagation(); deleteStep(plan.id, step.id) }}
                            title="Delete step"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })
        )}
      </main>

      {/* Quick Ally (Stuck) Modal */}
      <QuickAllyModal
        taskName={stuckTaskName}
        isOpen={showStuckModal}
        onClose={() => setShowStuckModal(false)}
      />

      {/* Focus Quality Survey (Trojan Horse) */}
      <PostFocusToast
        userId={user?.id}
        show={showFocusSurvey}
        onDismiss={handleFocusToastDismiss}
      />

      {/* Goal Sync Modal */}
      {showCompletionModal && completedPlan && (() => {
        const goalProgress = getGoalProgress(completedPlan.related_goal_id || null)
        const plantEmoji = getPlantEmoji(goalProgress)
        const plantScale = 1 + (goalProgress / 100) * 1.5

        return (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-icon">🎉</div>
              <h2 className="modal-title">Great work!</h2>
              <p className="modal-text">
                {onlineCount > 0
                  ? <>You and {onlineCount} other{onlineCount !== 1 ? 's' : ''} crushed it just now.</>
                  : <>You completed your focus session.</>}
                <br />
                <strong>Did this complete the step in your Goal?</strong>
              </p>
              {completedPlan.related_goal_id && (
                <>
                  <div className="modal-goal-badge">
                    🎯 {getGoalTitle(completedPlan.related_goal_id)}
                  </div>
                  <div className="modal-plant-viz">
                    <div className="modal-plant-emoji" style={{ fontSize: `${plantScale}rem` }}>
                      {plantEmoji}
                    </div>
                    <div className="modal-plant-bar">
                      <div className="modal-plant-fill" style={{ width: `${goalProgress}%` }} />
                    </div>
                    <span className="modal-plant-label">{goalProgress}% grown</span>
                  </div>
                </>
              )}
              <div className="modal-actions">
                <button
                  className="modal-btn secondary"
                  onClick={() => handleGoalSync(false)}
                  disabled={syncingGoal}
                >
                  Not yet
                </button>
                <button
                  className="modal-btn primary"
                  onClick={() => handleGoalSync(true)}
                  disabled={syncingGoal}
                >
                  {syncingGoal ? 'Syncing...' : 'Yes, mark complete!'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Mode-Specific Completion Modal */}
      {showModeModal && userMode === 'recovery' && (
        <div className="modal-overlay">
          <div className="modal-card mode-modal recovery">
            <div className="modal-icon">🌿</div>
            <h2 className="modal-title">You did it! Energy check:</h2>
            <p className="modal-text">
              How do you feel now?
            </p>
            <div className="modal-actions">
              <button
                className="modal-btn secondary"
                onClick={() => { setShowModeModal(false); router.push('/dashboard?mode=recovery') }}
              >
                Still Tired
              </button>
              <button
                className="modal-btn primary recovery-btn"
                onClick={handleRecoveryBetter}
              >
                Better / Warmed Up
              </button>
            </div>
          </div>
        </div>
      )}

      {showModeModal && userMode === 'growth' && (
        <div className="modal-overlay">
          <div className="modal-card mode-modal growth">
            <div className="modal-icon">🔥</div>
            <h2 className="modal-title">Momentum is high!</h2>
            <p className="modal-text">
              You're in the zone. Ride the wave or take a well-earned break — both are wins.
            </p>
            <div className="modal-actions">
              <button
                className="modal-btn primary growth-btn"
                onClick={() => { setShowModeModal(false); onNewBrainDump() }}
              >
                Keep Streak Alive
              </button>
              <button
                className="modal-btn secondary"
                onClick={() => { setShowModeModal(false); router.push('/dashboard') }}
              >
                Take a Break
              </button>
            </div>
          </div>
        </div>
      )}

      {/* XP Toast */}
      {gamPrefs.showXP && xpToast.visible && (
        <div className="xp-toast">+{xpToast.amount} XP</div>
      )}

      {/* Undo Delete Toast */}
      {pendingDelete && (
        <div className="undo-toast">
          <span className="undo-text">Deleted &ldquo;{pendingDelete.label}&rdquo;</span>
          <button onClick={undoDelete} className="undo-btn">Undo</button>
        </div>
      )}

      {/* Implicit Overwhelm Toast */}
      {showOverwhelmToast && (
        <div className="overwhelm-toast">
          <span className="overwhelm-text">Things feeling sticky? 💜</span>
          <div className="overwhelm-actions">
            <button
              className="overwhelm-btn break"
              onClick={() => { dismissOverwhelmToast(); router.push('/brake') }}
            >
              Break
            </button>
            <button
              className="overwhelm-btn help"
              onClick={() => { dismissOverwhelmToast(); setStuckTaskName(sortedPlans[0]?.task_name || 'Current task'); setShowStuckModal(true) }}
            >
              Help
            </button>
          </div>
          <button className="overwhelm-dismiss" onClick={dismissOverwhelmToast}>×</button>
        </div>
      )}

      {/* Micro-Start Timer Bar */}
      {microTimerPlanId && (
        <div className="micro-timer-bar">
          <div className="micro-timer-info">
            <span className="micro-timer-icon">⚡</span>
            <span className="micro-timer-msg">You can stop after this.</span>
          </div>
          <span className="micro-timer-time">{formatMicroTime(microSecondsLeft)}</span>
          <button className="micro-timer-stop" onClick={stopMicroTimer}>Stop</button>
        </div>
      )}

      {/* Momentum Check Modal */}
      {showMomentumModal && (
        <div className="modal-overlay">
          <div className="modal-card momentum-modal">
            <div className="modal-icon">⏰</div>
            <h2 className="modal-title">Momentum Check</h2>
            <p className="modal-text">
              Your 5 minutes are up! How are you feeling?
            </p>
            <div className="momentum-options">
              <button className="momentum-btn rolling" onClick={handleMomentumKeepGoing}>
                <span className="momentum-btn-icon">🔥</span>
                <span className="momentum-btn-label">I&apos;m rolling! Keep going.</span>
              </button>
              <button className="momentum-btn pause" onClick={handleMomentumBreak}>
                <span className="momentum-btn-icon">☕</span>
                <span className="momentum-btn-label">I need a break.</span>
              </button>
              <button className="momentum-btn done" onClick={handleMomentumDone}>
                <span className="momentum-btn-icon">✅</span>
                <span className="momentum-btn-label">Task is done!</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drift Detector — non-blocking welcome-back card */}
      {showDriftModal && (
        <div className="drift-card">
          <span className="drift-icon">👀</span>
          <div className="drift-content">
            <p className="drift-title">You drifted away</p>
            <p className="drift-text">Subtract that time or keep rolling?</p>
          </div>
          <div className="drift-actions">
            <button className="drift-btn keep" onClick={handleDriftKeepRolling}>
              Keep rolling
            </button>
            {microTimerPlanId && (
              <button className="drift-btn subtract" onClick={handleDriftSubtract}>
                + 5m
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quick Capture (Parking Lot) — always visible, even during timer */}
      <div className={`quick-capture-bar ${microTimerPlanId ? 'above-timer' : ''}`}>
        <span className="quick-capture-icon">📥</span>
        <input
          type="text"
          className="quick-capture-input"
          placeholder="Capture a stray thought..."
          value={captureText}
          onChange={(e) => setCaptureText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleQuickCapture() }}
          maxLength={200}
        />
        <button
          className="quick-capture-add"
          onClick={handleQuickCapture}
          disabled={captureText.trim().length === 0}
        >
          Add
        </button>
      </div>

      {/* Quick Capture Toast */}
      {showCaptureToast && (
        <div className="capture-toast">📥 Saved for later. Back to flow.</div>
      )}

      {/* Village Boost Burst */}
      {showBoostBurst && (
        <div className="boost-burst">
          <div className="boost-confetti">
            {[...Array(12)].map((_, i) => (
              <span key={i} className="boost-piece" style={{
                left: `${10 + Math.random() * 80}%`,
                animationDelay: `${Math.random() * 0.5}s`,
                backgroundColor: ['#1D9BF0', '#00ba7c', '#ffad1f', '#805ad5', '#f4212e', '#ff6b6b'][i % 6],
              }} />
            ))}
          </div>
          <div className="boost-msg">
            <span className="boost-msg-icon">👋</span>
            <span className="boost-msg-text">Village boosted! Keep going.</span>
          </div>
        </div>
      )}

      {/* Celebration */}
      {showCelebration && (
        <div className="celebration-overlay">
          <div className="celebration-content">
            <div className="celebration-emoji">🌸</div>
            <h2 className="celebration-title">Goal Complete!</h2>
            <p className="celebration-text">
              Your goal has bloomed! All steps are done.
            </p>
            <div className="confetti">
              {[...Array(20)].map((_, i) => (
                <span key={i} className="confetti-piece" style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  backgroundColor: ['#f4212e', '#1D9BF0', '#00ba7c', '#ffad1f', '#805ad5'][i % 5],
                }} />
              ))}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .focus-page {
          --primary: #1D9BF0;
          --success: #00ba7c;
          --danger: #f4212e;
          --bg-gray: #f7f9fa;
          --dark-gray: #536471;
          --light-gray: #8899a6;
          --extra-light-gray: #eff3f4;
          background: var(--bg-gray);
          min-height: 100vh;
          min-height: 100dvh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          transition: filter 0.5s ease;
        }

        .focus-page.recovery-dimmed {
          filter: saturate(0.45) brightness(1.02);
        }

        .main {
          padding: clamp(12px, 4vw, 20px);
          padding-bottom: clamp(70px, 18vw, 90px);
          max-width: 600px;
          margin: 0 auto;
        }

        .page-header-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: clamp(14px, 4vw, 20px);
        }

        .page-header-title h1 {
          font-size: clamp(22px, 6vw, 28px);
          font-weight: 700;
          margin: 0;
        }

        .page-header-actions {
          display: flex;
          gap: clamp(6px, 1.5vw, 8px);
        }

        /* ===== LOCK-IN MODE ===== */
        .lockin-bar {
          position: sticky;
          top: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: clamp(8px, 2vw, 12px);
          padding: clamp(10px, 2.5vw, 14px) clamp(16px, 4vw, 24px);
          background: linear-gradient(135deg, #0f1419 0%, #1a2332 100%);
          color: white;
        }

        .lockin-icon {
          font-size: clamp(14px, 3.5vw, 16px);
        }

        .lockin-label {
          font-size: clamp(13px, 3.5vw, 15px);
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .lockin-unlock {
          margin-left: auto;
          padding: clamp(4px, 1vw, 6px) clamp(10px, 2.5vw, 14px);
          background: rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 100px;
          font-size: clamp(11px, 3vw, 13px);
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .lockin-unlock:hover {
          background: rgba(255, 255, 255, 0.2);
          color: white;
        }

        /* ===== ZEN MODE ===== */
        .zen-page {
          position: relative;
        }

        .zen-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 20, 25, 0.6);
          z-index: 50;
          animation: zenFadeIn 0.3s ease;
        }

        @keyframes zenFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .main-zen {
          position: relative;
          z-index: 60;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: calc(100vh - 20px);
          min-height: calc(100dvh - 20px);
          padding-top: clamp(20px, 6vw, 40px);
        }

        .zen-header {
          display: flex;
          justify-content: center;
          margin-bottom: clamp(16px, 4vw, 24px);
          width: 100%;
          max-width: 600px;
        }

        .main-zen .task-card.zen-active {
          border: 2px solid rgba(99, 102, 241, 0.35);
          box-shadow: 0 8px 40px rgba(99, 102, 241, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1);
          max-width: 600px;
          width: 100%;
          transform: scale(1.02);
          animation: zenCardIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes zenCardIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1.02) translateY(0); }
        }

        .zen-toggle {
          padding: clamp(6px, 1.5vw, 8px) clamp(12px, 3vw, 16px);
          background: white;
          border: 1.5px solid var(--extra-light-gray);
          border-radius: 100px;
          font-size: clamp(12px, 3.2vw, 14px);
          font-weight: 600;
          color: var(--dark-gray);
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .zen-toggle:hover {
          background: var(--bg-gray);
          border-color: var(--light-gray);
        }

        .zen-toggle.active {
          background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%);
          color: white;
          border-color: transparent;
          box-shadow: 0 2px 10px rgba(99, 102, 241, 0.3);
        }

        .zen-toggle.active:hover {
          background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
        }

        .new-dump-btn {
          width: 100%;
          padding: clamp(12px, 3.5vw, 16px);
          background: white;
          border: 2px dashed #1D9BF0;
          border-radius: clamp(12px, 3vw, 16px);
          font-size: clamp(14px, 4vw, 17px);
          font-weight: 600;
          color: #1D9BF0;
          cursor: pointer;
          margin-bottom: clamp(14px, 4vw, 20px);
          transition: all 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .new-dump-btn:hover {
          background: rgba(29, 155, 240, 0.05);
        }

        .card {
          background: white;
          border-radius: clamp(14px, 4vw, 20px);
          padding: clamp(16px, 4.5vw, 24px);
          margin-bottom: clamp(12px, 3.5vw, 18px);
        }

        .empty-state {
          text-align: center;
          padding: clamp(30px, 8vw, 50px) clamp(16px, 4vw, 24px);
        }

        .empty-emoji {
          font-size: clamp(40px, 12vw, 60px);
          display: block;
          margin-bottom: clamp(12px, 3vw, 18px);
        }

        .empty-title {
          font-size: clamp(16px, 4.5vw, 20px);
          font-weight: 700;
          margin: 0 0 clamp(6px, 1.5vw, 10px) 0;
        }

        .empty-subtitle {
          font-size: clamp(13px, 3.5vw, 15px);
          color: var(--light-gray);
          margin: 0 0 clamp(18px, 5vw, 28px) 0;
        }

        .btn-primary {
          padding: clamp(12px, 3vw, 16px) clamp(24px, 6vw, 36px);
          background: var(--primary);
          color: white;
          border: none;
          border-radius: clamp(10px, 2.5vw, 14px);
          font-size: clamp(14px, 4vw, 17px);
          font-weight: 600;
          cursor: pointer;
        }

        .task-top-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: clamp(10px, 3vw, 14px);
        }

        .task-badges {
          display: flex;
          flex-wrap: wrap;
          gap: clamp(6px, 1.5vw, 8px);
        }

        .linked-goal-badge {
          display: inline-flex;
          align-items: center;
          gap: clamp(4px, 1vw, 6px);
          padding: clamp(4px, 1vw, 6px) clamp(8px, 2vw, 12px);
          background: rgba(29, 155, 240, 0.08);
          border-radius: 100px;
          font-size: clamp(11px, 3vw, 13px);
          font-weight: 500;
          color: var(--primary);
          max-width: clamp(150px, 40vw, 200px);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .due-badge {
          display: inline-flex;
          padding: clamp(4px, 1vw, 6px) clamp(8px, 2vw, 12px);
          background: rgba(0, 186, 124, 0.08);
          border-radius: 100px;
          font-size: clamp(11px, 3vw, 13px);
          font-weight: 500;
          color: var(--success);
        }

        .task-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: clamp(10px, 3vw, 14px);
        }

        .task-name {
          font-size: clamp(15px, 4vw, 18px);
          font-weight: 700;
          margin: 0;
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .task-progress-text {
          font-size: clamp(12px, 3.2vw, 14px);
          color: var(--light-gray);
          flex-shrink: 0;
          margin-left: clamp(8px, 2vw, 12px);
        }

        .progress-bar {
          height: clamp(6px, 1.5vw, 8px);
          background: var(--extra-light-gray);
          border-radius: 100px;
          margin-bottom: clamp(12px, 3vw, 18px);
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: var(--success);
          border-radius: 100px;
          transition: width 0.3s ease;
        }

        /* ===== VILLAGE PRESENCE (BODY DOUBLING) ===== */
        .village-presence {
          display: flex;
          align-items: center;
          gap: clamp(8px, 2vw, 12px);
          padding: clamp(8px, 2vw, 10px) clamp(10px, 2.5vw, 14px);
          background: rgba(29, 155, 240, 0.05);
          border: 1px solid rgba(29, 155, 240, 0.12);
          border-radius: clamp(10px, 2.5vw, 14px);
          margin-bottom: clamp(10px, 2.5vw, 14px);
        }

        .village-dots {
          display: flex;
          gap: 3px;
          flex-shrink: 0;
        }

        .village-dot {
          width: clamp(8px, 2vw, 10px);
          height: clamp(8px, 2vw, 10px);
          border-radius: 50%;
          background: #00ba7c;
          animation: villagePulse 2s ease-in-out infinite;
        }

        @keyframes villagePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }

        .village-text {
          flex: 1;
          font-size: clamp(12px, 3.2vw, 14px);
          font-weight: 500;
          color: var(--dark-gray);
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .village-boost-btn {
          padding: clamp(4px, 1vw, 6px) clamp(10px, 2.5vw, 14px);
          background: white;
          border: 1.5px solid rgba(29, 155, 240, 0.25);
          border-radius: 100px;
          font-size: clamp(12px, 3.2vw, 14px);
          font-weight: 600;
          color: var(--primary);
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          white-space: nowrap;
        }

        .village-boost-btn:hover {
          background: rgba(29, 155, 240, 0.08);
          border-color: var(--primary);
        }

        .village-boost-btn:active {
          transform: scale(0.95);
        }

        /* Village Boost Burst */
        .boost-burst {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 990;
          pointer-events: none;
          animation: boostFadeOut 2.5s ease forwards;
        }

        @keyframes boostFadeOut {
          0% { opacity: 1; }
          70% { opacity: 1; }
          100% { opacity: 0; }
        }

        .boost-confetti {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          overflow: hidden;
        }

        .boost-piece {
          position: absolute;
          width: clamp(6px, 1.5vw, 10px);
          height: clamp(6px, 1.5vw, 10px);
          border-radius: 50%;
          top: 50%;
          animation: boostExplode 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }

        @keyframes boostExplode {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--tx, 0), var(--ty, -200px)) scale(0.3); opacity: 0; }
        }

        .boost-piece:nth-child(1) { --tx: -60px; --ty: -180px; }
        .boost-piece:nth-child(2) { --tx: 80px; --ty: -200px; }
        .boost-piece:nth-child(3) { --tx: -120px; --ty: -100px; }
        .boost-piece:nth-child(4) { --tx: 100px; --ty: -140px; }
        .boost-piece:nth-child(5) { --tx: -30px; --ty: -220px; }
        .boost-piece:nth-child(6) { --tx: 50px; --ty: -90px; }
        .boost-piece:nth-child(7) { --tx: -90px; --ty: -160px; }
        .boost-piece:nth-child(8) { --tx: 130px; --ty: -120px; }
        .boost-piece:nth-child(9) { --tx: -50px; --ty: -240px; }
        .boost-piece:nth-child(10) { --tx: 70px; --ty: -170px; }
        .boost-piece:nth-child(11) { --tx: -110px; --ty: -130px; }
        .boost-piece:nth-child(12) { --tx: 40px; --ty: -210px; }

        .boost-msg {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          align-items: center;
          gap: clamp(8px, 2vw, 12px);
          background: white;
          padding: clamp(12px, 3vw, 16px) clamp(18px, 5vw, 28px);
          border-radius: clamp(14px, 4vw, 20px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
          animation: boostMsgPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        @keyframes boostMsgPop {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }

        .boost-msg-icon {
          font-size: clamp(24px, 7vw, 32px);
        }

        .boost-msg-text {
          font-size: clamp(14px, 3.8vw, 17px);
          font-weight: 700;
          color: var(--dark-gray);
          white-space: nowrap;
        }

        .stuck-btn {
          width: 100%;
          padding: clamp(10px, 2.5vw, 12px);
          background: rgba(128, 90, 213, 0.06);
          border: 1px dashed rgba(128, 90, 213, 0.3);
          border-radius: clamp(10px, 2.5vw, 14px);
          font-size: clamp(13px, 3.5vw, 15px);
          font-weight: 600;
          color: #805ad5;
          cursor: pointer;
          margin-bottom: clamp(12px, 3vw, 18px);
          transition: all 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .stuck-btn:hover {
          background: rgba(128, 90, 213, 0.12);
          border-color: rgba(128, 90, 213, 0.5);
        }

        .stuck-btn:active {
          transform: scale(0.98);
        }

        .step-item {
          display: flex;
          align-items: flex-start;
          gap: clamp(10px, 3vw, 14px);
          padding: clamp(10px, 3vw, 14px) 0;
          border-bottom: 1px solid var(--extra-light-gray);
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .step-item:last-child { border-bottom: none; }

        .checkbox {
          position: relative;
          width: clamp(20px, 5.5vw, 26px);
          height: clamp(20px, 5.5vw, 26px);
          border-radius: 50%;
          border: 2px solid var(--light-gray);
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: clamp(12px, 3vw, 14px);
          flex-shrink: 0;
          transition: all 0.2s ease;
          margin-top: 2px;
        }

        .checkbox.checked {
          border: none;
          background: var(--success);
        }

        .checkbox.step-pulse {
          animation: checkPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .checkbox.step-pulse::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 2px solid var(--success);
          transform: translate(-50%, -50%) scale(1);
          animation: ringPulse 0.5s ease-out forwards;
          pointer-events: none;
        }

        @keyframes checkPop {
          0% { transform: scale(1); }
          40% { transform: scale(1.35); }
          100% { transform: scale(1); }
        }

        @keyframes ringPulse {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.7; }
          100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
        }

        .step-content {
          flex: 1;
          min-width: 0;
        }

        .step-text {
          display: block;
          font-size: clamp(14px, 3.8vw, 16px);
          color: var(--dark-gray);
          word-wrap: break-word;
          line-height: 1.4;
        }

        .step-text.completed {
          text-decoration: line-through;
          color: var(--light-gray);
        }

        .step-meta {
          display: block;
          font-size: clamp(11px, 3vw, 13px);
          color: var(--light-gray);
          margin-top: 2px;
        }

        /* Task Action Menu */
        .task-actions-wrapper {
          position: relative;
          flex-shrink: 0;
        }

        .task-menu-btn {
          background: none;
          border: none;
          font-size: clamp(18px, 5vw, 22px);
          color: var(--light-gray);
          cursor: pointer;
          padding: clamp(4px, 1vw, 6px) clamp(6px, 1.5vw, 10px);
          border-radius: 8px;
          line-height: 1;
          letter-spacing: 2px;
          transition: background 0.15s ease;
        }

        .task-menu-btn:hover {
          background: var(--extra-light-gray);
          color: var(--dark-gray);
        }

        .task-action-menu {
          position: absolute;
          top: 100%;
          right: 0;
          background: white;
          border-radius: clamp(10px, 2.5vw, 14px);
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          padding: clamp(4px, 1vw, 6px);
          min-width: clamp(140px, 40vw, 180px);
          z-index: 50;
          animation: fadeIn 0.15s ease;
        }

        .action-item {
          display: block;
          width: 100%;
          padding: clamp(8px, 2.5vw, 12px) clamp(10px, 3vw, 14px);
          text-align: left;
          background: none;
          border: none;
          border-radius: clamp(6px, 1.5vw, 8px);
          cursor: pointer;
          font-size: clamp(13px, 3.5vw, 15px);
          color: var(--dark-gray);
          transition: background 0.1s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .action-item:hover {
          background: var(--bg-gray);
        }

        .action-item.danger {
          color: var(--danger);
        }

        .action-menu-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 49;
        }

        /* Inline Editing */
        .inline-edit {
          display: flex;
          align-items: center;
          gap: clamp(6px, 1.5vw, 8px);
          width: 100%;
        }

        .inline-edit-input {
          flex: 1;
          padding: clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 12px);
          border: 2px solid var(--primary);
          border-radius: clamp(6px, 1.5vw, 8px);
          font-size: clamp(14px, 3.8vw, 16px);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          min-width: 0;
        }

        .inline-edit-input:focus {
          outline: none;
        }

        .inline-save {
          width: clamp(28px, 7vw, 34px);
          height: clamp(28px, 7vw, 34px);
          border: none;
          background: var(--success);
          color: white;
          border-radius: 50%;
          font-size: clamp(12px, 3vw, 14px);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .inline-cancel {
          width: clamp(28px, 7vw, 34px);
          height: clamp(28px, 7vw, 34px);
          border: none;
          background: var(--extra-light-gray);
          color: var(--dark-gray);
          border-radius: 50%;
          font-size: clamp(12px, 3vw, 14px);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        /* Step Actions */
        .step-actions {
          display: flex;
          gap: clamp(2px, 0.5vw, 4px);
          flex-shrink: 0;
          opacity: 0.4;
          transition: opacity 0.15s ease;
        }

        .step-item:hover .step-actions {
          opacity: 1;
        }

        .step-action-btn {
          width: clamp(26px, 6.5vw, 30px);
          height: clamp(26px, 6.5vw, 30px);
          border: none;
          background: none;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: clamp(12px, 3vw, 14px);
          transition: background 0.15s ease;
        }

        .step-action-btn:hover {
          background: var(--extra-light-gray);
        }

        .step-action-btn.delete {
          font-size: clamp(16px, 4vw, 20px);
          color: var(--danger);
        }

        .step-action-btn.delete:hover {
          background: rgba(244, 33, 46, 0.1);
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: clamp(16px, 4vw, 24px);
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .modal-card {
          background: white;
          border-radius: clamp(16px, 4vw, 24px);
          padding: clamp(24px, 6vw, 36px);
          max-width: 400px;
          width: 100%;
          text-align: center;
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .modal-icon { font-size: clamp(48px, 14vw, 64px); margin-bottom: clamp(12px, 3vw, 18px); }
        .modal-title { font-size: clamp(20px, 5.5vw, 26px); font-weight: 700; margin: 0 0 clamp(8px, 2vw, 12px) 0; }
        .modal-text { font-size: clamp(14px, 3.8vw, 16px); color: var(--dark-gray); line-height: 1.5; margin: 0 0 clamp(16px, 4vw, 22px) 0; }
        .modal-goal-badge {
          display: inline-block;
          padding: clamp(8px, 2vw, 12px) clamp(14px, 3.5vw, 20px);
          background: rgba(29, 155, 240, 0.08);
          border-radius: 100px;
          font-size: clamp(13px, 3.5vw, 15px);
          font-weight: 500;
          color: var(--primary);
          margin-bottom: clamp(18px, 5vw, 26px);
        }

        .modal-actions { display: flex; gap: clamp(10px, 3vw, 14px); }

        .modal-btn {
          flex: 1;
          padding: clamp(12px, 3.5vw, 16px);
          border-radius: clamp(10px, 2.5vw, 14px);
          font-size: clamp(14px, 3.8vw, 16px);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .modal-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .modal-btn.secondary { background: var(--bg-gray); border: none; color: var(--dark-gray); }
        .modal-btn.primary { background: var(--success); border: none; color: white; }
        .modal-btn.primary:hover:not(:disabled) { background: #00a06a; }

        /* Mode-Specific Modal Accents */
        .mode-modal.recovery {
          border-top: 4px solid #f4212e;
        }

        .mode-modal.growth {
          border-top: 4px solid #00ba7c;
        }

        .mode-modal.recovery .modal-title {
          color: #dc2626;
        }

        .mode-modal.growth .modal-title {
          color: #059669;
        }

        /* Plant Visualization in Goal Sync Modal */
        .modal-plant-viz {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: clamp(6px, 1.5vw, 10px);
          margin-bottom: clamp(18px, 5vw, 26px);
        }

        .modal-plant-emoji {
          transition: font-size 0.6s cubic-bezier(0.4, 0, 0.2, 1);
          animation: plantGrow 0.8s ease;
        }

        @keyframes plantGrow {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }

        .modal-plant-bar {
          width: clamp(120px, 40vw, 180px);
          height: 8px;
          background: var(--extra-light-gray);
          border-radius: 100px;
          overflow: hidden;
        }

        .modal-plant-fill {
          height: 100%;
          background: linear-gradient(90deg, #00ba7c 0%, #059669 100%);
          border-radius: 100px;
          transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .modal-plant-label {
          font-size: clamp(11px, 3vw, 13px);
          color: var(--light-gray);
          font-weight: 500;
        }

        .recovery-btn {
          background: linear-gradient(135deg, #f4212e 0%, #dc2626 100%) !important;
        }

        .recovery-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%) !important;
        }

        .growth-btn {
          background: linear-gradient(135deg, #00ba7c 0%, #059669 100%) !important;
        }

        .growth-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #059669 0%, #047857 100%) !important;
        }

        /* Celebration */
        .celebration-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
          animation: fadeIn 0.3s ease;
          overflow: hidden;
        }

        .celebration-content { text-align: center; position: relative; z-index: 10; }
        .celebration-emoji { font-size: clamp(72px, 20vw, 100px); animation: bounce 0.6s ease infinite alternate; }

        @keyframes bounce {
          from { transform: translateY(0); }
          to { transform: translateY(-15px); }
        }

        .celebration-title { font-size: clamp(28px, 8vw, 40px); font-weight: 800; color: white; margin: clamp(12px, 3vw, 20px) 0 clamp(8px, 2vw, 12px) 0; }
        .celebration-text { font-size: clamp(16px, 4.5vw, 20px); color: rgba(255, 255, 255, 0.9); margin: 0; }

        .confetti { position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; overflow: hidden; }
        .confetti-piece {
          position: absolute;
          width: clamp(8px, 2vw, 12px);
          height: clamp(8px, 2vw, 12px);
          border-radius: 2px;
          top: -20px;
          animation: confettiFall 3s ease-in-out infinite;
        }

        @keyframes confettiFall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }

        /* XP Toast */
        .xp-toast {
          position: fixed;
          bottom: clamp(60px, 16vw, 80px);
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #00ba7c 0%, #059669 100%);
          color: white;
          padding: clamp(8px, 2vw, 12px) clamp(16px, 4vw, 24px);
          border-radius: 100px;
          font-size: clamp(14px, 3.8vw, 17px);
          font-weight: 700;
          z-index: 950;
          box-shadow: 0 4px 14px rgba(0, 186, 124, 0.4);
          animation: xpPop 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes xpPop {
          0% { opacity: 0; transform: translateX(-50%) translateY(10px) scale(0.8); }
          60% { transform: translateX(-50%) translateY(-4px) scale(1.05); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }

        /* Undo Delete Toast */
        .undo-toast {
          position: fixed;
          bottom: clamp(16px, 4vw, 24px);
          left: 50%;
          transform: translateX(-50%);
          background: #1f2937;
          color: white;
          padding: clamp(10px, 2.5vw, 14px) clamp(14px, 3.5vw, 20px);
          border-radius: clamp(10px, 2.5vw, 14px);
          display: flex;
          align-items: center;
          gap: clamp(10px, 2.5vw, 14px);
          z-index: 960;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          max-width: clamp(280px, 80vw, 400px);
          animation: toastSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .undo-text {
          font-size: clamp(13px, 3.5vw, 15px);
          font-weight: 500;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .undo-btn {
          padding: clamp(6px, 1.5vw, 8px) clamp(12px, 3vw, 16px);
          background: rgba(29, 155, 240, 0.2);
          color: #60a5fa;
          border: none;
          border-radius: clamp(6px, 1.5vw, 8px);
          font-size: clamp(13px, 3.5vw, 15px);
          font-weight: 700;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .undo-btn:hover {
          background: rgba(29, 155, 240, 0.35);
        }

        /* Implicit Overwhelm Toast */
        .overwhelm-toast {
          position: fixed;
          bottom: clamp(16px, 4vw, 24px);
          right: clamp(16px, 4vw, 24px);
          background: white;
          border-radius: clamp(12px, 3vw, 16px);
          padding: clamp(14px, 3.5vw, 18px) clamp(16px, 4vw, 20px);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          border-left: 4px solid #805ad5;
          display: flex;
          align-items: center;
          gap: clamp(10px, 2.5vw, 14px);
          z-index: 900;
          max-width: clamp(280px, 75vw, 360px);
          animation: toastSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .overwhelm-text {
          font-size: clamp(13px, 3.5vw, 15px);
          font-weight: 600;
          color: var(--dark-gray);
          flex: 1;
          white-space: nowrap;
        }

        .overwhelm-actions {
          display: flex;
          gap: clamp(6px, 1.5vw, 8px);
          flex-shrink: 0;
        }

        .overwhelm-btn {
          padding: clamp(6px, 1.5vw, 8px) clamp(12px, 3vw, 16px);
          border: none;
          border-radius: clamp(8px, 2vw, 10px);
          font-size: clamp(12px, 3.2vw, 14px);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          white-space: nowrap;
        }

        .overwhelm-btn.break {
          background: rgba(244, 33, 46, 0.1);
          color: #f4212e;
        }

        .overwhelm-btn.break:hover {
          background: rgba(244, 33, 46, 0.2);
        }

        .overwhelm-btn.help {
          background: rgba(128, 90, 213, 0.1);
          color: #805ad5;
        }

        .overwhelm-btn.help:hover {
          background: rgba(128, 90, 213, 0.2);
        }

        .overwhelm-dismiss {
          position: absolute;
          top: clamp(4px, 1vw, 6px);
          right: clamp(6px, 1.5vw, 8px);
          width: 20px;
          height: 20px;
          border: none;
          background: none;
          color: var(--light-gray);
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background 0.15s ease;
        }

        .overwhelm-dismiss:hover {
          background: var(--extra-light-gray);
          color: var(--dark-gray);
        }

        /* ===== MICRO-START: 5-MINUTE DASH ===== */
        .micro-start-btn {
          width: 100%;
          padding: clamp(10px, 2.5vw, 14px);
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(249, 115, 22, 0.08) 100%);
          border: 2px dashed rgba(139, 92, 246, 0.35);
          border-radius: clamp(10px, 2.5vw, 14px);
          font-size: clamp(14px, 3.8vw, 16px);
          font-weight: 700;
          color: #7c3aed;
          cursor: pointer;
          margin-bottom: clamp(8px, 2vw, 12px);
          transition: all 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .micro-start-btn:hover {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.14) 0%, rgba(249, 115, 22, 0.14) 100%);
          border-color: rgba(139, 92, 246, 0.5);
          transform: translateY(-1px);
        }

        .micro-start-btn:active {
          transform: scale(0.98);
        }

        .micro-active-badge {
          width: 100%;
          padding: clamp(10px, 2.5vw, 14px);
          background: linear-gradient(135deg, #7c3aed 0%, #f97316 100%);
          border: none;
          border-radius: clamp(10px, 2.5vw, 14px);
          font-size: clamp(15px, 4vw, 18px);
          font-weight: 700;
          color: white;
          text-align: center;
          margin-bottom: clamp(8px, 2vw, 12px);
          animation: microPulse 2s ease-in-out infinite;
        }

        @keyframes microPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.3); }
          50% { box-shadow: 0 0 0 8px rgba(124, 58, 237, 0); }
        }

        .micro-timer-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(135deg, #7c3aed 0%, #f97316 100%);
          color: white;
          padding: clamp(12px, 3vw, 16px) clamp(16px, 4vw, 24px);
          display: flex;
          align-items: center;
          gap: clamp(10px, 2.5vw, 14px);
          z-index: 980;
          box-shadow: 0 -4px 20px rgba(124, 58, 237, 0.3);
          animation: slideUpBar 0.3s ease;
        }

        @keyframes slideUpBar {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        .micro-timer-info {
          flex: 1;
          display: flex;
          align-items: center;
          gap: clamp(6px, 1.5vw, 10px);
        }

        .micro-timer-icon {
          font-size: clamp(18px, 5vw, 24px);
        }

        .micro-timer-msg {
          font-size: clamp(12px, 3.2vw, 14px);
          font-weight: 500;
          opacity: 0.9;
        }

        .micro-timer-time {
          font-size: clamp(24px, 7vw, 32px);
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          letter-spacing: 1px;
        }

        .micro-timer-stop {
          padding: clamp(6px, 1.5vw, 10px) clamp(14px, 3.5vw, 20px);
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: 1.5px solid rgba(255, 255, 255, 0.4);
          border-radius: clamp(8px, 2vw, 12px);
          font-size: clamp(13px, 3.5vw, 15px);
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .micro-timer-stop:hover {
          background: rgba(255, 255, 255, 0.35);
        }

        /* Momentum Check Modal */
        .momentum-modal {
          border-top: 4px solid #7c3aed;
        }

        .momentum-options {
          display: flex;
          flex-direction: column;
          gap: clamp(8px, 2vw, 12px);
        }

        .momentum-btn {
          display: flex;
          align-items: center;
          gap: clamp(10px, 2.5vw, 14px);
          width: 100%;
          padding: clamp(14px, 3.5vw, 18px);
          background: white;
          border: 2px solid var(--extra-light-gray);
          border-radius: clamp(12px, 3vw, 16px);
          cursor: pointer;
          text-align: left;
          transition: all 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .momentum-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
        }

        .momentum-btn.rolling {
          border-color: rgba(249, 115, 22, 0.3);
          background: rgba(249, 115, 22, 0.04);
        }

        .momentum-btn.rolling:hover {
          border-color: #f97316;
          background: rgba(249, 115, 22, 0.08);
        }

        .momentum-btn.pause {
          border-color: rgba(29, 155, 240, 0.3);
          background: rgba(29, 155, 240, 0.04);
        }

        .momentum-btn.pause:hover {
          border-color: var(--primary);
          background: rgba(29, 155, 240, 0.08);
        }

        .momentum-btn.done {
          border-color: rgba(0, 186, 124, 0.3);
          background: rgba(0, 186, 124, 0.04);
        }

        .momentum-btn.done:hover {
          border-color: var(--success);
          background: rgba(0, 186, 124, 0.08);
        }

        .momentum-btn-icon {
          font-size: clamp(22px, 6vw, 28px);
          flex-shrink: 0;
        }

        .momentum-btn-label {
          font-size: clamp(14px, 3.8vw, 16px);
          font-weight: 600;
          color: var(--dark-gray);
        }

        /* ===== DRIFT DETECTOR ===== */
        .drift-card {
          position: fixed;
          top: clamp(16px, 4vw, 24px);
          left: 50%;
          transform: translateX(-50%);
          background: white;
          border-radius: clamp(12px, 3vw, 16px);
          padding: clamp(12px, 3vw, 16px) clamp(16px, 4vw, 20px);
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
          border-top: 3px solid #f97316;
          display: flex;
          align-items: center;
          gap: clamp(10px, 2.5vw, 14px);
          z-index: 970;
          max-width: clamp(320px, 85vw, 420px);
          width: calc(100% - 32px);
          animation: driftSlideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes driftSlideDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        .drift-icon {
          font-size: clamp(24px, 7vw, 32px);
          flex-shrink: 0;
        }

        .drift-content {
          flex: 1;
          min-width: 0;
        }

        .drift-title {
          font-size: clamp(14px, 3.8vw, 16px);
          font-weight: 700;
          color: #0f1419;
          margin: 0 0 2px 0;
        }

        .drift-text {
          font-size: clamp(12px, 3.2vw, 14px);
          color: var(--light-gray);
          margin: 0;
        }

        .drift-actions {
          display: flex;
          gap: clamp(6px, 1.5vw, 8px);
          flex-shrink: 0;
        }

        .drift-btn {
          padding: clamp(6px, 1.5vw, 8px) clamp(10px, 2.5vw, 14px);
          border: none;
          border-radius: clamp(8px, 2vw, 10px);
          font-size: clamp(12px, 3.2vw, 14px);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          white-space: nowrap;
        }

        .drift-btn.keep {
          background: var(--bg-gray);
          color: var(--dark-gray);
        }

        .drift-btn.keep:hover {
          background: var(--extra-light-gray);
        }

        .drift-btn.subtract {
          background: rgba(249, 115, 22, 0.1);
          color: #f97316;
        }

        .drift-btn.subtract:hover {
          background: rgba(249, 115, 22, 0.2);
        }

        /* ===== QUICK CAPTURE (PARKING LOT) ===== */
        .quick-capture-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          align-items: center;
          transition: bottom 0.3s ease;
          gap: clamp(8px, 2vw, 12px);
          padding: clamp(10px, 2.5vw, 14px) clamp(12px, 3vw, 18px);
          background: white;
          border-top: 1px solid var(--extra-light-gray);
          box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.06);
          z-index: 940;
        }

        .quick-capture-icon {
          font-size: clamp(18px, 5vw, 22px);
          flex-shrink: 0;
          opacity: 0.7;
        }

        .quick-capture-input {
          flex: 1;
          padding: clamp(8px, 2vw, 10px) clamp(10px, 2.5vw, 14px);
          border: 1.5px solid var(--extra-light-gray);
          border-radius: clamp(8px, 2vw, 12px);
          font-size: clamp(13px, 3.5vw, 15px);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: var(--bg-gray);
          color: #0f1419;
          min-width: 0;
          transition: border-color 0.15s ease;
        }

        .quick-capture-input:focus {
          outline: none;
          border-color: var(--light-gray);
          background: white;
        }

        .quick-capture-input::placeholder {
          color: var(--light-gray);
          font-style: italic;
        }

        .quick-capture-add {
          padding: clamp(8px, 2vw, 10px) clamp(14px, 3.5vw, 18px);
          background: var(--extra-light-gray);
          border: none;
          border-radius: clamp(8px, 2vw, 12px);
          font-size: clamp(13px, 3.5vw, 15px);
          font-weight: 600;
          color: var(--dark-gray);
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .quick-capture-add:hover:not(:disabled) {
          background: var(--primary);
          color: white;
        }

        .quick-capture-add:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .quick-capture-bar.above-timer {
          bottom: clamp(48px, 12vw, 60px);
        }

        .capture-toast {
          position: fixed;
          bottom: clamp(70px, 18vw, 90px);
          left: 50%;
          transform: translateX(-50%);
          background: #1f2937;
          color: white;
          padding: clamp(8px, 2vw, 12px) clamp(16px, 4vw, 24px);
          border-radius: 100px;
          font-size: clamp(13px, 3.5vw, 15px);
          font-weight: 600;
          z-index: 950;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
          animation: xpPop 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          white-space: nowrap;
        }

        @media (min-width: 768px) {
          .main { padding: 24px; padding-bottom: 120px; }
          .step-item:hover {
            background: var(--bg-gray);
            margin: 0 -24px;
            padding-left: 24px;
            padding-right: 24px;
          }
        }

        @media (min-width: 1024px) {
          .main { max-width: 680px; }
        }
      `}</style>

      <FABToolbox />
    </div>
  )
}
