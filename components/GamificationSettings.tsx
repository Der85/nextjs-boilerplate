'use client'

import { useState } from 'react'
import { useGamificationPrefs } from '@/context/GamificationPrefsContext'

interface GamificationSettingsProps {
  onClose?: () => void
}

export default function GamificationSettings({ onClose }: GamificationSettingsProps) {
  const {
    prefs,
    toggleXP,
    toggleBadges,
    toggleStreaks,
    toggleAll,
    isAnyEnabled,
    addMaintenanceDay,
    canAddMaintenanceDay,
    maintenanceDaysThisWeek,
  } = useGamificationPrefs()
  const [maintenanceAdded, setMaintenanceAdded] = useState(false)

  const handleAddMaintenanceDay = () => {
    const success = addMaintenanceDay()
    if (success) {
      setMaintenanceAdded(true)
    }
  }

  return (
    <div className="gam-settings">
      <div className="gam-settings-header">
        <h3 className="gam-settings-title">Gamification</h3>
        <p className="gam-settings-subtitle">
          Some people find XP and streaks motivating. Others find them stressful. It&apos;s okay either way.
        </p>
      </div>

      <div className="gam-settings-options">
        {/* Master toggle */}
        <div className="gam-option master">
          <div className="gam-option-content">
            <span className="gam-option-icon">🎮</span>
            <div className="gam-option-text">
              <span className="gam-option-label">Enable All</span>
              <span className="gam-option-desc">Turn all gamification on or off</span>
            </div>
          </div>
          <button
            className={`toggle-btn ${isAnyEnabled ? 'on' : 'off'}`}
            onClick={() => toggleAll(!isAnyEnabled)}
            aria-label={isAnyEnabled ? 'Disable all gamification' : 'Enable all gamification'}
          >
            <span className="toggle-slider" />
          </button>
        </div>

        <div className="gam-divider" />

        {/* XP toggle */}
        <div className="gam-option">
          <div className="gam-option-content">
            <span className="gam-option-icon">⭐</span>
            <div className="gam-option-text">
              <span className="gam-option-label">XP & Levels</span>
              <span className="gam-option-desc">Experience points, level progress bars</span>
            </div>
          </div>
          <button
            className={`toggle-btn ${prefs.showXP ? 'on' : 'off'}`}
            onClick={toggleXP}
            aria-label={prefs.showXP ? 'Hide XP' : 'Show XP'}
          >
            <span className="toggle-slider" />
          </button>
        </div>

        {/* Badges toggle */}
        <div className="gam-option">
          <div className="gam-option-content">
            <span className="gam-option-icon">🏆</span>
            <div className="gam-option-text">
              <span className="gam-option-label">Badges</span>
              <span className="gam-option-desc">Achievement unlocks, badge collections</span>
            </div>
          </div>
          <button
            className={`toggle-btn ${prefs.showBadges ? 'on' : 'off'}`}
            onClick={toggleBadges}
            aria-label={prefs.showBadges ? 'Hide badges' : 'Show badges'}
          >
            <span className="toggle-slider" />
          </button>
        </div>

        {/* Streaks toggle */}
        <div className="gam-option">
          <div className="gam-option-content">
            <span className="gam-option-icon">🔥</span>
            <div className="gam-option-text">
              <span className="gam-option-label">Streaks</span>
              <span className="gam-option-desc">Fire emoji, streak counts, streak messages</span>
            </div>
          </div>
          <button
            className={`toggle-btn ${prefs.showStreaks ? 'on' : 'off'}`}
            onClick={toggleStreaks}
            aria-label={prefs.showStreaks ? 'Hide streaks' : 'Show streaks'}
          >
            <span className="toggle-slider" />
          </button>
        </div>

        <div className="gam-divider" />

        {/* Maintenance Day Section */}
        <div className="maintenance-section">
          <div className="maintenance-header">
            <span className="gam-option-icon">🌿</span>
            <div className="gam-option-text">
              <span className="gam-option-label">Maintenance Day</span>
              <span className="gam-option-desc">
                Take a rest day without breaking your streak. {maintenanceDaysThisWeek}/2 used this week.
              </span>
            </div>
          </div>
          {maintenanceAdded ? (
            <div className="maintenance-success">
              <span className="success-icon">✓</span>
              <span className="success-text">Today is a maintenance day. Rest well.</span>
            </div>
          ) : canAddMaintenanceDay() ? (
            <button className="maintenance-btn" onClick={handleAddMaintenanceDay}>
              Take Today Off
            </button>
          ) : (
            <div className="maintenance-limit">
              <span className="limit-text">You&apos;ve used your rest days this week</span>
            </div>
          )}
        </div>
      </div>

      {onClose && (
        <button className="gam-done-btn" onClick={onClose}>
          Done
        </button>
      )}

      <style jsx>{`
        .gam-settings {
          width: 100%;
        }

        .gam-settings-header {
          margin-bottom: clamp(16px, 4vw, 24px);
        }

        .gam-settings-title {
          font-size: clamp(18px, 5vw, 22px);
          font-weight: 700;
          color: #0f1419;
          margin: 0 0 clamp(6px, 1.5vw, 8px) 0;
        }

        .gam-settings-subtitle {
          font-size: clamp(13px, 3.5vw, 15px);
          color: #536471;
          margin: 0;
          line-height: 1.5;
        }

        .gam-settings-options {
          display: flex;
          flex-direction: column;
          gap: clamp(12px, 3vw, 16px);
        }

        .gam-option {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: clamp(12px, 3vw, 16px);
          background: #f7f9fa;
          border-radius: clamp(10px, 2.5vw, 14px);
        }

        .gam-option.master {
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border: 1px solid #bae6fd;
        }

        .gam-option-content {
          display: flex;
          align-items: center;
          gap: clamp(10px, 2.5vw, 14px);
        }

        .gam-option-icon {
          font-size: clamp(20px, 5vw, 26px);
          line-height: 1;
        }

        .gam-option-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .gam-option-label {
          font-size: clamp(14px, 3.8vw, 16px);
          font-weight: 600;
          color: #0f1419;
        }

        .gam-option-desc {
          font-size: clamp(11px, 3vw, 13px);
          color: #536471;
        }

        .gam-divider {
          height: 1px;
          background: #e5e7eb;
          margin: clamp(4px, 1vw, 8px) 0;
        }

        /* Toggle button styles */
        .toggle-btn {
          position: relative;
          width: clamp(44px, 12vw, 52px);
          height: clamp(26px, 7vw, 30px);
          border-radius: 100px;
          border: none;
          cursor: pointer;
          transition: background 0.2s ease;
          flex-shrink: 0;
        }

        .toggle-btn.on {
          background: #00ba7c;
        }

        .toggle-btn.off {
          background: #d1d5db;
        }

        .toggle-slider {
          position: absolute;
          top: 3px;
          width: clamp(20px, 5.5vw, 24px);
          height: clamp(20px, 5.5vw, 24px);
          border-radius: 50%;
          background: white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          transition: left 0.2s ease;
        }

        .toggle-btn.on .toggle-slider {
          left: calc(100% - clamp(23px, 6vw, 27px));
        }

        .toggle-btn.off .toggle-slider {
          left: 3px;
        }

        /* Maintenance Day Section */
        .maintenance-section {
          padding: clamp(14px, 3.5vw, 18px);
          background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
          border: 1px solid #a7f3d0;
          border-radius: clamp(10px, 2.5vw, 14px);
        }

        .maintenance-header {
          display: flex;
          align-items: flex-start;
          gap: clamp(10px, 2.5vw, 14px);
          margin-bottom: clamp(12px, 3vw, 16px);
        }

        .maintenance-btn {
          width: 100%;
          padding: clamp(12px, 3vw, 16px);
          background: #059669;
          color: white;
          border: none;
          border-radius: clamp(8px, 2vw, 12px);
          font-size: clamp(14px, 3.8vw, 16px);
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .maintenance-btn:hover {
          background: #047857;
        }

        .maintenance-btn:active {
          transform: scale(0.98);
        }

        .maintenance-success {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: clamp(8px, 2vw, 12px);
          padding: clamp(12px, 3vw, 16px);
          background: white;
          border-radius: clamp(8px, 2vw, 12px);
        }

        .success-icon {
          font-size: clamp(18px, 4.5vw, 22px);
          color: #059669;
        }

        .success-text {
          font-size: clamp(13px, 3.5vw, 15px);
          font-weight: 500;
          color: #059669;
        }

        .maintenance-limit {
          padding: clamp(10px, 2.5vw, 14px);
          background: rgba(255, 255, 255, 0.7);
          border-radius: clamp(8px, 2vw, 12px);
          text-align: center;
        }

        .limit-text {
          font-size: clamp(12px, 3.2vw, 14px);
          color: #536471;
        }

        .gam-done-btn {
          width: 100%;
          margin-top: clamp(20px, 5vw, 28px);
          padding: clamp(14px, 3.5vw, 18px);
          background: #0f1419;
          color: white;
          border: none;
          border-radius: clamp(10px, 2.5vw, 14px);
          font-size: clamp(15px, 4vw, 17px);
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .gam-done-btn:hover {
          background: #2f3336;
        }
      `}</style>
    </div>
  )
}
