export default function MatchCard({ match }) {
  return (
    <div>
      <p>{match.home_team.name} vs {match.away_team.name}</p>
      <p>{new Date(match.kickoff_utc).toLocaleString(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short'
})}</p>
<p style={{ fontSize: '11px', color: 'gray' }}>
  {Intl.DateTimeFormat().resolvedOptions().timeZone}
</p>
      <p>{match.status}</p>    
    </div>
  )
}