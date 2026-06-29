import { useState } from 'react'
import { supabase } from '../lib/supabase'
import './ScorePicker.css'

export default function ScorePicker({ match, user, existingPick, onPickSubmitted, onClose }) {
  // Load initial state from existingPick (if editing) or defaults (if new pick).
  // Previously these defaulted to 0 always — clicking "edit" then "submit" without
  // changing anything would silently overwrite a saved pick with 0-0.
  const [homeScore, setHomeScore] = useState(existingPick?.pick_home ?? 0)
  const [awayScore, setAwayScore] = useState(existingPick?.pick_away ?? 0)
  // pick_winner is only meaningful on knockout draws. Load it from a saved
  // pick (NULL for old picks and non-draw picks — that's fine).
  const [pickWinner, setPickWinner] = useState(existingPick?.pick_winner ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)

  // Show the "who advances?" picker only for knockout matches the user has
  // tipped as a draw. Group stage never advances anyone.
  const isKnockout   = match.stage !== 'GROUP_STAGE'
  const isDraw       = homeScore === awayScore
  const showAdvancer = isKnockout && isDraw

  // A non-draw score implies the advancer from the score itself, so the
  // nominated winner is ignored on submit (written as NULL) when it's not a
  // draw. We deliberately do NOT clear pickWinner here: bumping the score off a
  // draw and back used to silently wipe an intentional selection.
  const updateHome = (value) => setHomeScore(Math.max(0, value))
  const updateAway = (value) => setAwayScore(Math.max(0, value))

  // Knockout draws must nominate who advances before the pick can be submitted.
  const advancerMissing = showAdvancer && !pickWinner

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleSubmit = async () => {
    if (advancerMissing) {
      showToast('Pick who advances before submitting.')
      return
    }
    setSubmitting(true)
    const { error } = await supabase.from("picks").upsert({
      user_id: user.id,
      match_id: match.id,
      pick_home: homeScore,
      pick_away: awayScore,
      pick_winner: showAdvancer ? pickWinner : null
    }, { onConflict: 'user_id,match_id' })
    setSubmitting(false)

    if (error) {
      console.error('Pick upsert failed:', error)
      showToast('Failed to submit pick.')
    } else {
      onPickSubmitted()
    }
  }

  // Button label adapts to context: edit vs new. Submission is blocked
  // separately when a knockout draw is missing its advancer (see advancerMissing).
  const submitLabel = submitting
    ? 'Submitting…'
    : existingPick
      ? 'Update Tip'
      : 'Submit Tip'

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
              <button className="score-btn" onClick={() => updateHome(homeScore - 1)}>−</button>
              <span className="score-value">{homeScore}</span>
              <button className="score-btn" onClick={() => updateHome(homeScore + 1)}>+</button>
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
              <button className="score-btn" onClick={() => updateAway(awayScore - 1)}>−</button>
              <span className="score-value">{awayScore}</span>
              <button className="score-btn" onClick={() => updateAway(awayScore + 1)}>+</button>
            </div>
          </div>
        </div>
        {showAdvancer && (
          <div className="advancer-picker">
            <p className="advancer-label">Who advances?</p>
            <p className="advancer-hint">
              If this match ends drawn after extra time, who do you think wins on penalties?
            </p>
            <div className="advancer-options">
              <button
                className={`advancer-btn${pickWinner === 'HOME_TEAM' ? ' selected' : ''}`}
                onClick={() => setPickWinner('HOME_TEAM')}
              >
                {match.home_team.name}
              </button>
              <button
                className={`advancer-btn${pickWinner === 'AWAY_TEAM' ? ' selected' : ''}`}
                onClick={() => setPickWinner('AWAY_TEAM')}
              >
                {match.away_team.name}
              </button>
            </div>
            {!pickWinner && (
              <p className="advancer-missing-hint">
                Pick who advances to submit your draw prediction.
              </p>
            )}
          </div>
        )}
        <button
          className="submit-btn"
          onClick={handleSubmit}
          disabled={submitting || advancerMissing}
        >
          {submitLabel}
        </button>
        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  )
}