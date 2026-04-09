import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import './Leaderboard.css'

export default function Leaderboard({ selectedGroup }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true)
      setError(null)

      let query = supabase
        .from("leaderboard")
        .select(`*, profile:profiles(display_name)`)
        .order("total_points", { ascending: false })

      if (selectedGroup) {
        const { data: members, error: membersError } = await supabase
          .from("group_members")
          .select("user_id")
          .eq("group_id", selectedGroup.id)

        if (membersError) {
          setError('Could not load group members.')
          setLoading(false)
          return
        }

        const memberIds = members.map(m => m.user_id)
        query = query.in("user_id", memberIds)
      }

      const { data, error: leaderboardError } = await query

      if (leaderboardError) {
        setError('Could not load leaderboard.')
      } else {
        setEntries(data || [])
      }
      setLoading(false)
    }

    fetchLeaderboard()
  }, [selectedGroup])

  if (loading) {
    return (
      <div className="leaderboard">
        <h2 className="leaderboard-title">Leaderboard</h2>
        <p className="leaderboard-subtitle">
          {selectedGroup ? selectedGroup.name : 'All Players'}
        </p>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton-row" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="leaderboard">
        <h2 className="leaderboard-title">Leaderboard</h2>
        <div className="error-banner">{error}</div>
      </div>
    )
  }

  return (
  <div className="leaderboard">
    <h2 className="leaderboard-title">Leaderboard</h2>
    <p className="leaderboard-subtitle">
      {selectedGroup ? selectedGroup.name : 'All Players'}
    </p>
    {entries.map((entry, index) => (
      <div key={entry.user_id} className={`leaderboard-entry ${index < 3 ? 'top' : ''}`}>
        <div className={`rank ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''}`}>
          {index + 1}
        </div>
        <div className="entry-info">
          <div className="entry-name">
            {entry.profile?.display_name ?? entry.profile?.email ?? 'Player'}
          </div>
          <div className="entry-stats">
            {entry.exact_scores} exact · {entry.correct_results} correct
          </div>
          <div className="power-stats">
            {entry.last_5_form && (
              <div className="form-row">
                {entry.last_5_form.split('').map((r, i) => (
                  <span key={i} className={`form-dot ${r === 'W' ? 'win' : 'loss'}`}>
                    {r === 'W' ? '✓' : '✗'}
                  </span>
                ))}
              </div>
            )}
            <div className="power-badges">
              {entry.current_streak > 1 && (
                <span className="badge streak">🔥 {entry.current_streak}</span>
              )}
              {entry.accuracy_pct > 0 && (
                <span className="badge accuracy">{entry.accuracy_pct}%</span>
              )}
              {entry.best_single_match > 0 && (
                <span className="badge best">⚡{entry.best_single_match}pts best</span>
              )}
            </div>
          </div>
        </div>
        <div>
          <div className="entry-points">{entry.total_points}</div>
          <div className="entry-points-label">pts</div>
        </div>
      </div>
    ))}
  </div>
)}
