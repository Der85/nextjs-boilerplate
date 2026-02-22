import { useState, useEffect, useRef } from 'react'
import type { TaskWithCategory, RecurrenceRule, RecurrenceFrequency } from '@/lib/types'

interface UseTaskEditFormOptions {
  task: TaskWithCategory
  isOpen: boolean
  onSave: (id: string, updates: Partial<TaskWithCategory>) => void
  onClose: () => void
}

export function useTaskEditForm({ task, isOpen, onSave, onClose }: UseTaskEditFormOptions) {
  const titleRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState(task.title)
  const [dueDate, setDueDate] = useState(task.due_date)
  const [dueTime, setDueTime] = useState(task.due_time)
  const [priority, setPriority] = useState(task.priority)
  const [categoryId, setCategoryId] = useState(task.category_id)
  const [isRecurring, setIsRecurring] = useState(task.is_recurring || false)
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency | null>(
    task.recurrence_rule?.frequency || null
  )
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string | null>(
    task.recurrence_rule?.end_date || null
  )
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Reset form when task changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle(task.title)
      setDueDate(task.due_date)
      setDueTime(task.due_time)
      setPriority(task.priority)
      setCategoryId(task.category_id)
      setIsRecurring(task.is_recurring || false)
      setRecurrenceFrequency(task.recurrence_rule?.frequency || null)
      setRecurrenceEndDate(task.recurrence_rule?.end_date || null)
      setHasChanges(false)
      setTimeout(() => {
        titleRef.current?.focus()
        titleRef.current?.select()
      }, 50)
    }
  }, [isOpen, task])

  // Track changes
  useEffect(() => {
    const currentRule = task.recurrence_rule
    const recurrenceChanged =
      isRecurring !== (task.is_recurring || false) ||
      recurrenceFrequency !== (currentRule?.frequency || null) ||
      recurrenceEndDate !== (currentRule?.end_date || null)

    const changed =
      title !== task.title ||
      dueDate !== task.due_date ||
      dueTime !== task.due_time ||
      priority !== task.priority ||
      categoryId !== task.category_id ||
      recurrenceChanged
    setHasChanges(changed)
  }, [title, dueDate, dueTime, priority, categoryId, isRecurring, recurrenceFrequency, recurrenceEndDate, task])

  const handleSave = async () => {
    if (!title.trim()) return

    setSaving(true)

    const updates: Partial<TaskWithCategory> = {}
    if (title.trim() !== task.title) updates.title = title.trim()
    if (dueDate !== task.due_date) updates.due_date = dueDate
    if (dueTime !== task.due_time) updates.due_time = dueTime
    if (priority !== task.priority) updates.priority = priority
    if (categoryId !== task.category_id) updates.category_id = categoryId

    const currentRule = task.recurrence_rule
    const recurrenceChanged =
      isRecurring !== (task.is_recurring || false) ||
      recurrenceFrequency !== (currentRule?.frequency || null) ||
      recurrenceEndDate !== (currentRule?.end_date || null)

    if (recurrenceChanged) {
      updates.is_recurring = isRecurring
      if (isRecurring && recurrenceFrequency) {
        const newRule: RecurrenceRule = { frequency: recurrenceFrequency }
        if (recurrenceEndDate) newRule.end_date = recurrenceEndDate
        updates.recurrence_rule = newRule
      } else {
        updates.recurrence_rule = null
      }
    }

    if (Object.keys(updates).length > 0) {
      await onSave(task.id, updates)
    }

    setSaving(false)
    onClose()
  }

  return {
    titleRef,
    title, setTitle,
    dueDate, setDueDate,
    dueTime, setDueTime,
    priority, setPriority,
    categoryId, setCategoryId,
    isRecurring, setIsRecurring,
    recurrenceFrequency, setRecurrenceFrequency,
    recurrenceEndDate, setRecurrenceEndDate,
    saving,
    hasChanges,
    handleSave,
  }
}
