import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import './Leaderboard.css'
import './GlobalLeaderboard.css'

const TOP_N = 10
const NEIGHBORS = 3
const PAGE_SIZE = 50
const POLL_INTERVAL_MS = 30_000
const SKELETON_ROWS = 8

function LeaderRow({ entry, rank, isCurrentUser }) {
  return (
    <div className={`gl-row${isCurrentUser ? ' gl-row--me' : ''}`}>
      <div className="gl-rank">{rank}</div>
      <div className="gl-name">
        {entry.display_name ?? entry.profile?.display_name ?? 'Player'}
        {isCurrentUser && <span className="gl-you">You</span>}
      </div>
      <div className="gl-points">
        {entry.total_points}
        <span className="gl-points-label">pts</span>
      </div>
    </div>
  )
}

function EmptyState({ onShowHowItWorks }) {
  return (
    <>
      <div className="empty-state">
        <div className="empty-state-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" />
            <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
            <path d="M6 3h12v10a6 6 0 0 1-12 0V3z" />
            <path d="M12 19v2" />
            <path d="M8 21h8" />
          </svg>
        </div>
        <div className="empty-state-title">No picks scored yet</div>
        <div className="empty-state-body">Get tipping! Rankings will appear once matches begin.</div>
      </div>
      {onShowHowItWorks && (
        <button className="how-it-works-link" onClick={onShowHowItWorks}>
          How it works
        </button>
      )}
    </>
  )
}

export default function GlobalLeaderboard({ hasLiveMatch, onShowHowItWorks, user }) {
  const [mode, setMode] = useState('neighborhood') // 'neighborhood' | 'full'

  // Neighborhood view state
  const [topRows, setTopRows] = useState([])
  const [neighborhoodRows, setNeighborhoodRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Full view state
  const [fullRows, setFullRows] = useState([])
  const [fullLoading, setFullLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [fullError, setFullError] = useState(null)

  // Social proof
  const [userCount, setUserCount] = useState(null)

  useEffect(() => {
    let cancelled = false
    supabase.rpc('get_user_count').then(({ data, error: countError }) => {
      if (cancelled || countError) return
      setUserCount(typeof data === 'number' ? data : Number(data))
    })
    return () => { cancelled = true }
  }, [])

  const socialProof = userCount != null && userCount >= 10 ? (
    <div className="gl-social-proof">
      <span className="gl-social-proof-count">{userCount}</span>
      {user ? ' players and counting' : ' players have joined the fun'}
    </div>
  ) : null

  // --- Neighborhood (default) view ---------------------------------------
  const fetchNeighborhood = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc('get_leaderboard_neighborhood', {
      p_user_id: user?.id ?? null,
      p_top_n: TOP_N,
      p_neighbors: NEIGHBORS,
    })
    if (rpcError) {
      setError('Could not load leaderboard.')
      setLoading(false)
      return
    }
    setError(null)
    const rows = data || []
    const top = rows.filter(r => r.section === 'top')
    const neighborhood = rows.filter(r => r.section === 'neighborhood')
    setTopRows(top)
    setNeighborhoodRows(neighborhood)
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    if (mode !== 'neighborhood') return
    fetchNeighborhood()
    if (!hasLiveMatch) return
    const interval = setInterval(fetchNeighborhood, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [mode, fetchNeighborhood, hasLiveMatch])

  // --- Full paginated view ------------------------------------------------
  // Uses get_leaderboard_page RPC so the full tiebreaker chain (including
  // alphabetical fallback on display_name) is applied server-side, matching
  // the ordering produced by get_leaderboard_neighborhood.
  const fetchFullPage = useCallback(async (offset) => {
    return supabase.rpc('get_leaderboard_page', {
      p_offset: offset,
      p_limit: PAGE_SIZE,
    })
  }, [])

  const openFullView = useCallback(async () => {
    setMode('full')
    setFullLoading(true)
    setFullError(null)
    setFullRows([])
    setHasMore(false)
    const { data, error: pageError } = await fetchFullPage(0)
    if (pageError) {
      setFullError('Could not load leaderboard.')
      setFullLoading(false)
      return
    }
    const rows = data || []
    setFullRows(rows)
    setHasMore(rows.length === PAGE_SIZE)
    setFullLoading(false)
  }, [fetchFullPage])

  const loadMore = useCallback(async () => {
    setLoadingMore(true)
    const { data, error: pageError } = await fetchFullPage(fullRows.length)
    if (pageError) {
      setFullError('Could not load more.')
      setLoadingMore(false)
      return
    }
    const rows = data || []
    setFullRows(prev => [...prev, ...rows])
    setHasMore(rows.length === PAGE_SIZE)
    setLoadingMore(false)
  }, [fetchFullPage, fullRows.length])

  const backToSummary = useCallback(() => {
    setMode('neighborhood')
  }, [])

  // --- Render helpers -----------------------------------------------------
  const renderSkeleton = (count) => (
    Array.from({ length: count }).map((_, i) => <div key={i} className="skeleton-row gl-skeleton" />)
  )

  const renderNeighborhood = () => {
    if (loading) return renderSkeleton(SKELETON_ROWS)
    if (error) return <div className="error-banner">{error}</div>
    if (topRows.length === 0) return <EmptyState onShowHowItWorks={onShowHowItWorks} />

    const userInTop = user && topRows.some(r => r.user_id === user.id)
    const hasNeighborhood = neighborhoodRows.length > 0
    // Gap between the top block (ends at TOP_N) and the first neighborhood row.
    // Only show a divider when ranks are actually hidden between them.
    const lowestNeighborRank = hasNeighborhood ? neighborhoodRows[0].rank : null
    const gap = hasNeighborhood ? lowestNeighborRank - TOP_N - 1 : 0
    // Logged-in user with no leaderboard entry yet: not in the top block and
    // no neighborhood returned.
    const userMissing = user && !userInTop && !hasNeighborhood

    return (
      <>
        <div className="gl-block">
          {topRows.map(r => (
            <LeaderRow key={r.user_id} entry={r} rank={r.rank} isCurrentUser={user?.id === r.user_id} />
          ))}
        </div>

        {hasNeighborhood && (
          <>
            {gap > 0 && (
              <div className="gl-divider">
                — {gap} {gap === 1 ? 'other' : 'others'} —
              </div>
            )}
            <div className="gl-block">
              {neighborhoodRows.map(r => (
                <LeaderRow key={r.user_id} entry={r} rank={r.rank} isCurrentUser={user?.id === r.user_id} />
              ))}
            </div>
          </>
        )}

        {userMissing && (
          <div className="gl-hint">Your ranking will appear once matches begin.</div>
        )}

        {!user && (
          <div className="gl-hint">Sign in to see your position</div>
        )}

        <button type="button" className="gl-toggle" onClick={openFullView}>
          View full leaderboard →
        </button>
      </>
    )
  }

  const renderFull = () => (
    <>
      <button type="button" className="gl-back" onClick={backToSummary}>
        ← Back to summary
      </button>

      {fullLoading ? (
        renderSkeleton(10)
      ) : fullError && fullRows.length === 0 ? (
        <div className="error-banner">{fullError}</div>
      ) : fullRows.length === 0 ? (
        <EmptyState onShowHowItWorks={onShowHowItWorks} />
      ) : (
        <>
          <div className="gl-block">
            {fullRows.map((entry, i) => (
              <LeaderRow
                key={entry.user_id}
                entry={entry}
                rank={entry.rank ?? i + 1}
                isCurrentUser={user?.id === entry.user_id}
              />
            ))}
          </div>
          {fullError && <div className="error-banner">{fullError}</div>}
          {hasMore && (
            <button type="button" className="gl-load-more" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </>
  )

  return (
    <div className="leaderboard">
      <h2 className="leaderboard-title">Leaderboard</h2>
      {socialProof}
      {mode === 'neighborhood' ? renderNeighborhood() : renderFull()}
    </div>
  )
}