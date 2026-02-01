'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AppHeader from '@/components/AppHeader'

type UserMode = 'recovery' | 'maintenance' | 'growth'

interface Tool {
  id: string
  path: string
  icon: string
  title: string
  description: string
  useWhen: string
  color: string
  bgGradient: string
}

const tools: Tool[] = [
  {
    id: 'focus',
    path: '/focus',
    icon: '⏱️',
    title: 'Focus Session',
    description: 'Break down overwhelming tasks into manageable steps',
    useWhen: 'You have energy to work and need structure',
    color: '#1D9BF0',
    bgGradient: 'linear-gradient(135deg, rgba(29, 155, 240, 0.08) 0%, rgba(29, 155, 240, 0.02) 100%)',
  },
  {
    id: 'brake',
    path: '/brake',
    icon: '🛑',
    title: 'BREAK',
    description: '10-second emotional reset with breathing',
    useWhen: 'Feeling overwhelmed, stuck, or dysregulated',
    color: '#f4212e',
    bgGradient: 'linear-gradient(135deg, rgba(244, 33, 46, 0.08) 0%, rgba(244, 33, 46, 0.02) 100%)',
  },
  {
    id: 'ally',
    path: '/ally',
    icon: '💜',
    title: 'Ally - Get Unstuck',
    description: 'Break through executive dysfunction blocks',
    useWhen: "Can't start, can't decide, or feeling paralyzed",
    color: '#805ad5',
    bgGradient: 'linear-gradient(135deg, rgba(128, 90, 213, 0.08) 0%, rgba(128, 90, 213, 0.02) 100%)',
  },
  {
    id: 'goals',
    path: '/goals',
    icon: '🌱',
    title: 'Goals',
    description: 'Track meaningful progress with your plant garden',
    useWhen: 'Planning ahead and building sustainable habits',
    color: '#00ba7c',
    bgGradient: 'linear-gradient(135deg, rgba(0, 186, 124, 0.08) 0%, rgba(0, 186, 124, 0.02) 100%)',
  },
]

export default function ToolsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [userMode, setUserMode] = useState<UserMode>('maintenance')

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUser(session.user)

      // Fetch user's last mood entry to determine mode
      const { data: moodData } = await supabase
        .from('mood_entries')
        .select('mood_score, note, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(3)

      if (moodData && moodData.length > 0) {
        const lastEntry = moodData[0]
        const lastMood = lastEntry.mood_score
        const lastNote = lastEntry.note?.toLowerCase() || ''

        // Calculate streak
        let streak = 1
        for (let i = 1; i < moodData.length; i++) {
          const curr = new Date(moodData[i - 1].created_at)
          const prev = new Date(moodData[i].created_at)
          const diff = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
          if (diff <= 1) streak++
          else break
        }

        // Determine mode
        if (lastMood <= 3 || lastNote.includes('overwhelmed')) {
          setUserMode('recovery')
        } else if (lastMood >= 8 && streak > 2) {
          setUserMode('growth')
        } else {
          setUserMode('maintenance')
        }
      }

      setLoading(false)
    }
    init()
  }, [router])

  const getModeMessage = () => {
    switch (userMode) {
      case 'recovery':
        return {
          text: 'Energy is low. BREAK is your friend right now.',
          icon: '🫂',
          recommendedTool: 'brake'
        }
      case 'growth':
        return {
          text: 'You have momentum! Great time for Focus Sessions.',
          icon: '🚀',
          recommendedTool: 'focus'
        }
      default:
        return {
          text: 'Choose the tool that fits your current need.',
          icon: '🧰',
          recommendedTool: null
        }
    }
  }

  if (loading) {
    return (
      <div className="tools-page">
        <AppHeader notificationBar={{ text: 'Loading your toolkit...', color: '#1D9BF0', icon: '🧰' }} />
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading...</p>
        </div>
        <style jsx>{globalStyles}</style>
      </div>
    )
  }

  const modeInfo = getModeMessage()

  return (
    <div className="tools-page">
      <AppHeader
        notificationBar={{
          text: modeInfo.text,
          color: userMode === 'recovery' ? '#f4212e' : userMode === 'growth' ? '#00ba7c' : '#1D9BF0',
          icon: modeInfo.icon || '🧰',
        }}
      />

      <main className="main">
        {/* Mode-aware message */}
        {modeInfo.icon && (
          <div className="mode-message">
            <span className="mode-icon">{modeInfo.icon}</span>
            <p>{modeInfo.text}</p>
          </div>
        )}

        {/* Tool cards */}
        <div className="tools-grid">
          {tools.map((tool) => {
            const isRecommended = tool.id === modeInfo.recommendedTool
            const isDimmed = userMode === 'recovery' && tool.id === 'focus'

            return (
              <button
                key={tool.id}
                onClick={() => router.push(tool.path)}
                className={`tool-card ${isRecommended ? 'recommended' : ''} ${isDimmed ? 'dimmed' : ''}`}
                style={{
                  background: tool.bgGradient,
                  borderColor: isRecommended ? tool.color : '#e5e7eb'
                }}
              >
                {isRecommended && (
                  <div className="recommended-badge" style={{ background: tool.color }}>
                    Recommended
                  </div>
                )}

                <div className="tool-header">
                  <span className="tool-icon">{tool.icon}</span>
                  <h2 className="tool-title">{tool.title}</h2>
                </div>

                <p className="tool-description">{tool.description}</p>

                <div className="use-when">
                  <span className="use-when-label">Use when:</span>
                  <span className="use-when-text">{tool.useWhen}</span>
                </div>

                <div className="tool-action" style={{ color: tool.color }}>
                  Open {tool.title} →
                </div>
              </button>
            )
          })}
        </div>

        {/* Energy tracker link */}
        <button
          onClick={() => router.push('/burnout')}
          className="secondary-tool"
        >
          <span className="secondary-icon">⚡</span>
          <div className="secondary-content">
            <span className="secondary-title">Energy Tracker</span>
            <span className="secondary-subtitle">Track your battery level</span>
          </div>
          <span className="secondary-arrow">→</span>
        </button>
      </main>

      <style jsx>{globalStyles}</style>
    </div>
  )
}

const globalStyles = `
  .tools-page {
    --primary: #1D9BF0;
    --dark-gray: #536471;
    --light-gray: #8899a6;
    --bg-gray: #f7f9fa;

    background: var(--bg-gray);
    min-height: 100vh;
    min-height: 100dvh;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 50vh;
  }

  .spinner {
    width: clamp(24px, 5vw, 32px);
    height: clamp(24px, 5vw, 32px);
    border: 3px solid var(--primary);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 12px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .main {
    padding: clamp(16px, 4vw, 24px);
    padding-bottom: clamp(16px, 4vw, 24px);
    max-width: 680px;
    margin: 0 auto;
  }

  /* Mode message */
  .mode-message {
    display: flex;
    align-items: center;
    gap: clamp(12px, 3vw, 16px);
    padding: clamp(14px, 4vw, 18px);
    background: white;
    border-radius: clamp(14px, 3.5vw, 18px);
    margin-bottom: clamp(16px, 4vw, 24px);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  .mode-icon {
    font-size: clamp(24px, 6vw, 28px);
    flex-shrink: 0;
  }

  .mode-message p {
    font-size: clamp(14px, 3.8vw, 16px);
    color: var(--dark-gray);
    margin: 0;
    line-height: 1.5;
  }

  /* Tools grid */
  .tools-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: clamp(14px, 3.5vw, 18px);
    margin-bottom: clamp(20px, 5vw, 28px);
  }

  .tool-card {
    position: relative;
    padding: clamp(18px, 5vw, 24px);
    background: white;
    border: 2px solid #e5e7eb;
    border-radius: clamp(16px, 4vw, 20px);
    cursor: pointer;
    text-align: left;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    gap: clamp(10px, 2.5vw, 14px);
  }

  .tool-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  }

  .tool-card:active {
    transform: translateY(0);
  }

  .tool-card.recommended {
    border-width: 2px;
  }

  .tool-card.dimmed {
    opacity: 0.5;
  }

  .recommended-badge {
    position: absolute;
    top: clamp(12px, 3vw, 16px);
    right: clamp(12px, 3vw, 16px);
    padding: clamp(4px, 1.2vw, 6px) clamp(10px, 2.5vw, 14px);
    background: var(--primary);
    color: white;
    font-size: clamp(10px, 2.8vw, 12px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-radius: 100px;
  }

  .tool-header {
    display: flex;
    align-items: center;
    gap: clamp(10px, 2.5vw, 14px);
  }

  .tool-icon {
    font-size: clamp(28px, 7vw, 36px);
    line-height: 1;
  }

  .tool-title {
    font-size: clamp(18px, 5vw, 22px);
    font-weight: 700;
    color: #0f1419;
    margin: 0;
  }

  .tool-description {
    font-size: clamp(14px, 3.8vw, 16px);
    color: var(--dark-gray);
    line-height: 1.5;
    margin: 0;
  }

  .use-when {
    display: flex;
    flex-direction: column;
    gap: clamp(4px, 1vw, 6px);
    padding: clamp(10px, 3vw, 14px);
    background: rgba(0, 0, 0, 0.02);
    border-radius: clamp(8px, 2vw, 12px);
  }

  .use-when-label {
    font-size: clamp(11px, 3vw, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--light-gray);
  }

  .use-when-text {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    line-height: 1.4;
  }

  .tool-action {
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 600;
    color: var(--primary);
    margin-top: clamp(4px, 1vw, 8px);
  }

  /* Secondary tool (Energy Tracker) */
  .secondary-tool {
    width: 100%;
    padding: clamp(14px, 4vw, 18px);
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: clamp(14px, 3.5vw, 18px);
    display: flex;
    align-items: center;
    gap: clamp(12px, 3vw, 16px);
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .secondary-tool:hover {
    background: var(--bg-gray);
  }

  .secondary-icon {
    font-size: clamp(22px, 6vw, 26px);
    flex-shrink: 0;
  }

  .secondary-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: clamp(2px, 0.5vw, 4px);
  }

  .secondary-title {
    font-size: clamp(15px, 4vw, 17px);
    font-weight: 600;
    color: #0f1419;
  }

  .secondary-subtitle {
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--dark-gray);
  }

  .secondary-arrow {
    font-size: clamp(18px, 5vw, 22px);
    color: var(--light-gray);
    flex-shrink: 0;
  }

  @media (min-width: 768px) {
    .tools-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .main {
      padding: 24px;
    }
  }

  @media (min-width: 1024px) {
    .main {
      padding: 32px;
    }
  }
`
