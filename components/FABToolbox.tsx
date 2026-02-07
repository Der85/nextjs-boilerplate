'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import GamificationSettings from './GamificationSettings'

interface FABToolboxProps {
  energyParam?: string
  isRecoveryMode?: boolean
}

export default function FABToolbox({ energyParam = 'medium', isRecoveryMode = false }: FABToolboxProps) {
  const router = useRouter()
  const [toolboxExpanded, setToolboxExpanded] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Don't show FAB in recovery mode - keep it minimal
  if (isRecoveryMode) {
    return null
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* FAB Button */}
      <button
        className="toolbox-fab"
        onClick={() => setToolboxExpanded(!toolboxExpanded)}
        aria-label="Open toolbox"
      >
        🧰
      </button>

      {/* Toolbox Modal */}
      {toolboxExpanded && (
        <>
          <div className="fab-overlay" onClick={() => setToolboxExpanded(false)} />
          <div className="fab-modal">
            <div className="fab-modal-header">
              <span className="fab-modal-title">Quick Tools</span>
              <button className="fab-modal-close" onClick={() => setToolboxExpanded(false)}>×</button>
            </div>
            <div className="fab-modal-grid">
              <button onClick={() => { router.push('/dashboard'); setToolboxExpanded(false) }} className="fab-tool-btn">
                <span className="fab-tool-icon">🏠</span>
                <span className="fab-tool-label">Home</span>
              </button>
              <button onClick={() => { router.push(`/focus?energy=${energyParam}`); setToolboxExpanded(false) }} className="fab-tool-btn">
                <span className="fab-tool-icon">⏱️</span>
                <span className="fab-tool-label">Focus</span>
              </button>
              <button onClick={() => { router.push(`/goals?energy=${energyParam}`); setToolboxExpanded(false) }} className="fab-tool-btn">
                <span className="fab-tool-icon">🎯</span>
                <span className="fab-tool-label">Goals</span>
              </button>
              <button onClick={() => { router.push(`/ally?energy=${energyParam}`); setToolboxExpanded(false) }} className="fab-tool-btn">
                <span className="fab-tool-icon">💜</span>
                <span className="fab-tool-label">Stuck</span>
              </button>
              <button onClick={() => { router.push(`/history?energy=${energyParam}`); setToolboxExpanded(false) }} className="fab-tool-btn">
                <span className="fab-tool-icon">📊</span>
                <span className="fab-tool-label">History</span>
              </button>
              <button onClick={() => { router.push('/brake'); setToolboxExpanded(false) }} className="fab-tool-btn">
                <span className="fab-tool-icon">🫁</span>
                <span className="fab-tool-label">Breathe</span>
              </button>
              <button onClick={() => { router.push('/check-in'); setToolboxExpanded(false) }} className="fab-tool-btn">
                <span className="fab-tool-icon">📋</span>
                <span className="fab-tool-label">Check-in</span>
              </button>
              <button onClick={() => { router.push('/wind-down'); setToolboxExpanded(false) }} className="fab-tool-btn">
                <span className="fab-tool-icon">🌙</span>
                <span className="fab-tool-label">Wind Down</span>
              </button>
              <button onClick={() => { setSettingsOpen(true); setToolboxExpanded(false) }} className="fab-tool-btn">
                <span className="fab-tool-icon">⚙️</span>
                <span className="fab-tool-label">Settings</span>
              </button>
            </div>
            <div className="fab-modal-footer">
              <button onClick={handleLogout} className="fab-logout-btn">
                Log out
              </button>
            </div>
          </div>
        </>
      )}

      {/* Settings Modal */}
      {settingsOpen && (
        <>
          <div className="settings-overlay" onClick={() => setSettingsOpen(false)} />
          <div className="settings-modal">
            <div className="settings-modal-header">
              <span className="settings-modal-title">Settings</span>
              <button className="settings-modal-close" onClick={() => setSettingsOpen(false)}>×</button>
            </div>
            <div className="settings-modal-content">
              <GamificationSettings onClose={() => setSettingsOpen(false)} />
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .toolbox-fab {
          position: fixed;
          bottom: clamp(20px, 5vw, 28px);
          right: clamp(20px, 5vw, 28px);
          width: clamp(56px, 14vw, 64px);
          height: clamp(56px, 14vw, 64px);
          border-radius: 50%;
          background: linear-gradient(135deg, #1D9BF0 0%, #1a8cd8 100%);
          border: none;
          cursor: pointer;
          font-size: clamp(24px, 6vw, 28px);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 16px rgba(29, 155, 240, 0.35);
          z-index: 90;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .toolbox-fab:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 24px rgba(29, 155, 240, 0.45);
        }

        .fab-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 95;
          animation: fade-in 0.15s ease;
        }

        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .fab-modal {
          position: fixed;
          bottom: clamp(90px, 22vw, 110px);
          right: clamp(20px, 5vw, 28px);
          background: white;
          border-radius: clamp(16px, 4vw, 24px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          z-index: 100;
          animation: slide-up 0.2s ease;
          width: clamp(280px, 80vw, 320px);
        }

        @keyframes slide-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .fab-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: clamp(14px, 3.5vw, 18px);
          border-bottom: 1px solid #eff3f4;
        }

        .fab-modal-title {
          font-size: clamp(16px, 4.5vw, 18px);
          font-weight: 700;
          color: #0f1419;
        }

        .fab-modal-close {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: none;
          background: #eff3f4;
          color: #536471;
          font-size: 18px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s ease;
        }

        .fab-modal-close:hover {
          background: #e5e7eb;
        }

        .fab-modal-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: clamp(8px, 2vw, 12px);
          padding: clamp(14px, 3.5vw, 18px);
        }

        .fab-tool-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: clamp(6px, 1.5vw, 8px);
          padding: clamp(14px, 3.5vw, 18px) clamp(8px, 2vw, 12px);
          background: #f7f9fa;
          border: 1px solid #eff3f4;
          border-radius: clamp(12px, 3vw, 16px);
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .fab-tool-btn:hover {
          background: white;
          border-color: #1D9BF0;
        }

        .fab-tool-btn:active {
          transform: scale(0.95);
        }

        .fab-tool-icon {
          font-size: clamp(22px, 5.5vw, 26px);
          line-height: 1;
        }

        .fab-tool-label {
          font-size: clamp(11px, 3vw, 13px);
          font-weight: 600;
          color: #536471;
        }

        .fab-modal-footer {
          padding: clamp(12px, 3vw, 16px);
          border-top: 1px solid #eff3f4;
        }

        .fab-logout-btn {
          width: 100%;
          padding: clamp(10px, 2.5vw, 14px);
          background: none;
          border: 1px solid #ef4444;
          border-radius: clamp(8px, 2vw, 12px);
          color: #ef4444;
          font-size: clamp(13px, 3.5vw, 15px);
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .fab-logout-btn:hover {
          background: rgba(239, 68, 68, 0.08);
        }

        /* Settings Modal */
        .settings-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 999;
          animation: fade-in 0.15s ease;
        }

        .settings-modal {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: white;
          border-radius: clamp(16px, 4vw, 24px) clamp(16px, 4vw, 24px) 0 0;
          z-index: 1000;
          animation: slide-up 0.2s ease;
          max-height: 85vh;
          overflow-y: auto;
        }

        .settings-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: clamp(14px, 3.5vw, 18px);
          border-bottom: 1px solid #eff3f4;
          position: sticky;
          top: 0;
          background: white;
          z-index: 1;
        }

        .settings-modal-title {
          font-size: clamp(16px, 4.5vw, 18px);
          font-weight: 700;
          color: #0f1419;
        }

        .settings-modal-close {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: none;
          background: #eff3f4;
          color: #536471;
          font-size: 18px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s ease;
        }

        .settings-modal-close:hover {
          background: #e5e7eb;
        }

        .settings-modal-content {
          padding: clamp(18px, 4.5vw, 24px);
          padding-bottom: calc(clamp(18px, 4.5vw, 24px) + env(safe-area-inset-bottom, 0px));
        }

        @media (min-width: 768px) {
          .fab-modal { width: 340px; }
          .settings-modal {
            max-width: 480px;
            left: 50%;
            transform: translateX(-50%);
            border-radius: clamp(16px, 4vw, 24px);
            bottom: 50%;
            transform: translate(-50%, 50%);
          }
        }
      `}</style>
    </>
  )
}
