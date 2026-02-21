import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { templatesRateLimiter } from '@/lib/rateLimiter'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }

    if (templatesRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }

    const { id } = await context.params
    const body = await request.json()

    // Fetch the template
    const { data: template, error: templateError } = await supabase
      .from('task_templates')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (templateError || !template) {
      return apiError('Template not found.', 404, 'NOT_FOUND')
    }

    // Create task from template
    const taskData: Record<string, unknown> = {
      user_id: user.id,
      title: template.task_name,
      status: 'active',
      priority: template.priority,
      category_id: template.category_id,
      is_recurring: template.is_recurring_default,
      recurrence_rule: template.is_recurring_default ? template.recurrence_rule : null,
      position: 0,
      ai_confidence: 1.0,
    }

    // Add optional fields from request
    if (body.due_date) {
      taskData.due_date = body.due_date
    }
    if (body.due_time) {
      taskData.due_time = body.due_time
    }

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert(taskData)
      .select('*, category:categories(id, name, color, icon)')
      .single()

    if (taskError) {
      console.error('Task from template error:', taskError)
      return apiError('Failed to create task.', 500, 'INTERNAL_ERROR')
    }

    // Atomically increment template usage stats
    await supabase.rpc('increment_template_use_count', { template_id: id })

    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    console.error('Templates create-task POST error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
