import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { templatesRateLimiter } from '@/lib/rateLimiter'
import { templatePatchSchema, parseBody } from '@/lib/validations'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
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
    const parsed = parseBody(templatePatchSchema, body)
    if (!parsed.success) return parsed.response

    const updates: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) {
        updates[key] = value
      }
    }

    if (Object.keys(updates).length === 0) {
      return apiError('No valid fields to update.', 400, 'VALIDATION_ERROR')
    }

    // Verify category belongs to user if provided
    if (parsed.data.category_id) {
      const { data: cat } = await supabase
        .from('categories')
        .select('id')
        .eq('id', parsed.data.category_id)
        .eq('user_id', user.id)
        .single()

      if (!cat) {
        return apiError('Invalid category.', 400, 'VALIDATION_ERROR')
      }
    }

    const { data: template, error } = await supabase
      .from('task_templates')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*, category:categories(id, name, color, icon)')
      .single()

    if (error) {
      if (error.code === '23505') {
        return apiError('A template with this name already exists.', 409, 'CONFLICT')
      }
      console.error('Template update error:', error)
      return apiError('Failed to update template.', 500, 'INTERNAL_ERROR')
    }

    if (!template) {
      return apiError('Template not found.', 404, 'NOT_FOUND')
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Templates PATCH error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }

    const { id } = await context.params

    const { error } = await supabase
      .from('task_templates')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Template delete error:', error)
      return apiError('Failed to delete template.', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Templates DELETE error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
