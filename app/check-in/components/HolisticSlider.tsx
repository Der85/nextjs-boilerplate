'use client'

import { useState, useRef, useCallback } from 'react'

interface HolisticSliderProps {
  onSelect: (moodScore: number, energyLevel: number) => void
  yesterdayMood: number | null
}

const getQuadrantLabel = (x: number, y: number): { label: string; emoji: string } => {
  // x = 0-1 (mood: unpleasant→pleasant), y = 0-1 (energy: low→high)
  if (x >= 0.5 && y >= 0.5) return { label: 'Thriving', emoji: '🚀' }
  if (x < 0.5 && y >= 0.5) return { label: 'Anxious', emoji: '⚡' }
  if (x >= 0.5 && y < 0.5) return { label: 'Chill', emoji: '😌' }
  return { label: 'Burned Out', emoji: '🪫' }
}

const getQuadrantColor = (x: number, y: number): string => {
  if (x >= 0.5 && y >= 0.5) return '#00ba7c' // green - thriving
  if (x < 0.5 && y >= 0.5) return '#f4212e' // red - anxious
  if (x >= 0.5 && y < 0.5) return '#1D9BF0' // blue - chill
  return '#805ad5' // purple - burned out
}

export default function HolisticSlider({ onSelect, yesterdayMood }: HolisticSliderProps) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)

  const getPositionFromEvent = useCallback((clientX: number, clientY: number) => {
    if (!gridRef.current) return null
    const rect = gridRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height)) // invert Y (top=high)
    return { x, y }
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const pos = getPositionFromEvent(e.clientX, e.clientY)
    if (pos) {
      setPosition(pos)
      setIsDragging(true)
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    }
    if ('vibrate' in navigator) navigator.vibrate(10)
  }, [getPositionFromEvent])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return
    const pos = getPositionFromEvent(e.clientX, e.clientY)
    if (pos) setPosition(pos)
  }, [isDragging, getPositionFromEvent])

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleConfirm = () => {
    if (!position) return
    const moodScore = Math.round(position.x * 10) // 0-10
    const energyLevel = Math.round(position.y * 4) // 0-4
    onSelect(moodScore, energyLevel)
  }

  const moodScore = position ? Math.round(position.x * 10) : null
  const energyLevel = position ? Math.round(position.y * 4) : null
  const quadrant = position ? getQuadrantLabel(position.x, position.y) : null
  const quadrantColor = position ? getQuadrantColor(position.x, position.y) : '#8899a6'

  return (
    <div className="holistic-screen">
      <div className="holistic-content">
        <h2 className="holistic-title">How are you right now?</h2>
        <p className="holistic-subtitle">Tap or drag to place yourself on the grid</p>

        {yesterdayMood !== null && (
          <div className="yesterday-badge">
            Yesterday's mood: {yesterdayMood}/10
          </div>
        )}

        {/* Result display */}
        <div className="result-display" style={{ visibility: position ? 'visible' : 'hidden' }}>
          <span className="result-emoji">{quadrant?.emoji || '🎯'}</span>
          <span className="result-label" style={{ color: quadrantColor }}>
            {quadrant?.label || ''}
          </span>
        </div>

        {/* The 2D Grid */}
        <div className="grid-wrapper">
          {/* Y-axis label */}
          <div className="axis-label y-axis">
            <span className="axis-high">⚡ High</span>
            <span className="axis-low">🪫 Low</span>
          </div>

          <div className="grid-area">
            {/* Quadrant background colors */}
            <div className="quadrant-bg">
              <div className="q tl" />
              <div className="q tr" />
              <div className="q bl" />
              <div className="q br" />
            </div>

            {/* Corner labels */}
            <div className="corner-labels">
              <span className="corner tl">⚡ Anxious</span>
              <span className="corner tr">🚀 Thriving</span>
              <span className="corner bl">🪫 Burned Out</span>
              <span className="corner br">😌 Chill</span>
            </div>

            {/* Interaction area */}
            <div
              ref={gridRef}
              className="grid-touch"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              style={{ touchAction: 'none' }}
            >
              {/* Crosshair lines */}
              <div className="crosshair-h" />
              <div className="crosshair-v" />

              {/* The dot */}
              {position && (
                <div
                  className={`dot ${isDragging ? 'dragging' : ''}`}
                  style={{
                    left: `${position.x * 100}%`,
                    bottom: `${position.y * 100}%`,
                    backgroundColor: quadrantColor,
                    boxShadow: `0 0 0 ${isDragging ? '12px' : '6px'} ${quadrantColor}30`,
                  }}
                />
              )}
            </div>
          </div>

          {/* X-axis label */}
          <div className="axis-label x-axis">
            <span className="axis-low">😢 Unpleasant</span>
            <span className="axis-high">😄 Pleasant</span>
          </div>
        </div>

        {/* Mapped values */}
        {position && (
          <div className="values-row">
            <div className="value-chip">
              <span className="value-label">Mood</span>
              <span className="value-number" style={{ color: quadrantColor }}>{moodScore}/10</span>
            </div>
            <div className="value-chip">
              <span className="value-label">Energy</span>
              <span className="value-number" style={{ color: quadrantColor }}>
                {['Depleted', 'Low', 'Moderate', 'High', 'Overflowing'][energyLevel!]}
              </span>
            </div>
          </div>
        )}

        {/* Confirm button */}
        <button
          className="confirm-btn"
          disabled={!position}
          onClick={handleConfirm}
          style={{
            background: position ? quadrantColor : '#e5e7eb',
          }}
        >
          {position ? `I'm feeling ${quadrant?.label} →` : 'Tap the grid above'}
        </button>
      </div>

      <style jsx>{`
        .holistic-screen {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(16px, 4vw, 24px);
          background: #f7f9fa;
        }

        .holistic-content {
          text-align: center;
          max-width: 500px;
          width: 100%;
        }

        .holistic-title {
          font-size: clamp(22px, 6vw, 28px);
          font-weight: 700;
          color: #0f1419;
          margin: 0 0 clamp(6px, 1.5vw, 10px) 0;
        }

        .holistic-subtitle {
          font-size: clamp(14px, 3.8vw, 16px);
          color: #536471;
          margin: 0 0 clamp(12px, 3vw, 18px) 0;
        }

        .yesterday-badge {
          display: inline-block;
          padding: clamp(4px, 1.5vw, 8px) clamp(10px, 3vw, 16px);
          background: rgba(255, 255, 255, 0.9);
          border-radius: 100px;
          font-size: clamp(12px, 3.2vw, 14px);
          font-weight: 600;
          color: #536471;
          margin-bottom: clamp(12px, 3vw, 18px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .result-display {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: clamp(8px, 2vw, 12px);
          margin-bottom: clamp(12px, 3vw, 18px);
          animation: fadeIn 0.2s ease;
        }

        .result-emoji {
          font-size: clamp(32px, 8vw, 44px);
        }

        .result-label {
          font-size: clamp(20px, 5.5vw, 26px);
          font-weight: 800;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }

        /* Grid wrapper */
        .grid-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: clamp(6px, 1.5vw, 10px);
          margin-bottom: clamp(16px, 4vw, 24px);
        }

        .axis-label {
          display: flex;
          justify-content: space-between;
          width: 100%;
          max-width: clamp(260px, 70vw, 340px);
          font-size: clamp(11px, 3vw, 13px);
          color: #8899a6;
          font-weight: 500;
        }

        .axis-label.y-axis {
          flex-direction: column;
          position: absolute;
          left: clamp(-48px, -12vw, -60px);
          top: 0;
          bottom: 0;
          width: auto;
          max-width: none;
          justify-content: space-between;
          align-items: flex-end;
          padding: clamp(4px, 1vw, 8px) 0;
        }

        .axis-label.x-axis {
          padding: 0 clamp(4px, 1vw, 8px);
        }

        /* Grid area */
        .grid-area {
          position: relative;
          width: clamp(260px, 70vw, 340px);
          height: clamp(260px, 70vw, 340px);
          margin-left: clamp(48px, 12vw, 60px);
        }

        .quadrant-bg {
          position: absolute;
          inset: 0;
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          border-radius: clamp(16px, 4vw, 24px);
          overflow: hidden;
        }

        .q { transition: opacity 0.2s ease; }
        .q.tl { background: rgba(244, 33, 46, 0.06); }
        .q.tr { background: rgba(0, 186, 124, 0.06); }
        .q.bl { background: rgba(128, 90, 213, 0.06); }
        .q.br { background: rgba(29, 155, 240, 0.06); }

        .corner-labels {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 1;
        }

        .corner {
          position: absolute;
          font-size: clamp(10px, 2.8vw, 12px);
          color: #8899a6;
          font-weight: 500;
          padding: clamp(6px, 2vw, 10px);
          opacity: 0.7;
        }

        .corner.tl { top: 0; left: 0; }
        .corner.tr { top: 0; right: 0; text-align: right; }
        .corner.bl { bottom: 0; left: 0; }
        .corner.br { bottom: 0; right: 0; text-align: right; }

        /* Touch area */
        .grid-touch {
          position: absolute;
          inset: 0;
          border-radius: clamp(16px, 4vw, 24px);
          border: 2px solid #e5e7eb;
          cursor: crosshair;
          z-index: 2;
          overflow: hidden;
        }

        .crosshair-h,
        .crosshair-v {
          position: absolute;
          background: rgba(0, 0, 0, 0.06);
        }

        .crosshair-h {
          left: 0;
          right: 0;
          top: 50%;
          height: 1px;
        }

        .crosshair-v {
          top: 0;
          bottom: 0;
          left: 50%;
          width: 1px;
        }

        /* The draggable dot */
        .dot {
          position: absolute;
          width: clamp(28px, 7vw, 36px);
          height: clamp(28px, 7vw, 36px);
          border-radius: 50%;
          border: 3px solid white;
          transform: translate(-50%, 50%);
          transition: box-shadow 0.2s ease, width 0.15s ease, height 0.15s ease;
          z-index: 10;
          pointer-events: none;
        }

        .dot.dragging {
          width: clamp(36px, 9vw, 44px);
          height: clamp(36px, 9vw, 44px);
        }

        /* Values */
        .values-row {
          display: flex;
          justify-content: center;
          gap: clamp(12px, 3vw, 18px);
          margin-bottom: clamp(16px, 4vw, 24px);
          animation: fadeIn 0.3s ease;
        }

        .value-chip {
          background: white;
          padding: clamp(8px, 2vw, 12px) clamp(14px, 4vw, 20px);
          border-radius: clamp(10px, 2.5vw, 14px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: clamp(2px, 0.5vw, 4px);
        }

        .value-label {
          font-size: clamp(11px, 3vw, 13px);
          color: #8899a6;
          font-weight: 500;
        }

        .value-number {
          font-size: clamp(14px, 3.8vw, 17px);
          font-weight: 700;
        }

        /* Confirm button */
        .confirm-btn {
          width: 100%;
          padding: clamp(14px, 4vw, 18px);
          color: white;
          border: none;
          border-radius: clamp(12px, 3vw, 16px);
          font-size: clamp(16px, 4.5vw, 19px);
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .confirm-btn:disabled {
          color: #8899a6;
          cursor: not-allowed;
        }

        .confirm-btn:not(:disabled):active {
          transform: scale(0.98);
        }
      `}</style>
    </div>
  )
}
