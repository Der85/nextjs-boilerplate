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
    // Fetch last 90 days
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
      
      // Calculate stats
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
      <div className="app-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <span 
            className="animate-spin" 
            style={{ 
              display: 'block',
              width: '32px', 
              height: '32px', 
              border: '3px solid var(--primary)',
              borderTopColor: 'transparent',
              borderRadius: '50%'
            }} 
          />
        </div>
      </div>
    )
  }

  return (
    <div className="app-container" style={{ background: 'var(--bg-gray)', minHeight: '100vh' }}>
      {/* Header */}
      <header style={{
        position: 'sticky',
        top: 0,
        background: 'white',
        borderBottom: '1px solid #eee',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 100
      }}>
        <button 
          onClick={() => router.push('/dashboard')}
          style={{ 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer',
            fontSize: '20px',
            padding: '4px'
          }}
        >
          ←
        </button>
        <h1 style={{ fontSize: '18px', fontWeight: 700 }}>Mood Insights</h1>
      </header>

      <main style={{ padding: '16px', paddingBottom: '32px' }}>
        {/* Summary Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <StatCard 
            label="This Week" 
            value={stats.weeklyAvg.toFixed(1)}
            subtext="avg mood"
            highlight
          />
          <StatCard 
            label="This Month" 
            value={stats.monthlyAvg.toFixed(1)}
            subtext="avg mood"
          />
          <StatCard 
            label="Best Day" 
            value={stats.highest.toString()}
            subtext="highest"
          />
          <StatCard 
            label="Tough Day" 
            value={stats.lowest.toString()}
            subtext="lowest"
          />
        </div>

        {/* Charts */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <MoodHistoryViz entries={entries} />
        </div>

        {/* Full Entry List */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600 }}>
              All Check-ins ({stats.total})
            </h2>
          </div>

          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {entries.map((entry, i) => (
              <div 
                key={entry.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '12px 16px',
                  borderBottom: i < entries.length - 1 ? '1px solid #f5f5f5' : 'none'
                }}
              >
                <span style={{ fontSize: '28px' }}>{getMoodEmoji(entry.mood_score)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontWeight: 700, fontSize: '16px' }}>{entry.mood_score}/10</span>
                    <span style={{ color: 'var(--light-gray)', fontSize: '12px' }}>
                      {formatDate(entry.created_at)}
                    </span>
                  </div>
                  {entry.note && (
                    <p style={{ fontSize: '14px', color: 'var(--dark-gray)', marginBottom: '4px' }}>
                      {entry.note}
                    </p>
                  )}
                  {entry.coach_advice && (
                    <div style={{
                      background: 'rgba(29, 155, 240, 0.05)',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      marginTop: '6px'
                    }}>
                      <span style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '12px' }}>
                        🧠 Coach: 
                      </span>
                      <span style={{ fontSize: '13px', color: 'var(--dark-gray)', marginLeft: '4px' }}>
                        {entry.coach_advice}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Bottom Nav */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'white',
        borderTop: '1px solid #eee',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '8px 0 max(8px, env(safe-area-inset-bottom))',
        zIndex: 100
      }}>
        <NavButton icon="🏠" label="Home" onClick={() => router.push('/dashboard')} />
        <NavButton icon="⏱️" label="Focus" onClick={() => router.push('/focus')} />
        <NavButton icon="📊" label="Insights" active onClick={() => {}} />
      </nav>

      <style jsx global>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// Helper Components
const StatCard = ({ 
  label, 
  value, 
  subtext, 
  highlight 
}: { 
  label: string
  value: string
  subtext: string
  highlight?: boolean 
}) => (
  <div style={{
    background: highlight ? 'linear-gradient(135deg, var(--primary) 0%, #1a91da 100%)' : 'white',
    borderRadius: '12px',
    padding: '16px',
    color: highlight ? 'white' : 'inherit'
  }}>
    <p style={{ 
      fontSize: '12px', 
      opacity: highlight ? 0.9 : 0.6,
      marginBottom: '4px' 
    }}>
      {label}
    </p>
    <p style={{ fontSize: '28px', fontWeight: 700, marginBottom: '2px' }}>{value}</p>
    <p style={{ fontSize: '11px', opacity: highlight ? 0.8 : 0.5 }}>{subtext}</p>
  </div>
)

const NavButton = ({ icon, label, active, onClick }: { 
  icon: string
  label: string
  active?: boolean
  onClick: () => void 
}) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '8px 16px',
      color: active ? 'var(--primary)' : 'var(--light-gray)',
      fontSize: '20px'
    }}
  >
    <span>{icon}</span>
    <span style={{ fontSize: '11px', fontWeight: active ? 600 : 400 }}>{label}</span>
  </button>
)
