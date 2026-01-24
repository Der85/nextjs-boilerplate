'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface BurnoutEntry {
  id: string
  energy_level: number
  stress_level: number
  sleep_quality: number
  note: string | null
  created_at: string
}

const getBatteryEmoji = (level: number): string => {
  if (level <= 2) return '🪫'
  if (level <= 4) return '🔋'
  if (level <= 6) return '🔋'
  if (level <= 8) return '🔋'
  return '⚡'
}

const getBatteryColor = (level: number): string => {
  if (level <= 3) return 'var(--danger)'
  if (level <= 5) return 'var(--warning)'
  return 'var(--success)'
}

export default function BurnoutPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [view, setView] = useState<'check' | 'history'>('check')
  const [entries, setEntries] = useState<BurnoutEntry[]>([])
  
  const [energy, setEnergy] = useState<number | null>(null)
  const [stress, setStress] = useState<number | null>(null)
  const [sleep, setSleep] = useState<number | null>(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      await fetchEntries(session.user.id)
      setLoading(false)
    }
    init()
  }, [router])

  const fetchEntries = async (userId: string) => {
    const { data } = await supabase
      .from('burnout_checks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)
    if (data) setEntries(data)
  }

  const handleSubmit = async () => {
    if (!user || energy === null || stress === null || sleep === null) return
    setSaving(true)
    
    await supabase.from('burnout_checks').insert({
      user_id: user.id,
      energy_level: energy,
      stress_level: stress,
      sleep_quality: sleep,
      note: note || null
    })

    setEnergy(null)
    setStress(null)
    setSleep(null)
    setNote('')
    if (user) await fetchEntries(user.id)
    setSaving(false)
    setView('history')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  const getOverallScore = (e: BurnoutEntry) => {
    return Math.round((e.energy_level + (10 - e.stress_level) + e.sleep_quality) / 3)
  }

  if (loading) {
    return (
      <div className="app-container flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--warning)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="app-container">
      <div className="top-bar">
        <div className="top-bar-inner">
          <button onClick={() => router.push('/dashboard')} className="btn btn-ghost btn-icon">←</button>
          <h1 style={{ fontSize: '19px', fontWeight: 800 }}>Battery Check</h1>
          <div style={{ width: '36px' }} />
        </div>
      </div>

      <div className="main-content">
        <div className="tabs">
          <button className={`tab ${view === 'check' ? 'tab-active' : ''}`} onClick={() => setView('check')}>Check in</button>
          <button className={`tab ${view === 'history' ? 'tab-active' : ''}`} onClick={() => setView('history')}>History</button>
        </div>

        {view === 'check' && (
          <div className="compose-box">
            <div className="text-center mb-4">
              <span className="emoji-large">🔋</span>
              <h2 className="text-xl font-extrabold mt-2">How's your battery?</h2>
            </div>

            <div className="mb-4">
              <p className="font-bold mb-2">Energy level</p>
              <p className="text-sm text-muted mb-2">1 = exhausted, 10 = fully charged</p>
              <div className="rating-grid">
                {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                  <button key={n} onClick={() => setEnergy(n)}
                    className={`rating-btn ${energy === n ? 'rating-btn-active' : ''}`}
                    style={energy === n ? { background: getBatteryColor(n), borderColor: getBatteryColor(n) } : {}}>{n}</button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <p className="font-bold mb-2">Stress level</p>
              <p className="text-sm text-muted mb-2">1 = calm, 10 = overwhelmed</p>
              <div className="rating-grid">
                {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                  <button key={n} onClick={() => setStress(n)}
                    className={`rating-btn ${stress === n ? 'rating-btn-active' : ''}`}
                    style={stress === n ? { background: 'var(--danger)', borderColor: 'var(--danger)' } : {}}>{n}</button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <p className="font-bold mb-2">Sleep quality</p>
              <p className="text-sm text-muted mb-2">1 = terrible, 10 = great</p>
              <div className="rating-grid">
                {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                  <button key={n} onClick={() => setSleep(n)}
                    className={`rating-btn ${sleep === n ? 'rating-btn-active' : ''}`}
                    style={sleep === n ? { background: 'var(--primary)', borderColor: 'var(--primary)' } : {}}>{n}</button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <p className="font-bold mb-2">Notes (optional)</p>
              <textarea value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Anything affecting your energy?" className="input" rows={2} style={{ minHeight: 'auto' }} />
            </div>

            <button onClick={handleSubmit} disabled={energy === null || stress === null || sleep === null || saving}
              className="btn btn-primary w-full" style={{ background: 'var(--warning)' }}>
              {saving ? 'Saving...' : 'Log battery check'}
            </button>
          </div>
        )}

        {view === 'history' && (
          <>
            {entries.length === 0 ? (
              <div className="card text-center" style={{ padding: '40px 15px' }}>
                <span className="emoji-large">🔋</span>
                <p className="font-bold mt-3">No checks yet</p>
                <p className="text-sm text-muted mt-1">Start tracking your energy levels</p>
                <button onClick={() => setView('check')} className="btn btn-primary mt-4" style={{ background: 'var(--warning)' }}>
                  First check-in
                </button>
              </div>
            ) : (
              entries.map((entry) => {
                const overall = getOverallScore(entry)
                return (
                  <div key={entry.id} className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '32px' }}>{getBatteryEmoji(overall)}</span>
                      <div style={{ flex: 1 }}>
                        <p className="font-bold">Overall: {overall}/10</p>
                        <p className="text-sm text-muted">{formatDate(entry.created_at)}</p>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '16px', marginBottom: entry.note ? '12px' : '0' }}>
                      <div>
                        <p className="text-sm text-muted">Energy</p>
                        <p className="font-bold" style={{ color: getBatteryColor(entry.energy_level) }}>{entry.energy_level}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted">Stress</p>
                        <p className="font-bold" style={{ color: entry.stress_level > 6 ? 'var(--danger)' : 'var(--dark-gray)' }}>{entry.stress_level}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted">Sleep</p>
                        <p className="font-bold" style={{ color: 'var(--primary)' }}>{entry.sleep_quality}</p>
                      </div>
                    </div>

                    {entry.note && (
                      <p className="text-sm" style={{ borderTop: '1px solid var(--extra-light-gray)', paddingTop: '12px' }}>{entry.note}</p>
                    )}
                  </div>
                )
              })
            )}
          </>
        )}

        <div style={{ height: '50px' }} />
      </div>
    </div>
  )
}
