'use client'

import React, { Component, ReactNode } from 'react'

interface SafeModalProps {
  children: ReactNode
  /** Called when error boundary catches an error */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  /** Called when user clicks retry */
  onRetry?: () => void
  /** Called when user clicks dismiss/close */
  onDismiss?: () => void
  /** Custom fallback title */
  fallbackTitle?: string
  /** Custom fallback message */
  fallbackMessage?: string
}

interface SafeModalState {
  hasError: boolean
  error: Error | null
}

/**
 * SafeModal - React Error Boundary wrapper for complex modals
 *
 * Wrap your modal content with this component to prevent crashes
 * from taking down the entire page. If the modal crashes, users see
 * a friendly fallback UI instead of a white screen.
 *
 * Usage:
 * ```tsx
 * <SafeModal onDismiss={() => setShowModal(false)}>
 *   <TriageModal ... />
 * </SafeModal>
 * ```
 */
export default class SafeModal extends Component<SafeModalProps, SafeModalState> {
  constructor(props: SafeModalProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): SafeModalState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('SafeModal caught error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null })
    this.props.onRetry?.()
  }

  handleDismiss = (): void => {
    this.setState({ hasError: false, error: null })
    this.props.onDismiss?.()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const {
        fallbackTitle = "Something went wrong",
        fallbackMessage = "This feature hit a snag, but your data is safe."
      } = this.props

      return (
        <div className="safe-modal-fallback">
          <div className="fallback-content">
            <div className="fallback-icon">🛠️</div>
            <h2 className="fallback-title">{fallbackTitle}</h2>
            <p className="fallback-message">{fallbackMessage}</p>

            <div className="fallback-actions">
              <button onClick={this.handleRetry} className="retry-btn">
                Try again
              </button>
              {this.props.onDismiss && (
                <button onClick={this.handleDismiss} className="dismiss-btn">
                  Close
                </button>
              )}
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="fallback-details">
                <summary>Technical details</summary>
                <pre>{this.state.error.message}</pre>
              </details>
            )}
          </div>

          <style jsx>{`
            .safe-modal-fallback {
              display: flex;
              align-items: center;
              justify-content: center;
              padding: clamp(24px, 6vw, 40px);
              min-height: 300px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .fallback-content {
              max-width: 360px;
              width: 100%;
              text-align: center;
            }

            .fallback-icon {
              font-size: clamp(40px, 10vw, 56px);
              margin-bottom: clamp(12px, 3vw, 20px);
            }

            .fallback-title {
              font-size: clamp(18px, 4.5vw, 22px);
              font-weight: 700;
              color: #0f1419;
              margin: 0 0 clamp(8px, 2vw, 12px) 0;
            }

            .fallback-message {
              font-size: clamp(14px, 3.8vw, 16px);
              color: #536471;
              line-height: 1.5;
              margin: 0 0 clamp(20px, 5vw, 28px) 0;
            }

            .fallback-actions {
              display: flex;
              flex-direction: column;
              gap: clamp(10px, 2.5vw, 14px);
            }

            .retry-btn {
              width: 100%;
              padding: clamp(12px, 3vw, 16px);
              background: #1D9BF0;
              color: white;
              border: none;
              border-radius: 12px;
              font-size: clamp(15px, 4vw, 17px);
              font-weight: 600;
              cursor: pointer;
              transition: background 0.15s ease, transform 0.15s ease;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .retry-btn:hover {
              background: #1a8cd8;
              transform: translateY(-1px);
            }

            .dismiss-btn {
              background: none;
              border: none;
              color: #8899a6;
              font-size: clamp(14px, 3.8vw, 16px);
              cursor: pointer;
              padding: clamp(8px, 2vw, 12px);
              text-decoration: underline;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .dismiss-btn:hover {
              color: #536471;
            }

            .fallback-details {
              margin-top: clamp(20px, 5vw, 28px);
              padding: clamp(10px, 2.5vw, 14px);
              background: #f7f9fa;
              border-radius: 10px;
              text-align: left;
              font-size: 12px;
              color: #536471;
            }

            .fallback-details summary {
              cursor: pointer;
              font-weight: 600;
              margin-bottom: 6px;
            }

            .fallback-details pre {
              margin: 6px 0 0 0;
              padding: 10px;
              background: white;
              border-radius: 6px;
              overflow-x: auto;
              font-size: 11px;
              white-space: pre-wrap;
              word-break: break-word;
            }
          `}</style>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Functional wrapper for easier use with hooks
 * Use this when you need to pass hook-based callbacks
 */
export function withSafeModal<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: Omit<SafeModalProps, 'children'>
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component'

  const WithSafeModalComponent = (props: P) => (
    <SafeModal {...options}>
      <WrappedComponent {...props} />
    </SafeModal>
  )

  WithSafeModalComponent.displayName = `WithSafeModal(${displayName})`

  return WithSafeModalComponent
}
