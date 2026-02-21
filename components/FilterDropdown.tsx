'use client'

import type { ReactNode } from 'react'

interface FilterDropdownProps {
  label: string
  isActive: boolean
  displayValue?: string
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
}

export const pillStyle = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '6px 12px',
  border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
  borderRadius: 'var(--radius-full)',
  background: active ? 'var(--color-accent-light)' : 'var(--color-bg)',
  color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
  fontSize: 'var(--text-small)',
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'all 0.15s',
})

export const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  zIndex: 50,
  marginTop: '4px',
  padding: '8px',
  background: 'var(--color-bg)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-lg)',
  minWidth: '180px',
  maxHeight: '280px',
  overflowY: 'auto',
}

export const checkboxStyle = (checked: boolean): React.CSSProperties => ({
  width: '16px',
  height: '16px',
  borderRadius: '3px',
  border: `2px solid ${checked ? 'var(--color-accent)' : 'var(--color-border)'}`,
  background: checked ? 'var(--color-accent)' : 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
})

export const optionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  fontSize: 'var(--text-caption)',
  color: 'var(--color-text-primary)',
}

const chevronIcon = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const checkIcon = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export function CheckMark({ checked }: { checked: boolean }) {
  return (
    <div style={checkboxStyle(checked)}>
      {checked && checkIcon}
    </div>
  )
}

export default function FilterDropdown({
  label,
  isActive,
  displayValue,
  isOpen,
  onToggle,
  children,
}: FilterDropdownProps) {
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        style={pillStyle(isActive)}
      >
        {isActive && displayValue ? displayValue : label}
        {chevronIcon}
      </button>
      {isOpen && (
        <div style={dropdownStyle} role="listbox">
          {children}
        </div>
      )}
    </div>
  )
}
