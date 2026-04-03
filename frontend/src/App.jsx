import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'

export default function App() {
  const [teams, setTeams] = useState([])

  useEffect(() => {
  supabase.from("teams").select("*")
    .then(({ data, error }) => {
      console.log("data:", data)
      console.log("error:", error)
      setTeams(data)
    })
}, [])

  return (
    <div>
      <h1>WC2026 Tipping App</h1>
      {teams.map(team => (
      <p key= {team.id}>{team.name}</p>
      ))}
    </div>
  )
}