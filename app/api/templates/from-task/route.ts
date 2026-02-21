import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { templatesRateLimiter } from '@/lib/rateLimiter'

const MAX_TEMPLATES = 50

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }

    if (templatesRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }

    // Check template count limit
    const { count } = await supabase
      .from('task_templates')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (count && count >= MAX_TEMPLATES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_TEMPLATES} templates allowed. Delete unused templates first.` },
        { status: 400 }
      )
    }

    const body = await request.json()
    const taskId = body.task_id
    const templateName = typeof body.template_name === 'string' ? body.template_name.trim() : ''

    if (!taskId || !templateName) {
      return apiError('Task ID and template name are required.', 400, 'VALIDATION_ERROR')
    }

    // Fetch the source task
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', user.id)
      .single()

    if (taskError || !task) {
      return apiError('Task not found.', 404, 'NOT_FOUND')
    }

    // Create template from task
    const { data: template, error } = await supabase
      .from('task_templates')
      .insert({
        user_id: user.id,
        name: templateName,
        task_name: task.title,
        description: task.original_fragment || null,
        priority: task.priority,
        category_id: task.category_id,
        is_recurring_default: task.is_recurring || false,
        recurrence_rule: task.recurrence_rule,
        tags: [],
      })
      .select('*, category:categories(id, name, color, icon)')
      .single()

    if (error) {
      if (error.code === '23505') {
        return apiError('A template with this name already exists.', 409, 'CONFLICT')
      }
      console.error('Template from task error:', error)
      return apiError('Failed to create template.', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    console.error('Templates from-task POST error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
