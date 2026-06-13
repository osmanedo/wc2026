import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import './ConsensusBar.css'

export default function ConsensusBar({ matchId, userPick, onClick }) {
  const [dist, setDist] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase.rpc('get_match_pick_distribution', {
        p_match_id: Number(matchId),
      })
      if (cancelled) return
      if (error || !data || !data.length) return
      setDist(data[0])
    }
    load()
    return () => { cancelled = true }
  }, [matchId])

  if (!dist || dist.total === 0) return null

  const homePct = Math.round((dist.home_wins / dist.total) * 100)
  const drawPct = Math.round((dist.draws / dist.total) * 100)
  const awayPct = Math.max(0, 100 - homePct - drawPct)

  let userSegment = null
  if (userPick) {
    if (userPick.pick_home > userPick.pick_away) userSegment = 'home'
    else if (userPick.pick_home < userPick.pick_away) userSegment = 'away'
    else userSegment = 'draw'
  }

  // Horizontal position (center of the user's segment) for the pick marker.
  let userPos = null
  if (userSegment === 'home') userPos = homePct / 2
  else if (userSegment === 'draw') userPos = homePct + drawPct / 2
  else if (userSegment === 'away') userPos = homePct + drawPct + awayPct / 2

  const userLabel = userSegment === 'home' ? 'Home' : userSegment === 'away' ? 'Away' : 'Draw'

  // Keep the label inside the card even when the marker sits near an edge.
  let labelStyle = { left: `${userPos}%`, transform: 'translateX(-50%)' }
  if (userPos != null && userPos <= 12) labelStyle = { left: 0 }
  else if (userPos != null && userPos >= 88) labelStyle = { right: 0 }

  return (
    <div
      className={`consensus-bar${onClick ? ' tappable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="consensus-header">
        <span className="consensus-stats">
          <span className={`stat home${userSegment === 'home' ? ' user' : ''}`}>
            Home {homePct}%
          </span>
          <span className="dot">·</span>
          <span className={`stat draw${userSegment === 'draw' ? ' user' : ''}`}>
            Draw {drawPct}%
          </span>
          <span className="dot">·</span>
          <span className={`stat away${userSegment === 'away' ? ' user' : ''}`}>
            Away {awayPct}%
          </span>
        </span>
        <span className="consensus-right">
          <span className="consensus-total">{dist.total.toLocaleString()} picks</span>
        </span>
      </div>
      <div className="consensus-track-wrap">
        <div className="consensus-track">
          <div
            className={`consensus-segment home${userSegment === 'home' ? ' user' : ''}`}
            style={{ width: `${homePct}%` }}
          />
          <div
            className={`consensus-segment draw${userSegment === 'draw' ? ' user' : ''}`}
            style={{ width: `${drawPct}%` }}
          />
          <div
            className={`consensus-segment away${userSegment === 'away' ? ' user' : ''}`}
            style={{ width: `${awayPct}%` }}
          />
        </div>
        {userPos != null && (
          <>
            <span className="consensus-marker-pin" style={{ left: `${userPos}%` }} />
            <span className="consensus-marker-label" style={labelStyle}>You · {userLabel}</span>
          </>
        )}
      </div>
      {onClick && (
        <div className="consensus-cta">
          Tap to see your league's picks <span className="consensus-cta-arrow">→</span>
        </div>
      )}
    </div>
  )
}
