import { ZoneBrowser } from '@/components/ZoneBrowser'
import { ExploreFeed } from '@/components/ExploreFeed'

export default function ExplorePage() {
  return (
    <div style={{ maxWidth: 'var(--content-max-width)', margin: '0 auto' }}>
      {/* Zone browser — discover and follow zones */}
      <div style={{ borderBottom: '2px solid var(--color-border)' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <h1 style={{ fontSize: '1rem', fontWeight: 700 }}>Browse Zones</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            Discover active locations and follow the ones you care about
          </p>
        </div>
        <ZoneBrowser />
      </div>

      {/* Global feed */}
      <ExploreFeed />
    </div>
  )
}
