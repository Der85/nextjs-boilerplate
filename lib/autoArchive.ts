import { createClient } from '@/utils/supabase/client'

interface OverdueTask {
  id: string
  task_name: string
  due_date: string | null
  created_at: string
  status: string
  auto_archived?: boolean
  auto_archived_at?: string
  original_due_date?: string
}

interface AutoArchiveResult {
  archivedCount: number
  autoArchivedTasks: OverdueTask[]
}

/**
 * Auto-archive overdue tasks based on staleness
 *
 * Rules:
 * - 1 day overdue: leave as-is (user might just be a day behind)
 * - 2+ days overdue: auto-archive to 'parked' status
 * - 7+ days since last login: archive ALL tasks with due dates
 *
 * This runs on dashboard load to ensure the user never faces a backlog.
 */
export async function autoArchiveOverdueTasks(userId: string): Promise<AutoArchiveResult> {
  const supabase = createClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const twoDaysAgo = new Date(today)
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

  try {
    // Fetch all incomplete tasks with due dates that are 2+ days overdue
    // and not already auto-archived
    // Note: If auto_archived column doesn't exist yet, this will fail gracefully
    const { data: overdueTasks, error: fetchError } = await supabase
      .from('focus_plans')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'completed')
      .lt('due_date', twoDaysAgo.toISOString().split('T')[0])

    if (fetchError) {
      // If error is about missing column, return empty (migration not run yet)
      if (fetchError.message?.includes('auto_archived')) {
        console.log('Auto-archive columns not yet available, skipping')
        return { archivedCount: 0, autoArchivedTasks: [] }
      }
      console.error('Error fetching overdue tasks:', fetchError)
      return { archivedCount: 0, autoArchivedTasks: [] }
    }

    if (!overdueTasks || overdueTasks.length === 0) {
      return { archivedCount: 0, autoArchivedTasks: [] }
    }

    // Filter out already auto-archived tasks (in case column exists but wasn't in query)
    const tasksToArchive = overdueTasks.filter(t => !t.auto_archived)
    if (tasksToArchive.length === 0) {
      return { archivedCount: 0, autoArchivedTasks: [] }
    }

    // Auto-archive these tasks - update each one to preserve its original due_date
    const now = new Date().toISOString()
    const archivedTasks: OverdueTask[] = []

    for (const task of tasksToArchive) {
      const { error: updateError } = await supabase
        .from('focus_plans')
        .update({
          status: 'parked',
          auto_archived: true,
          auto_archived_at: now,
          original_due_date: task.due_date, // Preserve original due_date
          due_date: null,
        })
        .eq('id', task.id)
        .eq('user_id', userId)

      if (!updateError) {
        archivedTasks.push(task as OverdueTask)
      }
    }

    return {
      archivedCount: archivedTasks.length,
      autoArchivedTasks: archivedTasks,
    }
  } catch (error) {
    console.error('Auto-archive error:', error)
    return { archivedCount: 0, autoArchivedTasks: [] }
  }
}

/**
 * Get recently auto-archived tasks for the Gentle Tidy Up card
 * Only shows tasks that were auto-archived since the user's last session
 */
export async function getRecentlyAutoArchivedTasks(userId: string): Promise<OverdueTask[]> {
  const supabase = createClient()
  try {
    // Get tasks that were auto-archived in the last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data, error } = await supabase
      .from('focus_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('auto_archived', true)
      .gte('auto_archived_at', sevenDaysAgo.toISOString())
      .order('auto_archived_at', { ascending: false })

    if (error) {
      console.error('Error fetching auto-archived tasks:', error)
      return []
    }

    return (data || []) as OverdueTask[]
  } catch (error) {
    console.error('Error in getRecentlyAutoArchivedTasks:', error)
    return []
  }
}

/**
 * Check how many tasks are already due tomorrow
 * Used for the reschedule safety cap
 */
export async function getTasksDueTomorrow(userId: string): Promise<number> {
  const supabase = createClient()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  try {
    const { count, error } = await supabase
      .from('focus_plans')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('due_date', tomorrowStr)
      .neq('status', 'completed')

    if (error) {
      console.error('Error counting tomorrow tasks:', error)
      return 0
    }

    return count || 0
  } catch (error) {
    console.error('Error in getTasksDueTomorrow:', error)
    return 0
  }
}

/**
 * Spread tasks across the next few days (1-2 per day max)
 * Used when user chooses "Spread them out" option
 */
export async function spreadTasksAcrossDays(
  userId: string,
  taskIds: string[]
): Promise<boolean> {
  if (taskIds.length === 0) return true

  const supabase = createClient()
  try {
    const updates: { id: string; due_date: string }[] = []
    let currentDate = new Date()
    currentDate.setDate(currentDate.getDate() + 1) // Start from tomorrow

    let tasksPerDay = 0
    const maxPerDay = 2

    for (const id of taskIds) {
      updates.push({
        id,
        due_date: currentDate.toISOString().split('T')[0],
      })

      tasksPerDay++
      if (tasksPerDay >= maxPerDay) {
        currentDate.setDate(currentDate.getDate() + 1)
        tasksPerDay = 0
      }
    }

    // Update each task with its new due date
    for (const update of updates) {
      const { error } = await supabase
        .from('focus_plans')
        .update({
          due_date: update.due_date,
          auto_archived: false,
          status: 'active'
        })
        .eq('id', update.id)
        .eq('user_id', userId)

      if (error) {
        console.error('Error spreading task:', error)
        return false
      }
    }

    return true
  } catch (error) {
    console.error('Error in spreadTasksAcrossDays:', error)
    return false
  }
}

/**
 * Restore an auto-archived task to active status
 */
export async function restoreAutoArchivedTask(
  userId: string,
  taskId: string,
  newDueDate?: string
): Promise<boolean> {
  const supabase = createClient()
  try {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dueDateToUse = newDueDate || tomorrow.toISOString().split('T')[0]

    const { error } = await supabase
      .from('focus_plans')
      .update({
        status: 'active',
        due_date: dueDateToUse,
        auto_archived: false,
        auto_archived_at: null,
      })
      .eq('id', taskId)
      .eq('user_id', userId)

    if (error) {
      console.error('Error restoring task:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error in restoreAutoArchivedTask:', error)
    return false
  }
}
