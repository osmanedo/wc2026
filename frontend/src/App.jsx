import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import MatchCard from './components/MatchCard'
import Auth from './components/Auth'
import Leaderboard from './components/Leaderboard'
import GroupPanel from './components/GroupPanel'

export default function App() {
  const [matches, setMatches] = useState([])
  const [user, setUser] = useState(null)
  const [picks, setPicks] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [userGroups, setUserGroups] = useState([])
  const [showGroupPanel, setShowGroupPanel] = useState(false)
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

     return () => subscription.unsubscribe()
  }, [])

  // Separate useEffect that runs whenever user changes
useEffect(() => {
  if (!user) return

  supabase
    .from("group_members")
    .select(`*, group:groups(id, name, code)`)
    .eq("user_id", user.id)
    .then(({ data }) => setUserGroups(data?.map(m => m.group) || []))

  fetchPicks()
  const handleLogout = async () => {
    await supabase.auth.signOut()
  }
}, [user])

  return (
    <div>
      <h1>WC2026 Fantasy App</h1>
      {!user && <Auth />}
      {user && (
        <div>
          <p>Welcome, {user.email}</p>
          <button onClick={handleLogout}>Sign Out</button>
        </div>
      )}
      <Leaderboard />
      {user && userGroups.length > 0 && (
        <div>
          <button onClick={() => setSelectedGroup(null)}>All Players</button>
          {userGroups.map(group => (
            <button key={group.id} onClick={() => setSelectedGroup(group)}>
              {group.name}
            </button>
          ))}
        </div>
    )}

      {user && (
        <button onClick={() => setShowGroupPanel(true)}>
          My Groups
        </button>
      )}

      {showGroupPanel && (
        <GroupPanel 
          user={user} 
          onClose={() => setShowGroupPanel(false)} 
        />
      )} 
      {matches.map(match => (
        <MatchCard key={match.id} match={match} user={user}
        existingPick={picks.find(pick => pick.match_id === match.id)}
        onPickSubmitted={fetchPicks}
        />
      ))}
 
    </div>
)}