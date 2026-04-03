import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'

export default function App() {
  const [matches, setMatches] = useState([])

  useEffect(() => {
    supabase.from("matches").select(`
      *,
      home_team:teams!fk_home_team(name),
      away_team:teams!fk_away_team(name)
    `)
    .then(({ data, error }) => {
      console.log("data:", data)
      console.log("error:", error)
      setMatches(data)
    })
  }, [])

  return (
    <div>
      <h1>WC2026 Fantasy App</h1>
      {matches.map(match => (
        <p key={match.id}>
          {match.home_team?.name} vs {match.away_team?.name}
        </p>
      ))}
    </div>
  )
}