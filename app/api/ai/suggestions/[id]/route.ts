import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { aiRateLimiter } from '@/lib/rateLimiter'
import { categorySuggestionActionSchema, parseBody } from '@/lib/validations'
import type { SuggestedCategory } from '@/lib/types'

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
    if (aiRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }


    const { id } = await context.params
    const body = await request.json()
    const parsed = parseBody(categorySuggestionActionSchema, body)
    if (!parsed.success) return parsed.response
    const { action } = parsed.data

    // Fetch the suggestion
    const { data: suggestion, error: fetchError } = await supabase
      .from('category_suggestions')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .single()

    if (fetchError || !suggestion) {
      return apiError('Suggestion not found.', 404, 'NOT_FOUND')
    }

    if (action === 'dismiss') {
      await supabase
        .from('category_suggestions')
        .update({ status: 'dismissed', resolved_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)

      return NextResponse.json({ success: true })
    }

    // Accept: claim the suggestion first (prevents duplicate processing),
    // then create categories, then finalize
    const { error: claimError } = await supabase
      .from('category_suggestions')
      .update({ status: 'processing', resolved_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('status', 'pending') // guard: only claim if still pending

    if (claimError) {
      return apiError('Suggestion already processed.', 409, 'CONFLICT')
    }

    const suggestedCategories = suggestion.suggested_categories as SuggestedCategory[]
    const createdCategories: Record<string, unknown>[] = []

    for (const sc of suggestedCategories) {
      const { data: cat, error: catError } = await supabase
        .from('categories')
        .insert({
          user_id: user.id,
          name: sc.name,
          color: sc.color,
          icon: sc.icon,
          is_ai_generated: true,
          position: createdCategories.length,
        })
        .select()
        .single()

      if (catError) {
        console.error('Category creation error:', catError)
        continue
      }

      createdCategories.push(cat)

      if (sc.task_ids && sc.task_ids.length > 0) {
        await supabase
          .from('tasks')
          .update({ category_id: cat.id })
          .in('id', sc.task_ids)
          .eq('user_id', user.id)
      }
    }

    if (createdCategories.length === 0) {
      // All category creations failed — revert to pending so user can retry
      await supabase
        .from('category_suggestions')
        .update({ status: 'pending', resolved_at: null })
        .eq('id', id)
        .eq('user_id', user.id)

      return apiError('Failed to create categories.', 500, 'INTERNAL_ERROR')
    }

    // Finalize: mark accepted and update profile
    await supabase
      .from('category_suggestions')
      .update({ status: 'accepted' })
      .eq('id', id)
      .eq('user_id', user.id)

    await supabase
      .from('user_profiles')
      .update({ category_suggestions_accepted: true })
      .eq('id', user.id)

    return NextResponse.json({
      success: true,
      categories: createdCategories,
    })
  } catch (error) {
    console.error('Suggestion PATCH error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
