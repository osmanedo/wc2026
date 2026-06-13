import './App.css'
import { useState, useEffect } from 'react'

const ROUND_ORDER = ['GROUP_STAGE', 'LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL']
const ROUND_LABELS = {
  GROUP_STAGE: 'Group Stage',
  LAST_32: 'Round of 32',
  LAST_16: 'Round of 16',
  QUARTER_FINALS: 'Quarter Finals',
  SEMI_FINALS: 'Semi Finals',
  THIRD_PLACE: 'Third Place',
  FINAL: 'Final',
}
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import MatchCard from './components/MatchCard'
import Leaderboard from './components/Leaderboard'
import GlobalLeaderboard from './components/GlobalLeaderboard'
import LeaguePanel from './components/LeaguePanel'
import HowItWorks from './components/HowItWorks'
import MatchDetail from './components/MatchDetail'

const UsersIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)

const CalendarIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)

const TrophyIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
    <path d="M4 22h16"/>
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
  </svg>
)

function HeaderCountdown() {
  const target = new Date('2026-06-11T19:00:00Z').getTime()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  const diff = target - now
  if (diff <= 0) return null

  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  const pad = (n) => String(n).padStart(2, '0')

  const num = { color: 'white' }

  return (
    <div style={{
      width: '100%',
      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
      padding: '8px 0 0 0',
      marginTop: 10,
      textAlign: 'center',
    }}>
      <div style={{
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 700,
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.7)',
      }}>
        <span style={num}>{days}</span> Days <span style={num}>{pad(hours)}</span> Hours <span style={num}>{pad(minutes)}</span> Minutes to kickoff
      </div>
      <div style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.5)',
        marginTop: 4,
      }}>
        Get your first prediction in before kick off
      </div>
    </div>
  )
}

export default function App() {
  const [view, setView] = useState('fixtures')
  const [matches, setMatches] = useState([])
  const [loadingMatches, setLoadingMatches] = useState(true)
  const [matchesError, setMatchesError] = useState(null)
  const [user, setUser] = useState(null)
  const [picks, setPicks] = useState([])
  const [selectedLeague, setSelectedLeague] = useState(null)
  const [userLeagues, setUserLeagues] = useState([])
  const [leaguesError, setLeaguesError] = useState(null)
  const [displayName, setDisplayName] = useState(null)
  const [showAiBriefs, setShowAiBriefs] = useState(null)
  const [aiBriefError, setAiBriefError] = useState(null)
  const [copiedCode, setCopiedCode] = useState(null)
  const [filterDate, setFilterDate] = useState('all')
  const [filterTeam, setFilterTeam] = useState('all')
  const [filterRound, setFilterRound] = useState('all')
  const [filterGroup, setFilterGroup] = useState('all')
  const [isDeepLinkJoin, setIsDeepLinkJoin] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState(null)

  const copyCode = (code) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    })
  }
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showLeaguePanel, setShowLeaguePanel] = useState(false)
  const [showLeagueSignIn, setShowLeagueSignIn] = useState(false)
  const [showHowItWorks, setShowHowItWorks] = useState(
  () => !localStorage.getItem('wc2026_welcomed')
  && !sessionStorage.getItem('pendingJoinCode')
  && !new URLSearchParams(window.location.search).get('join')
  )
  const [showInviteBanner, setShowInviteBanner] = useState(
  () => !!sessionStorage.getItem('pendingJoinCode')
    || !!new URLSearchParams(window.location.search).get('join')
  )
  const [installPrompt, setInstallPrompt] = useState(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)

  // helper: switch view and exit match detail
  const goToView = (v) => {
    setSelectedMatch(null)
    setView(v)
  }

  useEffect(() => {
    if (localStorage.getItem('wc2026_install_dismissed')) return

    // Show banner immediately; also capture native install prompt if available
    setShowInstallBanner(true)

    const handler = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
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

  const toDateLabel = (kickoff) => new Date(kickoff).toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  })

  const allDateLabels = [...new Set(matches.map(m => toDateLabel(m.kickoff_utc)))]

  const availableRounds = [...new Set(matches.map(m => m.stage))]
    .sort((a, b) => ROUND_ORDER.indexOf(a) - ROUND_ORDER.indexOf(b))

  const availableTeams = [...new Set(
    matches.flatMap(m => [m.home_team?.name, m.away_team?.name]).filter(Boolean)
  )].sort()

  const availableGroups = [...new Set(matches.map(m => m.group_name).filter(Boolean))].sort()

  const filteredMatches = matches.filter(m => {
    if (filterRound !== 'all' && m.stage !== filterRound) return false
    if (filterTeam !== 'all' && m.home_team?.name !== filterTeam && m.away_team?.name !== filterTeam) return false
    if (filterDate !== 'all' && toDateLabel(m.kickoff_utc) !== filterDate) return false
    if (filterGroup !== 'all' && m.group_name !== filterGroup) return false
    return true
  })

  const matchesByDate = filteredMatches.reduce((groups, match) => {
    const date = toDateLabel(match.kickoff_utc)
    if (!groups[date]) groups[date] = []
    groups[date].push(match)
    return groups
  }, {})

  // CRITICAL: filter picks to current user. New RLS policy opens reads of
  // group members' picks after kickoff — unfiltered select would return
  // other users' picks and break existingPick lookup in MatchCard.
  const fetchPicks = () => {
    if (!user) return
    supabase.from("picks").select("*")
      .eq('user_id', user.id)
      .then(({ data }) => setPicks(data ?? []))
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const joinCode = params.get('join')
    if (joinCode) {
      sessionStorage.setItem('pendingJoinCode', joinCode)
      // Clean the URL so it doesn't look messy or re-trigger on refresh
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    const fetchMatches = () =>
      supabase.from("matches").select(`
        *,
        home_team:teams!fk_home_team(name, flag_url),
        away_team:teams!fk_away_team(name, flag_url)
      `).order('kickoff_utc', { ascending: true }).then(({ data, error }) => {
        if (error) setMatchesError('Could not load fixtures. Please refresh.')
        else setMatches(data ?? [])
        setLoadingMatches(false)
      })

    fetchMatches()

    const matchPollInterval = setInterval(() => {
      setMatches(current => {
        if (current.some(m => m.status !== 'TIMED' && m.status !== 'FINISHED'))
          fetchMatches()
        return current
      })
    }, 30_000)

    return () => {
      subscription.unsubscribe()
      clearInterval(matchPollInterval)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    supabase
      .from("group_members")
      .select(`*, group:groups(id, name, code)`)
      .eq("user_id", user.id)
      .then(async ({ data, error }) => {
        if (error) { setLeaguesError('Could not load your leagues.'); return }
        const leagues = data?.map(m => m.group) || []
        if (leagues.length === 0) { setUserLeagues([]); return }
        const leagueIds = leagues.map(g => g.id)
        const { data: memberRows } = await supabase
          .from("group_members")
          .select("group_id, profiles(display_name, avatar_url)")
          .in("group_id", leagueIds)
        const membersMap = (memberRows || []).reduce((acc, r) => {
          if (!acc[r.group_id]) acc[r.group_id] = []
          if (r.profiles) acc[r.group_id].push(r.profiles)
          return acc
        }, {})
        setUserLeagues(leagues.map(g => ({
          ...g,
          member_count: (membersMap[g.id] || []).length,
          members: membersMap[g.id] || [],
        })))
      })
    supabase
      .from("profiles")
      .select("display_name, show_ai_briefs")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        setDisplayName(data?.display_name ?? null)
        setShowAiBriefs(data?.show_ai_briefs ?? true)
      })
    fetchPicks()
  }, [user])

  useEffect(() => {
  if (!user) return
  const pending = sessionStorage.getItem('pendingJoinCode')
  if (pending) {
    setView('leagues')
    setShowLeaguePanel(true)
    setIsDeepLinkJoin(true)
    setShowInviteBanner(false)
    // Don't clear it here — GroupPanel will clear it after successful join
  }
}, [user])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [view, selectedMatch])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const showBriefs = showAiBriefs ?? true

  const toggleAiBriefs = async () => {
    if (!user) return
    const prev = showBriefs
    const next = !prev
    setShowAiBriefs(next)
    setAiBriefError(null)
    const { error } = await supabase
      .from("profiles")
      .update({ show_ai_briefs: next })
      .eq("id", user.id)
    if (error) {
      setShowAiBriefs(prev)
      setAiBriefError('Could not save preference')
      setTimeout(() => setAiBriefError(null), 3000)
    }
  }

  return (
    <div className="app">
      {showInstallBanner && (
        <div className="install-banner">
          <span className="install-banner-text">
            Add WC2026 Fantasy App to your homescreen for the best experience
          </span>
          <button className="install-banner-btn" onClick={handleInstall} disabled={!installPrompt}>Install</button>
          <button className="install-banner-dismiss" onClick={dismissInstallBanner}>✕</button>
        </div>
      )}

      {showInviteBanner && !user && (
        <div className="invite-banner">
          <div className="invite-banner-content">
            <span className="invite-banner-icon"><UsersIcon /></span>
            <div>
              <div className="invite-banner-title">You've been invited to a Fantasy League</div>
              <div className="invite-banner-body">Sign in to join your mates and start making predictions.</div>
            </div>
          </div>
          <button className="signin-btn" onClick={() => setShowAuthModal(true)}>Sign In to Join</button>
        </div>
      )}

      {/* Header */}
      <header className="header">
        <div className="header-top">
          <div className="brand">
            <img src="/fifa-world-cup-2026-logo.png" alt="WC2026 Logo" className="logo" />
            <h1>World Cup 2026 Fantasy</h1>
          </div>
          {!user && <button className="signin-btn" onClick={() => setShowAuthModal(true)}>Sign in</button>}
          {user && (
            <div className="user-bar">
              <div className="user-avatar" title={displayName ?? user.email}>
                {(() => {
                  const name = displayName ?? user.email ?? ''
                  const parts = name.split(/[\s@]/).filter(Boolean)
                  return parts.length >= 2
                    ? (parts[0][0] + parts[1][0]).toUpperCase()
                    : name.slice(0, 2).toUpperCase()
                })()}
              </div>
              <button className="signout-btn" onClick={handleLogout}>Sign Out</button>
            </div>
          )}
        </div>
        <HeaderCountdown />
      </header>

      {/* Views */}
      <main className="main">
        {selectedMatch ? (
          <MatchDetail
            match={selectedMatch}
            user={user}
            onBack={() => setSelectedMatch(null)}
            userPick={picks.find(p => p.match_id === selectedMatch.id)}
          />
        ) : (
        <>
        {view === 'fixtures' && (
          <div>
            {matchesError && (
              <div className="error-banner">{matchesError}</div>
            )}
            {!loadingMatches && matches.length > 0 && (
              <div className="fixtures-filters-row">
                <div className="fixtures-filters">
                  <select value={filterRound} onChange={e => setFilterRound(e.target.value)}>
                    <option value="all">All Rounds</option>
                    {availableRounds.map(r => (
                      <option key={r} value={r}>{ROUND_LABELS[r] ?? r}</option>
                    ))}
                  </select>
                  <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)}>
                    <option value="all">All Teams</option>
                    {availableTeams.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <select value={filterDate} onChange={e => setFilterDate(e.target.value)}>
                    <option value="all">All Dates</option>
                    {allDateLabels.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  {availableGroups.length > 0 && (
                    <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}>
                      <option value="all">All Groups</option>
                      {availableGroups.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="fixtures-filters-gutter">
                  <button className="hiw-icon-btn" onClick={() => setShowHowItWorks(true)} title="How it works">ⓘ</button>
                  {user && (
                    <div className="ai-brief-toggle">
                      <span className="ai-brief-toggle-label">AI Brief</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={showBriefs}
                        title="Show AI Brief & Prediction on fixtures"
                        className={`ai-brief-switch${showBriefs ? ' on' : ''}`}
                        onClick={toggleAiBriefs}
                      >
                        <span className="ai-brief-knob" />
                      </button>
                      {aiBriefError && <span className="ai-brief-toggle-error">{aiBriefError}</span>}
                    </div>
                  )}
                </div>
              </div>
            )}
            {loadingMatches && !matchesError ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton-card" />
              ))
            ) : Object.keys(matchesByDate).length === 0 && !matchesError ? (
              <p className="no-results">No fixtures match your filters.</p>
            ) : (
              Object.entries(matchesByDate).map(([date, dayMatches]) => (
                <div key={date}>
                  <h3 className='date-header'>{date}</h3>
                  <div className="match-grid">
                    {dayMatches.map(match => (
                      <MatchCard key={match.id} match={match} user={user}
                        existingPick={picks.find(pick => pick.match_id === match.id)}
                        onPickSubmitted={fetchPicks}
                        onSignIn={() => setShowAuthModal(true)}
                        showBriefs={showBriefs}
                        onViewDetail={setSelectedMatch}
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
            {user && userLeagues.length > 0 && (
              <div className="league-tabs">
                <button
                className={`league-tab ${!selectedLeague ? 'active' : ''}`}
                  onClick={() => setSelectedLeague(null)}>
                  All Players
                </button>
                {userLeagues.map(league => (
                  <button
                  key={league.id}
                  className={`league-tab ${selectedLeague?.id === league.id ? 'active' : ''}`}
                  onClick={() => setSelectedLeague(league)}>
                  {league.name}
                </button>
              ))}
              </div>
            )}
            {selectedLeague ? (
              <Leaderboard
                selectedGroup={selectedLeague}
                hasLiveMatch={matches.some(m => m.status !== 'TIMED' && m.status !== 'FINISHED')}
                onShowHowItWorks={() => setShowHowItWorks(true)}
                user={user}
              />
            ) : (
              <GlobalLeaderboard
                hasLiveMatch={matches.some(m => m.status !== 'TIMED' && m.status !== 'FINISHED')}
                onShowHowItWorks={() => setShowHowItWorks(true)}
                user={user}
              />
            )}
            {!user && (
              <div className="leaderboard-signin-cta">
                <p className="leaderboard-signin-cta-text">Submit picks and climb the rankings</p>
                <Auth />
              </div>
            )}
          </div>
        )}

        {view === 'leagues' && (
          <div className="leagues-view">
            {!isDeepLinkJoin && (
              <>
                <h2 className="leagues-title">My Leagues</h2>
                <p className="leagues-subtitle">Create or join a league to compete with friends</p>
                <button className="create-join-btn" onClick={() => {
                  if (!user) { setShowLeagueSignIn(true); return }
                  setShowLeagueSignIn(false)
                  setShowLeaguePanel(true)
              }}>
                + Create or Join a League
              </button>
              {showLeagueSignIn && !user && (
                <div className="empty-state sign-in-prompt">
                  <div className="empty-state-icon">👥</div>
                  <div className="empty-state-title">Sign in to continue</div>
                  <div className="empty-state-body">You need to be signed in to create or join a league.</div>
                <Auth />
              </div>
            )}
          </>
        )}
        {showLeaguePanel && (
          <LeaguePanel
            user={user}
            initialJoinCode={sessionStorage.getItem('pendingJoinCode')}
            onClose={() => {
              sessionStorage.removeItem('pendingJoinCode')
              setShowLeaguePanel(false)
              setIsDeepLinkJoin(false)
              if (user) {
                supabase
                  .from("group_members")
                  .select(`*, group:groups(id, name, code)`)
                  .eq("user_id", user.id)
                  .then(({ data }) => setUserLeagues(data?.map(m => m.group) || []))
              }
            }}
          />
        )}
        {!isDeepLinkJoin && (
          <>
            {leaguesError && <div className="error-banner">{leaguesError}</div>}
            <div className="my-leagues-list">
              {userLeagues.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">👥</div>
                  <div className="empty-state-title">You are not in a league yet</div>
                  <div className="empty-state-body">Create or join one above to compete with friends.</div>
                </div>
              ) : (
                userLeagues.map(league => (
                  <div key={league.id} className="league-card">
                    <div className="league-card-main">
                      <div className="league-card-name">{league.name}</div>
                      <div className="league-card-code">{league.member_count != null ? `${league.member_count} members` : 'Tap code to copy'}</div>
                    </div>
                    <button className={`code-badge${copiedCode === league.code ? ' copied' : ''}`} onClick={() => copyCode(league.code)}>
                     {copiedCode === league.code ? 'Copied!' : league.code}
                    </button>
                    {league.members && league.members.length > 0 && (
                      <div className="league-card-members">
                        {league.members.map((m, i) => {
                          const name = m.display_name || '?'
                          const initial = name.charAt(0).toUpperCase()
                          return (
                            <div key={i} className="league-member">
                              {m.avatar_url ? (
                                <img
                                  className="league-member-avatar"
                                  src={m.avatar_url}
                                  alt=""
                                  onError={(e) => {
                                    const img = e.currentTarget
                                    const fallback = document.createElement('div')
                                    fallback.className = 'league-member-avatar league-member-avatar-fallback'
                                    fallback.textContent = initial
                                    img.replaceWith(fallback)
                                  }}
                                />
                              ) : (
                                <div className="league-member-avatar league-member-avatar-fallback">
                                  {initial}
                                </div>
                              )}
                              <span className="league-member-name">{name}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
              ))
            )}
          </div>
          <button className="how-it-works-link" onClick={() => setShowHowItWorks(true)}>
            How it works
          </button>
        </>
      )}
    </div>
  )}
        </>
        )}
      </main>

      {showAuthModal && (
        <div className="auth-modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="auth-modal" onClick={e => e.stopPropagation()}>
            <button className="auth-modal-close" onClick={() => setShowAuthModal(false)}>✕</button>
            <Auth onSuccess={() => setShowAuthModal(false)} />
          </div>
        </div>
      )}

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
        <button onClick={() => goToView('fixtures')} className={view === 'fixtures' && !selectedMatch ? 'active' : ''}>
          <span className="nav-icon"><CalendarIcon /></span>
          <span className="nav-label">Fixtures</span>
        </button>
        <button onClick={() => goToView('leaderboard')} className={view === 'leaderboard' && !selectedMatch ? 'active' : ''}>
          <span className="nav-icon"><TrophyIcon /></span>
          <span className="nav-label">Leaderboard</span>
        </button>
        <button onClick={() => goToView('leagues')} className={view === 'leagues' && !selectedMatch ? 'active' : ''}>
          <span className="nav-icon"><UsersIcon /></span>
          <span className="nav-label">Leagues</span>
        </button>
      </nav>
    </div>
  )
}