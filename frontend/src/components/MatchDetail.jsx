import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './MatchDetail.css';

export default function MatchDetail() {
  const { matchId } = useParams();
  const [match, setMatch] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState(null);
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kickedOff, setKickedOff] = useState(false);

  // initial load: match (with team embeds) + user's groups
  useEffect(() => {
    async function init() {
      setLoading(true);

      const { data: m } = await supabase
        .from('matches')
        .select('*, home_team:home_team_id(*), away_team:away_team_id(*)')
        .eq('id', matchId)
        .single();
      setMatch(m);
      setKickedOff(m && new Date(m.kickoff_utc) <= new Date());

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: gm } = await supabase
          .from('group_members')
          .select('group_id, groups(id, name)')
          .eq('user_id', user.id);
        const mapped = (gm || []).map(r => r.groups).filter(Boolean);
        setLeagues(mapped);
        if (mapped.length) setSelectedLeagueId(mapped[0].id);
      }

      setLoading(false);
    }
    init();
  }, [matchId]);

  // fetch picks when group selected + match has kicked off
  useEffect(() => {
    if (!selectedLeagueId || !kickedOff) return;
    async function load() {
      const { data, error } = await supabase.rpc('get_group_picks_for_match', {
        p_match_id: Number(matchId),
        p_group_id: Number(selectedLeagueId),
      });
      if (error) { console.error(error); return; }
      setPicks(data || []);
    }
    load();
  }, [selectedLeagueId, kickedOff, matchId]);

  if (loading) return <div className="md-loading">loading…</div>;
  if (!match) return <div className="md-loading">match not found</div>;

  return (
    <div className="md-container">
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

      {!kickedOff && (
        <div className="md-notice">
          league picks will appear here once the match has kicked off.
        </div>
      )}

      {kickedOff && leagues.length === 0 && (
        <div className="md-notice">
          join a league to see other members' picks.
        </div>
      )}

      {kickedOff && leagues.length > 0 && (
        <>
          {leagues.length > 1 && (
            <div className="md-league-selector">
              <label className="md-label">LEAGUE</label>
              <select
                value={selectedLeagueId || ''}
                onChange={(e) => setSelectedLeagueId(e.target.value)}
                className="md-select"
              >
                {leagues.map((lg) => (
                  <option key={lg.id} value={lg.id}>{lg.name}</option>
                ))}
              </select>
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
  );
}