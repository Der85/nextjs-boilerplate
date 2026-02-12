import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SuggestedCategory } from '@/lib/types'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await context.params
    const body = await request.json()
    const action = body.action

    if (!['accept', 'dismiss'].includes(action)) {
      return NextResponse.json({ error: 'Action must be "accept" or "dismiss".' }, { status: 400 })
    }

    // Fetch the suggestion
    const { data: suggestion, error: fetchError } = await supabase
      .from('category_suggestions')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .single()

    if (fetchError || !suggestion) {
      return NextResponse.json({ error: 'Suggestion not found.' }, { status: 404 })
    }

    if (action === 'dismiss') {
      await supabase
        .from('category_suggestions')
        .update({ status: 'dismissed', resolved_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)

      return NextResponse.json({ success: true })
    }

    // Accept: create categories and assign tasks
    const suggestedCategories = suggestion.suggested_categories as SuggestedCategory[]
    const createdCategories: Record<string, unknown>[] = []

    for (const sc of suggestedCategories) {
      // Create the category
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

      // Assign tasks to this category
      if (sc.task_ids && sc.task_ids.length > 0) {
        await supabase
          .from('tasks')
          .update({ category_id: cat.id })
          .in('id', sc.task_ids)
          .eq('user_id', user.id)
      }
    }

    // Mark suggestion as accepted
    await supabase
      .from('category_suggestions')
      .update({ status: 'accepted', resolved_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)

    // Update user profile
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
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
