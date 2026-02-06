'use client'

import { UserStatsProvider } from '@/context/UserStatsContext'
import { GamificationPrefsProvider } from '@/context/GamificationPrefsContext'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <UserStatsProvider>
      <GamificationPrefsProvider>
        {children}
      </GamificationPrefsProvider>
    </UserStatsProvider>
  )
}
