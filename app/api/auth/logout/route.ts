import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST only — never allow GET to prevent CSRF via <img src="..."> or link prefetch
export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return NextResponse.redirect(new URL('/login', appUrl), { status: 302 })
}
