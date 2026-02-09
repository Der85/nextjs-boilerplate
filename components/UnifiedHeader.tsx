'use client'

import { useRouter } from 'next/navigation'

interface UnifiedHeaderProps {
  subtitle?: string
  showMenu?: boolean
  backPath?: string
}

export default function UnifiedHeader({ subtitle, backPath }: UnifiedHeaderProps) {
  const router = useRouter()

  return (
    <header className="unified-header">
      {backPath && (
        <button onClick={() => router.push(backPath)} className="header-back-btn" aria-label="Go back">
          ←
        </button>
      )}

      <button onClick={() => router.push('/dashboard')} className="header-logo">
        adhder.io
      </button>

      {subtitle && <span className="header-subtitle">{subtitle}</span>}

      <div className="header-spacer" />

      <style jsx>{`
        .unified-header {
          position: sticky;
          top: 0;
          background: white;
          border-bottom: 1px solid #eff3f4;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          gap: 10px;
          z-index: 100;
        }

        .header-back-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 20px;
          color: #1da1f2;
          padding: 4px 8px;
          margin-right: -4px;
          transition: opacity 0.15s ease;
          flex-shrink: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .header-back-btn:hover { opacity: 0.7; }

        .header-logo {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 18px;
          font-weight: 800;
          color: #1da1f2;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          white-space: nowrap;
          flex-shrink: 0;
          transition: opacity 0.15s ease;
          letter-spacing: -0.5px;
        }
        .header-logo:hover { opacity: 0.8; }

        .header-subtitle {
          font-size: 14px;
          color: #8899a6;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .header-spacer { flex: 1; }
      `}</style>
    </header>
  )
}
