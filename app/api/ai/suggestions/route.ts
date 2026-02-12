import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { data: suggestions, error } = await supabase
      .from('category_suggestions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error('Suggestions fetch error:', error)
      return NextResponse.json({ error: 'Failed to load suggestions.' }, { status: 500 })
    }

    return NextResponse.json({ suggestion: suggestions?.[0] || null })
  } catch (error) {
    console.error('Suggestions GET error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
