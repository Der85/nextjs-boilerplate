'use client'

import TabBar from '@/components/TabBar'
import { CategoriesProvider } from '@/lib/contexts/CategoriesContext'
import { RemindersProvider } from '@/lib/contexts/RemindersContext'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CategoriesProvider>
      <RemindersProvider>
        <div style={{
          minHeight: '100dvh',
          paddingBottom: 'calc(var(--tab-bar-height) + var(--safe-area-bottom))',
        }}>
          <main style={{
            maxWidth: 'var(--content-max-width)',
            margin: '0 auto',
            padding: '0 16px',
          }}>
            {children}
          </main>
          <TabBar />
        </div>
      </RemindersProvider>
    </CategoriesProvider>
  )
}
