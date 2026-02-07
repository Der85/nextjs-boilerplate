'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import GamificationSettings from './GamificationSettings'

type FABMode = 'pre-checkin' | 'recovery' | 'maintenance' | 'growth'

interface FABToolboxProps {
  mode: FABMode
  energyParam?: string
  promotedTool?: { id: string; label: string }
  hasActiveGoalStep?: boolean
  justCompletedTask?: boolean
  currentHourLocal?: number
  streakCount?: number
  // Legacy prop for backward compatibility
  isRecoveryMode?: boolean
}

// Tool definitions with categories
const SUPPORT_TOOLS = [
  { id: 'brake', icon: '🫁', label: 'Breathe', path: '/brake', description: 'Take a calming breath' },
  { id: 'village', icon: '💜', label: 'Village', path: '/village', description: 'Connect with support' },
  { id: 'wins', icon: '🏆', label: 'Wins', path: '/wins', description: 'Celebrate progress' },
]

const PRODUCTIVITY_TOOLS = [
  { id: 'focus', icon: '⏱️', label: 'Focus', path: '/focus', description: 'Start a focus session' },
  { id: 'goals', icon: '🎯', label: 'Goals', path: '/goals', description: 'Track your goals' },
  { id: 'history', icon: '📊', label: 'History', path: '/history', description: 'Review patterns' },
]

const UTILITY_TOOLS = [
  { id: 'home', icon: '🏠', label: 'Home', path: '/dashboard', description: 'Back to dashboard' },
  { id: 'checkin', icon: '📋', label: 'Check-in', path: '/check-in', description: 'Log how you feel' },
  { id: 'winddown', icon: '🌙', label: 'Wind Down', path: '/wind-down', description: 'End your day' },
]

// FAB button appearance by mode
const FAB_CONFIG = {
  'pre-checkin': {
    icon: '🌱',
    className: 'fab-precheckin',
    label: 'Start your day',
  },
  'recovery': {
    icon: '🤲',
    className: 'fab-recovery',
    label: 'I\'m here for you',
  },
  'maintenance': {
    icon: '🧰',
    className: 'fab-maintenance',
    label: 'Quick tools',
  },
  'growth': {
    icon: '⚡',
    className: 'fab-growth',
    label: 'Keep the momentum',
  },
}

// Get contextually promoted tool based on time/state
const getPromotedTool = (
  currentHour: number,
  justCompletedTask: boolean,
  hasActiveGoalStep: boolean,
  mode: FABMode
): { id: string; label: string } | null => {
  // Morning (5am-11am): Promote Check-in
  if (currentHour >= 5 && currentHour < 11 && mode === 'pre-checkin') {
    return { id: 'checkin', label: 'Start with a check-in' }
  }

  // Just completed a task: Promote Wins
  if (justCompletedTask) {
    return { id: 'wins', label: 'Log your win!' }
  }

  // Active goal step: Promote Goals
  if (hasActiveGoalStep) {
    return { id: 'goals', label: 'Continue your goal' }
  }

  // Evening (7pm-11pm): Promote Wind Down
  if (currentHour >= 19 && currentHour < 23) {
    return { id: 'winddown', label: 'Ready to wind down?' }
  }

  return null
}

export default function FABToolbox({
  mode,
  energyParam = 'medium',
  promotedTool: externalPromotedTool,
  hasActiveGoalStep = false,
  justCompletedTask = false,
  currentHourLocal,
  streakCount = 0,
  // Legacy prop - convert to mode if needed
  isRecoveryMode,
}: FABToolboxProps) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [animatingOut, setAnimatingOut] = useState(false)

  // Determine effective mode (legacy prop fallback)
  const effectiveMode: FABMode = isRecoveryMode ? 'recovery' : mode

  // Get current hour if not provided
  const currentHour = currentHourLocal ?? new Date().getHours()

  // Get promoted tool (external prop takes precedence)
  const promotedTool = externalPromotedTool || getPromotedTool(
    currentHour,
    justCompletedTask,
    hasActiveGoalStep,
    effectiveMode
  )

  // Find the promoted tool details
  const allTools = [...SUPPORT_TOOLS, ...PRODUCTIVITY_TOOLS, ...UTILITY_TOOLS]
  const promotedToolDetails = promotedTool
    ? allTools.find(t => t.id === promotedTool.id)
    : null

  const fabConfig = FAB_CONFIG[effectiveMode]

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleClose = () => {
    setAnimatingOut(true)
    setTimeout(() => {
      setExpanded(false)
      setAnimatingOut(false)
    }, 150)
  }

  const navigateTo = (path: string) => {
    handleClose()
    // Add energy param for relevant paths
    const pathsWithEnergy = ['/focus', '/goals', '/ally', '/history']
    if (pathsWithEnergy.some(p => path.startsWith(p))) {
      router.push(`${path}?energy=${energyParam}`)
    } else {
      router.push(path)
    }
  }

  // Determine FAB state based on mode
  const getFABState = (): 'minimal' | 'focused' | 'expanded' => {
    if (effectiveMode === 'recovery') return 'minimal'
    if (effectiveMode === 'pre-checkin') return 'focused'
    return 'expanded'
  }

  const fabState = getFABState()

  // Recovery mode: Minimal FAB (just the brake button)
  if (fabState === 'minimal') {
    return (
      <>
        <button
          className={`toolbox-fab ${fabConfig.className}`}
          onClick={() => router.push('/brake')}
          aria-label={fabConfig.label}
          title={fabConfig.label}
        >
          <span className="fab-icon">{fabConfig.icon}</span>
        </button>

        <style jsx>{`
          .toolbox-fab {
            position: fixed;
            bottom: clamp(20px, 5vw, 28px);
            right: clamp(20px, 5vw, 28px);
            width: clamp(60px, 15vw, 72px);
            height: clamp(60px, 15vw, 72px);
            border-radius: 50%;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 90;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
          }

          .fab-icon {
            font-size: clamp(28px, 7vw, 34px);
            animation: breathing 8s ease-in-out infinite;
          }

          @keyframes breathing {
            0%, 100% { transform: scale(1); }
            25% { transform: scale(1.1); }
            50% { transform: scale(1); }
            75% { transform: scale(1.1); }
          }

          .fab-recovery {
            background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%);
            box-shadow: 0 4px 20px rgba(139, 92, 246, 0.3);
          }

          .fab-recovery::after {
            content: '';
            position: absolute;
            inset: -4px;
            border-radius: 50%;
            border: 2px solid rgba(139, 92, 246, 0.4);
            animation: breathing-ring 8s ease-in-out infinite;
          }

          @keyframes breathing-ring {
            0%, 100% { transform: scale(1); opacity: 0.6; }
            25% { transform: scale(1.08); opacity: 0.9; }
            50% { transform: scale(1); opacity: 0.6; }
            75% { transform: scale(1.08); opacity: 0.9; }
          }

          .toolbox-fab:hover {
            transform: scale(1.05);
          }
        `}</style>
      </>
    )
  }

  // Focused mode (pre-checkin): 2-3 essential tools visible
  if (fabState === 'focused' && !expanded) {
    const focusedTools = [
      { id: 'checkin', icon: '📋', label: 'Check in', path: '/check-in', isPromoted: promotedTool?.id === 'checkin' },
      { id: 'brake', icon: '🫁', label: 'Breathe', path: '/brake', isPromoted: false },
      { id: 'goals', icon: '🎯', label: 'Goals', path: '/goals', isPromoted: promotedTool?.id === 'goals' },
    ]

    return (
      <>
        <div className="fab-focused-container">
          {/* Mini tools row */}
          <div className="focused-tools-row">
            {focusedTools.map((tool, index) => (
              <button
                key={tool.id}
                className={`focused-tool-btn ${tool.isPromoted ? 'promoted' : ''}`}
                onClick={() => navigateTo(tool.path)}
                aria-label={tool.label}
                title={tool.label}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <span className="focused-tool-icon">{tool.icon}</span>
              </button>
            ))}
          </div>

          {/* Main FAB - opens full menu */}
          <button
            className={`toolbox-fab ${fabConfig.className}`}
            onClick={() => setExpanded(true)}
            aria-label="More tools"
            title="More tools"
          >
            <span className="fab-icon">{fabConfig.icon}</span>
          </button>
        </div>

        <style jsx>{`
          .fab-focused-container {
            position: fixed;
            bottom: clamp(20px, 5vw, 28px);
            right: clamp(20px, 5vw, 28px);
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: clamp(10px, 2.5vw, 14px);
            z-index: 90;
          }

          .focused-tools-row {
            display: flex;
            gap: clamp(8px, 2vw, 12px);
            animation: fadeSlideIn 0.3s ease-out;
          }

          @keyframes fadeSlideIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .focused-tool-btn {
            width: clamp(44px, 11vw, 52px);
            height: clamp(44px, 11vw, 52px);
            border-radius: 50%;
            background: white;
            border: 2px solid #eff3f4;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            transition: all 0.2s ease;
            animation: popIn 0.3s ease-out backwards;
          }

          .focused-tool-btn:hover {
            transform: scale(1.1);
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
            border-color: #1D9BF0;
          }

          .focused-tool-btn.promoted {
            background: linear-gradient(135deg, #fef9c3 0%, #fde047 100%);
            border-color: #fbbf24;
            animation: pulse-gentle 2s ease-in-out infinite;
          }

          @keyframes pulse-gentle {
            0%, 100% { box-shadow: 0 2px 8px rgba(251, 191, 36, 0.3); }
            50% { box-shadow: 0 4px 16px rgba(251, 191, 36, 0.5); }
          }

          @keyframes popIn {
            from {
              opacity: 0;
              transform: scale(0.8);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }

          .focused-tool-icon {
            font-size: clamp(20px, 5vw, 24px);
          }

          .toolbox-fab {
            width: clamp(56px, 14vw, 64px);
            height: clamp(56px, 14vw, 64px);
            border-radius: 50%;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            position: relative;
          }

          .fab-icon {
            font-size: clamp(24px, 6vw, 28px);
          }

          .fab-precheckin {
            background: linear-gradient(135deg, #fef9c3 0%, #fde047 100%);
            box-shadow: 0 4px 16px rgba(251, 191, 36, 0.35);
          }

          .fab-precheckin .fab-icon {
            animation: gentle-pulse 3s ease-in-out infinite;
          }

          @keyframes gentle-pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.08); }
          }

          .toolbox-fab:hover {
            transform: scale(1.05);
          }
        `}</style>
      </>
    )
  }

  // Expanded mode (maintenance/growth): Full menu with tiered layout
  return (
    <>
      {/* Main FAB Button */}
      {!expanded && (
        <button
          className={`toolbox-fab ${fabConfig.className}`}
          onClick={() => setExpanded(true)}
          aria-label={fabConfig.label}
          title={fabConfig.label}
        >
          <span className="fab-icon">{fabConfig.icon}</span>
          {promotedToolDetails && (
            <span className="fab-badge" />
          )}
        </button>
      )}

      {/* Expanded Modal */}
      {expanded && (
        <>
          <div
            className={`fab-overlay ${animatingOut ? 'closing' : ''}`}
            onClick={handleClose}
          />
          <div className={`fab-modal ${animatingOut ? 'closing' : ''}`}>
            {/* Header with mode-aware styling */}
            <div className={`fab-modal-header ${effectiveMode}`}>
              <span className="fab-modal-title">
                {effectiveMode === 'growth' && streakCount > 0
                  ? `🔥 ${streakCount} day streak`
                  : 'Quick Tools'}
              </span>
              <button className="fab-modal-close" onClick={handleClose}>×</button>
            </div>

            {/* Promoted Tool Banner (if any) */}
            {promotedToolDetails && (
              <button
                className="promoted-tool-banner"
                onClick={() => navigateTo(promotedToolDetails.path)}
              >
                <span className="promoted-icon">{promotedToolDetails.icon}</span>
                <div className="promoted-content">
                  <span className="promoted-label">{promotedTool?.label || promotedToolDetails.label}</span>
                  <span className="promoted-desc">{promotedToolDetails.description}</span>
                </div>
                <span className="promoted-arrow">→</span>
              </button>
            )}

            {/* Support Tools Section */}
            <div className="tool-section">
              <span className="section-label">Support</span>
              <div className="tool-row">
                {SUPPORT_TOOLS.map((tool, index) => (
                  <button
                    key={tool.id}
                    className={`fab-tool-btn ${promotedTool?.id === tool.id ? 'promoted' : ''}`}
                    onClick={() => navigateTo(tool.path)}
                    style={{ animationDelay: `${index * 0.03}s` }}
                  >
                    <span className="fab-tool-icon">{tool.icon}</span>
                    <span className="fab-tool-label">{tool.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Productivity Tools Section */}
            <div className="tool-section">
              <span className="section-label">Productivity</span>
              <div className="tool-row">
                {PRODUCTIVITY_TOOLS.map((tool, index) => (
                  <button
                    key={tool.id}
                    className={`fab-tool-btn ${promotedTool?.id === tool.id ? 'promoted' : ''}`}
                    onClick={() => navigateTo(tool.path)}
                    style={{ animationDelay: `${(index + 3) * 0.03}s` }}
                  >
                    <span className="fab-tool-icon">{tool.icon}</span>
                    <span className="fab-tool-label">{tool.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Utility Tools - smaller, less prominent */}
            <div className="utility-section">
              {UTILITY_TOOLS.map((tool, index) => (
                <button
                  key={tool.id}
                  className={`utility-btn ${promotedTool?.id === tool.id ? 'promoted' : ''}`}
                  onClick={() => navigateTo(tool.path)}
                  style={{ animationDelay: `${(index + 6) * 0.03}s` }}
                >
                  <span className="utility-icon">{tool.icon}</span>
                  <span className="utility-label">{tool.label}</span>
                </button>
              ))}
              <button
                className="utility-btn"
                onClick={() => { setSettingsOpen(true); handleClose() }}
                style={{ animationDelay: '0.27s' }}
              >
                <span className="utility-icon">⚙️</span>
                <span className="utility-label">Settings</span>
              </button>
            </div>

            {/* Footer */}
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
        /* ===== Main FAB Button ===== */
        .toolbox-fab {
          position: fixed;
          bottom: clamp(20px, 5vw, 28px);
          right: clamp(20px, 5vw, 28px);
          width: clamp(56px, 14vw, 64px);
          height: clamp(56px, 14vw, 64px);
          border-radius: 50%;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 90;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          position: relative;
        }

        .fab-icon {
          font-size: clamp(24px, 6vw, 28px);
        }

        .fab-badge {
          position: absolute;
          top: 2px;
          right: 2px;
          width: 12px;
          height: 12px;
          background: #ef4444;
          border-radius: 50%;
          border: 2px solid white;
        }

        .fab-maintenance {
          background: linear-gradient(135deg, #1D9BF0 0%, #1a8cd8 100%);
          box-shadow: 0 4px 16px rgba(29, 155, 240, 0.35);
        }

        .fab-growth {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          box-shadow: 0 4px 16px rgba(16, 185, 129, 0.35);
        }

        .fab-growth .fab-icon {
          animation: energy-pulse 2s ease-in-out infinite;
        }

        @keyframes energy-pulse {
          0%, 100% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.05) rotate(-3deg); }
          75% { transform: scale(1.05) rotate(3deg); }
        }

        .fab-precheckin {
          background: linear-gradient(135deg, #fef9c3 0%, #fde047 100%);
          box-shadow: 0 4px 16px rgba(251, 191, 36, 0.35);
        }

        .toolbox-fab:hover {
          transform: scale(1.05);
        }

        .toolbox-fab:active {
          transform: scale(0.95);
        }

        /* ===== Overlay ===== */
        .fab-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 95;
          animation: fade-in 0.15s ease;
        }

        .fab-overlay.closing {
          animation: fade-out 0.15s ease forwards;
        }

        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes fade-out {
          from { opacity: 1; }
          to { opacity: 0; }
        }

        /* ===== Modal ===== */
        .fab-modal {
          position: fixed;
          bottom: clamp(20px, 5vw, 28px);
          right: clamp(20px, 5vw, 28px);
          background: white;
          border-radius: clamp(16px, 4vw, 24px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          z-index: 100;
          animation: modal-in 0.2s ease;
          width: clamp(300px, 85vw, 360px);
          max-height: 80vh;
          overflow-y: auto;
        }

        .fab-modal.closing {
          animation: modal-out 0.15s ease forwards;
        }

        @keyframes modal-in {
          from { opacity: 0; transform: translateY(16px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes modal-out {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to { opacity: 0; transform: translateY(16px) scale(0.95); }
        }

        /* ===== Header ===== */
        .fab-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: clamp(14px, 3.5vw, 18px);
          border-bottom: 1px solid #eff3f4;
        }

        .fab-modal-header.growth {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.04) 100%);
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

        /* ===== Promoted Tool Banner ===== */
        .promoted-tool-banner {
          display: flex;
          align-items: center;
          gap: clamp(10px, 2.5vw, 14px);
          padding: clamp(12px, 3vw, 16px);
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.12) 0%, rgba(245, 158, 11, 0.08) 100%);
          border: none;
          border-bottom: 1px solid #eff3f4;
          cursor: pointer;
          width: 100%;
          text-align: left;
          transition: background 0.15s ease;
          animation: slideIn 0.25s ease-out;
        }

        .promoted-tool-banner:hover {
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.18) 0%, rgba(245, 158, 11, 0.12) 100%);
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }

        .promoted-icon {
          font-size: clamp(24px, 6vw, 28px);
          flex-shrink: 0;
        }

        .promoted-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .promoted-label {
          font-size: clamp(14px, 3.8vw, 16px);
          font-weight: 600;
          color: #0f1419;
        }

        .promoted-desc {
          font-size: clamp(12px, 3.2vw, 13px);
          color: #536471;
        }

        .promoted-arrow {
          font-size: clamp(16px, 4vw, 18px);
          color: #f59e0b;
          font-weight: 600;
        }

        /* ===== Tool Sections ===== */
        .tool-section {
          padding: clamp(12px, 3vw, 16px);
          border-bottom: 1px solid #eff3f4;
        }

        .section-label {
          display: block;
          font-size: clamp(11px, 3vw, 12px);
          font-weight: 600;
          color: #8899a6;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: clamp(10px, 2.5vw, 12px);
        }

        .tool-row {
          display: flex;
          gap: clamp(8px, 2vw, 12px);
        }

        .fab-tool-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: clamp(6px, 1.5vw, 8px);
          padding: clamp(12px, 3vw, 16px) clamp(6px, 1.5vw, 10px);
          background: #f7f9fa;
          border: 2px solid transparent;
          border-radius: clamp(12px, 3vw, 16px);
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          animation: popIn 0.2s ease-out backwards;
        }

        @keyframes popIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }

        .fab-tool-btn:hover {
          background: white;
          border-color: #1D9BF0;
          transform: translateY(-2px);
        }

        .fab-tool-btn:active {
          transform: translateY(0) scale(0.98);
        }

        .fab-tool-btn.promoted {
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.1) 100%);
          border-color: #f59e0b;
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

        /* ===== Utility Section (smaller tools) ===== */
        .utility-section {
          display: flex;
          flex-wrap: wrap;
          gap: clamp(6px, 1.5vw, 10px);
          padding: clamp(12px, 3vw, 16px);
          border-bottom: 1px solid #eff3f4;
        }

        .utility-btn {
          display: flex;
          align-items: center;
          gap: clamp(6px, 1.5vw, 8px);
          padding: clamp(8px, 2vw, 10px) clamp(12px, 3vw, 16px);
          background: #f7f9fa;
          border: 1px solid #eff3f4;
          border-radius: clamp(8px, 2vw, 12px);
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          animation: popIn 0.2s ease-out backwards;
        }

        .utility-btn:hover {
          background: white;
          border-color: #1D9BF0;
        }

        .utility-btn.promoted {
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.1) 100%);
          border-color: #f59e0b;
        }

        .utility-icon {
          font-size: clamp(16px, 4vw, 18px);
        }

        .utility-label {
          font-size: clamp(12px, 3.2vw, 14px);
          font-weight: 500;
          color: #536471;
        }

        /* ===== Footer ===== */
        .fab-modal-footer {
          padding: clamp(12px, 3vw, 16px);
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

        /* ===== Settings Modal ===== */
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
          animation: modal-in 0.2s ease;
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

        /* ===== Desktop adjustments ===== */
        @media (min-width: 768px) {
          .fab-modal {
            width: 380px;
          }

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
