'use client'

import { LocationProvider } from '@/lib/contexts/LocationContext'
import AppHeader from '@/components/AppHeader'
import FeedTabs from '@/components/FeedTabs'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <LocationProvider>
      <div style={{
        maxWidth: 'var(--content-max-width)',
        margin: '0 auto',
        minHeight: '100vh',
        borderLeft: '1px solid var(--color-border)',
        borderRight: '1px solid var(--color-border)',
      }}>
        <AppHeader />
        <FeedTabs />
        <main>{children}</main>
      </div>
    </LocationProvider>
  )
}
