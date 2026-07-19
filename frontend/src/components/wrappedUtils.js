// Shared helpers for the Wrapped modal + share card. Pure functions only —
// no side effects, so both the on-screen modal and the off-screen capture
// card derive identical copy from the same stats blob.

// Percentile tier badge for panel 2 / the share card. Evaluated top-down,
// first match wins. Returns null when the user doesn't clear any tier.
export function percentileBadge(finalRank, totalUsers) {
  if (finalRank == null || !totalUsers) return null
  if (finalRank <= 10) return { label: 'top 10 finisher', tier: 'gold' }
  if (finalRank <= 50) return { label: 'top 50 finisher', tier: 'gold' }
  if (finalRank / totalUsers <= 0.10) return { label: 'top 10%', tier: 'silver' }
  if (finalRank / totalUsers <= 0.50) return { label: 'top half', tier: 'subtle' }
  return null
}

// Human name of the side that actually won the final.
export function actualWinnerName(finalPick) {
  if (!finalPick) return null
  switch (finalPick.actual_winner) {
    case 'HOME_TEAM': return finalPick.home_team_name
    case 'AWAY_TEAM': return finalPick.away_team_name
    case 'DRAW': return 'a draw'
    default: return null
  }
}

// Initials fallback when an avatar image is missing or fails to load.
export function initials(name) {
  const parts = String(name ?? '').split(/[\s@]/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return String(name ?? '?').slice(0, 2).toUpperCase()
}

export const fmt = (n) => Number(n ?? 0).toLocaleString('en-US')
