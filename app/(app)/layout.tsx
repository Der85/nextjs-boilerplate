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

  const { data: profile } = await supabase
    .from('profiles')
    .select('handle, display_name')
    .eq('id', user.id)
    .maybeSingle<Pick<Profile, 'handle' | 'display_name'>>()

  // Fallback if profile row hasn't been created yet (trigger race condition edge case)
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
