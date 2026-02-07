'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

interface MorningSleepCardProps {
  userId: string
  onDismiss: () => void
}

export default function MorningSleepCard({ userId, onDismiss }: MorningSleepCardProps) {
  const supabase = createClient()
  const [sleepValue, setSleepValue] = useState(5)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    await supabase.from('burnout_logs').insert({
      user_id: userId,
      sleep_quality: sleepValue,
      source: 'morning_key',
    })
    setSaving(false)
    onDismiss()
  }

  return (
    <>
      <div className="morning-overlay">
        <div className="morning-card">
          <span className="morning-emoji">🌅</span>
          <h2 className="morning-title">How did we sleep?</h2>
          <p className="morning-subtitle">Quick check before you start your day</p>

          <div className="morning-slider-wrap">
            <input
              type="range"
              min="1"
              max="10"
              value={sleepValue}
              onChange={(e) => setSleepValue(Number(e.target.value))}
              className="morning-slider"
            />
            <div className="morning-labels">
              <span>Terrible</span>
              <span className="morning-value">{sleepValue}/10</span>
              <span>Great</span>
            </div>
          </div>

          <button
            onClick={handleSave}
            className="morning-btn"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Log Sleep'}
          </button>
          <button onClick={onDismiss} className="morning-skip">
            Skip
          </button>
        </div>
      </div>

      <style jsx>{`
        .morning-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          padding: clamp(16px, 4vw, 24px);
          animation: morningFadeIn 0.3s ease;
        }

        .morning-card {
          background: white;
          border-radius: clamp(20px, 5vw, 28px);
          padding: clamp(28px, 7vw, 40px);
          max-width: 400px;
          width: 100%;
          text-align: center;
          animation: morningSlideUp 0.4s ease;
        }

        .morning-emoji {
          font-size: clamp(48px, 14vw, 64px);
          display: block;
          margin-bottom: clamp(14px, 4vw, 20px);
        }

        .morning-title {
          font-size: clamp(20px, 5.5vw, 26px);
          font-weight: 700;
          margin: 0 0 clamp(6px, 1.5vw, 10px) 0;
          color: #0f1419;
        }

        .morning-subtitle {
          font-size: clamp(14px, 3.8vw, 16px);
          color: #536471;
          margin: 0 0 clamp(24px, 6vw, 32px) 0;
        }

        .morning-slider-wrap {
          margin-bottom: clamp(20px, 5vw, 28px);
        }

        .morning-slider {
          width: 100%;
          height: 6px;
          -webkit-appearance: none;
          appearance: none;
          background: linear-gradient(to right, #f4212e, #ffad1f, #00ba7c);
          border-radius: 100px;
          outline: none;
          margin-bottom: clamp(10px, 2.5vw, 14px);
        }

        .morning-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: clamp(24px, 6.5vw, 32px);
          height: clamp(24px, 6.5vw, 32px);
          border-radius: 50%;
          background: white;
          border: 3px solid #1D9BF0;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }

        .morning-slider::-moz-range-thumb {
          width: clamp(24px, 6.5vw, 32px);
          height: clamp(24px, 6.5vw, 32px);
          border-radius: 50%;
          background: white;
          border: 3px solid #1D9BF0;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }

        .morning-labels {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: clamp(12px, 3.2vw, 14px);
          color: #8899a6;
        }

        .morning-value {
          font-size: clamp(18px, 5vw, 24px);
          font-weight: 700;
          color: #1D9BF0;
        }

        .morning-btn {
          width: 100%;
          padding: clamp(14px, 4vw, 18px);
          background: linear-gradient(135deg, #ffad1f 0%, #f59e0b 100%);
          color: white;
          border: none;
          border-radius: 100px;
          font-size: clamp(15px, 4.2vw, 18px);
          font-weight: 700;
          cursor: pointer;
          margin-bottom: clamp(8px, 2vw, 12px);
          box-shadow: 0 4px 14px rgba(245, 158, 11, 0.3);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .morning-btn:disabled { opacity: 0.7; cursor: wait; }

        .morning-skip {
          width: 100%;
          padding: clamp(10px, 2.5vw, 14px);
          background: none;
          border: none;
          font-size: clamp(13px, 3.5vw, 15px);
          color: #536471;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        @keyframes morningFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes morningSlideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
