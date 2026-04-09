import { useState, useEffect } from 'react'
import ScorePicker from './ScorePicker'
import AIBrief from './AIBrief'
import './MatchCard.css'

export default function MatchCard({ match, user, existingPick, onPickSubmitted }) {
  const [showPicker, setShowPicker] = useState(false)
  const [showBrief, setShowBrief] = useState(false)
  const [now, setNow] = useState(Date.now())

  // Tick every 30s so the countdown stays fresh
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [])

  const kickoff = new Date(match.kickoff_utc).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  })

  const isFinished = match.status === 'FINISHED'
  const isTimed   = match.status === 'TIMED'
  const isLocked  = !isTimed && !isFinished

  const kickoffMs = new Date(match.kickoff_utc).getTime()
  const msLeft    = kickoffMs - now
  const isUnder24h = msLeft > 0 && msLeft < 24 * 60 * 60 * 1000
  const isUrgent   = msLeft > 0 && msLeft < 60 * 60 * 1000  // under 1h

  const getCountdown = () => {
    const totalMins = Math.floor(msLeft / 60_000)
    const hours = Math.floor(totalMins / 60)
    const mins  = totalMins % 60
    if (hours > 0) return `Kicks off in ${hours}h ${mins}m - Tip Soon!`
    if (totalMins > 0) return `Kicks off in ${totalMins}m - Tip Now!`
    return 'Kicking off soon - Finalise your tip!'
  }

  return (
    <div className="match-card" onClick={() => isTimed && user && setShowPicker(true)}>
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
              {Intl.DateTimeFormat().resolvedOptions().timeZone.replace('Australia/', '')}
            </span>
          <span className={`status-badge ${match.status.toLowerCase()}`}>
            {isFinished ? 'FT' : match.status === 'TIMED' ? 'vs' : match.status}
          </span>
        </div>
        <span className="team-name right">{match.away_team.name}</span>
        <img className="team-flag" src={match.away_team.flag_url} alt={`${match.away_team.name} flag`} />
      </div>

      {/* AI Brief trigger button */}
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

      {existingPick ? (
        <div className="pick-display">
          ✓ Your pick: {existingPick.pick_home} - {existingPick.pick_away}
          {existingPick.points_earned != null && (
            <span className="points-badge">{existingPick.points_earned} pts</span>
          )}
        </div>
      ) : isLocked ? (
        <div className="locked-badge">🔒 Locked</div>
      ) : isTimed && user && isUnder24h ? (
        <div className={`pick-prompt countdown${isUrgent ? ' urgent' : ''}`}>
          ⏱ {getCountdown()}
        </div>
      ) : (
        isTimed && user && <div className="pick-prompt">Tap to tip</div>
      )}

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
