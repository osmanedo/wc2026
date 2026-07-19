// Sample payloads for the hidden preview routes. Shape mirrors exactly what
// get_user_wrapped_stats returns, so the preview exercises the same render
// paths as production. These drive panel states we can't reproduce without
// corrupting live data (won/lost/draw final variants, null panels).

// Reliable, CORS-enabled test images so avatar loading + html-to-image capture
// are actually exercised in preview.
const TEST_AVATAR = 'https://i.pravatar.cc/300?img=13'
const FLAG = (code) => `https://flagcdn.com/w160/${code}.png`

const baseProfile = {
  display_name: 'Patryk Bialek',
  avatar_url: TEST_AVATAR,
}

const baseRank = { final_rank: 224, total_users: 1085 }

const baseStats = { total_points: 255, exact_scores: 13, correct_results: 45, accuracy_pct: 58 }

const baseBestMatch = {
  stage: 'LAST_32',
  points: 12,
  match_id: 537417,
  home_flag: FLAG('za'),
  away_flag: FLAG('ca'),
  pick_home: 0,
  pick_away: 1,
  home_score: 0,
  away_score: 1,
  home_team_name: 'South Africa',
  away_team_name: 'Canada',
}

const baseStreak = {
  streak_length: 6,
  start_match_id: 537419,
  end_match_id: 537429,
  start_match_label: 'Portugal vs Croatia',
  end_match_label: 'Switzerland vs Algeria',
}

// Final-pick variants ---------------------------------------------------------

const finalWon = {
  pick_home: 2,
  pick_away: 1,
  pick_winner: null,
  actual_home: 3,
  actual_away: 2,
  actual_winner: 'HOME_TEAM',
  home_team_name: 'Spain',
  away_team_name: 'Argentina',
  home_flag: FLAG('es'),
  away_flag: FLAG('ar'),
  predicted_winner_name: 'Spain',
  predicted_correctly: true,
}

const finalLost = {
  // Argentina 2-1 Spain; user had Spain to win.
  pick_home: 1,
  pick_away: 2,
  pick_winner: null,
  actual_home: 2,
  actual_away: 1,
  actual_winner: 'HOME_TEAM',
  home_team_name: 'Argentina',
  away_team_name: 'Spain',
  home_flag: FLAG('ar'),
  away_flag: FLAG('es'),
  predicted_winner_name: 'Spain',
  predicted_correctly: false,
}

const finalDraw = {
  // User predicted a 1-1 draw but tipped Spain to advance; Spain won outright.
  pick_home: 1,
  pick_away: 1,
  pick_winner: 'HOME_TEAM',
  actual_home: 2,
  actual_away: 0,
  actual_winner: 'HOME_TEAM',
  home_team_name: 'Spain',
  away_team_name: 'Argentina',
  home_flag: FLAG('es'),
  away_flag: FLAG('ar'),
  predicted_winner_name: 'Spain',
  predicted_correctly: true,
}

// Variant assembly ------------------------------------------------------------

function fullPayload(finalPick) {
  return {
    profile: baseProfile,
    rank: baseRank,
    stats: baseStats,
    best_match: baseBestMatch,
    longest_streak: baseStreak,
    final_pick: finalPick,
  }
}

export const SAMPLE_STATES = ['won', 'lost', 'draw', 'nofinal', 'lowengagement']

export function getSampleData(state) {
  switch (state) {
    case 'lost':
      return fullPayload(finalLost)
    case 'draw':
      return fullPayload(finalDraw)
    case 'nofinal':
      return fullPayload(null)
    case 'lowengagement':
      return {
        profile: baseProfile,
        rank: { final_rank: 812, total_users: 1085 },
        stats: { total_points: 12, exact_scores: 0, correct_results: 3, accuracy_pct: 25 },
        best_match: null,
        longest_streak: null,
        final_pick: null,
      }
    case 'won':
    default:
      return fullPayload(finalWon)
  }
}

// Reads ?state= from the URL, defaulting to 'won'.
export function stateFromUrl() {
  const state = new URLSearchParams(window.location.search).get('state')
  return SAMPLE_STATES.includes(state) ? state : 'won'
}
