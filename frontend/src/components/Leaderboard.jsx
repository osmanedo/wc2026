import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Leaderboard() {
  const [entries, setEntries] = useState([])

  useEffect(() => {
    supabase.from("leaderboard")
  .select(`
    *,
    profile:profiles(display_name)
  `)
  .order("total_points", { ascending: false })
  .then(({ data }) => setEntries(data))
  }, [])

  return (
    <div>
      <h2>Leaderboard</h2>
      {entries.map((entry, index) => (
        <div key={entry.user_id}>
          <span>{index + 1}. {entry.profile?.display_name}</span>
          <span> - Points: {entry.total_points}</span>
        </div>
      ))}
    </div>
  )
}