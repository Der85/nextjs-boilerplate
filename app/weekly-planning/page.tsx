'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import UnifiedHeader from '@/components/UnifiedHeader'
import WeeklyPlanningWizard from '@/components/WeeklyPlanningWizard'
import type { WeeklyPlanFull } from '@/lib/types/weekly-planning'

export default function WeeklyPlanningPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [showSuccessToast, setShowSuccessToast] = useState(false)
  const [completedPlan, setCompletedPlan] = useState<WeeklyPlanFull | null>(null)

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setLoading(false)
    }
    checkAuth()
  }, [router, supabase])

  // Handle close - redirect to dashboard
  const handleClose = () => {
    router.push('/dashboard')
  }

  // Handle completion - show toast and redirect
  const handleComplete = (plan: WeeklyPlanFull) => {
    setCompletedPlan(plan)
    setShowSuccessToast(true)

    // Redirect after showing toast
    setTimeout(() => {
      router.push('/dashboard')
    }, 2500)
  }

  if (loading) {
    return (
      <div className="loading-page">
        <div className="loading-content">
          <div className="loading-spinner" />
          <p>Loading weekly planning...</p>
        </div>
        <style jsx>{`
          .loading-page {
            min-height: 100vh;
            min-height: 100dvh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(180deg, #f7f9fa 0%, #fff 100%);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          .loading-content {
            text-align: center;
          }
          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #eff3f4;
            border-top-color: #1D9BF0;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin: 0 auto 16px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          .loading-content p {
            color: #536471;
            font-size: 15px;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="weekly-planning-page">
      <UnifiedHeader subtitle="Weekly Planning" />

      <main className="main-content">
        <WeeklyPlanningWizard
          onClose={handleClose}
          onComplete={handleComplete}
        />
      </main>

      {/* Success Toast */}
      {showSuccessToast && (
        <div className="success-toast">
          <div className="toast-content">
            <span className="toast-icon">🎯</span>
            <div className="toast-text">
              <strong>Week planned!</strong>
              <span>
                {completedPlan?.outcomes.length || 0} outcomes,{' '}
                {completedPlan?.tasks.length || 0} tasks ready
              </span>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .weekly-planning-page {
          min-height: 100vh;
          min-height: 100dvh;
          background: linear-gradient(180deg, #f7f9fa 0%, #fff 100%);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .main-content {
          max-width: 800px;
          margin: 0 auto;
          padding: clamp(16px, 4vw, 24px);
        }

        /* Success Toast */
        .success-toast {
          position: fixed;
          top: clamp(80px, 15vw, 100px);
          left: 50%;
          transform: translateX(-50%);
          z-index: 1000;
          animation: slideDown 0.3s ease, fadeOut 0.3s ease 2s forwards;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }

        .toast-content {
          display: flex;
          align-items: center;
          gap: clamp(12px, 3vw, 16px);
          background: white;
          padding: clamp(14px, 3.5vw, 18px) clamp(18px, 4.5vw, 24px);
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
          border: 1px solid #eff3f4;
        }

        .toast-icon {
          font-size: clamp(28px, 7vw, 36px);
          flex-shrink: 0;
        }

        .toast-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .toast-text strong {
          font-size: clamp(16px, 4.5vw, 18px);
          font-weight: 700;
          color: #0f1419;
        }

        .toast-text span {
          font-size: clamp(13px, 3.5vw, 15px);
          color: #536471;
        }
      `}</style>
    </div>
  )
}
