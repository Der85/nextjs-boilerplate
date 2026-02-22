'use client'

interface SaveViewModalProps {
  value: string
  onChange: (name: string) => void
  onSave: () => void
  onClose: () => void
}

export default function SaveViewModal({ value, onChange, onSave, onClose }: SaveViewModalProps) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
    }}>
      <div style={{
        background: 'var(--color-bg)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        width: '90%',
        maxWidth: '320px',
      }}>
        <h3 style={{
          fontSize: 'var(--text-subheading)',
          fontWeight: 600,
          marginBottom: '16px',
          color: 'var(--color-text-primary)',
        }}>
          Save View
        </h3>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="View name"
          maxLength={30}
          autoFocus
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-body)',
            marginBottom: '16px',
            background: 'var(--color-bg)',
            color: 'var(--color-text-primary)',
          }}
          onKeyDown={(e) => e.key === 'Enter' && onSave()}
        />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--text-caption)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!value.trim()}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              background: value.trim() ? 'var(--color-accent)' : 'var(--color-surface)',
              color: value.trim() ? '#fff' : 'var(--color-text-tertiary)',
              fontSize: 'var(--text-caption)',
              fontWeight: 600,
              cursor: value.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
