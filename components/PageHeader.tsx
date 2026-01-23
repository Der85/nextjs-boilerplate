'use client'

import { useRouter } from 'next/navigation'

interface PageHeaderProps {
  title: string
  backPath?: string
  backLabel?: string
  showBack?: boolean
  rightAction?: React.ReactNode
}

export default function PageHeader({ 
  title, 
  backPath = '/dashboard',
  backLabel,
  showBack = true,
  rightAction
}: PageHeaderProps) {
  const router = useRouter()

  // Generate back label from path if not provided
  const getBackLabel = () => {
    if (backLabel) return backLabel
    
    const pathLabels: Record<string, string> = {
      '/dashboard': 'Home',
      '/tools': 'Tools',
      '/goals': 'Goals',
      '/village': 'Village',
      '/focus': 'Focus',
      '/ally': 'Ally',
      '/brake': 'Brake',
      '/burnout': 'Battery',
    }
    
    return pathLabels[backPath] || 'Back'
  }

  return (
    <header 
      className="bg-white border-b border-slate-200 sticky top-0 z-40"
      role="banner"
    >
      <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Back button */}
        {showBack ? (
          <button 
            onClick={() => router.push(backPath)}
            className="flex items-center gap-1 text-slate-600 hover:text-slate-800 font-medium text-sm min-w-[4rem]"
            aria-label={`Go back to ${getBackLabel()}`}
          >
            <svg 
              className="w-5 h-5" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M15 19l-7-7 7-7" 
              />
            </svg>
            <span>{getBackLabel()}</span>
          </button>
        ) : (
          <div className="w-16" />
        )}

        {/* Title */}
        <h1 className="text-lg font-semibold text-slate-800 text-center">
          {title}
        </h1>

        {/* Right action or spacer */}
        {rightAction ? (
          <div className="min-w-[4rem] flex justify-end">
            {rightAction}
          </div>
        ) : (
          <div className="w-16" />
        )}
      </div>
    </header>
  )
}
