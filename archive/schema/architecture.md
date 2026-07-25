# WC2026 Fantasy Architecture

System overview at end-of-tournament. Written for a version of me in 2028 who needs to reason about this again.

## Overview

A fantasy tipping app for the FIFA World Cup 2026. Users predict scores for each match. Points are awarded on match completion. Users compete on a global leaderboard and inside private groups they create or join.

Roughly 1,320 users, 264 private groups, 76,043 picks across 104 matches. Costs kept near zero through generous free tiers plus one paid API subscription.

## System diagram (words version)

```
[User's browser]
      |
      | HTTPS
      v
[Vercel: React/Vite frontend, wc2026fantasy.app]
      |
      | supabase-js client
      v
[Supabase]
   |-- Postgres (schema, tables, functions, views)
   |-- Realtime (WebSocket, pushes match/leaderboard updates)
   |-- Auth (Google OAuth)
   |-- pg_cron (scheduled DB tasks)
   |-- pg_net (HTTP calls from Postgres to GHA workflow_dispatch)
   |-- Vault (secrets: football-data key, anthropic key)
      ^
      | RPC (service key auth)
      |
[GitHub Actions: scheduled workflows]
   |-- update_results.yml (every 5 min during match windows)
   |-- seed_and_brief.yml (daily)
      |
      | HTTP
      v
[football-data.org API] (paid tier)
[Anthropic API]         (pay per token)
```

## Frontend

- React 18 + Vite
- Deployed on Vercel (free tier, custom domain wc2026fantasy.app)
- State: local component state + Supabase Realtime subscriptions for live data
- Auth: Google OAuth via Supabase Auth
- Styling: plain CSS with design tokens. Fonts: Syne for headings, DM Sans for body
- Key components: GlobalLeaderboard, GroupLeaderboard, MatchList, PickForm, AIBrief, WrappedModal, WrappedShareCard, KofiButton
- No router. View state managed via a `view` prop threaded through App. Path-based routes exist only for the internal Wrapped preview pages, dispatched from `main.jsx` on `window.location.pathname`.
- No PWA install prompt beyond browser-native "Add to Home Screen"

## Backend

- Supabase project on the free tier throughout
- Postgres with RLS enabled on every user-touching table
- Realtime enabled for `matches` and the leaderboard view for live score/rank updates
- pg_cron for internal scheduled jobs (e.g. triggering GHA workflows via pg_net)
- Vault for API keys used by DB-side jobs

### Key tables

- `profiles` - user profile, joins to Supabase Auth user id
- `teams` - the 48 tournament teams
- `matches` - all 104 matches, scores, status, winner, penalties
- `picks` - user predictions per match
- `groups` - private groups, unique join code
- `group_members` - many-to-many, users to groups
- `ai_briefs` - one row per match, holds pre-match brief and post-match summary

### Key functions

- `get_result(home, away)` - returns 'HOME_WIN', 'AWAY_WIN', or 'DRAW'
- `calculate_points(match_id_input)` - loops all picks for a match, writes `points_earned`. Idempotent.
- `get_user_wrapped_stats(user_uuid)` - returns JSON blob for the Wrapped modal

### Key views

- `leaderboard` - live-computed, joins picks + matches, aggregates per user with streaks and form. Not materialized.

## Data flow: match update path

1. GHA schedule fires `update_results.yml` every 5 minutes
2. Script `update_results.py` runs
3. Script exits early if no match is live or imminent (self-gating)
4. Otherwise calls football-data.org for all matches
5. For each returned match, diffs against DB state
6. If status/score/winner changed, writes update to `matches` table
7. If match transitioned to FINISHED (or winner just backfilled), calls `calculate_points(match_id)` RPC
8. Supabase Realtime pushes the `matches` row change to any connected client
9. Frontend re-renders leaderboard (fetch-on-demand, not Realtime)
10. Post-match summary generated via Anthropic API if not already present

## Data flow: pick submission path

1. User submits pick in `PickForm`
2. Frontend inserts/upserts row into `picks`
3. RLS checks: user owns the row, match is not locked (kickoff not passed)
4. Row committed
5. No scoring happens yet. Scoring happens when the match finishes and `calculate_points` runs.

## Data flow: AI brief generation

1. `seed_and_brief.yml` runs daily on a schedule
2. Script identifies upcoming matches without a pre-match brief
3. Calls Anthropic API with match context (teams, form, tournament stage)
4. Stores result in `ai_briefs.pre_match_brief`
5. Frontend fetches on match card render if `profiles.show_ai_briefs = true`

Post-match summaries follow the same pattern but are triggered by `update_results.py` when a match transitions to FINISHED.

## Automation

Two GHA workflows:

- **update_results.yml** - every 5 minutes. Self-gated to exit if nothing is live or imminent. This is the hot path.
- **seed_and_brief.yml** - daily. Seeds new matches from the API if fixtures update, generates missing pre-match briefs.

All scripts pin dependency versions in `requirements.txt` (see retrospective.md for why).

## External services

- **football-data.org** - paid tier `free_plus_livescores` at $22 AUD/month. Alternative in 2028: sportsdata.io, api-sports.io.
- **Anthropic Claude API** - AI briefs and summaries. Started on Claude Sonnet 4, migrated to Claude Sonnet 4.6 around mid-June. Sonnet 4.6 for the full tournament thereafter.
- **Google OAuth** - via Supabase Auth. Free.
- **Ko-fi** - tip jar. Embedded via custom KofiButton React modal.
- **Vercel** - hosting. Free tier throughout, no bandwidth issues.
- **GitHub Actions** - automation. Free tier for public repos.

## Cost breakdown

Approximate spend during the tournament. Anthropic API measured across 30 days of usage data (11 June to 11 July, roughly the tournament through group stage plus knockouts to semis). football-data.org billed monthly, so figure ~2 months over the full tournament run.

| Service | Tier | Cost |
|---|---|---|
| Supabase | Free | $0 |
| Vercel | Free | $0 |
| GitHub Actions | Free (public repo) | $0 |
| Google OAuth | Free | $0 |
| football-data.org | free_plus_livescores | $22 AUD/month |
| Anthropic API | Pay-per-use | ~$5.62 USD across 30 days measured |
| Domain (wc2026fantasy.app) | Yearly | $12 AUD |
| **Approximate total** | | **~$55 - $60 AUD for the full tournament** |

Anthropic breakdown of the ~$5.62:
- LLM tokens (input + output): ~$3.92
- Web search (used by briefs for team context): ~$1.70

For 1,320 users and 104 matches, the AI feature was effectively free. Do it again without hesitation.

## Reliability notes

- Supabase free tier had no reliability issues during the tournament
- Vercel had no downtime that affected users
- GHA scheduled workflows were occasionally delayed by several minutes under load (see retrospective.md, GHA cron 5-minute minimum). Mitigated by pg_cron trigger pattern later in the tournament.
- football-data.org had no outages
- Anthropic API had no outages

## Security posture

- Every user-facing table has RLS enabled
- Service key never exposed to the frontend. Only used from GHA runners and edge functions.
- Secrets in Vault, GHA repo secrets, and Vercel env vars. Never committed.
- No user data leaves Supabase.
- Legacy JWT keys temporarily re-enabled during the tournament (tech debt, see retrospective).