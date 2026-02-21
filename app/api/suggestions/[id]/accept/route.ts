import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { suggestionsRateLimiter } from '@/lib/rateLimiter'

interface RouteContext {
  params: Promise<{ id: string }>
}

// POST /api/suggestions/[id]/accept
// Creates a new task from the suggestion and marks it as accepted

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }

    if (suggestionsRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }

    const { id } = await context.params

    // Fetch the suggestion
    const { data: suggestion, error: fetchError } = await supabase
      .from('task_suggestions')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !suggestion) {
      return apiError('Suggestion not found.', 404, 'NOT_FOUND')
    }

    if (suggestion.status !== 'pending' && suggestion.status !== 'snoozed') {
      return apiError('Suggestion has already been processed.', 400, 'VALIDATION_ERROR')
    }

    // Create the task
    const taskData: Record<string, unknown> = {
      user_id: user.id,
      title: suggestion.suggested_task_name,
      status: 'active',
      category_id: suggestion.suggested_category_id,
      priority: suggestion.suggested_energy === 'high' ? 'high' : suggestion.suggested_energy === 'low' ? 'low' : 'medium',
      position: 0,
      ai_confidence: 0.9, // Suggested by AI
    }

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert(taskData)
      .select('*, category:categories(id, name, color, icon)')
      .single()

    if (taskError) {
      console.error('Task creation error:', taskError)
      return apiError('Failed to create task.', 500, 'INTERNAL_ERROR')
    }

    // Update suggestion status
    await supabase
      .from('task_suggestions')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', id)

    // Increment template use_count if from a template
    if (suggestion.source_template_id) {
      // Fetch current use_count and increment
      const { data: template } = await supabase
        .from('task_templates')
        .select('use_count')
        .eq('id', suggestion.source_template_id)
        .single()

      if (template) {
        await supabase
          .from('task_templates')
          .update({
            use_count: (template.use_count || 0) + 1,
            last_used_at: new Date().toISOString(),
          })
          .eq('id', suggestion.source_template_id)
      }
    }

    return NextResponse.json({
      task: {
        ...task,
        category: Array.isArray(task.category) ? task.category[0] || null : task.category,
      },
      message: 'Task created from suggestion.',
    })
  } catch (error) {
    console.error('Suggestion accept error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
