import { useState } from 'react'
import ScorePicker from './ScorePicker'
import AIBrief from './AIBrief'
import './MatchCard.css'

export default function MatchCard({ match, user, existingPick, onPickSubmitted }) {
  const [showPicker, setShowPicker] = useState(false)
  const [showBrief, setShowBrief] = useState(false)

  const kickoff = new Date(match.kickoff_utc).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  })

  const isFinished = match.status === 'FINISHED'
  const isTimed = match.status === 'TIMED'

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
          🤖 AI Brief
        </button>
      </div>

      {existingPick ? (
        <div className="pick-display">
          ✓ Your pick: {existingPick.pick_home} - {existingPick.pick_away}
          {existingPick.points_earned != null && (
            <span className="points-badge">{existingPick.points_earned} pts</span>
          )}
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
          onClose={() => setShowBrief(false)}
        />
      )}
    </div>
  )
}