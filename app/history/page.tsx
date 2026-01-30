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
  const [showMenu, setShowMenu] = useState(false)
  
  // Phase 1: Random online count for Village presence (matches Dashboard)
  const [onlineCount] = useState(() => Math.floor(Math.random() * 51)) // 0-50

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
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

  // Phase 3: Clinical Bridge - Export data for therapist/doctor
  const handleExport = () => {
    if (entries.length === 0) return

    // CSV Header
    const headers = ['Date', 'Mood Score', 'Note', 'Coach Advice']
    
    // Convert entries to CSV rows
    const rows = entries.map(entry => {
      const date = new Date(entry.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
      
      // Escape quotes and wrap in quotes if contains comma or newline
      const escapeCSV = (str: string | null) => {
        if (!str) return ''
        const escaped = str.replace(/"/g, '""')
        if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')) {
          return `"${escaped}"`
        }
        return escaped
      }
      
      return [
        date,
        entry.mood_score,
        escapeCSV(entry.note),
        escapeCSV(entry.coach_advice)
      ].join(',')
    })
    
    // Combine header and rows
    const csvContent = [headers.join(','), ...rows].join('\n')
    
    // Create blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    
    // Generate filename with current date
    const today = new Date().toISOString().split('T')[0]
    link.setAttribute('href', url)
    link.setAttribute('download', `ADHDer_Report_${today}.csv`)
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Clean up
    URL.revokeObjectURL(url)
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
      {/* Header - Consistent with Dashboard */}
      <header className="header">
        <button onClick={() => router.push('/dashboard')} className="logo">
          ADHDer.io
        </button>
        <div className="header-actions">
          {/* Phase 1: Village Presence Indicator (matches Dashboard) */}
          <div className="village-pill">
            <span className="presence-dot"></span>
            <span className="presence-count">{onlineCount} online</span>
          </div>
          <button onClick={() => router.push('/ally')} className="icon-btn purple" title="I'm stuck">
            💜
          </button>
          <button onClick={() => router.push('/brake')} className="icon-btn red" title="Need to pause">
            🛑
          </button>
          <button onClick={() => setShowMenu(!showMenu)} className="icon-btn menu">
            ☰
          </button>
        </div>

        {showMenu && (
          <div className="dropdown-menu">
            <button onClick={() => { router.push('/dashboard'); setShowMenu(false) }} className="menu-item">
              🏠 Dashboard
            </button>
            <button onClick={() => { router.push('/focus'); setShowMenu(false) }} className="menu-item">
              ⏱️ Focus Mode
            </button>
            <button onClick={() => { router.push('/goals'); setShowMenu(false) }} className="menu-item">
              🎯 Goals
            </button>
            <button onClick={() => { router.push('/burnout'); setShowMenu(false) }} className="menu-item">
              ⚡ Energy Tracker
            </button>
            <button onClick={() => { router.push('/village'); setShowMenu(false) }} className="menu-item">
              👥 My Village
            </button>
            <div className="menu-divider" />
            <button
              onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
              className="menu-item logout"
            >
              Log out
            </button>
          </div>
        )}
      </header>

      {showMenu && <div className="menu-overlay" onClick={() => setShowMenu(false)} />}

      <main className="main">
        {/* Page Title with Export Button */}
        <div className="page-header-title">
          <h1>📊 Mood Insights</h1>
          {entries.length > 0 && (
            <button onClick={handleExport} className="btn-export">
              📥 Export for Doctor
            </button>
          )}
        </div>

        {/* Phase 2: Weekly Narrative Card (replaces stats-grid) */}
        {stats.total > 0 && (
          <div className={`narrative-card ${
            stats.weeklyAvg < 4.5 ? 'recovery' : 
            stats.weeklyAvg > 7.5 ? 'growth' : 
            'maintenance'
          }`}>
            <div className="narrative-header">
              <span className="narrative-icon">
                {stats.weeklyAvg < 4.5 ? '🫂' : stats.weeklyAvg > 7.5 ? '🚀' : '⚖️'}
              </span>
              <div className="narrative-titles">
                <h2 className="narrative-title">
                  {stats.weeklyAvg < 4.5 
                    ? 'Recovery Pattern Detected' 
                    : stats.weeklyAvg > 7.5 
                    ? 'High Momentum Week' 
                    : 'Steady Baseline'}
                </h2>
                <p className="narrative-subtitle">Weekly Report</p>
              </div>
              <div className="narrative-score">
                <span className="score-value">{stats.weeklyAvg.toFixed(1)}</span>
                <span className="score-label">avg</span>
              </div>
            </div>
            <p className="narrative-text">
              {stats.weeklyAvg < 4.5 
                ? `This week has been heavy. You've faced some tough days, but showing up matters. Consider using BREAK more often.`
                : stats.weeklyAvg > 7.5 
                ? `You're trending upward! Great job maintaining energy. This is a good time to tackle meaningful goals.`
                : `You held your ground this week. Consistency is the goal — you're building sustainable habits.`}
            </p>
            <div className="narrative-stats">
              <div className="mini-stat">
                <span className="mini-label">Month Avg</span>
                <span className="mini-value">{stats.monthlyAvg.toFixed(1)}</span>
              </div>
              <div className="mini-stat">
                <span className="mini-label">Best</span>
                <span className="mini-value">{stats.highest}</span>
              </div>
              <div className="mini-stat">
                <span className="mini-label">Low</span>
                <span className="mini-value">{stats.lowest}</span>
              </div>
              <div className="mini-stat">
                <span className="mini-label">Check-ins</span>
                <span className="mini-value">{stats.total}</span>
              </div>
            </div>
          </div>
        )}

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
    --success: #00ba7c;
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
    justify-content: space-between;
    align-items: center;
    z-index: 100;
  }

  .logo {
    background: none;
    border: none;
    cursor: pointer;
    font-size: clamp(16px, 4vw, 20px);
    font-weight: 800;
    color: var(--primary);
  }

  .header-actions {
    display: flex;
    gap: clamp(6px, 2vw, 10px);
  }

  .icon-btn {
    width: clamp(32px, 8vw, 42px);
    height: clamp(32px, 8vw, 42px);
    border-radius: 50%;
    border: none;
    cursor: pointer;
    font-size: clamp(14px, 3.5vw, 18px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon-btn.purple { background: rgba(128, 90, 213, 0.1); }
  .icon-btn.red { background: rgba(239, 68, 68, 0.1); }
  .icon-btn.menu {
    background: white;
    border: 1px solid #ddd;
    font-size: clamp(12px, 3vw, 16px);
  }

  /* ===== PHASE 1: VILLAGE PRESENCE PILL ===== */
  .village-pill {
    display: flex;
    align-items: center;
    gap: clamp(5px, 1.5vw, 8px);
    padding: clamp(4px, 1.2vw, 6px) clamp(8px, 2.5vw, 12px);
    background: rgba(0, 186, 124, 0.08);
    border: 1px solid rgba(0, 186, 124, 0.2);
    border-radius: 100px;
  }

  .presence-dot {
    width: clamp(6px, 1.8vw, 8px);
    height: clamp(6px, 1.8vw, 8px);
    background: var(--success);
    border-radius: 50%;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      box-shadow: 0 0 0 0 rgba(0, 186, 124, 0.4);
    }
    50% {
      opacity: 0.6;
      box-shadow: 0 0 0 4px rgba(0, 186, 124, 0);
    }
  }

  .presence-count {
    font-size: clamp(10px, 2.8vw, 12px);
    font-weight: 600;
    color: var(--success);
  }

  .dropdown-menu {
    position: absolute;
    top: clamp(50px, 12vw, 60px);
    right: clamp(12px, 4vw, 20px);
    background: white;
    border-radius: clamp(10px, 2.5vw, 14px);
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    padding: clamp(6px, 1.5vw, 10px);
    min-width: clamp(140px, 40vw, 180px);
    z-index: 200;
  }

  .menu-item {
    display: block;
    width: 100%;
    padding: clamp(8px, 2.5vw, 12px) clamp(10px, 3vw, 14px);
    text-align: left;
    background: none;
    border: none;
    border-radius: clamp(6px, 1.5vw, 10px);
    cursor: pointer;
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
  }

  .menu-item:hover { background: var(--bg-gray); }
  .menu-item.logout { color: #ef4444; }
  .menu-divider { border-top: 1px solid #eee; margin: 8px 0; }
  .menu-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 99;
  }

  /* ===== MAIN CONTENT ===== */
  .main {
    padding: clamp(12px, 4vw, 20px);
    padding-bottom: clamp(80px, 20vw, 110px);
    max-width: 600px;
    margin: 0 auto;
  }

  .page-header-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: clamp(14px, 4vw, 20px);
  }

  .page-header-title h1 {
    font-size: clamp(22px, 6vw, 28px);
    font-weight: 700;
    margin: 0;
  }

  /* Phase 3: Export Button */
  .btn-export {
    display: flex;
    align-items: center;
    gap: clamp(4px, 1vw, 6px);
    padding: clamp(6px, 2vw, 10px) clamp(10px, 3vw, 14px);
    background: white;
    border: 1px solid #ddd;
    border-radius: clamp(8px, 2vw, 12px);
    font-size: clamp(11px, 3vw, 13px);
    font-weight: 600;
    color: var(--dark-gray);
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .btn-export:hover {
    background: var(--bg-gray);
    border-color: var(--primary);
    color: var(--primary);
  }

  .btn-export:active {
    transform: scale(0.98);
  }

  .card {
    background: white;
    border-radius: clamp(12px, 3vw, 18px);
    overflow: hidden;
  }

  /* ===== PHASE 2: NARRATIVE CARD ===== */
  .narrative-card {
    background: white;
    border-radius: clamp(14px, 4vw, 20px);
    padding: clamp(18px, 5vw, 26px);
    margin-bottom: clamp(14px, 4vw, 22px);
    border: 1px solid;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  }

  .narrative-card.recovery {
    background: rgba(244, 33, 46, 0.04);
    border-color: rgba(244, 33, 46, 0.15);
  }

  .narrative-card.growth {
    background: rgba(0, 186, 124, 0.04);
    border-color: rgba(0, 186, 124, 0.15);
  }

  .narrative-card.maintenance {
    background: rgba(29, 155, 240, 0.04);
    border-color: rgba(29, 155, 240, 0.15);
  }

  .narrative-header {
    display: flex;
    align-items: flex-start;
    gap: clamp(12px, 3.5vw, 16px);
    margin-bottom: clamp(14px, 4vw, 18px);
  }

  .narrative-icon {
    font-size: clamp(32px, 9vw, 44px);
    flex-shrink: 0;
  }

  .narrative-titles {
    flex: 1;
  }

  .narrative-title {
    font-size: clamp(16px, 4.5vw, 20px);
    font-weight: 700;
    margin: 0 0 clamp(2px, 0.5vw, 4px) 0;
    color: var(--text-dark, #0f1419);
  }

  .narrative-card.recovery .narrative-title {
    color: #dc2626;
  }

  .narrative-card.growth .narrative-title {
    color: #059669;
  }

  .narrative-card.maintenance .narrative-title {
    color: var(--primary);
  }

  .narrative-subtitle {
    font-size: clamp(11px, 3vw, 13px);
    color: var(--light-gray);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .narrative-score {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: white;
    border-radius: clamp(10px, 2.5vw, 14px);
    padding: clamp(8px, 2.5vw, 12px) clamp(12px, 3.5vw, 18px);
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }

  .score-value {
    font-size: clamp(22px, 6.5vw, 30px);
    font-weight: 800;
    line-height: 1;
  }

  .narrative-card.recovery .score-value {
    color: #dc2626;
  }

  .narrative-card.growth .score-value {
    color: #059669;
  }

  .narrative-card.maintenance .score-value {
    color: var(--primary);
  }

  .score-label {
    font-size: clamp(10px, 2.8vw, 12px);
    color: var(--light-gray);
    text-transform: uppercase;
  }

  .narrative-text {
    font-size: clamp(14px, 3.8vw, 16px);
    color: var(--dark-gray);
    line-height: 1.6;
    margin: 0 0 clamp(16px, 4.5vw, 22px) 0;
  }

  .narrative-stats {
    display: flex;
    justify-content: space-between;
    padding-top: clamp(14px, 4vw, 18px);
    border-top: 1px solid rgba(0,0,0,0.06);
  }

  .mini-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(2px, 0.5vw, 4px);
  }

  .mini-label {
    font-size: clamp(9px, 2.5vw, 11px);
    color: var(--light-gray);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .mini-value {
    font-size: clamp(14px, 4vw, 18px);
    font-weight: 700;
    color: var(--dark-gray);
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

  .nav-btn.active { color: var(--primary); }
  .nav-icon { font-size: clamp(18px, 5vw, 24px); }
  .nav-label { font-size: clamp(10px, 2.8vw, 12px); font-weight: 400; }
  .nav-btn.active .nav-label { font-weight: 600; }

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
