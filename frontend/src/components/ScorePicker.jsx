import { useState } from 'react'
import { supabase } from '../lib/supabase'
import './ScorePicker.css'

export default function ScorePicker({ match, user, onPickSubmitted, onClose }) {
  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    const { error } = await supabase.from("picks").upsert({
      user_id: user.id,
      match_id: match.id,
      pick_home: homeScore,
      pick_away: awayScore
    }, { onConflict: 'user_id, match_id' })
    setSubmitting(false)

    if (error) {
      showToast('Failed to submit pick.')
    } else {
      onPickSubmitted()
    }
  }

  return (
    <div className="score-picker-overlay" onClick={onClose}>
      <div className="score-picker-sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-top-row">
          <div className="sheet-handle" />
          <button className="sheet-cancel-btn" onClick={onClose}>Cancel</button>
        </div>
        <p className="picker-label">Enter your prediction</p>
        <div className="picker-row">
          <div className="picker-team">
            <img
              className="picker-flag"
              src={match.home_team.flag_url}
              alt={`${match.home_team.name} flag`}
            />
            <span className="picker-team-name">{match.home_team.name}</span>
            <div className="score-controls">
              <button className="score-btn" onClick={() => setHomeScore(Math.max(0, homeScore - 1))}>−</button>
              <span className="score-value">{homeScore}</span>
              <button className="score-btn" onClick={() => setHomeScore(homeScore + 1)}>+</button>
            </div>
          </div>
          <span className="picker-vs">—</span>
          <div className="picker-team">
            <img
              className="picker-flag"
              src={match.away_team.flag_url}
              alt={`${match.away_team.name} flag`}
            />
            <span className="picker-team-name">{match.away_team.name}</span>
            <div className="score-controls">
              <button className="score-btn" onClick={() => setAwayScore(Math.max(0, awayScore - 1))}>−</button>
              <span className="score-value">{awayScore}</span>
              <button className="score-btn" onClick={() => setAwayScore(awayScore + 1)}>+</button>
            </div>
          </div>
        </div>
        <button className="submit-btn" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit Tip'}
        </button>
        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  )
}
