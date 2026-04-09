import './App.css'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import MatchCard from './components/MatchCard'
import Leaderboard from './components/Leaderboard'
import GroupPanel from './components/GroupPanel'
import HowItWorks from './components/HowItWorks'

export default function App() {
  const [view, setView] = useState('fixtures')
  const [matches, setMatches] = useState([])
  const [loadingMatches, setLoadingMatches] = useState(true)
  const [matchesError, setMatchesError] = useState(null)
  const [user, setUser] = useState(null)
  const [picks, setPicks] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [userGroups, setUserGroups] = useState([])
  const [groupsError, setGroupsError] = useState(null)
  const [showGroupPanel, setShowGroupPanel] = useState(false)
  const [showGroupSignIn, setShowGroupSignIn] = useState(false)
  const [showHowItWorks, setShowHowItWorks] = useState(
    () => !localStorage.getItem('wc2026_welcomed')
  )
  const [installPrompt, setInstallPrompt] = useState(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)

  useEffect(() => {
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
    if (!isMobile || localStorage.getItem('wc2026_install_dismissed')) return

    const handler = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
      setShowInstallBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') {
      setShowInstallBanner(false)
      setInstallPrompt(null)
    }
  }

  const dismissInstallBanner = () => {
    localStorage.setItem('wc2026_install_dismissed', '1')
    setShowInstallBanner(false)
  }

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
      .then(({ data }) => setPicks(data ?? []))
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
      home_team:teams!fk_home_team(name, flag_url),
      away_team:teams!fk_away_team(name, flag_url)
    `).order('kickoff_utc', { ascending: true }).then(({ data, error }) => {
      if (error) setMatchesError('Could not load fixtures. Please refresh.')
      else setMatches(data ?? [])
      setLoadingMatches(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return
    supabase
      .from("group_members")
      .select(`*, group:groups(id, name, code)`)
      .eq("user_id", user.id)
      .then(({ data, error }) => {
        if (error) setGroupsError('Could not load your groups.')
        else setUserGroups(data?.map(m => m.group) || [])
      })
    fetchPicks()
  }, [user])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="app">
      {showInstallBanner && (
        <div className="install-banner">
          <span className="install-banner-text">
            📲 Add WC2026 Fantasy to your homescreen for the best experience
          </span>
          <button className="install-banner-btn" onClick={handleInstall}>Install</button>
          <button className="install-banner-dismiss" onClick={dismissInstallBanner}>✕</button>
        </div>
      )}

      {/* Header */}
      <header className="header">
        <div className="brand">
          <img src="/fifa-world-cup-2026-logo.png" alt="WC2026 Logo" className="logo" />
          <h1>World Cup 2026 Fantasy</h1>
        </div>
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
            {matchesError && (
              <div className="error-banner">{matchesError}</div>
            )}
            {loadingMatches && !matchesError ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton-card" />
              ))
            ) : (
              Object.entries(matchesByDate).map(([date, dayMatches]) => (
                <div key={date}>
                  <h3 className='date-header'>{date}</h3>
                  <div className="match-grid">
                    {dayMatches.map(match => (
                      <MatchCard key={match.id} match={match} user={user}
                        existingPick={picks.find(pick => pick.match_id === match.id)}
                        onPickSubmitted={fetchPicks}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {view === 'leaderboard' && (
          <div>
            {user && userGroups.length > 0 && (
              <div className="group-tabs">
                <button
                className={`group-tab ${!selectedGroup ? 'active' : ''}`}
                  onClick={() => setSelectedGroup(null)}>
                  All Players
                </button>
                {userGroups.map(group => (
                  <button
                  key={group.id}
                  className={`group-tab ${selectedGroup?.id === group.id ? 'active' : ''}`}
                  onClick={() => setSelectedGroup(group)}>
                  {group.name}
                </button>
              ))}
              </div>
            )}
            <Leaderboard selectedGroup={selectedGroup} />
            <button className="how-it-works-link" onClick={() => setShowHowItWorks(true)}>
              How it works
            </button>
          </div>
        )}

        {view === 'groups' && (
          <div className="groups-view">
            <h2 className="groups-title">My Groups</h2>
            <p className="groups-subtitle">Create or join a group to compete with friends</p>
            <button className="create-join-btn" onClick={() => {
              if (!user) { setShowGroupSignIn(true); return }
              setShowGroupSignIn(false)
              setShowGroupPanel(true)
            }}>
              + Create or Join a Group
            </button>
            {showGroupSignIn && !user && (
              <div className="empty-state sign-in-prompt">
                <div className="empty-state-icon">👥</div>
                <div className="empty-state-title">Sign in to continue</div>
                <div className="empty-state-body">You need to be signed in to create or join a group.</div>
                <Auth />
              </div>
            )}
            {showGroupPanel && (
              <GroupPanel user={user} onClose={() => {
                setShowGroupPanel(false)
                if (user) {
                  supabase
                    .from("group_members")
                    .select(`*, group:groups(id, name, code)`)
                    .eq("user_id", user.id)
                    .then(({ data }) => setUserGroups(data?.map(m => m.group) || []))
                }
              }} />
            )}
            {groupsError && <div className="error-banner">{groupsError}</div>}
            <div className="my-groups-list">
              {userGroups.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">👥</div>
                  <div className="empty-state-title">You're not in a group yet</div>
                  <div className="empty-state-body">Create or join one above to compete with friends.</div>
                </div>
              ) : (
                userGroups.map(group => (
                  <div key={group.id} className="group-card">
                    <div>
                      <div className="group-card-name">{group.name}</div>
                      <div className="group-card-code">Share code with friends</div>
                    </div>
                    <div className="code-badge">{group.code}</div>
                  </div>
                ))
              )}
            </div>
            <button className="how-it-works-link" onClick={() => setShowHowItWorks(true)}>
              How it works
            </button>
          </div>
        )}
      </main>

      {showHowItWorks && (
        <HowItWorks onClose={() => {
          localStorage.setItem('wc2026_welcomed', '1')
          setShowHowItWorks(false)
        }} />
      )}

      <footer className="app-footer">
        <a href="/privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
      </footer>

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
