'use client'

import { useState } from 'react'
import QuickCapture from './QuickCapture'

interface MobileCaptureButtonProps {
  onCaptured?: () => void
}

export default function MobileCaptureButton({ onCaptured }: MobileCaptureButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        className="mobile-capture-btn"
        onClick={() => setIsOpen(true)}
        aria-label="Quick capture"
      >
        <span className="capture-icon">+</span>
      </button>

      <QuickCapture
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onCaptured={onCaptured}
        source="mobile"
      />

      <style jsx>{`
        .mobile-capture-btn {
          position: fixed;
          bottom: 90px;
          right: 20px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, #1D9BF0, #0284c7);
          border: none;
          box-shadow: 0 4px 20px rgba(29, 155, 240, 0.4);
          cursor: pointer;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .mobile-capture-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 24px rgba(29, 155, 240, 0.5);
        }

        .mobile-capture-btn:active {
          transform: scale(0.95);
        }

        .capture-icon {
          font-size: 28px;
          font-weight: 300;
          color: white;
          line-height: 1;
        }

        /* Hide on desktop */
        @media (min-width: 768px) {
          .mobile-capture-btn {
            display: none;
          }
        }
      `}</style>
    </>
  )
}
