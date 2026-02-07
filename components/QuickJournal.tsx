'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface QuickJournalProps {
  onSave?: () => void
  onClose?: () => void
}

export default function QuickJournal({ onSave, onClose }: QuickJournalProps) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus the textarea
  useEffect(() => {
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 100)
  }, [])

  const handleSave = async () => {
    if (!text.trim()) {
      onClose?.()
      return
    }

    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Save as a journal entry linked to today's mood
        const today = new Date().toISOString().split('T')[0]

        // First, try to find today's mood entry to attach the journal
        const { data: moodEntry } = await supabase
          .from('mood_entries')
          .select('id, note')
          .eq('user_id', user.id)
          .gte('created_at', `${today}T00:00:00`)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (moodEntry) {
          // Append to existing note
          const existingNote = moodEntry.note || ''
          const separator = existingNote ? '\n\n---\n\n' : ''
          const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

          await supabase
            .from('mood_entries')
            .update({
              note: `${existingNote}${separator}[${timestamp}] ${text.trim()}`
            })
            .eq('id', moodEntry.id)
        } else {
          // Create a new mood entry with just the journal text
          await supabase
            .from('mood_entries')
            .insert({
              user_id: user.id,
              mood_score: 3, // Default low score since they're in recovery
              note: text.trim(),
              coach_advice: null,
            })
        }
      }

      setSaved(true)
      setTimeout(() => {
        onSave?.()
      }, 800)
    } catch (err) {
      console.error('Error saving journal:', err)
      // Still complete - don't block the user
      onSave?.()
    } finally {
      setSaving(false)
    }
  }

  // Show saved confirmation
  if (saved) {
    return (
      <div className="journal-container saved-state">
        <div className="saved-icon">✓</div>
        <p className="saved-text">Saved</p>
        <style jsx>{styles}</style>
      </div>
    )
  }

  return (
    <div className="journal-container">
      <h3 className="journal-title">Write it down</h3>
      <p className="journal-hint">Whatever's on your mind. No one else will see this.</p>

      <textarea
        ref={textareaRef}
        className="journal-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="I'm feeling..."
        rows={5}
      />

      <div className="journal-actions">
        <button
          className="save-btn"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Done'}
        </button>
        <button
          className="cancel-btn"
          onClick={onClose}
          disabled={saving}
        >
          Back
        </button>
      </div>

      <style jsx>{styles}</style>
    </div>
  )
}

const styles = `
  .journal-container {
    display: flex;
    flex-direction: column;
    flex: 1;
    text-align: left;
  }

  .journal-container.saved-state {
    align-items: center;
    justify-content: center;
  }

  .saved-icon {
    width: clamp(56px, 14vw, 72px);
    height: clamp(56px, 14vw, 72px);
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: clamp(28px, 7vw, 36px);
    color: white;
    margin-bottom: clamp(12px, 3vw, 16px);
    animation: scaleIn 0.3s ease-out;
  }

  @keyframes scaleIn {
    from {
      transform: scale(0.8);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  .saved-text {
    font-size: clamp(16px, 4vw, 18px);
    color: #6b7280;
    margin: 0;
  }

  .journal-title {
    font-size: clamp(18px, 4.5vw, 22px);
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 clamp(6px, 1.5vw, 8px) 0;
  }

  .journal-hint {
    font-size: clamp(13px, 3.2vw, 14px);
    color: #9ca3af;
    margin: 0 0 clamp(16px, 4vw, 20px) 0;
  }

  .journal-textarea {
    width: 100%;
    flex: 1;
    min-height: clamp(100px, 25vw, 140px);
    padding: clamp(14px, 3.5vw, 18px);
    border: 1.5px solid rgba(139, 92, 246, 0.2);
    border-radius: clamp(12px, 3vw, 16px);
    font-size: clamp(15px, 3.8vw, 17px);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1f2937;
    resize: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    line-height: 1.6;
  }

  .journal-textarea:focus {
    outline: none;
    border-color: rgba(139, 92, 246, 0.4);
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }

  .journal-textarea::placeholder {
    color: #d1d5db;
  }

  .journal-actions {
    display: flex;
    gap: clamp(10px, 2.5vw, 14px);
    margin-top: clamp(16px, 4vw, 20px);
  }

  .save-btn {
    flex: 1;
    padding: clamp(12px, 3vw, 16px);
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    color: white;
    border: none;
    border-radius: 100px;
    font-size: clamp(14px, 3.5vw, 16px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .save-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(139, 92, 246, 0.35);
  }

  .save-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .cancel-btn {
    padding: clamp(12px, 3vw, 16px) clamp(20px, 5vw, 28px);
    background: transparent;
    color: #9ca3af;
    border: 1px solid #e5e7eb;
    border-radius: 100px;
    font-size: clamp(14px, 3.5vw, 16px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .cancel-btn:hover:not(:disabled) {
    background: #f9fafb;
    border-color: #d1d5db;
    color: #6b7280;
  }

  .cancel-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`
