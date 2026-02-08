'use client'

import React, { Component, ReactNode } from 'react'
import { saveEmergencyState, clearEmergencyState, getEmergencyStateInfo } from '@/lib/emergencyState'

interface StateSavingErrorBoundaryProps {
  children: ReactNode
  /**
   * Unique identifier for this error boundary instance.
   * Used to persist and recover state across crashes.
   */
  componentName: string
  /**
   * Function to get current state from the wrapped component.
   * Called just before showing error fallback to save progress.
   */
  getState?: () => unknown
  /**
   * Called when error boundary catches an error (after state is saved)
   */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  /**
   * Called when user clicks retry - receives recovered state if available
   */
  onRetry?: (recoveredState?: unknown) => void
  /**
   * Called when user clicks dismiss/close
   */
  onDismiss?: () => void
  /**
   * Custom fallback title
   */
  fallbackTitle?: string
  /**
   * Custom fallback message
   */
  fallbackMessage?: string
  /**
   * Whether to show recovery option when emergency state exists
   */
  showRecoveryOption?: boolean
}

interface StateSavingErrorBoundaryState {
  hasError: boolean
  error: Error | null
  hasRecoverableState: boolean
}

/**
 * StateSavingErrorBoundary - Error Boundary that saves state before crashing
 *
 * For ADHD users, losing work is devastating. This error boundary ensures
 * that if a component crashes, the user's progress is saved to localStorage
 * and can be recovered when they retry.
 *
 * Usage:
 * ```tsx
 * const [formState, setFormState] = useState(initialState)
 *
 * <StateSavingErrorBoundary
 *   componentName="TaskEntryForm"
 *   getState={() => formState}
 *   onRetry={(recovered) => {
 *     if (recovered) setFormState(recovered)
 *   }}
 * >
 *   <TaskEntryForm state={formState} onChange={setFormState} />
 * </StateSavingErrorBoundary>
 * ```
 */
export default class StateSavingErrorBoundary extends Component<
  StateSavingErrorBoundaryProps,
  StateSavingErrorBoundaryState
> {
  constructor(props: StateSavingErrorBoundaryProps) {
    super(props)
    // Check if there's recoverable state on mount
    const info = getEmergencyStateInfo(props.componentName)
    this.state = {
      hasError: false,
      error: null,
      hasRecoverableState: info.exists,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<StateSavingErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Save state BEFORE doing anything else
    if (this.props.getState) {
      try {
        const currentState = this.props.getState()
        saveEmergencyState(this.props.componentName, currentState, error)
        this.setState({ hasRecoverableState: true })
      } catch (e) {
        console.error('[StateSavingErrorBoundary] Failed to get state:', e)
      }
    }

    console.error(`[StateSavingErrorBoundary:${this.props.componentName}] Caught error:`, error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  handleRetry = (): void => {
    // Try to recover state
    let recoveredState: unknown = undefined
    if (this.state.hasRecoverableState) {
      try {
        const info = getEmergencyStateInfo(this.props.componentName)
        if (info.exists) {
          // Import dynamically to avoid SSR issues
          import('@/lib/emergencyState').then(({ loadEmergencyState }) => {
            recoveredState = loadEmergencyState(this.props.componentName)
          })
        }
      } catch (e) {
        console.error('[StateSavingErrorBoundary] Failed to recover state:', e)
      }
    }

    this.setState({ hasError: false, error: null })
    this.props.onRetry?.(recoveredState)

    // Clear emergency state after successful retry
    clearEmergencyState(this.props.componentName)
  }

  handleDismiss = (): void => {
    this.setState({ hasError: false, error: null })
    this.props.onDismiss?.()
    // Keep emergency state - user might want to recover later
  }

  handleClearAndDismiss = (): void => {
    clearEmergencyState(this.props.componentName)
    this.setState({ hasError: false, error: null, hasRecoverableState: false })
    this.props.onDismiss?.()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const {
        fallbackTitle = "Something went wrong",
        fallbackMessage = "Don't worry - your progress has been saved.",
        showRecoveryOption = true,
      } = this.props

      const recoveryInfo = getEmergencyStateInfo(this.props.componentName)
      const showRecovery = showRecoveryOption && recoveryInfo.exists

      return (
        <div className="state-saving-error-boundary">
          <div className="boundary-content">
            <div className="boundary-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 9v4m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <h2 className="boundary-title">{fallbackTitle}</h2>
            <p className="boundary-message">{fallbackMessage}</p>

            {showRecovery && recoveryInfo.savedAt && (
              <div className="recovery-notice">
                <span className="recovery-icon">💾</span>
                <span>Progress saved {this.formatTimeAgo(recoveryInfo.savedAt)}</span>
              </div>
            )}

            <div className="boundary-actions">
              <button onClick={this.handleRetry} className="retry-btn">
                {showRecovery ? 'Recover & Retry' : 'Try Again'}
              </button>

              {this.props.onDismiss && (
                <button onClick={this.handleDismiss} className="dismiss-btn">
                  Close (keep saved progress)
                </button>
              )}

              {showRecovery && (
                <button onClick={this.handleClearAndDismiss} className="clear-btn">
                  Start fresh
                </button>
              )}
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="boundary-details">
                <summary>Technical details (dev only)</summary>
                <pre>{this.state.error.message}</pre>
                <pre className="stack-trace">{this.state.error.stack}</pre>
              </details>
            )}
          </div>

          <style jsx>{`
            .state-saving-error-boundary {
              display: flex;
              align-items: center;
              justify-content: center;
              padding: clamp(24px, 6vw, 40px);
              min-height: 300px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: rgba(26, 26, 46, 0.95);
              border-radius: 16px;
              color: #e4e4f0;
            }

            .boundary-content {
              max-width: 400px;
              width: 100%;
              text-align: center;
            }

            .boundary-icon {
              margin-bottom: 20px;
            }

            .boundary-title {
              font-size: clamp(18px, 4.5vw, 22px);
              font-weight: 700;
              color: #ffffff;
              margin: 0 0 12px 0;
            }

            .boundary-message {
              font-size: clamp(14px, 3.8vw, 16px);
              color: #a0a0b8;
              line-height: 1.5;
              margin: 0 0 20px 0;
            }

            .recovery-notice {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              padding: 12px 16px;
              background: rgba(34, 197, 94, 0.15);
              border: 1px solid rgba(34, 197, 94, 0.3);
              border-radius: 10px;
              font-size: 14px;
              color: #22c55e;
              margin-bottom: 24px;
            }

            .recovery-icon {
              font-size: 16px;
            }

            .boundary-actions {
              display: flex;
              flex-direction: column;
              gap: 12px;
            }

            .retry-btn {
              width: 100%;
              padding: 14px 20px;
              background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
              color: white;
              border: none;
              border-radius: 12px;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              transition: transform 0.15s ease, box-shadow 0.15s ease;
              font-family: inherit;
            }

            .retry-btn:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
            }

            .retry-btn:active {
              transform: translateY(0);
            }

            .dismiss-btn {
              background: rgba(255, 255, 255, 0.1);
              border: 1px solid rgba(255, 255, 255, 0.2);
              color: #a0a0b8;
              font-size: 14px;
              cursor: pointer;
              padding: 12px;
              border-radius: 10px;
              font-family: inherit;
              transition: background 0.15s ease;
            }

            .dismiss-btn:hover {
              background: rgba(255, 255, 255, 0.15);
              color: #e4e4f0;
            }

            .clear-btn {
              background: none;
              border: none;
              color: #6b6b80;
              font-size: 13px;
              cursor: pointer;
              padding: 8px;
              text-decoration: underline;
              font-family: inherit;
            }

            .clear-btn:hover {
              color: #a0a0b8;
            }

            .boundary-details {
              margin-top: 24px;
              padding: 14px;
              background: rgba(0, 0, 0, 0.3);
              border-radius: 10px;
              text-align: left;
              font-size: 12px;
              color: #6b6b80;
            }

            .boundary-details summary {
              cursor: pointer;
              font-weight: 600;
              margin-bottom: 8px;
              color: #a0a0b8;
            }

            .boundary-details pre {
              margin: 8px 0 0 0;
              padding: 10px;
              background: rgba(0, 0, 0, 0.4);
              border-radius: 6px;
              overflow-x: auto;
              font-size: 11px;
              white-space: pre-wrap;
              word-break: break-word;
              color: #ff6b6b;
              font-family: 'Monaco', 'Menlo', monospace;
            }

            .stack-trace {
              color: #6b6b80;
              margin-top: 8px;
            }
          `}</style>
        </div>
      )
    }

    return this.props.children
  }

  private formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
    return `${Math.floor(seconds / 86400)} days ago`
  }
}

/**
 * Hook-friendly wrapper for functional components
 */
export function withStateSavingBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: Omit<StateSavingErrorBoundaryProps, 'children'>
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component'

  const WithStateSavingBoundaryComponent = (props: P) => (
    <StateSavingErrorBoundary {...options}>
      <WrappedComponent {...props} />
    </StateSavingErrorBoundary>
  )

  WithStateSavingBoundaryComponent.displayName = `WithStateSavingBoundary(${displayName})`

  return WithStateSavingBoundaryComponent
}
