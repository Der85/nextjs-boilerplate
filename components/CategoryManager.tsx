'use client'

import { useState } from 'react'
import type { Category } from '@/lib/types'
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/lib/utils/categories'

interface CategoryManagerProps {
  categories: Category[]
  onUpdate: (id: string, updates: Partial<Category>) => void
  onCreate: (category: { name: string; color: string; icon: string }) => void
  onDelete: (id: string) => void
}

export default function CategoryManager({
  categories,
  onUpdate,
  onCreate,
  onDelete,
}: CategoryManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editIcon, setEditIcon] = useState('')
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)

  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(CATEGORY_COLORS[0])
  const [newIcon, setNewIcon] = useState(CATEGORY_ICONS[0])

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const startEdit = (cat: Category) => {
    setEditingId(cat.id)
    setEditName(cat.name)
    setEditColor(cat.color)
    setEditIcon(cat.icon)
    setShowIconPicker(false)
    setShowColorPicker(false)
  }

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return
    onUpdate(editingId, {
      name: editName.trim(),
      color: editColor,
      icon: editIcon,
    })
    setEditingId(null)
  }

  const handleCreate = () => {
    if (!newName.trim()) return
    onCreate({
      name: newName.trim(),
      color: newColor,
      icon: newIcon,
    })
    setIsAdding(false)
    setNewName('')
    setNewColor(CATEGORY_COLORS[0])
    setNewIcon(CATEGORY_ICONS[0])
  }

  const handleDelete = (id: string) => {
    onDelete(id)
    setDeleteConfirm(null)
  }

  const buttonStyle: React.CSSProperties = {
    padding: '8px 16px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-caption)',
    fontWeight: 500,
    cursor: 'pointer',
    minHeight: '36px',
  }

  return (
    <div>
      {/* Category List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {categories.map((cat) => (
          <div
            key={cat.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              background: 'var(--color-bg)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
            }}
          >
            {editingId === cat.id ? (
              // Edit mode
              <>
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowIconPicker(!showIconPicker)}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)',
                      fontSize: '20px',
                      cursor: 'pointer',
                    }}
                  >
                    {editIcon}
                  </button>
                  {showIconPicker && (
                    <div style={{
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
                      display: 'grid',
                      gridTemplateColumns: 'repeat(8, 1fr)',
                      gap: '4px',
                      width: '280px',
                    }}>
                      {CATEGORY_ICONS.map((icon) => (
                        <button
                          key={icon}
                          onClick={() => {
                            setEditIcon(icon)
                            setShowIconPicker(false)
                          }}
                          style={{
                            width: '32px',
                            height: '32px',
                            border: icon === editIcon ? '2px solid var(--color-accent)' : 'none',
                            borderRadius: 'var(--radius-sm)',
                            background: icon === editIcon ? 'var(--color-accent-subtle)' : 'none',
                            fontSize: '16px',
                            cursor: 'pointer',
                          }}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--text-body)',
                    background: 'var(--color-bg)',
                    color: 'var(--color-text-primary)',
                  }}
                  autoFocus
                />

                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      border: '2px solid var(--color-border)',
                      background: editColor,
                      cursor: 'pointer',
                    }}
                  />
                  {showColorPicker && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      zIndex: 50,
                      marginTop: '4px',
                      padding: '8px',
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-lg)',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '8px',
                    }}>
                      {CATEGORY_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => {
                            setEditColor(color)
                            setShowColorPicker(false)
                          }}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            border: color === editColor ? '3px solid var(--color-text-primary)' : '2px solid transparent',
                            background: color,
                            cursor: 'pointer',
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={saveEdit}
                  style={{
                    ...buttonStyle,
                    background: 'var(--color-accent)',
                    color: '#fff',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  style={{
                    ...buttonStyle,
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Cancel
                </button>
              </>
            ) : deleteConfirm === cat.id ? (
              // Delete confirmation
              <>
                <span style={{ flex: 1, color: 'var(--color-danger)', fontSize: 'var(--text-caption)' }}>
                  Delete &quot;{cat.name}&quot;? Tasks will become uncategorized.
                </span>
                <button
                  onClick={() => handleDelete(cat.id)}
                  style={{
                    ...buttonStyle,
                    background: 'var(--color-danger)',
                    color: '#fff',
                  }}
                >
                  Delete
                </button>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  style={{
                    ...buttonStyle,
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              // View mode
              <>
                <span style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-md)',
                  background: `${cat.color}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                }}>
                  {cat.icon}
                </span>
                <span style={{
                  flex: 1,
                  fontSize: 'var(--text-body)',
                  color: 'var(--color-text-primary)',
                }}>
                  {cat.name}
                </span>
                <span
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: cat.color,
                  }}
                />
                {cat.is_system && (
                  <span style={{
                    fontSize: 'var(--text-small)',
                    color: 'var(--color-text-tertiary)',
                    padding: '2px 6px',
                    background: 'var(--color-surface)',
                    borderRadius: 'var(--radius-sm)',
                  }}>
                    System
                  </span>
                )}
                <button
                  onClick={() => startEdit(cat)}
                  aria-label="Edit category"
                  style={{
                    width: '32px',
                    height: '32px',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    background: 'none',
                    color: 'var(--color-text-tertiary)',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  onClick={() => setDeleteConfirm(cat.id)}
                  aria-label="Delete category"
                  style={{
                    width: '32px',
                    height: '32px',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    background: 'none',
                    color: 'var(--color-text-tertiary)',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add New Category */}
      {isAdding ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px',
          marginTop: '12px',
          background: 'var(--color-bg)',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--color-accent)',
        }}>
          <button
            onClick={() => {
              const currentIdx = CATEGORY_ICONS.indexOf(newIcon)
              const nextIdx = (currentIdx + 1) % CATEGORY_ICONS.length
              setNewIcon(CATEGORY_ICONS[nextIdx])
            }}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              fontSize: '20px',
              cursor: 'pointer',
            }}
            title="Click to change icon"
          >
            {newIcon}
          </button>

          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Category name"
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--text-body)',
              background: 'var(--color-bg)',
              color: 'var(--color-text-primary)',
            }}
            autoFocus
          />

          <button
            onClick={() => {
              const currentIdx = CATEGORY_COLORS.indexOf(newColor)
              const nextIdx = (currentIdx + 1) % CATEGORY_COLORS.length
              setNewColor(CATEGORY_COLORS[nextIdx])
            }}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '2px solid var(--color-border)',
              background: newColor,
              cursor: 'pointer',
            }}
            title="Click to change color"
          />

          <button
            onClick={handleCreate}
            disabled={!newName.trim()}
            style={{
              ...buttonStyle,
              background: newName.trim() ? 'var(--color-accent)' : 'var(--color-surface)',
              color: newName.trim() ? '#fff' : 'var(--color-text-tertiary)',
            }}
          >
            Add
          </button>
          <button
            onClick={() => setIsAdding(false)}
            style={{
              ...buttonStyle,
              background: 'var(--color-surface)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            padding: '12px',
            marginTop: '12px',
            border: '1px dashed var(--color-border)',
            borderRadius: 'var(--radius-md)',
            background: 'none',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--text-body)',
            cursor: 'pointer',
            transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-surface)'
            e.currentTarget.style.borderColor = 'var(--color-accent)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = 'var(--color-border)'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Category
        </button>
      )}
    </div>
  )
}
