import './App.css'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import MatchCard from './components/MatchCard'
import Leaderboard from './components/Leaderboard'
import GroupPanel from './components/GroupPanel'

export default function App() {
  const [view, setView] = useState('fixtures')
  const [matches, setMatches] = useState([])
  const [user, setUser] = useState(null)
  const [picks, setPicks] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [userGroups, setUserGroups] = useState([])
  const [showGroupPanel, setShowGroupPanel] = useState(false)
  const matchesByDate = matches.reduce((groups, match) => {
    const date = new Date(match.kickoff_utc).toLocaleDateString('en-AU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    })
    if (!groups[date]) groups[date] = []
    groups[date].push(match)
    return groups
  }, {})
  const fetchPicks = () => {
    supabase.from("picks").select("*")
      .then(({ data }) => setPicks(data))
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    supabase.from("matches").select(`
      *,
      home_team:teams!fk_home_team(name),
      away_team:teams!fk_away_team(name)
    `).then(({ data }) => setMatches(data))

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return
    supabase
      .from("group_members")
      .select(`*, group:groups(id, name, code)`)
      .eq("user_id", user.id)
      .then(({ data }) => setUserGroups(data?.map(m => m.group) || []))
    fetchPicks()
  }, [user])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <h1>WC2026 Fantasy</h1>
        {!user && <Auth className="signin-btn"/>}
        {user && (
          <div className="user-bar">
            <span>{user.email}</span>
            <button onClick={handleLogout}>Sign Out</button>
          </div>
        )}
      </header>

      {/* Views */}
      <main className="main">
        {view === 'fixtures' && (
          <div>
            {Object.entries(matchesByDate).map(([date, dayMatches]) => (
              <div key={date}>
                <h3 className='date-header'>{date}</h3>
                {dayMatches.map(match => (
                  <MatchCard key={match.id} match={match} user={user}
                    existingPick={picks.find(pick => pick.match_id === match.id)}
                    onPickSubmitted={fetchPicks}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {view === 'leaderboard' && (
          <div>
            {user && userGroups.length > 0 && (
              <div className="group-selector">
                <button onClick={() => setSelectedGroup(null)}>All Players</button>
                {userGroups.map(group => (
                  <button key={group.id} onClick={() => setSelectedGroup(group)}>
                    {group.name}
                  </button>
                ))}
              </div>
            )}
            <Leaderboard selectedGroup={selectedGroup} />
          </div>
        )}

        {view === 'groups' && (
          <div>
            <button onClick={() => setShowGroupPanel(true)}>
              + Create or Join a Group
            </button>
            {showGroupPanel && (
              <GroupPanel
                user={user}
                onClose={() => setShowGroupPanel(false)}
              />
            )}
            <div>
              <h2>My Groups</h2>
              {userGroups.map(group => (
                <div key={group.id}>
                  <p>{group.name}</p>
                  <p>Code: {group.code}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="bottom-nav">
        <button onClick={() => setView('fixtures')} className={view === 'fixtures' ? 'active' : ''}>
          🏟️ Fixtures
        </button>
        <button onClick={() => setView('leaderboard')} className={view === 'leaderboard' ? 'active' : ''}>
          🏆 Leaderboard
        </button>
        <button onClick={() => setView('groups')} className={view === 'groups' ? 'active' : ''}>
          👥 Groups
        </button>
      </nav>
    </div>
  )
}