import { forwardRef } from 'react'
import './WrappedShareCard.css'
import { percentileBadge, actualWinnerName, initials, fmt } from './wrappedUtils'

// Fixed 1080×1920 (Instagram story) card captured off-screen via html-to-image.
// Self-contained: no scroll, no interaction — it has to make sense in a
// stranger's feed. forwardRef so the modal can hand it to toPng().
const WrappedShareCard = forwardRef(function WrappedShareCard({ data }, ref) {
  if (!data) return null

  const { profile, rank, stats, final_pick } = data
  const badge = percentileBadge(rank?.final_rank, rank?.total_users)

  let finalLine = null
  if (final_pick && final_pick.predicted_correctly != null) {
    finalLine = final_pick.predicted_correctly
      ? `called the champion: ${final_pick.predicted_winner_name}`
      : `had ${final_pick.predicted_winner_name} · ${actualWinnerName(final_pick)} took it`
  }

  return (
    <div className="wsc" ref={ref}>
      {/* Identity header — logo is the hero mark, wordmark sits beneath it.
          Same-origin static asset, so no CORS concern for html-to-image. */}
      <div className="wsc-header">
        <img className="wsc-logo" src="/fifa-world-cup-2026-logo.png" alt="World Cup 2026" />
        <div className="wsc-wordmark">wc2026fantasy.app</div>
      </div>

      <div className="wsc-user">
        {profile?.avatar_url ? (
          <img className="wsc-avatar" src={profile.avatar_url} alt="" crossOrigin="anonymous" />
        ) : (
          <div className="wsc-avatar wsc-avatar--fallback">{initials(profile?.display_name)}</div>
        )}
        <div className="wsc-name">{profile?.display_name ?? 'player'}</div>
      </div>

      <div className="wsc-rank-block">
        <div className="wsc-rank">#{fmt(rank?.final_rank)}</div>
        <div className="wsc-rank-sub">of {fmt(rank?.total_users)}</div>
        {badge && <div className={`wsc-badge wsc-badge--${badge.tier}`}>{badge.label}</div>}
      </div>

      <div className="wsc-stats">
        <div className="wsc-stat">
          <div className="wsc-stat-num">{fmt(stats?.total_points)}</div>
          <div className="wsc-stat-label">points</div>
        </div>
        <div className="wsc-stat">
          <div className="wsc-stat-num">{fmt(stats?.exact_scores)}</div>
          <div className="wsc-stat-label">exact scores</div>
        </div>
        <div className="wsc-stat">
          <div className="wsc-stat-num">{stats?.accuracy_pct ?? 0}%</div>
          <div className="wsc-stat-label">accuracy</div>
        </div>
      </div>

      {finalLine && <div className="wsc-final">{finalLine}</div>}
    </div>
  )
})

export default WrappedShareCard
