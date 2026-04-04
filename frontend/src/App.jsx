import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import MatchCard from './components/MatchCard'
import Auth from './components/Auth'
import Leaderboard from './components/Leaderboard'

export default function App() {
  const [matches, setMatches] = useState([])
  const [user, setUser] = useState(null)
  const [picks, setPicks] = useState([])
  const fetchPicks = () => {
  console.log("fetchPicks called")
  supabase.from("picks").select("*")
    .then(({ data }) => setPicks(data))
}

  useEffect(() => {
    // Auth session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    // Fetch matches
    supabase.from("matches").select(`
      *,
      home_team:teams!fk_home_team(name),
      away_team:teams!fk_away_team(name)
    `)
    .then(({ data }) => setMatches(data))

    fetchPicks() 

     return () => subscription.unsubscribe()
  }, [])

  return (
    <div>
      <h1>WC2026 Fantasy App</h1>
      {!user && <Auth />}
      {user && <p>Welcome, {user.email}</p>}
      <Leaderboard />
      {matches.map(match => (
        <MatchCard key={match.id} match={match} user={user}
        existingPick={picks.find(pick => pick.match_id === match.id)}
        onPickSubmitted={fetchPicks}
        />
      ))}
    </div>
  )
}