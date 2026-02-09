'use client'

import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  padding?: string
}

export default function Card({ children, className = '', onClick, padding }: CardProps) {
  return (
    <div
      className={`card-elevated ${onClick ? 'card-clickable' : ''} ${className}`}
      onClick={onClick}
      style={padding ? { padding } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
    >
      {children}
    </div>
  )
}
