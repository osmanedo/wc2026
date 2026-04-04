import { useState } from 'react'
import ScorePicker from './ScorePicker'

export default function MatchCard({ match, user, existingPick, onPickSubmitted }) {
  const [showPicker, setShowPicker] = useState(false)

  return (
    <div onClick={() => setShowPicker(true)}>
      <p>{match.home_team.name} vs {match.away_team.name}</p>
      <p>{new Date(match.kickoff_utc).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      })}</p>
      <p>{match.status}</p>
      <p style={{ fontSize: '11px', color: 'gray' }}>
        {Intl.DateTimeFormat().resolvedOptions().timeZone}
      </p>  
      {existingPick ? (
        <p>Your pick: {existingPick.pick_home} - {existingPick.pick_away}</p>
      ):  (
        <p>No pick submitted yet</p>
      )}
      
      {showPicker && user && (
        <div onClick={(e) => e.stopPropagation()}>
          <ScorePicker
            match={match}
            user={user}
            onPickSubmitted={() => {
             setShowPicker(false)
             onPickSubmitted()
            }}
          />
          <button onClick={(e) => {
            e.stopPropagation()
            setShowPicker(false)
          }}>Cancel</button>
        </div>
      )}
    </div>
  )
}