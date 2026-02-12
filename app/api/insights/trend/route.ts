import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { insightsRateLimiter } from '@/lib/rateLimiter'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (insightsRateLimiter.isLimited(user.id)) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }

    // Get last 4 weeks of data
    const fourWeeksAgo = new Date()
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
    fourWeeksAgo.setHours(0, 0, 0, 0)

    // Fetch completed tasks in the last 4 weeks
    const { data: completedTasks } = await supabase
      .from('tasks')
      .select('completed_at')
      .eq('user_id', user.id)
      .eq('status', 'done')
      .gte('completed_at', fourWeeksAgo.toISOString())

    // Fetch created tasks in the last 4 weeks
    const { data: createdTasks } = await supabase
      .from('tasks')
      .select('created_at')
      .eq('user_id', user.id)
      .gte('created_at', fourWeeksAgo.toISOString())

    // Group by week
    const weeks: Record<string, { completed: number; created: number }> = {}

    // Initialize 4 weeks
    for (let i = 0; i < 4; i++) {
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() - (i * 7))
      weekStart.setHours(0, 0, 0, 0)
      const key = weekStart.toISOString().split('T')[0]
      weeks[key] = { completed: 0, created: 0 }
    }

    const getWeekKey = (dateStr: string): string | null => {
      const d = new Date(dateStr)
      const dayOfWeek = d.getDay()
      const weekStart = new Date(d)
      weekStart.setDate(weekStart.getDate() - dayOfWeek)
      weekStart.setHours(0, 0, 0, 0)
      const key = weekStart.toISOString().split('T')[0]
      return weeks[key] !== undefined ? key : null
    }

    completedTasks?.forEach(t => {
      if (t.completed_at) {
        const key = getWeekKey(t.completed_at)
        if (key) weeks[key].completed++
      }
    })

    createdTasks?.forEach(t => {
      const key = getWeekKey(t.created_at)
      if (key) weeks[key].created++
    })

    const weeklyTrend = Object.entries(weeks)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week_start, data]) => ({
        week_start,
        completed: data.completed,
        created: data.created,
      }))

    // Category breakdown
    const { data: categoryData } = await supabase
      .from('tasks')
      .select('category:categories(name, color), status')
      .eq('user_id', user.id)
      .not('category_id', 'is', null)
      .neq('status', 'dropped')

    const categoryBreakdown: Record<string, { name: string; color: string; count: number }> = {}
    if (categoryData) {
      for (const t of categoryData) {
        const cat = t.category as unknown as { name: string; color: string } | null
        if (cat) {
          const key = cat.name
          if (!categoryBreakdown[key]) {
            categoryBreakdown[key] = { name: cat.name, color: cat.color, count: 0 }
          }
          categoryBreakdown[key].count++
        }
      }
    }

    return NextResponse.json({
      weekly_trend: weeklyTrend,
      category_breakdown: Object.values(categoryBreakdown),
    })
  } catch (error) {
    console.error('Insights trend error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
