import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LocationProvider } from '@/lib/contexts/LocationContext'
import { LocationGate } from '@/components/LocationGate'
import { AppHeader } from '@/components/AppHeader'
import { TabBar } from '@/components/TabBar'
import type { Profile } from '@/lib/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  let { data: profile } = await supabase
    .from('profiles')
    .select('handle, display_name')
    .eq('id', user.id)
    .maybeSingle<Pick<Profile, 'handle' | 'display_name'>>()

  // Profile missing — user signed up before the new schema was applied.
  // Auto-create it now so all FK-dependent features (follows, posts) work.
  if (!profile) {
    const baseHandle = (user.email?.split('@')[0] ?? 'user')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 20)

    // Try the base handle first; if taken, append the first 4 chars of the user id
    const handle = baseHandle
    const { data: created } = await supabase
      .from('profiles')
      .upsert(
        { id: user.id, handle, display_name: handle },
        { onConflict: 'id' }
      )
      .select('handle, display_name')
      .maybeSingle<Pick<Profile, 'handle' | 'display_name'>>()

    profile = created
  }

  const handle = profile?.handle ?? user.email?.split('@')[0] ?? 'user'

  return (
    <LocationProvider>
      <LocationGate />
      <AppHeader handle={handle} />
      <main style={{ paddingBottom: '68px', minHeight: '100dvh' }}>
        {children}
      </main>
      <TabBar />
    </LocationProvider>
  )
}
