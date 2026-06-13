import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import ConsensusBar from './ConsensusBar'
import './MatchDetail.css'

export default function MatchDetail({ match, user, onBack, userPick }) {
  const [leagues, setLeagues] = useState([])
  const [selectedLeagueId, setSelectedLeagueId] = useState(null)
  const [picks, setPicks] = useState([])
  const [loading, setLoading] = useState(true)

  const kickedOff = match && new Date(match.kickoff_utc) <= new Date()

  // load user's groups
  useEffect(() => {
    async function loadGroups() {
      if (!user) { setLoading(false); return }
      const { data: gm } = await supabase
        .from('group_members')
        .select('group_id, groups(id, name)')
        .eq('user_id', user.id)
      const mapped = (gm || []).map(r => r.groups).filter(Boolean)
      setLeagues(mapped)
      if (mapped.length) setSelectedLeagueId(mapped[0].id)
      setLoading(false)
    }
    loadGroups()
  }, [user])

  // fetch picks when league selected + match has kicked off
  useEffect(() => {
    if (!selectedLeagueId || !kickedOff) return
    async function load() {
      const { data, error } = await supabase.rpc('get_group_picks_for_match', {
        p_match_id: Number(match.id),
        p_group_id: Number(selectedLeagueId),
      })
      if (error) { console.error(error); return }
      setPicks(data || [])
    }
    load()
  }, [selectedLeagueId, kickedOff, match.id])

  if (loading) return <div className="md-loading">loading…</div>

  return (
    <div className="md-container">
      <button className="md-back" onClick={onBack}>← Back to fixtures</button>

      <h1 className="md-title">
        {match.home_team?.flag_url && (
          <img src={match.home_team.flag_url} alt="" className="md-flag" />
        )}
        {match.home_team?.name} vs {match.away_team?.name}
        {match.away_team?.flag_url && (
          <img src={match.away_team.flag_url} alt="" className="md-flag" />
        )}
      </h1>
      <p className="md-kickoff">{new Date(match.kickoff_utc).toLocaleString()}</p>

      {kickedOff && (
        <ConsensusBar matchId={match.id} userPick={userPick} />
      )}

      {!kickedOff && (
        <div className="md-notice">
          league picks will appear here once the match has kicked off.
        </div>
      )}

      {kickedOff && !user && (
        <div className="md-notice">
          sign in to see what your league has tipped.
        </div>
      )}

      {kickedOff && user && leagues.length === 0 && (
        <div className="md-notice">
          join a league to see other members' picks.
        </div>
      )}

      {kickedOff && user && leagues.length > 0 && (
        <>
          {leagues.length > 1 && (
            <div className="league-tabs md-league-tabs">
              {leagues.map((lg) => (
                <button
                  key={lg.id}
                  className={`league-tab ${selectedLeagueId === lg.id ? 'active' : ''}`}
                  onClick={() => setSelectedLeagueId(lg.id)}
                >
                  {lg.name}
                </button>
              ))}
            </div>
          )}

          <h2 className="md-section-title">
            league picks ({picks.length})
          </h2>

          <div className="md-picks-list">
            {picks.map((p) => (
              <div key={p.user_id} className="md-pick-row">
                <span className="md-name">{p.display_name}</span>
                <span className="md-score">{p.pick_home}–{p.pick_away}</span>
                <span className="md-points">
                  {p.points_earned != null ? `${p.points_earned} pts` : '—'}
                </span>
              </div>
            ))}
            {picks.length === 0 && (
              <div className="md-empty">
                no picks from this league for this match.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}