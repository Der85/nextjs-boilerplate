import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'

// GET /api/suggestions
// Returns pending and unsnoozed suggestions for the user
// Ordered by: gap_fill first (most impactful), then by created_at

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }

    const now = new Date().toISOString()

    // Fetch pending and unsnoozed suggestions
    const { data: suggestions, error } = await supabase
      .from('task_suggestions')
      .select(`
        *,
        category:categories(id, name, color, icon),
        source_template:task_templates(id, name)
      `)
      .eq('user_id', user.id)
      .or(`status.eq.pending,and(status.eq.snoozed,snoozed_until.lt.${now})`)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Suggestions fetch error:', error)
      return apiError('Failed to load suggestions.', 500, 'INTERNAL_ERROR')
    }

    // Sort by suggestion_type priority and format response
    const sortedSuggestions = (suggestions || [])
      .map(s => ({
        ...s,
        category: Array.isArray(s.category) ? s.category[0] || null : s.category,
        source_template: Array.isArray(s.source_template) ? s.source_template[0] || null : s.source_template,
      }))
      .sort((a, b) => {
        // Priority order: gap_fill > priority_boost > routine_suggestion > template_based > seasonal
        const typeOrder: Record<string, number> = {
          gap_fill: 0,
          priority_boost: 1,
          routine_suggestion: 2,
          template_based: 3,
          seasonal: 4,
        }
        const orderA = typeOrder[a.suggestion_type] ?? 5
        const orderB = typeOrder[b.suggestion_type] ?? 5
        return orderA - orderB
      })

    return NextResponse.json({ suggestions: sortedSuggestions })
  } catch (error) {
    console.error('Suggestions GET error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
