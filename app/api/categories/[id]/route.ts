import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { categoriesRateLimiter } from '@/lib/rateLimiter'
import { categoryPatchSchema, parseBody } from '@/lib/validations'

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
    if (categoriesRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }


    const { id } = await context.params
    const body = await request.json()
    const parsed = parseBody(categoryPatchSchema, body)
    if (!parsed.success) return parsed.response

    const updates: Record<string, unknown> = {}
    if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim()
    if (parsed.data.color !== undefined) updates.color = parsed.data.color
    if (parsed.data.icon !== undefined) updates.icon = parsed.data.icon

    const { data: category, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Category update error:', error)
      return apiError('Failed to update category.', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({ category })
  } catch (error) {
    console.error('Category PATCH error:', error)
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
    if (categoriesRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }


    const { id } = await context.params

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Category delete error:', error)
      return apiError('Failed to delete category.', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Category DELETE error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
