# WC2026 Fantasy Archive

Snapshot of the WC2026 Fantasy app at end-of-tournament, kept as a reusable foundation for future tournaments (Euro 2028, Copa America 2028, and beyond).

## What this archive is for

Two purposes:

1. **Reference.** If Supabase or Vercel disappears, this folder has enough to reconstruct the schema and understand the architecture.
2. **Reusable kit.** In 2028 (or whenever the next tournament rolls around), this is the starting point. Clone the repo, swap the tournament-specific bits, redeploy.

## Folder contents

```
archive/
├── README.md                  this file
├── retrospective.md           what worked, what broke, what to do differently
├── architecture.md            data flow, tools, cost breakdown
├── final_stats.md             tournament snapshot (users, picks, results)
└── schema/                    all SQL objects, ordered for rebuild
    ├── 01_extensions.sql
    ├── 02_tables.sql
    ├── 03_functions.sql
    ├── 04_views.sql
    ├── 05_rls_policies.sql
    ├── 06_cron_jobs.sql
    └── seed_teams_wc2026.sql  reference only, swap per tournament
```

## Rebuilding for a new tournament

The high-level shape stays the same: teams, a fixture list, users making picks per match, points calculated on match finish, a live leaderboard, AI-generated pre-match briefs and post-match summaries. What changes per tournament is the data source, the fixture set, and the branding.

### Steps

1. **Fresh Supabase project.** Create it, note the URL and service key.
2. **Run schema files in order** (01 through 06) in the SQL editor. Skip `seed_teams_wc2026.sql` and seed the new tournament's teams instead.
3. **Fork or clone this repo.** Rename the project directory. Update `package.json` name and any hardcoded copy referencing "wc2026".
4. **Update the football data source.** football-data.org uses different competition codes per tournament (WC for World Cup, EC for Euros, CLI for Copa Libertadores, and so on). Update the API endpoint in `update_results.py` and `seed_matches.py`. Confirm the tournament is supported on the paid tier before committing to it.
5. **Update env vars in GitHub Actions and Vercel.** New Supabase URL, new service key, new football-data.org key if rotated.
6. **Reseed teams and matches.** Run the seeder script once teams are in.
7. **Update branding.** Logo, wordmark, font choices if you want to differentiate.
8. **Update the `matches.stage` values.** WC has GROUP_STAGE, LAST_32, LAST_16, QUARTER_FINALS, SEMI_FINALS, THIRD_PLACE, FINAL. Euros drop LAST_32 and THIRD_PLACE. Copa America has its own structure. Confirm the API's stage naming convention and update the scoring multiplier logic in `calculate_points` accordingly.

### Files to update per tournament

Roughly what changes vs stays.

**Changes:**
- Tournament name, dates, branding, favicon, logo
- Team list (seed table)
- Match list (from API seeder)
- Stage names and scoring multipliers if the tournament structure differs
- Competition code in the football-data.org API calls
- Domain, deployment target

**Stays as-is:**
- Schema (tables, functions, views)
- RLS policies
- Points calculation logic (base scoring + multiplier system)
- Frontend components (leaderboard, pick form, groups, AI briefs, Wrapped)
- Automation pattern (GHA + Python + Supabase RPC)
- Cost model

### Things to check before starting a new tournament build

1. **Is football-data.org still viable?** Check pricing, check that the competition is supported on the paid tier you can afford. Alternatives: sportsdata.io, api-sports.io.
2. **Is Anthropic API still the right AI provider?** Check pricing per token for the model you'd use.
3. **Are your dependency pins still needed?** The current pins (supabase==2.3.0, postgrest==0.13.2, httpx==0.24.1, anthropic==0.18.1) exist because of a JWT/Python compatibility issue that surfaced during WC2026. See retrospective.md. If Supabase has resolved that upstream, unpin and use current.
4. **Does the tournament format actually fit the app?** The app assumes group stage + single-elimination knockout with clear advancement. Formats with round-robin knockouts (Copa Libertadores group stage, some qualifiers) need scoring model adjustments.

## Not in this archive

- User data (picks, profiles, group memberships). Users own their picks. Stays in the Supabase DB and does not travel.
- Vault secrets. Never committed to a public location. Rotate for the new tournament.
- The `auth` schema. Supabase-managed, contains real user data.