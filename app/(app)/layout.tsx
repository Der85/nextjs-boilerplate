import TabBar from '@/components/TabBar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
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
  )
}
