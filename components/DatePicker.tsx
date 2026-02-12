'use client'

import { getTodayISO, getTomorrowISO, getWeekendISO, getNextWeekISO } from '@/lib/utils/dates'

interface DatePickerProps {
  value: string | null
  onChange: (date: string | null) => void
  onClose: () => void
}

const QUICK_OPTIONS = [
  { label: 'Today', getValue: getTodayISO },
  { label: 'Tomorrow', getValue: getTomorrowISO },
  { label: 'Weekend', getValue: getWeekendISO },
  { label: 'Next week', getValue: getNextWeekISO },
  { label: 'No date', getValue: () => null },
]

export default function DatePicker({ value, onChange, onClose }: DatePickerProps) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        zIndex: 20,
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        padding: '8px',
        minWidth: '200px',
        animation: 'fade-in 0.15s ease',
      }}
    >
      {QUICK_OPTIONS.map((opt) => (
        <button
          key={opt.label}
          onClick={() => {
            onChange(opt.getValue())
            onClose()
          }}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'none',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--text-caption)',
            cursor: 'pointer',
            transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
        >
          {opt.label}
        </button>
      ))}

      <div style={{
        borderTop: '1px solid var(--color-border)',
        marginTop: '4px',
        paddingTop: '4px',
      }}>
        <input
          type="date"
          value={value || ''}
          onChange={(e) => {
            onChange(e.target.value || null)
            onClose()
          }}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-caption)',
            color: 'var(--color-text-primary)',
            background: 'var(--color-bg)',
          }}
        />
      </div>
    </div>
  )
}
