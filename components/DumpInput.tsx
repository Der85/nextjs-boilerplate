'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

/* eslint-disable @typescript-eslint/no-explicit-any */
type SpeechRecognitionType = any

interface DumpInputProps {
  onSubmit: (text: string, source: 'text' | 'voice') => Promise<void>
  loading: boolean
}

export default function DumpInput({ onSubmit, loading }: DumpInputProps) {
  const [text, setText] = useState('')
  const [source, setSource] = useState<'text' | 'voice'>('text')
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<SpeechRecognitionType | null>(null)

  // Check speech API support
  useEffect(() => {
    setSpeechSupported('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
  }, [])

  // Restore draft from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('adhder-dump-draft')
    if (saved) setText(saved)
  }, [])

  // Persist draft to localStorage
  useEffect(() => {
    if (text) {
      localStorage.setItem('adhder-dump-draft', text)
    } else {
      localStorage.removeItem('adhder-dump-draft')
    }
  }, [text])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = `${Math.min(ta.scrollHeight, 400)}px`
    }
  }, [text])

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const toggleVoice = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognitionCtor) return

    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      let finalTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript
        }
      }
      if (finalTranscript) {
        setText(prev => (prev ? prev + ' ' : '') + finalTranscript)
        setSource('voice')
      }
    }
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [isListening])

  const handleSubmit = async () => {
    const trimmed = text.trim()
    if (trimmed.length < 3 || loading) return
    await onSubmit(trimmed, source)
    setText('')
    setSource('text')
    localStorage.removeItem('adhder-dump-draft')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0

  return (
    <div>
      <div style={{
        position: 'relative',
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        transition: 'border-color 0.15s',
      }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What's on your mind?"
          disabled={loading}
          rows={4}
          style={{
            width: '100%',
            border: 'none',
            outline: 'none',
            resize: 'none',
            fontSize: '17px',
            lineHeight: '1.6',
            color: 'var(--color-text-primary)',
            background: 'transparent',
            fontFamily: 'inherit',
            minHeight: '120px',
          }}
        />

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: '1px solid var(--color-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {speechSupported && (
              <button
                onClick={toggleVoice}
                disabled={loading}
                aria-label={isListening ? 'Stop listening' : 'Start voice input'}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  background: isListening ? 'var(--color-danger)' : 'var(--color-surface)',
                  color: isListening ? '#fff' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s',
                  animation: isListening ? 'check-pop 1s infinite' : 'none',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              </button>
            )}
            <span style={{
              fontSize: 'var(--text-small)',
              color: 'var(--color-text-tertiary)',
            }}>
              {wordCount > 0 ? `${wordCount} word${wordCount !== 1 ? 's' : ''}` : ''}
            </span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={text.trim().length < 3 || loading}
            style={{
              height: '44px',
              padding: '0 24px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              background: text.trim().length >= 3 ? 'var(--color-accent)' : 'var(--color-border)',
              color: text.trim().length >= 3 ? '#fff' : 'var(--color-text-tertiary)',
              fontSize: 'var(--text-caption)',
              fontWeight: 600,
              cursor: text.trim().length >= 3 && !loading ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {loading ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Parsing...
              </>
            ) : 'Done'}
          </button>
        </div>
      </div>

      <p style={{
        marginTop: '8px',
        fontSize: 'var(--text-small)',
        color: 'var(--color-text-tertiary)',
        textAlign: 'center',
      }}>
        {String.fromCodePoint(0x2318)}/Ctrl + Enter to submit
      </p>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
