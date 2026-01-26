'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import MoodHistoryViz from '@/components/MoodHistoryViz'

interface MoodEntry {
  id: string
  mood_score: number
  note: string | null
  coach_advice: string | null
  created_at: string
}

const getMoodEmoji = (score: number): string => {
  if (score <= 2) return '😢'
  if (score <= 4) return '😔'
  if (score <= 6) return '😐'
  if (score <= 8) return '🙂'
  return '😄'
}

export default function HistoryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<MoodEntry[]>([])
  const [stats, setStats] = useState({
    total: 0,
    average: 0,
    highest: 0,
    lowest: 10,
    weeklyAvg: 0,
    monthlyAvg: 0
  })

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      await fetchHistory(session.user.id)
      setLoading(false)
    }
    init()
  }, [router])

  const fetchHistory = async (userId: string) => {
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const { data } = await supabase
      .from('mood_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', ninetyDaysAgo.toISOString())
      .order('created_at', { ascending: false })

    if (data) {
      setEntries(data)
      
      if (data.length > 0) {
        const scores = data.map(e => e.mood_score)
        const oneWeekAgo = new Date()
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
        const oneMonthAgo = new Date()
        oneMonthAgo.setDate(oneMonthAgo.getDate() - 30)

        const weekEntries = data.filter(e => new Date(e.created_at) >= oneWeekAgo)
        const monthEntries = data.filter(e => new Date(e.created_at) >= oneMonthAgo)

        setStats({
          total: data.length,
          average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10,
          highest: Math.max(...scores),
          lowest: Math.min(...scores),
          weeklyAvg: weekEntries.length > 0 
            ? Math.round(weekEntries.reduce((a, e) => a + e.mood_score, 0) / weekEntries.length * 10) / 10 
            : 0,
          monthlyAvg: monthEntries.length > 0
            ? Math.round(monthEntries.reduce((a, e) => a + e.mood_score, 0) / monthEntries.length * 10) / 10
            : 0
        })
      }
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="history-page">
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading...</p>
        </div>
        <style jsx>{styles}</style>
      </div>
    )
  }

  return (
    <div className="history-page">
      {/* Header */}
      <header className="header">
        <button onClick={() => router.push('/dashboard')} className="back-btn">
          ←
        </button>
        <h1 className="page-title">Mood Insights</h1>
      </header>

      <main className="main">
        {/* Summary Stats */}
        <div className="stats-grid">
          <div className="stat-card highlight">
            <p className="stat-label">This Week</p>
            <p className="stat-value">{stats.weeklyAvg.toFixed(1)}</p>
            <p className="stat-subtext">avg mood</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">This Month</p>
            <p className="stat-value">{stats.monthlyAvg.toFixed(1)}</p>
            <p className="stat-subtext">avg mood</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Best Day</p>
            <p className="stat-value">{stats.highest}</p>
            <p className="stat-subtext">highest</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Tough Day</p>
            <p className="stat-value">{stats.lowest}</p>
            <p className="stat-subtext">lowest</p>
          </div>
        </div>

        {/* Charts */}
        <div className="card charts-card">
          <MoodHistoryViz entries={entries} />
        </div>

        {/* Full Entry List */}
        <div className="card entries-card">
          <div className="entries-header">
            <h2>All Check-ins ({stats.total})</h2>
          </div>

          <div className="entries-list">
            {entries.length === 0 ? (
              <div className="empty-state">
                <p>No check-ins yet</p>
                <button onClick={() => router.push('/dashboard')} className="cta-btn">
                  Log your first mood
                </button>
              </div>
            ) : (
              entries.map((entry, i) => (
                <div key={entry.id} className={`entry-item ${i > 0 ? 'bordered' : ''}`}>
                  <span className="entry-emoji">{getMoodEmoji(entry.mood_score)}</span>
                  <div className="entry-content">
                    <div className="entry-header">
                      <span className="entry-score">{entry.mood_score}/10</span>
                      <span className="entry-time">{formatDate(entry.created_at)}</span>
                    </div>
                    {entry.note && (
                      <p className="entry-note">{entry.note}</p>
                    )}
                    {entry.coach_advice && (
                      <div className="coach-advice">
                        <span className="coach-label">🧠 Coach:</span>
                        <span className="coach-text">{entry.coach_advice}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Bottom Nav */}
      <nav className="bottom-nav">
        <button onClick={() => router.push('/dashboard')} className="nav-btn">
          <span className="nav-icon">🏠</span>
          <span className="nav-label">Home</span>
        </button>
        <button onClick={() => router.push('/focus')} className="nav-btn">
          <span className="nav-icon">⏱️</span>
          <span className="nav-label">Focus</span>
        </button>
        <button className="nav-btn active">
          <span className="nav-icon">📊</span>
          <span className="nav-label">Insights</span>
        </button>
      </nav>

      <style jsx>{styles}</style>
    </div>
  )
}

// ============================================
// RESPONSIVE STYLES
// ============================================
const styles = `
  .history-page {
    --primary: #1D9BF0;
    --bg-gray: #f7f9fa;
    --dark-gray: #536471;
    --light-gray: #8899a6;
    
    background: var(--bg-gray);
    min-height: 100vh;
    min-height: 100dvh;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  /* ===== LOADING ===== */
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    min-height: 100dvh;
    color: var(--light-gray);
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

  /* ===== HEADER ===== */
  .header {
    position: sticky;
    top: 0;
    background: white;
    border-bottom: 1px solid #eee;
    padding: clamp(10px, 2.5vw, 14px) clamp(12px, 4vw, 20px);
    display: flex;
    align-items: center;
    gap: clamp(10px, 3vw, 16px);
    z-index: 100;
  }

  .back-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: clamp(18px, 5vw, 24px);
    padding: clamp(4px, 1vw, 8px);
    color: var(--dark-gray);
    line-height: 1;
  }

  .page-title {
    font-size: clamp(16px, 4.5vw, 20px);
    font-weight: 700;
    margin: 0;
  }

  /* ===== MAIN CONTENT ===== */
  .main {
    padding: clamp(12px, 4vw, 20px);
    padding-bottom: clamp(80px, 20vw, 110px);
    max-width: 600px;
    margin: 0 auto;
  }

  .card {
    background: white;
    border-radius: clamp(12px, 3vw, 18px);
    overflow: hidden;
  }

  /* ===== STATS GRID ===== */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: clamp(8px, 2.5vw, 14px);
    margin-bottom: clamp(14px, 4vw, 22px);
  }

  .stat-card {
    background: white;
    border-radius: clamp(10px, 2.5vw, 14px);
    padding: clamp(12px, 3.5vw, 20px);
  }

  .stat-card.highlight {
    background: linear-gradient(135deg, var(--primary) 0%, #1a91da 100%);
    color: white;
  }

  .stat-label {
    font-size: clamp(11px, 3vw, 13px);
    opacity: 0.7;
    margin: 0 0 clamp(2px, 1vw, 6px) 0;
  }

  .stat-card.highlight .stat-label {
    opacity: 0.9;
  }

  .stat-value {
    font-size: clamp(24px, 7vw, 34px);
    font-weight: 700;
    margin: 0 0 clamp(2px, 0.5vw, 4px) 0;
    line-height: 1.1;
  }

  .stat-subtext {
    font-size: clamp(10px, 2.8vw, 12px);
    opacity: 0.5;
    margin: 0;
  }

  .stat-card.highlight .stat-subtext {
    opacity: 0.8;
  }

  /* ===== CHARTS ===== */
  .charts-card {
    padding: clamp(12px, 4vw, 20px);
    margin-bottom: clamp(14px, 4vw, 22px);
  }

  /* ===== ENTRIES LIST ===== */
  .entries-card {
    margin-bottom: clamp(14px, 4vw, 22px);
  }

  .entries-header {
    padding: clamp(14px, 4vw, 18px);
    border-bottom: 1px solid #f0f0f0;
  }

  .entries-header h2 {
    font-size: clamp(14px, 4vw, 18px);
    font-weight: 600;
    margin: 0;
  }

  .entries-list {
    max-height: clamp(300px, 50vh, 500px);
    overflow-y: auto;
  }

  .empty-state {
    padding: clamp(30px, 8vw, 50px) clamp(16px, 4vw, 24px);
    text-align: center;
  }

  .empty-state p {
    color: var(--light-gray);
    font-size: clamp(14px, 3.8vw, 16px);
    margin: 0 0 clamp(14px, 4vw, 20px) 0;
  }

  .cta-btn {
    background: var(--primary);
    color: white;
    border: none;
    border-radius: clamp(8px, 2vw, 12px);
    padding: clamp(10px, 3vw, 14px) clamp(18px, 5vw, 28px);
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 600;
    cursor: pointer;
  }

  .entry-item {
    display: flex;
    align-items: flex-start;
    gap: clamp(10px, 3vw, 16px);
    padding: clamp(12px, 3.5vw, 18px) clamp(14px, 4vw, 20px);
  }

  .entry-item.bordered {
    border-top: 1px solid #f5f5f5;
  }

  .entry-emoji {
    font-size: clamp(24px, 7vw, 34px);
    flex-shrink: 0;
  }

  .entry-content {
    flex: 1;
    min-width: 0;
  }

  .entry-header {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: clamp(6px, 2vw, 10px);
    margin-bottom: clamp(2px, 0.5vw, 4px);
  }

  .entry-score {
    font-weight: 700;
    font-size: clamp(14px, 4vw, 18px);
  }

  .entry-time {
    color: var(--light-gray);
    font-size: clamp(11px, 3vw, 13px);
  }

  .entry-note {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    margin: clamp(4px, 1vw, 6px) 0;
    line-height: 1.4;
    word-wrap: break-word;
  }

  .coach-advice {
    background: rgba(29, 155, 240, 0.05);
    border-radius: clamp(6px, 1.5vw, 10px);
    padding: clamp(8px, 2.5vw, 12px);
    margin-top: clamp(6px, 1.5vw, 10px);
  }

  .coach-label {
    color: var(--primary);
    font-weight: 600;
    font-size: clamp(11px, 3vw, 13px);
  }

  .coach-text {
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--dark-gray);
    margin-left: clamp(4px, 1vw, 6px);
    line-height: 1.4;
  }

  /* ===== BOTTOM NAV ===== */
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: white;
    border-top: 1px solid #eee;
    display: flex;
    justify-content: space-around;
    padding: clamp(6px, 2vw, 10px) 0;
    padding-bottom: max(clamp(6px, 2vw, 10px), env(safe-area-inset-bottom));
    z-index: 100;
  }

  .nav-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(2px, 1vw, 4px);
    background: none;
    border: none;
    cursor: pointer;
    padding: clamp(6px, 2vw, 10px) clamp(14px, 4vw, 20px);
    color: var(--light-gray);
  }

  .nav-btn.active {
    color: var(--primary);
  }

  .nav-icon {
    font-size: clamp(18px, 5vw, 24px);
  }

  .nav-label {
    font-size: clamp(10px, 2.8vw, 12px);
    font-weight: 400;
  }

  .nav-btn.active .nav-label {
    font-weight: 600;
  }

  /* ===== TABLET/DESKTOP ===== */
  @media (min-width: 768px) {
    .main {
      padding: 24px;
      padding-bottom: 120px;
    }
    
    .stats-grid {
      gap: 16px;
    }
    
    .entries-list {
      max-height: 600px;
    }
  }

  @media (min-width: 1024px) {
    .header {
      padding: 16px 32px;
    }
    
    .main {
      max-width: 680px;
    }
  }
`
