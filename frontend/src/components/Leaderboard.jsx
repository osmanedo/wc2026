import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Leaderboard({ selectedGroup }) {
  const [entries, setEntries] = useState([])

useEffect(() => {
  const fetchLeaderboard = async () => {
    let query = supabase
      .from("leaderboard")
      .select(`*, profile:profiles(display_name)`)
      .order("total_points", { ascending: false })

    if (selectedGroup) {
      // Step 1 — get member IDs for this group
      const { data: members } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", selectedGroup.id)

      const memberIds = members.map(m => m.user_id)

      // Step 2 — filter leaderboard to those IDs
      query = query.in("user_id", memberIds)
    }

    const { data } = await query
    setEntries(data || [])
  }

  fetchLeaderboard()
}, [selectedGroup])

  return (
  <div>
    <h2>Leaderboard {selectedGroup ? `— ${selectedGroup.name}` : '— All Players'}</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Player</th>
          <th>Points</th>
          <th>Exact Scores</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry, index) => (
          <tr key={entry.user_id}>
            <td>{index + 1}</td>
            <td>{entry.profile?.display_name ?? 'Unknown'}</td>
            <td>{entry.total_points}</td>
            <td>{entry.exact_scores}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}