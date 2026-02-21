import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }

    // Try to fetch existing profile
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error && error.code === 'PGRST116') {
      // No profile exists, create one
      const { data: newProfile, error: insertError } = await supabase
        .from('user_profiles')
        .insert({ id: user.id })
        .select()
        .single()

      if (insertError) {
        console.error('Profile create error:', insertError)
        return apiError('Failed to create profile.', 500, 'INTERNAL_ERROR')
      }

      return NextResponse.json({ profile: newProfile, email: user.email })
    }

    if (error) {
      console.error('Profile fetch error:', error)
      return apiError('Failed to load profile.', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({ profile, email: user.email })
  } catch (error) {
    console.error('Profile GET error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }

    const body = await request.json()

    const updates: Record<string, unknown> = {}
    if (typeof body.display_name === 'string') updates.display_name = body.display_name.trim() || null
    if (typeof body.timezone === 'string') updates.timezone = body.timezone

    if (Object.keys(updates).length === 0) {
      return apiError('No valid fields to update.', 400, 'VALIDATION_ERROR')
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Profile update error:', error)
      return apiError('Failed to update profile.', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Profile PATCH error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
