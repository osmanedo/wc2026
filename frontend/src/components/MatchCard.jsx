import { useState, useEffect } from 'react'
import ScorePicker from './ScorePicker'
import AIBrief from './AIBrief'
import ConsensusBar from './ConsensusBar'
import './MatchCard.css'

export default function MatchCard({ match, user, existingPick, onPickSubmitted, onSignIn, showBriefs = true, onViewDetail }) {
  const [showPicker, setShowPicker] = useState(false)
  const [showBrief, setShowBrief] = useState(false)
  const [now, setNow] = useState(Date.now())

  const kickoff = new Date(match.kickoff_utc).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  })

  const isFinished = match.status === 'FINISHED'
  const isTimed   = match.status === 'TIMED'
  const isLive    = ['IN_PLAY', 'PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'].includes(match.status)

  const kickoffMs  = new Date(match.kickoff_utc).getTime()
  const msLeft     = kickoffMs - now
  const isUnder24h = msLeft > 0 && msLeft < 24 * 60 * 60 * 1000
  const isUrgent   = msLeft > 0 && msLeft < 60 * 60 * 1000  // under 1h

  // canPick: status must be TIMED and kickoff time must not have passed yet.
  // Client-side lock covering the gap before football-data.org flips to IN_PLAY.
  const canPick = isTimed && msLeft > 0

  // Whether a post-match summary has actually been generated yet. The embedded
  // ai_briefs relation comes back as an array (one row max per the unique
  // match_id constraint). We only flip the button copy once the summary exists,
  // so the label never promises a summary the modal can't yet show.
  const aiBrief = Array.isArray(match.ai_briefs) ? match.ai_briefs[0] : match.ai_briefs
  const hasSummary = isFinished && !!aiBrief?.post_match_summary

  // Show live or final score; otherwise show kickoff time. Null guard handles
  // the brief window where status flips to IN_PLAY before scores are written.
  const showScore = (isFinished || isLive) && match.home_score != null

  // Penalty shootout result. Both columns are only populated when a match was
  // decided on penalties; the side with the higher count is highlighted as the winner.
  const decidedOnPenalties = match.home_penalties != null && match.away_penalties != null

  // Short label for the status badge. Group stage only ever hits TIMED/IN_PLAY/
  // FINISHED — PAUSED/ET/PEN only show up in knockouts (from June 27).
  const statusLabel =
    isFinished ? 'FT' :
    isTimed    ? 'vs' :
    match.status === 'PAUSED'            ? 'HT'  :
    match.status === 'EXTRA_TIME'        ? 'ET'  :
    match.status === 'PENALTY_SHOOTOUT'  ? 'PEN' :
    isLive     ? 'LIVE' :
    match.status

  // Tick every 30s so the countdown stays fresh
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [])

  // Close picker if match is no longer pickable (status flipped or kickoff passed)
  useEffect(() => {
    if (showPicker && !canPick) setShowPicker(false)
  }, [match.status, msLeft])

  const getResult = (home, away) => home > away ? 'HOME' : away > home ? 'AWAY' : 'DRAW'

  // Mirrors the server-side calculate_points function. Used as a fallback for
  // the (very narrow) window between the score being set in the DB and
  // calculate_points populating points_earned. If the two ever drift, the
  // server is the source of truth — this is only a stopgap for display.
  const computePoints = () => {
    if (!existingPick || match.home_score == null || match.away_score == null) return null
    if (existingPick.points_earned != null) return existingPick.points_earned

    const multiplier = match.stage === 'FINAL' ? 3
      : ['LAST_32','LAST_16','QUARTER_FINALS','SEMI_FINALS','THIRD_PLACE'].includes(match.stage) ? 2
      : 1

    // Score-based base points
    let base = 0
    if (existingPick.pick_home === match.home_score && existingPick.pick_away === match.away_score) {
      base = 5
    } else if (getResult(existingPick.pick_home, existingPick.pick_away) === getResult(match.home_score, match.away_score)) {
      base = 2
    }

    // Advancement bonus (knockouts only). Requires the match.winner field to be set.
    let bonus = 0
    if (match.stage !== 'GROUP_STAGE' && match.winner) {
      const predictedAdvancer =
        existingPick.pick_home > existingPick.pick_away ? 'HOME_TEAM' :
        existingPick.pick_away > existingPick.pick_home ? 'AWAY_TEAM' :
        existingPick.pick_winner
      if (predictedAdvancer && predictedAdvancer === match.winner) bonus = 1
    }

    return (base + bonus) * multiplier
  }

  const pointsEarned = computePoints()

  const getCountdown = () => {
    const totalMins = Math.floor(msLeft / 60_000)
    const hours = Math.floor(totalMins / 60)
    const mins  = totalMins % 60
    if (hours > 0) return `Kicks off in ${hours}h ${mins}m - Tip Soon!`
    if (totalMins > 0) return `Kicks off in ${totalMins}m - Tip Now!`
    return 'Kicking off soon - Finalise your tip!'
  }

  // Surface the advancement pick alongside the score so users can see it
  // without having to re-open the picker. Only relevant for knockout draws.
  const advancerName = existingPick?.pick_winner === 'HOME_TEAM'
    ? match.home_team.name
    : existingPick?.pick_winner === 'AWAY_TEAM'
      ? match.away_team.name
      : null

  const renderPickDisplay = () => {
    if (!existingPick) return null
    return (
      <>
        ✓ Your pick: {existingPick.pick_home} - {existingPick.pick_away}
        {advancerName && (
          <span className="pick-advancer-tag"> ({advancerName} to advance)</span>
        )}
      </>
    )
  }

  return (
    <div className={`match-card${isFinished ? ' finished' : ''}`}>
      <div className="match-teams">
        <img
          className="team-flag"
          src={match.home_team.flag_url}
          alt={`${match.home_team.name} flag`}
          width="40"
          height="30"
        />
        <span className="team-name">{match.home_team.name}</span>
        <div className="match-center">
          {showScore ? (
            <span className="score">{match.home_score} - {match.away_score}</span>
          ) : (
            <span className="kickoff-time">{kickoff}</span>
          )}
          {showScore && decidedOnPenalties && (
            <span className="penalty-result">
              <span className={match.home_penalties > match.away_penalties ? 'pen-winner' : ''}>{match.home_penalties}</span>
              {' - '}
              <span className={match.away_penalties > match.home_penalties ? 'pen-winner' : ''}>{match.away_penalties}</span>
              <span className="pen-label"> pens</span>
            </span>
          )}
            <span className="timezone-label">
              Your time ({Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop().replace(/_/g, ' ')})
            </span>
          <span className={`status-badge ${match.status.toLowerCase()}`}>{statusLabel}</span>
        </div>
        <span className="team-name right">{match.away_team.name}</span>
        <img
          className="team-flag"
          src={match.away_team.flag_url}
          alt={`${match.away_team.name} flag`}
          width="40"
          height="30"
        />
      </div>

      {(isLive || isFinished) && (
        <div style={{ minHeight: '100px' }}>
          <ConsensusBar
            matchId={match.id}
            userPick={existingPick}
            onClick={() => onViewDetail?.(match)}
          />
        </div>
      )}

      <div className="pick-action-row">
        <div className="pick-action-left">
          {existingPick && isFinished ? (
            <div className="pick-display">
              {renderPickDisplay()}
              {pointsEarned != null && (
                <span className="points-badge">{pointsEarned} pts</span>
              )}
            </div>
          ) : existingPick && canPick ? (
            <div className="pick-display" style={{ cursor: 'pointer' }} onClick={() => setShowPicker(true)}>
              {renderPickDisplay()}
              <span className="edit-hint">Tap to edit</span>
            </div>
          ) : existingPick ? (
            <div className="pick-display">
              {renderPickDisplay()}
            </div>
          ) : !canPick && !isFinished ? (
            <div className="locked-badge">🔒 Locked</div>
          ) : canPick && user && isUnder24h ? (
            <div className={`pick-prompt countdown${isUrgent ? ' urgent' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setShowPicker(true)}>
              ⏱ {getCountdown()}
            </div>
          ) : canPick && user ? (
            <div className="pick-prompt tap-to-tip" style={{ cursor: 'pointer' }} onClick={() => setShowPicker(true)}>Tap to tip</div>
          ) : canPick && !user ? (
            <button className="pick-prompt sign-in" onClick={onSignIn}>Sign in to start tipping</button>
          ) : null}
        </div>

        {showBriefs && (
          <button
            className="ai-brief-btn"
            onClick={(e) => {
              e.stopPropagation()
              setShowBrief(true)
            }}
          >
            {hasSummary ? 'AI Match Summary' : 'AI Brief & Prediction'}
          </button>
        )}
      </div>

      {showPicker && (
        <ScorePicker
          match={match}
          user={user}
          existingPick={existingPick}
          onPickSubmitted={() => {
            setShowPicker(false)
            onPickSubmitted()
          }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* AI Brief modal */}
      {showBrief && (
        <AIBrief
          matchId={match.id}
          isFinished={isFinished}
          onClose={() => setShowBrief(false)}
        />
      )}
    </div>
  )
}