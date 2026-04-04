import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ScorePicker({ match, user, onPickSubmitted }) {
  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(0)

  const handleSubmit = async () => {
    const { error } = await supabase.from("picks").upsert({
      user_id: user.id,
      match_id: match.id,
      pick_home: homeScore,
      pick_away: awayScore
    }, { onConflict: 'user_id, match_id' })

    if (error) {
      console.error('Error submitting pick:', error)
    } else {
      onPickSubmitted()
    }
  }

  return (
    <div>
      <input
        type="number"
        min="0"
        value={homeScore}
        onChange={(e) => setHomeScore(Number(e.target.value))}
      />
      <input
        type="number"
        min="0"
        value={awayScore}
        onChange={(e) => setAwayScore(Number(e.target.value))}
      />
      <button onClick={handleSubmit}>
        Submit Score
      </button>
    </div>
  )
}