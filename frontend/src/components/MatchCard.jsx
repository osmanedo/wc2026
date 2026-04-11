import { useState, useEffect } from 'react'
import ScorePicker from './ScorePicker'
import AIBrief from './AIBrief'
import './MatchCard.css'

export default function MatchCard({ match, user, existingPick, onPickSubmitted }) {
  const [showPicker, setShowPicker] = useState(false)
  const [showBrief, setShowBrief] = useState(false)
  const [now, setNow] = useState(Date.now())

  const kickoff = new Date(match.kickoff_utc).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  })

  const isFinished = match.status === 'FINISHED'
  const isTimed   = match.status === 'TIMED'

  const kickoffMs  = new Date(match.kickoff_utc).getTime()
  const msLeft     = kickoffMs - now
  const isUnder24h = msLeft > 0 && msLeft < 24 * 60 * 60 * 1000
  const isUrgent   = msLeft > 0 && msLeft < 60 * 60 * 1000  // under 1h

  // canPick: status must be TIMED and kickoff time must not have passed yet.
  // Client-side lock covering the gap before football-data.org flips to IN_PLAY.
  const canPick = isTimed && msLeft > 0

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

  const computePoints = () => {
    if (!existingPick || match.home_score == null || match.away_score == null) return null
    if (existingPick.points_earned != null) return existingPick.points_earned
    const multiplier = match.stage === 'FINAL' ? 3
      : ['LAST_32','LAST_16','QUARTER_FINALS','SEMI_FINALS'].includes(match.stage) ? 2
      : 1
    if (existingPick.pick_home === match.home_score && existingPick.pick_away === match.away_score)
      return 5 * multiplier
    if (getResult(existingPick.pick_home, existingPick.pick_away) === getResult(match.home_score, match.away_score))
      return 2 * multiplier
    return 0
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

  return (
    <div className="match-card">
      <div className="match-teams">
        <img className="team-flag" src={match.home_team.flag_url} alt={`${match.home_team.name} flag`} />
        <span className="team-name">{match.home_team.name}</span>
        <div className="match-center">
          {isFinished ? (
            <span className="score">{match.home_score} - {match.away_score}</span>
          ) : (
            <span className="kickoff-time">{kickoff}</span>
          )}
            <span className="timezone-label">
              Your time ({Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop().replace(/_/g, ' ')})
            </span>
          <span className={`status-badge ${match.status.toLowerCase()}`}>
            {isFinished ? 'FT' : match.status === 'TIMED' ? 'vs' : match.status}
          </span>
        </div>
        <span className="team-name right">{match.away_team.name}</span>
        <img className="team-flag" src={match.away_team.flag_url} alt={`${match.away_team.name} flag`} />
      </div>

      {existingPick && isFinished ? (
        <div className="pick-display">
          ✓ Your pick: {existingPick.pick_home} - {existingPick.pick_away}
          {pointsEarned != null && (
            <span className="points-badge">{pointsEarned} pts</span>
          )}
        </div>
      ) : existingPick && canPick ? (
        <div className="pick-display" style={{ cursor: 'pointer' }} onClick={() => setShowPicker(true)}>
          ✓ Your pick: {existingPick.pick_home} - {existingPick.pick_away}
          <span className="edit-hint">Tap to edit</span>
        </div>
      ) : existingPick ? (
        <div className="pick-display">
          ✓ Your pick: {existingPick.pick_home} - {existingPick.pick_away}
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
        <div className="pick-prompt sign-in">Sign in to start tipping</div>
      ) : null}

      {/* AI Brief trigger button — always visible */}
      <div className="ai-brief-row">
          <button
            className="ai-brief-btn"
            onClick={(e) => {
              e.stopPropagation()
              setShowBrief(true)
            }}
          >
            AI Brief & Prediction
          </button>
        </div>

      {showPicker && (
        <div onClick={(e) => e.stopPropagation()}>
          <ScorePicker
            match={match}
            user={user}
            onPickSubmitted={() => {
              setShowPicker(false)
              onPickSubmitted()
            }}
          />
          <button className="cancel-btn" onClick={(e) => {
            e.stopPropagation()
            setShowPicker(false)
          }}>Cancel</button>
        </div>
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
