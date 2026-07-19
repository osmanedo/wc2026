import { useState, useRef, useCallback, useEffect } from 'react'
import { toPng } from 'html-to-image'
import './WrappedModal.css'
import KofiButton from './KofiButton'
import WrappedShareCard from './WrappedShareCard'
import { percentileBadge, actualWinnerName, initials, fmt } from './wrappedUtils'

function Avatar({ url, name, className }) {
  const [failed, setFailed] = useState(false)
  if (url && !failed) {
    return (
      <img
        className={className}
        src={url}
        alt=""
        onError={() => setFailed(true)}
      />
    )
  }
  return <div className={`${className} wm-avatar--fallback`}>{initials(name)}</div>
}

// A minimal home–away flag/name/score strip reused by the best-match and
// final-pick panels.
function MatchStrip({ homeFlag, homeName, awayFlag, awayName, homeVal, awayVal }) {
  return (
    <div className="wm-match">
      <div className="wm-match-side">
        {homeFlag && <img className="wm-flag" src={homeFlag} alt="" />}
        <span className="wm-match-team">{homeName}</span>
      </div>
      <div className="wm-match-score">{homeVal}<span className="wm-match-dash">–</span>{awayVal}</div>
      <div className="wm-match-side">
        {awayFlag && <img className="wm-flag" src={awayFlag} alt="" />}
        <span className="wm-match-team">{awayName}</span>
      </div>
    </div>
  )
}

export default function WrappedModal({ data, onClose }) {
  const shareCardRef = useRef(null)
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState(null)

  // Lock background scroll for the lifetime of the modal so the page behind
  // doesn't drift while the user scroll-snaps through the panels.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const handleShare = useCallback(async () => {
    if (!shareCardRef.current || sharing) return
    setSharing(true)
    setShareError(null)
    try {
      const dataUrl = await toPng(shareCardRef.current, { pixelRatio: 2, cacheBust: true })
      const displayName = data?.profile?.display_name ?? 'player'
      const slug = displayName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'player'
      const filename = `wc2026-wrapped-${slug}.png`

      // On capable mobile browsers, offer the native share sheet with the PNG
      // blob first; fall back to a plain download everywhere else.
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], filename, { type: 'image/png' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'my wc2026 wrapped' })
          setSharing(false)
          return
        } catch {
          // user dismissed the share sheet — fall through to download
        }
      }
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = filename
      link.click()
    } catch (err) {
      console.error('wrapped share failed', err)
      setShareError('could not generate image. try again.')
    } finally {
      setSharing(false)
    }
  }, [data, sharing])

  if (!data) return null

  const { profile, rank, stats, best_match, longest_streak, final_pick } = data

  const badge = percentileBadge(rank?.final_rank, rank?.total_users)

  const showVolume = (stats?.total_points ?? 0) > 0
  const showBest = !!best_match
  const showStreak = !!longest_streak && (longest_streak.streak_length ?? 0) >= 2
  const showFinal = !!final_pick && final_pick.predicted_correctly != null
  const bestIsExact = showBest &&
    best_match.pick_home === best_match.home_score &&
    best_match.pick_away === best_match.away_score

  return (
    <div className="wm-overlay" role="dialog" aria-modal="true" aria-label="your world cup 2026 wrapped">
      <button className="wm-close" onClick={onClose} aria-label="close">✕</button>

      <div className="wm-scroll">
        {/* Panel 1 — Intro */}
        <section className="wm-panel">
          {/* Small logo accent — sits like a hat on the heading, signals
              authenticity without competing as the visual hero. */}
          <img className="wm-intro-logo" src="/fifa-world-cup-2026-logo.png" alt="World Cup 2026" />
          <h2 className="wm-heading">Your World Cup 2026, wrapped</h2>
          <Avatar url={profile?.avatar_url} name={profile?.display_name} className="wm-avatar" />
          <div className="wm-name">{profile?.display_name ?? 'player'}</div>
          {/* Signup count (1,320) includes the 235 who never picked; panel 2's
              "of {total_users}" uses the picked-users denominator for rank. */}
          <p className="wm-copy">1,320 tippers joined. You made it to the end!</p>
          <div className="wm-scroll-hint">scroll ↓</div>
        </section>

        {/* Panel 2 — Rank */}
        <section className="wm-panel">
          <div className="wm-hero">#{fmt(rank?.final_rank)}</div>
          <div className="wm-hero-sub">of {fmt(rank?.total_users)}</div>
          {badge && <div className={`wm-badge wm-badge--${badge.tier}`}>{badge.label}</div>}
        </section>

        {/* Panel 3 — Volume */}
        {showVolume && (
          <section className="wm-panel">
            <div className="wm-hero wm-hero--accent">{fmt(stats.total_points)}</div>
            <div className="wm-hero-label">points</div>
            <div className="wm-statrow">
              <div className="wm-stat">
                <div className="wm-stat-num">{fmt(stats.exact_scores)}</div>
                <div className="wm-stat-label">exact scores</div>
              </div>
              <div className="wm-stat">
                <div className="wm-stat-num">{fmt(stats.correct_results)}</div>
                <div className="wm-stat-label">correct results</div>
              </div>
              <div className="wm-stat">
                <div className="wm-stat-num">{stats.accuracy_pct ?? 0}%</div>
                <div className="wm-stat-label">accuracy</div>
              </div>
            </div>
          </section>
        )}

        {/* Panel 4 — Best match */}
        {showBest && (
          <section className="wm-panel">
            <h2 className="wm-heading">Your best match</h2>
            <MatchStrip
              homeFlag={best_match.home_flag}
              homeName={best_match.home_team_name}
              awayFlag={best_match.away_flag}
              awayName={best_match.away_team_name}
              homeVal={best_match.home_score}
              awayVal={best_match.away_score}
            />
            <p className="wm-copy">You picked {best_match.pick_home}–{best_match.pick_away}</p>
            <p className="wm-copy wm-copy--dim">Final: {best_match.home_score}–{best_match.away_score}</p>
            <div className="wm-hero wm-hero--accent">{fmt(best_match.points)}</div>
            <div className="wm-hero-label">points</div>
            {bestIsExact && <div className="wm-badge wm-badge--gold">exact score</div>}
          </section>
        )}

        {/* Panel 5 — Longest streak */}
        {showStreak && (
          <section className="wm-panel">
            <div className="wm-hero wm-hero--accent">{fmt(longest_streak.streak_length)}</div>
            <div className="wm-hero-label">in a row</div>
            <p className="wm-copy">
              Your best run — {longest_streak.start_match_label} to {longest_streak.end_match_label}
            </p>
          </section>
        )}

        {/* Panel 6 — Final pick */}
        {showFinal && (
          final_pick.predicted_correctly ? (
            <section className="wm-panel wm-panel--won">
              <h2 className="wm-heading">You called it!.</h2>
              <p className="wm-copy">{final_pick.predicted_winner_name} are your World Champions.</p>
              <MatchStrip
                homeFlag={final_pick.home_flag}
                homeName={final_pick.home_team_name}
                awayFlag={final_pick.away_flag}
                awayName={final_pick.away_team_name}
                homeVal={final_pick.actual_home}
                awayVal={final_pick.actual_away}
              />
            </section>
          ) : (
            <section className="wm-panel">
              <h2 className="wm-heading">you had {final_pick.predicted_winner_name}.</h2>
              <p className="wm-copy">
                {actualWinnerName(final_pick)} took it from you, ouch. {final_pick.actual_home}–{final_pick.actual_away}.
              </p>
              <MatchStrip
                homeFlag={final_pick.home_flag}
                homeName={final_pick.home_team_name}
                awayFlag={final_pick.away_flag}
                awayName={final_pick.away_team_name}
                homeVal={final_pick.actual_home}
                awayVal={final_pick.actual_away}
              />
            </section>
          )
        )}

        {/* Panel 7 — Goodbye */}
        <section className="wm-panel">
          <h2 className="wm-heading">Thanks for playing</h2>
          <p className="wm-copy">WC2026 fantasy is closing 1 week after the final. The leaderboard stays live.</p>
          <p className="wm-copy wm-copy--dim">if you enjoyed it, don't forget to shout me a beer</p>
          <div className="wm-kofi"><KofiButton username="ozeduardoperez" /></div>
          <button className="wm-share-btn" onClick={handleShare} disabled={sharing}>
            {sharing ? 'generating…' : 'share your wrapped'}
          </button>
          {shareError && <div className="wm-share-error">{shareError}</div>}
        </section>
      </div>

      {/* Off-screen capture target */}
      <div className="wm-sharecard-holder" aria-hidden="true">
        <WrappedShareCard ref={shareCardRef} data={data} />
      </div>
    </div>
  )
}
