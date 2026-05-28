import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import './Leaderboard.css'

// Order matches the tiebreak chain applied to the leaderboard.
// First entry that differs from the player above is what broke the tie.
const TIEBREAK_KEYS = [
  ['exact_scores',      n => `${n} exact`],
  ['correct_results',   n => `${n} correct`],
  ['best_single_match', n => `${n} best match`],
  ['current_streak',    n => `${n}-match streak`],
  ['accuracy_pct',      n => `${n}% accuracy`],
]

function getTiebreakerLabel(entry, prev) {
  if (!prev || prev.total_points !== entry.total_points) return null
  for (const [key, fmt] of TIEBREAK_KEYS) {
    if (prev[key] !== entry[key]) return fmt(entry[key])
  }
  return 'alphabetical'
}

function compareEntries(a, b) {
  if (b.total_points !== a.total_points) return b.total_points - a.total_points
  for (const [key] of TIEBREAK_KEYS) {
    if (b[key] !== a[key]) return Number(b[key]) - Number(a[key])
  }
  const an = a.profile?.display_name ?? ''
  const bn = b.profile?.display_name ?? ''
  return an.localeCompare(bn)
}

function getTopBadge(entry) {
  if (entry.current_streak > 1) return { kind: 'streak', label: `${entry.current_streak} streak` }
  if (entry.best_single_match > 0) return { kind: 'best', label: `${entry.best_single_match} best` }
  if (entry.accuracy_pct > 0) return { kind: 'accuracy', label: `${entry.accuracy_pct}%` }
  return null
}

// Visual order of podium slots: 2nd place, 1st place (centered), 3rd place
const PODIUM_ORDER = [1, 0, 2]

const POLL_INTERVAL_MS = 30_000

export default function Leaderboard({ selectedGroup, hasLiveMatch, onShowHowItWorks, user }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [memberIds, setMemberIds] = useState(null)
  const [userCount, setUserCount] = useState(null)
  const lastEntryCount = useRef(5)

  useEffect(() => {
    let cancelled = false
    supabase.rpc('get_user_count').then(({ data, error: countError }) => {
      if (cancelled || countError) return
      setUserCount(typeof data === 'number' ? data : Number(data))
    })
    return () => { cancelled = true }
  }, [])

  const socialProof = userCount != null && userCount >= 10 ? (
    <div
      style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '13px',
        color: 'var(--gray-400)',
        textAlign: 'center',
        marginBottom: '16px',
      }}
    >
      <span style={{ fontWeight: 700, color: 'var(--green)' }}>{userCount}</span>
      {user ? ' players and counting' : ' players have joined the fun'}
    </div>
  ) : null

  // Resolve league members once per selected group; only re-runs when the group changes.
  useEffect(() => {
    setLoading(true)
    if (!selectedGroup) {
      setMemberIds(null)
      return
    }
    setMemberIds(null) // clear stale IDs while we refetch for the new group
    let cancelled = false
    supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', selectedGroup.id)
      .then(({ data, error: membersError }) => {
        if (cancelled) return
        if (membersError) {
          setError('Could not load league members.')
          setMemberIds([])
        } else {
          setMemberIds(data.map(m => m.user_id))
        }
      })
    return () => { cancelled = true }
  }, [selectedGroup])

  const fetchLeaderboard = useCallback(async () => {
    let query = supabase
      .from('leaderboard')
      .select('*, profile:profiles(display_name)')
      .order('total_points',      { ascending: false })
      .order('exact_scores',      { ascending: false })
      .order('correct_results',   { ascending: false })
      .order('best_single_match', { ascending: false })
      .order('current_streak',    { ascending: false })
      .order('accuracy_pct',      { ascending: false })

    if (selectedGroup) {
      if (memberIds === null) return
      query = query.in('user_id', memberIds)
    }

    const { data, error: leaderboardError } = await query
    if (leaderboardError) {
      setError('Could not load leaderboard.')
    } else {
      setError(null)
      // Apply alphabetical fallback for fully tied entries — Array.sort is stable,
      // so existing numeric order from the DB is preserved otherwise.
      const sorted = (data || []).slice().sort(compareEntries)
      setEntries(sorted)
      if (sorted.length) lastEntryCount.current = sorted.length
    }
    setLoading(false)
  }, [selectedGroup, memberIds])

  useEffect(() => {
    if (selectedGroup && memberIds === null) return
    fetchLeaderboard()
    if (!hasLiveMatch) return
    const interval = setInterval(fetchLeaderboard, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchLeaderboard, hasLiveMatch, selectedGroup, memberIds])

  if (loading) {
    return (
      <div className="leaderboard">
        <h2 className="leaderboard-title">Leaderboard</h2>
        {socialProof}
        {Array.from({ length: lastEntryCount.current }).map((_, i) => (
          <div key={i} className="skeleton-row" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="leaderboard">
        <h2 className="leaderboard-title">Leaderboard</h2>
        {socialProof}
        <div className="error-banner">{error}</div>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="leaderboard">
        <h2 className="leaderboard-title">Leaderboard</h2>
        {socialProof}
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2"/>
              <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2"/>
              <path d="M6 3h12v10a6 6 0 0 1-12 0V3z"/>
              <path d="M12 19v2"/>
              <path d="M8 21h8"/>
            </svg>
          </div>
          <div className="empty-state-title">No picks submitted yet</div>
          <div className="empty-state-body">Get tipping! Rankings will appear once matches are played.</div>
        </div>
        {onShowHowItWorks && (
          <button className="how-it-works-link" onClick={onShowHowItWorks}>
            How it works
          </button>
        )}
      </div>
    )
  }

  const showPodium = entries.length > 3
  const podiumCount = showPodium ? 3 : 0
  const top = entries.slice(0, podiumCount)
  const rest = entries.slice(podiumCount)

  return (
    <div className="leaderboard">
      <h2 className="leaderboard-title">Leaderboard</h2>
      {socialProof}
      <p className="leaderboard-tiebreak-note">
        Tied on points? See{' '}
        <button type="button" className="tiebreak-note-link" onClick={onShowHowItWorks}>
          How it works
        </button>{' '}
        for the tiebreak order.
      </p>

      {showPodium && (
        <div className="podium">
          {PODIUM_ORDER.map(idx => {
            const e = top[idx]
            const tiebreaker = getTiebreakerLabel(e, entries[idx - 1])
            const topBadge = getTopBadge(e)
            return (
              <div key={e.user_id} className="podium-slot">
                <div
                  className={`podium-avatar${idx === 0 ? ' podium-avatar--first' : ''}`}
                  data-rank={idx + 1}
                >
                  {idx + 1}
                </div>
                <div className="podium-name">{e.profile?.display_name ?? 'Player'}</div>
                <div className="podium-pts">{e.total_points}</div>
                <div className="podium-pts-label">pts</div>
                {e.last_5_form && (
                  <div className="form-row podium-form">
                    {e.last_5_form.split('').map((r, i) => (
                      <span key={i} className={`form-dot ${r === 'W' ? 'win' : 'loss'}`} />
                    ))}
                  </div>
                )}
                {topBadge && (
                  <span className={`badge podium-badge ${topBadge.kind}`}>{topBadge.label}</span>
                )}
                <span className={`tiebreaker-hint podium-tiebreaker${tiebreaker ? '' : ' is-empty'}`}>
                  {tiebreaker || ' '}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {rest.map((entry, index) => {
        const adjustedIndex = index + podiumCount
        const tiebreakerLabel = getTiebreakerLabel(entry, entries[adjustedIndex - 1])

        return (
          <div key={entry.user_id} className="leaderboard-entry">
            <div className="rank">{adjustedIndex + 1}</div>
            <div className="entry-info">
              <div className="entry-name">
                {entry.profile?.display_name ?? 'Player'}
              </div>
              <div className="entry-stats">
                {entry.exact_scores} exact · {entry.correct_results} correct
                {tiebreakerLabel && (
                  <span className="tiebreaker-hint"> · {tiebreakerLabel}</span>
                )}
              </div>
              <div className="power-stats">
                {entry.last_5_form && (
                  <div className="form-row">
                    {entry.last_5_form.split('').map((r, i) => (
                      <span key={i} className={`form-dot ${r === 'W' ? 'win' : 'loss'}`} />
                    ))}
                  </div>
                )}
                <div className="power-badges">
                  {entry.current_streak > 1 && (
                    <span className="badge streak">{entry.current_streak} streak</span>
                  )}
                  {entry.accuracy_pct > 0 && (
                    <span className="badge accuracy">{entry.accuracy_pct}%</span>
                  )}
                  {entry.best_single_match > 0 && (
                    <span className="badge best">{entry.best_single_match} best</span>
                  )}
                </div>
              </div>
            </div>
            <div>
              <div className="entry-points">{entry.total_points}</div>
              <div className="entry-points-label">pts</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
