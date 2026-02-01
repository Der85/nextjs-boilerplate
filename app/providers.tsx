'use client'

import { UserStatsProvider } from '@/context/UserStatsContext'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <UserStatsProvider>
      {children}
    </UserStatsProvider>
  )
}
